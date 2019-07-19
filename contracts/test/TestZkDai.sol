pragma solidity ^0.5.0;

import "../ZkDai.sol";

contract TestZkDai is ZkDai {
  constructor(
    bool _development,
    address _dai,
    MintNoteVerifier _mintNoteVerifier,
    SpendNoteVerifier _spendNoteVerifier
  )
    public
    ZkDai(_development, _dai, _mintNoteVerifier, _spendNoteVerifier)
  {}


  function setDevelopment(bool _development) public {
    development = _development;
  }
}