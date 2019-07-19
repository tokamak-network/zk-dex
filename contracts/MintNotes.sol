pragma solidity ^0.5.0;

import {mintNBurnNote_Verifier as MintNoteVerifier} from "./verifiers/mintNBurnNote_Verifier.sol";
import "./ZkDaiBase.sol";


contract MintNotes is ZkDaiBase {
  uint8 internal constant NUM_PUBLIC_INPUTS = 5;

  MintNoteVerifier public mintNoteVerifier;

  constructor(MintNoteVerifier _mintNoteVerifier) public {
    mintNoteVerifier = _mintNoteVerifier;
  }

  /**
  * @dev Hashes the submitted proof and adds it to the submissions mapping that tracks
  *      submission time, type, public inputs of the zkSnark and the submitter
  *      public input
  *       - [0, 1]  = new note hash
  *       - [2]     = note value
  *       - [3]     = note type
  *       - [4]     = output
  */
  function submit(
    uint256[2] memory a,
    uint256[2] memory a_p,
    uint256[2][2] memory b,
    uint256[2] memory b_p,
    uint256[2] memory c,
    uint256[2] memory c_p,
    uint256[2] memory h,
    uint256[2] memory k,
    uint256[5] memory input,
    bytes memory encryptedNote
  )
    internal
  {
    require(development || mintNoteVerifier.verifyTx(a, a_p, b, b_p, c, c_p, h, k, input), "Failed to verify circuit");

    bytes32 note = calcHash(input[0], input[1]);
    require(notes[note] == State.Invalid, "Note was already minted");

    notes[note] = State.Valid;
    encryptedNotes[note] = encryptedNote;

    emit NoteStateChange(note, State.Valid);
  }
}