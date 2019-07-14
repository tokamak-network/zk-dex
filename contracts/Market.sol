pragma solidity ^0.5.0;

import "./ZkDai.sol";


contract Market is ZkDai {

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

  event OrderCreated(bytes32 orderHash, bytes32 indexed sourceToken, bytes32 indexed  targetToken);

  mapping(bytes32 => Order) public orders;

  function makeOrder(
    bytes32 makerViewingKey,
    bytes32 makerNote,
    bytes32 sourceToken,
    bytes32 targetToken,
    uint price
  ) external {
    // TODO: verify circuit:makeOrder

    require(sourceToken != targetToken, "Market: cannot make an order with same token pair");
    require(notes[makerNote] == State.Committed, "Market: maker note is not available");

    // TODO: instnatiate with zk-SNARK proofs
    Order memory order = Order({
      makerViewingKey: makerViewingKey,
      makerNote: makerNote,
      sourceToken: sourceToken,
      price: price,
      state: OrderState.Created
    });

    bytes32 orderHash = hashOrder(order);

    // save order
    orders[orderHash] = order;

    // mark maker note as spent
    notes[makerNote] = State.Spent;

    emit OrderCreated(orderHash, sourceToken, targetToken);
  }

  function takeOrder(
    bytes32 orderHash,
    bytes32 takerNoteToMaker
  ) external {
    Order storage order = orders[orderHash];
  }
  function settleOrder() external {

  }

    // TODO: use zk-SNARK proofs
  function hashOrder(Order storage order) internal view returns (bytes32) {
    return keccak256(abi.encode(
      order.makerViewingKey,
      order.makerNote,
      order.sourceToken,
      order.targetToken,
      order.price
    ));
  }
}

