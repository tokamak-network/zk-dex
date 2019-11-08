pragma solidity ^0.5.0;

import {mintNBurnNote_Verifier as MintNoteVerifier} from "./verifiers/mintNBurnNote_Verifier.sol";
import {transferNote_Verifier as SpendNoteVerifier} from "./verifiers/transferNote_Verifier.sol";
import {makeOrder_Verifier as MakeOrderVerifier} from "./verifiers/makeOrder_Verifier.sol";
import {takeOrder_Verifier as TakeOrderVerifier} from "./verifiers/takeOrder_Verifier.sol";
import {settleOrder_Verifier as SettleOrderVerifier} from "./verifiers/settleOrder_Verifier.sol";

import "./ZkDai.sol";
import "./RLPReader.sol";

contract ZkDex is ZkDai {
  using RLPReader for *;

  MakeOrderVerifier public makeOrderVerifier;
  TakeOrderVerifier public takeOrderVerifier;
  SettleOrderVerifier public settleOrderVerifier;

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
    MintNoteVerifier _mintNoteVerifier,
    SpendNoteVerifier _spendNoteVerifier,
    MakeOrderVerifier _makeOrderVerifier,
    TakeOrderVerifier _takeOrderVerifier,
    SettleOrderVerifier _settleOrderVerifier
  )
    public
    ZkDai(_development, _dai, _mintNoteVerifier, _spendNoteVerifier)
  {
    makeOrderVerifier = _makeOrderVerifier;
    takeOrderVerifier = _takeOrderVerifier;
    settleOrderVerifier = _settleOrderVerifier;
  }

  /**
   * zk-SNARK public input
   *  - [0, 1]  = maker note hash
   *  - [2]     = maker note type
   *  - [3]     = output
   */
  function makeOrder(
    bytes32 makerViewingKey,
    uint256 targetToken,
    uint price,
    uint256[2] calldata a,
    uint256[2] calldata a_p,
    uint256[2][2] calldata b,
    uint256[2] calldata b_p,
    uint256[2] calldata c,
    uint256[2] calldata c_p,
    uint256[2] calldata h,
    uint256[2] calldata k,
    uint256[4] calldata input
  ) external {
    require(development || makeOrderVerifier.verifyTx(a, a_p, b, b_p, c, c_p, h, k, input), "Failed to verify make order circuit");

    bytes32 makerNote = calcHash(input[0], input[1]);

    require(input[2] != targetToken, "ZkDex: cannot make an order with same token pair");
    require(notes[makerNote] == State.Valid, "ZkDex: maker note is not available");

    uint orderId = orders.length++;
    Order storage order = orders[orderId];

    order.makerViewingKey = makerViewingKey;
    order.makerNote = makerNote;
    order.sourceToken = input[2];
    order.targetToken = targetToken;
    order.price = price;
    order.state = OrderState.Created;

    notes[makerNote] = State.Traiding;

    emit NoteStateChange(makerNote, State.Traiding);

    // NOTE: cannot compile below line due to stack too deep error..
    // emit OrderCreated(orderId, input[2], targetToken);
  }



  /**
   * zk-SNARK public input
   *  - [0, 1]  = parent note hash
   *  - [2]     = parent note type
   *
   *  - [3, 4]  = taker note to maker note hash (staking note)
   *  - [5]     = taker note to maker type
   *  - [6, 7]  = owner of taker note to maker (== maker note)
   *
   *  - [8]     = output
   */
   function takeOrder(
    uint256 orderId,
    uint256[2] calldata a,
    uint256[2] calldata a_p,
    uint256[2][2] calldata b,
    uint256[2] calldata b_p,
    uint256[2] calldata c,
    uint256[2] calldata c_p,
    uint256[2] calldata h,
    uint256[2] calldata k,
    uint256[9] calldata input,
    bytes calldata encryptedStakingNote
  ) external {
    require(development || takeOrderVerifier.verifyTx(a, a_p, b, b_p, c, c_p, h, k, input), "Failed to verify take order circuit");

    Order storage order = orders[orderId];

    require(order.state == OrderState.Created);

    require(order.targetToken == input[2], "ZkDex: parent note token type mismatch");
    require(order.targetToken == input[5], "ZkDex: staking note token type mismatch");
    require(order.makerNote == calcHash(input[6], input[7]), "ZkDex: owner of taker note to maker mismatch");

    bytes32 parentNote = calcHash(input[0], input[1]);
    bytes32 takerNoteToMaker = calcHash(input[3], input[4]);

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
   * zk-SNARK public input
   *  - [0, 1]  = maker note hash
   *  - [2]     = maker note type
   *
   *  - [3, 4]  = taker note to maker note hash
   *  - [5]     = taker note to maker type
   *
   *  - [6, 7]  = reward note hash
   *  - [8]    = reward note type
   *  - [9, 10]= owner of reward note (parent note (for taker))
   *
   *  - [11, 12]= payment note hash
   *  - [13]    = payment note type
   *  - [14, 15]= owner of payment note (maker note (for maker))
   *
   *  - [16, 17]= change note hash
   *  - [18]    = change note type
   *
   *  - [19]    = price
   *
   *  - [20]    = output
   */
  function settleOrder(
    uint256 orderId,
    uint256[2] calldata a,
    uint256[2] calldata a_p,
    uint256[2][2] calldata b,
    uint256[2] calldata b_p,
    uint256[2] calldata c,
    uint256[2] calldata c_p,
    uint256[2] calldata h,
    uint256[2] calldata k,
    uint256[21] calldata input,

    bytes calldata encDatas // [encryptedRewardNote, encryptedPaymentNote, encryptedChangeNote]
  ) external {
    require(development || settleOrderVerifier.verifyTx(a, a_p, b, b_p, c, c_p, h, k, input), "Failed to verify settle order circuit");

    Order storage order = orders[orderId];

    require(order.makerNote == calcHash(input[0], input[1]), "ZkDex: maker note mismatch");
    require(order.sourceToken == input[2], "ZkDex: source token mismatch");
    require(order.takerNoteToMaker == calcHash(input[3], input[4]), "ZkDex: taker note to maker mismatch");
    require(order.targetToken == input[5], "ZkDex: target token mismatch");

    require(order.sourceToken == input[8], "ZkDex: reward token type mismatch");
    require(order.parentNote == calcHash(input[9], input[10]), "ZkDex: owner of reward note mismatch");
    require(order.targetToken == input[13], "ZkDex: payment token type mismatch");
    require(order.makerNote == calcHash(input[14], input[15]), "ZkDex: owner of payment note mismatch");

    require(order.price == input[19], "ZkDex: order price mismatch");

    require(order.state == OrderState.Taken, "ZkDex: order cannot be settled");


    require(notes[calcHash(input[6], input[7])] == State.Invalid, "ZkDex: reward note must be invalid");
    require(notes[calcHash(input[11], input[12])] == State.Invalid, "ZkDex: payment note must be invalid");
    require(notes[calcHash(input[16], input[17])] == State.Invalid, "ZkDex: change note must be invalid");

    notes[calcHash(input[6], input[7])] = State.Valid;
    notes[calcHash(input[11], input[12])] = State.Valid;
    notes[calcHash(input[16], input[17])] = State.Valid;

    notes[order.makerNote] = State.Spent;
    notes[order.parentNote] = State.Spent;
    notes[order.takerNoteToMaker] = State.Spent;

    RLPReader.RLPItem[] memory encList = encDatas.toRlpItem().toList();

    encryptedNotes[calcHash(input[6], input[7])] = encList[0].toBytes();
    encryptedNotes[calcHash(input[11], input[12])] = encList[1].toBytes();
    encryptedNotes[calcHash(input[16], input[17])] = encList[2].toBytes();

    order.state = OrderState.Settled;

    emit NoteStateChange(calcHash(input[6], input[7]), State.Valid);
    emit NoteStateChange(calcHash(input[11], input[12]), State.Valid);
    emit NoteStateChange(calcHash(input[16], input[17]), State.Valid);

    emit NoteStateChange(order.makerNote, State.Spent);
    emit NoteStateChange(order.parentNote, State.Spent);
    emit NoteStateChange(order.takerNoteToMaker, State.Spent);

    emit OrderSettled(orderId, calcHash(input[6], input[7]), calcHash(input[11], input[12]), calcHash(input[16], input[17]));
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