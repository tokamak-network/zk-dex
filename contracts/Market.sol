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


  function makeOrder(
    bytes32 makerViewingKey,
    bytes32 makerNote,
    bytes32 sourceToken,
    bytes32 targetToken,
    uint price
  ) external {

  }
  function takeOrder() external {

  }
  function settleOrder() external {

  }
}

