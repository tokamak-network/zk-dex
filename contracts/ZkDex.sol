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
   * zk-SNARK public input (Groth16/snarkjs format - Poseidon version)
   *  - [0] = output (always 1 for valid proof)
   *  - [1] = smart note hash (single field element)
   *  - [2] = original note hash (smart note's owner)
   *  - [3] = new note hash (converted normal note)
   */
   function convertNote(
    uint256[2] calldata a,
    uint256[2][2] calldata b,
    uint256[2] calldata c,
    uint256[4] calldata input,
    bytes calldata encryptedNote
  ) external {
    require(development || convertNoteVerifier.verifyProof(a, b, c, input), "Failed to verify circuit");

    bytes32 smartNote = bytes32(input[1]);
    bytes32 originalNote = bytes32(input[2]);
    bytes32 newNote = bytes32(input[3]);

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
   * zk-SNARK public input (Groth16/snarkjs format - Poseidon version)
   *  - [0] = output (always 1 for valid proof)
   *  - [1] = maker note hash (single field element)
   *  - [2] = maker note type
   */
  function makeOrder(
    bytes32 makerViewingKey,
    uint256 targetToken,
    uint price,
    uint256[2] calldata a,
    uint256[2][2] calldata b,
    uint256[2] calldata c,
    uint256[3] calldata input
  ) external {
    require(development || makeOrderVerifier.verifyProof(a, b, c, input), "Failed to verify make order circuit");

    bytes32 makerNote = bytes32(input[1]);

    require(input[2] != targetToken, "ZkDex: cannot make an order with same token pair");
    require(notes[makerNote] == State.Valid, "ZkDex: maker note is not available");

    uint orderId = orders.length;
    orders.push();
    Order storage order = orders[orderId];

    order.makerViewingKey = makerViewingKey;
    order.makerNote = makerNote;
    order.sourceToken = input[2];
    order.targetToken = targetToken;
    order.price = price;
    order.state = OrderState.Created;

    notes[makerNote] = State.Traiding;

    emit NoteStateChange(makerNote, State.Traiding);
  }



  /**
   * zk-SNARK public input (Groth16/snarkjs format - Poseidon version)
   *  - [0] = output (always 1 for valid proof)
   *  - [1] = parent note hash (oldNoteHash)
   *  - [2] = parent note type (oldType)
   *  - [3] = stake note hash (newNoteHash)
   *  - [4] = stake note owner address (160-bit, truncated from maker note hash)
   *  - [5] = stake note type (newType)
   */
   function takeOrder(
    uint256 orderId,
    uint256[2] calldata a,
    uint256[2][2] calldata b,
    uint256[2] calldata c,
    uint256[6] calldata input,
    bytes calldata encryptedStakingNote
  ) external {
    require(development || takeOrderVerifier.verifyProof(a, b, c, input), "Failed to verify take order circuit");

    Order storage order = orders[orderId];

    require(order.state == OrderState.Created);

    require(order.targetToken == input[2], "ZkDex: parent note token type mismatch");
    require(order.targetToken == input[5], "ZkDex: stake note token type mismatch");
    // Verify stake note owner == truncated maker note hash (last 160 bits)
    require(uint160(uint256(order.makerNote)) == input[4], "ZkDex: owner of taker note to maker mismatch");

    bytes32 parentNote = bytes32(input[1]);
    bytes32 takerNoteToMaker = bytes32(input[3]);

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
   * zk-SNARK public input (Groth16/snarkjs format - Poseidon version)
   *  - [0]  = output (always 1 for valid proof)
   *  - [1]  = maker note hash (o0Hash)
   *  - [2]  = maker note type (o0Type)
   *  - [3]  = taker stake note hash (o1Hash)
   *  - [4]  = taker stake note type (o1Type)
   *  - [5]  = reward note hash (n0Hash)
   *  - [6]  = reward note owner (160-bit, truncated parent note hash)
   *  - [7]  = reward note type (n0Type)
   *  - [8]  = payment note hash (n1Hash)
   *  - [9]  = payment note owner (160-bit, truncated maker note hash)
   *  - [10] = payment note type (n1Type)
   *  - [11] = change note hash (n2Hash)
   *  - [12] = change note type (n2Type)
   *  - [13] = price
   */
  function settleOrder(
    uint256 orderId,
    uint256[2] calldata a,
    uint256[2][2] calldata b,
    uint256[2] calldata c,
    uint256[14] calldata input,

    bytes calldata encDatas // [encryptedRewardNote, encryptedPaymentNote, encryptedChangeNote]
  ) external {
    require(development || settleOrderVerifier.verifyProof(a, b, c, input), "Failed to verify settle order circuit");

    Order storage order = orders[orderId];

    require(order.makerNote == bytes32(input[1]), "ZkDex: maker note mismatch");
    require(order.sourceToken == input[2], "ZkDex: source token mismatch");
    require(order.takerNoteToMaker == bytes32(input[3]), "ZkDex: taker note to maker mismatch");
    require(order.targetToken == input[4], "ZkDex: target token mismatch");

    require(order.sourceToken == input[7], "ZkDex: reward token type mismatch");
    // Verify reward note owner == truncated parent note hash (160-bit)
    require(uint160(uint256(order.parentNote)) == input[6], "ZkDex: owner of reward note mismatch");
    require(order.targetToken == input[10], "ZkDex: payment token type mismatch");
    // Verify payment note owner == truncated maker note hash (160-bit)
    require(uint160(uint256(order.makerNote)) == input[9], "ZkDex: owner of payment note mismatch");

    require(order.price == input[13], "ZkDex: order price mismatch");

    require(order.state == OrderState.Taken, "ZkDex: order cannot be settled");

    bytes32 rewardNote = bytes32(input[5]);
    bytes32 paymentNote = bytes32(input[8]);
    bytes32 changeNote = bytes32(input[11]);

    require(notes[rewardNote] == State.Invalid, "ZkDex: reward note must be invalid");
    require(notes[paymentNote] == State.Invalid, "ZkDex: payment note must be invalid");
    require(notes[changeNote] == State.Invalid, "ZkDex: change note must be invalid");

    notes[rewardNote] = State.Valid;
    notes[paymentNote] = State.Valid;
    notes[changeNote] = State.Valid;

    notes[order.makerNote] = State.Spent;
    notes[order.parentNote] = State.Spent;
    notes[order.takerNoteToMaker] = State.Spent;

    RLPReader.RLPItem[] memory encList = encDatas.toRlpItem().toList();

    encryptedNotes[rewardNote] = encList[0].toBytes();
    encryptedNotes[paymentNote] = encList[1].toBytes();
    encryptedNotes[changeNote] = encList[2].toBytes();

    order.state = OrderState.Settled;

    emit NoteStateChange(rewardNote, State.Valid);
    emit NoteStateChange(paymentNote, State.Valid);
    emit NoteStateChange(changeNote, State.Valid);

    emit NoteStateChange(order.makerNote, State.Spent);
    emit NoteStateChange(order.parentNote, State.Spent);
    emit NoteStateChange(order.takerNoteToMaker, State.Spent);

    emit OrderSettled(orderId, rewardNote, paymentNote, changeNote);
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
