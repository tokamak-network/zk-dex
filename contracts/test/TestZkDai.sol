pragma solidity ^0.4.25;

import "../ZkDai.sol";

contract TestZkDai is ZkDai {
  constructor(bool _development, address _dai) public ZkDai(_development, _dai) {}


  function setDevelopment(bool _development) public {
    development = _development;
  }
}