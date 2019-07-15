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
  event OrderSettled(uint256 orderId, bytes32 newNoteToMaker, bytes32 newNoteToTaker, bytes32 changeNote);

  constructor(bool _development, address _dai) ZkDai(_development, _dai) public {}

  /**
   * order input
   *  - [0]     = makerViewingKey
   *  - [0]     = targetToken
   *  - [0]     = price
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

  function takeOrder(
    uint256 orderId,
    bytes32 takerNoteToMaker,
    bytes32 parentNote
  ) external {
    // TODO: verify circuit:takerOrder

    Order storage order = orders[orderId];

    require(order.state == OrderState.Created);
    require(notes[parentNote] == State.Committed, "ZkDex: taker note is not available");
    require(notes[takerNoteToMaker] == State.Invalid, "ZkDex: taker send invalid note to maker");

    notes[parentNote] = State.Traiding;
    notes[takerNoteToMaker] = State.Traiding;

    order.takerNoteToMaker = takerNoteToMaker;
    order.parentNote = parentNote;

    order.state = OrderState.Taken;

    emit NoteStateChange(parentNote, State.Traiding);
    emit NoteStateChange(takerNoteToMaker, State.Traiding);
    emit OrderTaken(orderId, takerNoteToMaker, parentNote);
  }

  function settleOrder(
    uint256 orderId,
    bytes32 newNoteToMaker,
    bytes32 newNoteToTaker,
    bytes32 changeNote
  ) external {
    // TODO: verify circuit:settleOrder

    Order storage order = orders[orderId];

    require(order.state == OrderState.Taken);

    require(notes[newNoteToMaker] == State.Invalid, "ZkDex: newNoteToMaker is invalid");
    require(notes[newNoteToTaker] == State.Invalid, "ZkDex: newNoteToTaker is invalid");
    require(notes[changeNote] == State.Invalid, "ZkDex: changeNote is invalid");

    notes[newNoteToMaker] = State.Committed;
    notes[newNoteToTaker] = State.Committed;
    notes[changeNote] = State.Committed;

    emit NoteStateChange(newNoteToMaker, State.Committed);
    emit NoteStateChange(newNoteToTaker, State.Committed);
    emit NoteStateChange(changeNote, State.Committed);

    order.state = OrderState.Settled;

    emit OrderSettled(orderId, newNoteToMaker, newNoteToTaker, changeNote);
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

