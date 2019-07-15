pragma solidity ^0.4.25;

import "./ZkDai.sol";


contract ZkDex is ZkDai {

  enum OrderState {Created, Taken, Settled}

  struct Order {
    bytes32 makerViewingKey;
    bytes32 makerNote;
    bytes32 sourceToken;
    bytes32 targetToken;
    uint price;
    bytes32 takerNoteToMaker;
    bytes32 parentNote;

    OrderState state;
  }

  mapping(bytes32 => Order) public orders;

  event OrderCreated(bytes32 orderHash, bytes32 indexed sourceToken, bytes32 indexed targetToken, uint price);
  event OrderTaken(bytes32 orderHash, bytes32 takerNoteToMaker, bytes32 parentNote);
  event OrderSettled(bytes32 newNoteToMaker, bytes32 newNoteToTaker, bytes32 changeNote);

  constructor(bool _development, address _dai) ZkDai(_development, _dai) public {}

  function makeOrder(
    bytes32 makerViewingKey,
    bytes32 makerNote,
    bytes32 sourceToken,
    bytes32 targetToken,
    uint price
  ) external {
    // TODO: verify circuit:makeOrder

    require(sourceToken != targetToken, "ZkDex: cannot make an order with same token pair");
    require(notes[makerNote] == State.Committed, "ZkDex: maker note is not available");

    // TODO: instnatiate with zk-SNARK proofs
    Order memory order = Order({
      makerViewingKey: makerViewingKey,
      makerNote: makerNote,
      sourceToken: sourceToken,
      targetToken: targetToken,
      price: price,
      takerNoteToMaker: 0x00,
      parentNote: 0x00,
      state: OrderState.Created
    });

    bytes32 orderHash = hashOrder(order);

    orders[orderHash] = order;
    notes[makerNote] = State.Traiding;

    emit NoteStateChange(makerNote, State.Traiding);
    emit OrderCreated(orderHash, sourceToken, targetToken, price);
  }

  function takeOrder(
    bytes32 orderHash,
    bytes32 takerNoteToMaker,
    bytes32 parentNote
  ) external {
    // TODO: verify circuit:takerOrder

    Order storage order = orders[orderHash];

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
    emit OrderTaken(orderHash, takerNoteToMaker, parentNote);
  }

  function settleOrder(
    bytes32 orderHash,
    bytes32 newNoteToMaker,
    bytes32 newNoteToTaker,
    bytes32 changeNote
  ) external {
    // TODO: verify circuit:settleOrder

    Order storage order = orders[orderHash];

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

    emit OrderSettled(newNoteToMaker, newNoteToTaker, changeNote);
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

