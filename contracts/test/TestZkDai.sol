// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../ZkDai.sol";
import {IMintNBurnNoteVerifier, ITransferNoteVerifier} from "../verifiers/IGroth16Verifier.sol";

contract TestZkDai is ZkDai {
  constructor(
    bool _development,
    address _dai,
    IMintNBurnNoteVerifier _mintNoteVerifier,
    ITransferNoteVerifier _spendNoteVerifier
  )
    ZkDai(_development, _dai, _mintNoteVerifier, _spendNoteVerifier)
  {}


  function setDevelopment(bool _development) public {
    development = _development;
  }
}