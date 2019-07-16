pragma solidity ^0.4.25;

import "./ZkDai.sol";


contract ZkDex is ZkDai {

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

  constructor(bool _development, address _dai) ZkDai(_development, _dai) public {}

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
    uint256[2] a,
    uint256[2] a_p,
    uint256[2][2] b,
    uint256[2] b_p,
    uint256[2] c,
    uint256[2] c_p,
    uint256[2] h,
    uint256[2] k,
    uint256[4] input
  ) external {
    // TODO: verify circuit:makeOrder

    bytes32 makerNote = calcHash(input[0], input[1]);

    require(input[2] != targetToken, "ZkDex: cannot make an order with same token pair");
    require(notes[makerNote] == State.Committed, "ZkDex: maker note is not available");

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
   *  - [3, 4]  = taker note to maker note hash
   *  - [5]     = taker note to maker type
   *  - [6, 7]  = owner of taker note to maker (== maker note)
   *
   *  - [8]     = output
   */
   function takeOrder(
    uint256 orderId,
    uint256[2] a,
    uint256[2] a_p,
    uint256[2][2] b,
    uint256[2] b_p,
    uint256[2] c,
    uint256[2] c_p,
    uint256[2] h,
    uint256[2] k,
    uint256[9] input
  ) external {
    // TODO: verify circuit:takerOrder

    Order storage order = orders[orderId];

    require(order.state == OrderState.Created);

    require(order.sourceToken == input[2], "ZkDex: source token mismatch");
    require(order.targetToken == input[5], "ZkDex: target token mismatch");
    require(order.makerNote == calcHash(input[6], input[7]), "ZkDex: owner of taker note to maker mismatch");

    bytes32 parentNote = calcHash(input[0], input[1]);
    bytes32 takerNoteToMaker = calcHash(input[3], input[4]);

    require(notes[parentNote] == State.Committed, "ZkDex: taker note is not available");
    require(notes[takerNoteToMaker] == State.Invalid, "ZkDex: taker send valid note to maker");

    notes[parentNote] = State.Traiding;
    notes[takerNoteToMaker] = State.Traiding;

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
   *  - [6, 7]  = owner of taker note to maker (maker note)
   *
   *  - [8, 9]  = reward note hash
   *  - [10]    = reward note type
   *  - [11, 12]= owner of reward note (parent note (for taker))
   *
   *  - [13, 14]= payment note hash
   *  - [15]    = payment note type
   *  - [16, 17]= owner of payment note (maker note (for maker))
   *
   *  - [18, 19]= change note hash
   *  - [20]    = change note type
   *
   *  - [21]    = price
   *
   *  - [22]     = output
   */
  function settleOrder(
    uint256 orderId,
    uint256[2] a,
    uint256[2] a_p,
    uint256[2][2] b,
    uint256[2] b_p,
    uint256[2] c,
    uint256[2] c_p,
    uint256[2] h,
    uint256[2] k,
    uint256[23] input
  ) external {
    // TODO: verify circuit:settleOrder

    Order storage order = orders[orderId];

    require(order.makerNote == calcHash(input[0], input[1]), "ZkDex: maker note mismatch");
    require(order.sourceToken == input[2], "ZkDex: source token mismatch");
    require(order.takerNoteToMaker == calcHash(input[3], input[4]), "ZkDex: taker note to maker mismatch");
    require(order.targetToken == input[5], "ZkDex: target token mismatch");
    require(order.makerNote == calcHash(input[6], input[7]), "ZkDex: owner of taker note to maker mismatch");

    require(order.sourceToken == input[10], "ZkDex: reward token type mismatch");
    require(order.parentNote == calcHash(input[11], input[12]), "ZkDex: owner of reward note mismatch");
    require(order.targetToken == input[15], "ZkDex: payment token type mismatch");
    require(order.makerNote == calcHash(input[16], input[17]), "ZkDex: owner of payment note mismatch");

    require(order.price == input[21], "ZkDex: order price mismatch");

    require(order.state == OrderState.Taken, "ZkDex: order cannot be settled");

    bytes32 rewardNote = calcHash(input[8], input[9]);
    bytes32 paymentNote = calcHash(input[13], input[14]);
    bytes32 changeNote = calcHash(input[18], input[19]);

    require(notes[rewardNote] == State.Invalid, "ZkDex: reward note must be invalid");
    require(notes[paymentNote] == State.Invalid, "ZkDex: payment note must be invalid");
    require(notes[changeNote] == State.Invalid, "ZkDex: change note must be invalid");

    notes[rewardNote] = State.Committed;
    notes[paymentNote] = State.Committed;
    notes[changeNote] = State.Committed;

    notes[order.makerNote] = State.Spent;
    notes[order.parentNote] = State.Spent;
    notes[order.takerNoteToMaker] = State.Spent;

    order.state = OrderState.Settled;

    emit NoteStateChange(rewardNote, State.Committed);
    emit NoteStateChange(paymentNote, State.Committed);
    emit NoteStateChange(changeNote, State.Committed);

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
}

