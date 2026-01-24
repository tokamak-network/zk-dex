// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IMintNBurnNoteVerifier} from "./verifiers/IGroth16Verifier.sol";
import "./ZkDaiBase.sol";


abstract contract LiquidateNotes is ZkDaiBase {
  uint8 internal constant LIQUIDATE_NUM_PUBLIC_INPUTS = 4;

  IMintNBurnNoteVerifier public liquidateNoteVerifier;

  constructor(IMintNBurnNoteVerifier _liquidateNoteVerifier) {
    liquidateNoteVerifier = _liquidateNoteVerifier;
  }

  /**
  * @dev Hashes the submitted proof and adds it to the submissions mapping that tracks
  *      submission time, type, public inputs of the zkSnark and the submitter
  *      public input (Groth16/snarkjs format - outputs come first)
  *       - [0]     = output (always 1 for valid proof)
  *       - [1, 2]  = new note hash (nh0, nh1)
  *       - [3]     = note value
  *       - [4]     = note type
  */
  function submit(
    address to,
    uint256[2] memory a,
    uint256[2][2] memory b,
    uint256[2] memory c,
    uint256[5] memory input
  )
    internal
  {
    require(development || liquidateNoteVerifier.verifyProof(a, b, c, input), "failed to verify circuit");

    bytes32 note = calcHash(input[1], input[2]);

    require(notes[note] == State.Valid, "Note is either invalid or already spent");
    notes[note] = State.Spent;

    emit NoteStateChange(note, State.Spent);
  }
}
