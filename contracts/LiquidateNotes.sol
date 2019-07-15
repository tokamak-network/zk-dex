pragma solidity ^0.4.25;

import {Verifier as MintNoteVerifier} from "./verifiers/MintNoteVerifier.sol";
import "./ZkDaiBase.sol";


contract LiquidateNotes is MintNoteVerifier, ZkDaiBase {
  uint8 internal constant NUM_PUBLIC_INPUTS = 4;

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
    address to,
    uint256[2] a,
    uint256[2] a_p,
    uint256[2][2] b,
    uint256[2] b_p,
    uint256[2] c,
    uint256[2] c_p,
    uint256[2] h,
    uint256[2] k,
    uint256[5] input
  )
    internal
  {
    require(development || mintVerifyTx(a, a_p, b, b_p, c, c_p, h, k, input), "failed to verify circuit");

    bytes32 note = calcHash(input[0], input[1]);

    require(notes[note] == State.Committed, "Note is either invalid or already spent");
    notes[note] = State.Spent;

    emit NoteStateChange(note, State.Spent);
  }
}