// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IMintNBurnNoteVerifier} from "./verifiers/IGroth16Verifier.sol";
import "./ZkDaiBase.sol";


abstract contract MintNotes is ZkDaiBase {
  uint8 internal constant MINT_NUM_PUBLIC_INPUTS = 5;

  IMintNBurnNoteVerifier public mintNoteVerifier;

  constructor(IMintNBurnNoteVerifier _mintNoteVerifier) {
    mintNoteVerifier = _mintNoteVerifier;
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
    uint256[2] memory a,
    uint256[2][2] memory b,
    uint256[2] memory c,
    uint256[5] memory input,
    bytes memory encryptedNote
  )
    internal
  {
    require(development || mintNoteVerifier.verifyProof(a, b, c, input), "Failed to verify circuit");

    bytes32 note = calcHash(input[1], input[2]);
    require(notes[note] == State.Invalid, "Note was already minted");

    notes[note] = State.Valid;
    encryptedNotes[note] = encryptedNote;

    emit NoteStateChange(note, State.Valid);
  }
}
