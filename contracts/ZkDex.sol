// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IMintNBurnNoteVerifier, ITransferNoteVerifier, IConvertNoteVerifier, IMakeOrderVerifier, ITakeOrderVerifier, ISettleOrderVerifier} from "./verifiers/IGroth16Verifier.sol";

import "./ZkDai.sol";
import "./RLPReader.sol";

contract ZkDex is ZkDai {
  using RLPReader for bytes;
  using RLPReader for RLPReader.RLPItem;

  IConvertNoteVerifier public convertNoteVerifier;
  IMakeOrderVerifier public makeOrderVerifier;
  ITakeOrderVerifier public takeOrderVerifier;
  ISettleOrderVerifier public settleOrderVerifier;

  enum OrderState {Created, Taken, Settled}

  struct Order {
    bytes32 makerViewingKey;
    bytes32 makerNote;
    uint256 sourceToken;
    uint256 targetToken;
    uint256 price;
    bytes32 takerNoteToMaker;
    bytes32 parentNote;

    OrderState state;
  }

  Order[] public orders;

  event OrderCreated(uint256 orderId, uint256 sourceToken, uint256 targetToken);
  event OrderTaken(uint256 orderId, bytes32 takerNoteToMaker, bytes32 parentNote);
  event OrderSettled(uint256 orderId, bytes32 rewardNote, bytes32 paymentNote, bytes32 changeNote);

  constructor(
    bool _development,
    address _dai,
    IMintNBurnNoteVerifier _mintNoteVerifier,
    ITransferNoteVerifier _spendNoteVerifier,
    IConvertNoteVerifier _convertNoteVerifier,
    IMakeOrderVerifier _makeOrderVerifier,
    ITakeOrderVerifier _takeOrderVerifier,
    ISettleOrderVerifier _settleOrderVerifier
  )
    ZkDai(_development, _dai, _mintNoteVerifier, _spendNoteVerifier)
  {
    convertNoteVerifier = _convertNoteVerifier;
    makeOrderVerifier = _makeOrderVerifier;
    takeOrderVerifier = _takeOrderVerifier;
    settleOrderVerifier = _settleOrderVerifier;
  }

  /**
   * zk-SNARK public input (Groth16/snarkjs format - outputs come first)
   *  - [0]     = output (always 1 for valid proof)
   *  - [1, 2]  = smart note hash
   *  - [3, 4]  = original note hash (smart note's owner)
   *  - [5, 6]  = new note hash (converted normal note)
   */
   function convertNote(
    uint256[2] calldata a,
    uint256[2][2] calldata b,
    uint256[2] calldata c,
    uint256[7] calldata input,
    bytes calldata encryptedNote
  ) external {
    require(development || convertNoteVerifier.verifyProof(a, b, c, input), "Failed to verify circuit");

    bytes32 smartNote = calcHash(input[1], input[2]);
    bytes32 originalNote = calcHash(input[3], input[4]);
    bytes32 newNote = calcHash(input[5], input[6]);

    require(notes[smartNote] == State.Valid, "Smart note cannot be converted");
    require(notes[originalNote] != State.Invalid, "Original note doesn't exist");
    require(notes[newNote] == State.Invalid, "New note was already mint");

    notes[smartNote] = State.Invalid;
    notes[newNote] = State.Valid;

    encryptedNotes[newNote] = encryptedNote;

    emit NoteStateChange(smartNote, State.Invalid);
    emit NoteStateChange(newNote, State.Valid);
  }

  /**
   * zk-SNARK public input (Groth16/snarkjs format - outputs come first)
   *  - [0]     = output (always 1 for valid proof)
   *  - [1, 2]  = maker note hash
   *  - [3]     = maker note type
   */
  function makeOrder(
    bytes32 makerViewingKey,
    uint256 targetToken,
    uint price,
    uint256[2] calldata a,
    uint256[2][2] calldata b,
    uint256[2] calldata c,
    uint256[4] calldata input
  ) external {
    require(development || makeOrderVerifier.verifyProof(a, b, c, input), "Failed to verify make order circuit");

    bytes32 makerNote = calcHash(input[1], input[2]);

    require(input[3] != targetToken, "ZkDex: cannot make an order with same token pair");
    require(notes[makerNote] == State.Valid, "ZkDex: maker note is not available");

    uint orderId = orders.length;
    orders.push();
    Order storage order = orders[orderId];

    order.makerViewingKey = makerViewingKey;
    order.makerNote = makerNote;
    order.sourceToken = input[3];
    order.targetToken = targetToken;
    order.price = price;
    order.state = OrderState.Created;

    notes[makerNote] = State.Traiding;

    emit NoteStateChange(makerNote, State.Traiding);

    // NOTE: cannot compile below line due to stack too deep error..
    // emit OrderCreated(orderId, input[2], targetToken);
  }



  /**
   * zk-SNARK public input (Groth16/snarkjs format - outputs come first)
   *  - [0]     = output (always 1 for valid proof)
   *  - [1, 2]  = parent note hash
   *  - [3]     = parent note type
   *
   *  - [4, 5]  = taker note to maker note hash (stake note)
   *  - [6, 7]  = owner of taker note to maker (== maker note)
   *  - [8]     = taker note to maker type
   */
   function takeOrder(
    uint256 orderId,
    uint256[2] calldata a,
    uint256[2][2] calldata b,
    uint256[2] calldata c,
    uint256[9] calldata input,
    bytes calldata encryptedStakingNote
  ) external {
    require(development || takeOrderVerifier.verifyProof(a, b, c, input), "Failed to verify take order circuit");

    Order storage order = orders[orderId];

    require(order.state == OrderState.Created);

    require(order.targetToken == input[3], "ZkDex: parent note token type mismatch");
    require(order.targetToken == input[8], "ZkDex: stake note token type mismatch");
    require(order.makerNote == calcHash(input[6], input[7]), "ZkDex: owner of taker note to maker mismatch");

    bytes32 parentNote = calcHash(input[1], input[2]);
    bytes32 takerNoteToMaker = calcHash(input[4], input[5]);

    require(notes[parentNote] == State.Valid, "ZkDex: taker note is not available");
    require(notes[takerNoteToMaker] == State.Invalid, "ZkDex: taker send valid note to maker");

    notes[parentNote] = State.Traiding;
    notes[takerNoteToMaker] = State.Traiding;

    encryptedNotes[takerNoteToMaker] = encryptedStakingNote;

    order.parentNote = parentNote;
    order.takerNoteToMaker = takerNoteToMaker;
    order.state = OrderState.Taken;

    emit NoteStateChange(parentNote, State.Traiding);
    emit NoteStateChange(takerNoteToMaker, State.Traiding);
    emit OrderTaken(orderId, takerNoteToMaker, parentNote);
  }

  /**
   * zk-SNARK public input (Groth16/snarkjs format - outputs come first)
   *  - [0]     = output (always 1 for valid proof)
   *  - [1, 2]  = maker note hash
   *  - [3]     = maker note type
   *
   *  - [4, 5]  = taker note to maker note hash
   *  - [6]     = taker note to maker type
   *
   *  - [7, 8]  = reward note hash
   *  - [9, 10] = owner of reward note (parent note (for taker))
   *  - [11]    = reward note type
   *
   *  - [12, 13]= payment note hash
   *  - [14, 15]= owner of payment note (maker note (for maker))
   *  - [16]    = payment note type
   *
   *  - [17, 18]= change note hash
   *  - [19]    = change note type
   *
   *  - [20]    = price
   */
  function settleOrder(
    uint256 orderId,
    uint256[2] calldata a,
    uint256[2][2] calldata b,
    uint256[2] calldata c,
    uint256[21] calldata input,

    bytes calldata encDatas // [encryptedRewardNote, encryptedPaymentNote, encryptedChangeNote]
  ) external {
    require(development || settleOrderVerifier.verifyProof(a, b, c, input), "Failed to verify settle order circuit");

    Order storage order = orders[orderId];

    require(order.makerNote == calcHash(input[1], input[2]), "ZkDex: maker note mismatch");
    require(order.sourceToken == input[3], "ZkDex: source token mismatch");
    require(order.takerNoteToMaker == calcHash(input[4], input[5]), "ZkDex: taker note to maker mismatch");
    require(order.targetToken == input[6], "ZkDex: target token mismatch");

    require(order.sourceToken == input[11], "ZkDex: reward token type mismatch");
    require(order.parentNote == calcHash(input[9], input[10]), "ZkDex: owner of reward note mismatch");
    require(order.targetToken == input[16], "ZkDex: payment token type mismatch");
    require(order.makerNote == calcHash(input[14], input[15]), "ZkDex: owner of payment note mismatch");

    require(order.price == input[20], "ZkDex: order price mismatch");

    require(order.state == OrderState.Taken, "ZkDex: order cannot be settled");


    require(notes[calcHash(input[7], input[8])] == State.Invalid, "ZkDex: reward note must be invalid");
    require(notes[calcHash(input[12], input[13])] == State.Invalid, "ZkDex: payment note must be invalid");
    require(notes[calcHash(input[17], input[18])] == State.Invalid, "ZkDex: change note must be invalid");

    notes[calcHash(input[7], input[8])] = State.Valid;
    notes[calcHash(input[12], input[13])] = State.Valid;
    notes[calcHash(input[17], input[18])] = State.Valid;

    notes[order.makerNote] = State.Spent;
    notes[order.parentNote] = State.Spent;
    notes[order.takerNoteToMaker] = State.Spent;

    RLPReader.RLPItem[] memory encList = encDatas.toRlpItem().toList();

    encryptedNotes[calcHash(input[7], input[8])] = encList[0].toBytes();
    encryptedNotes[calcHash(input[12], input[13])] = encList[1].toBytes();
    encryptedNotes[calcHash(input[17], input[18])] = encList[2].toBytes();

    order.state = OrderState.Settled;

    emit NoteStateChange(calcHash(input[7], input[8]), State.Valid);
    emit NoteStateChange(calcHash(input[12], input[13]), State.Valid);
    emit NoteStateChange(calcHash(input[17], input[18]), State.Valid);

    emit NoteStateChange(order.makerNote, State.Spent);
    emit NoteStateChange(order.parentNote, State.Spent);
    emit NoteStateChange(order.takerNoteToMaker, State.Spent);

    emit OrderSettled(orderId, calcHash(input[7], input[8]), calcHash(input[12], input[13]), calcHash(input[17], input[18]));
  }

  function hashOrder(Order memory order) internal view returns (bytes32) {
    return keccak256(abi.encode(
      order.makerViewingKey,
      order.makerNote,
      order.sourceToken,
      order.targetToken,
      order.price
    ));
  }

  function getOrderCount() public view returns (uint256) {
    return orders.length;
  }
}
