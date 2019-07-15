pragma solidity ^0.4.25;

import {Verifier as LiquidateNoteVerifier} from "./verifiers/LiquidateNoteVerifier.sol";
import "./ZkDaiBase.sol";


contract LiquidateNotes is LiquidateNoteVerifier, ZkDaiBase {
  uint8 internal constant NUM_PUBLIC_INPUTS = 4;

  /**
  * @dev Hashes the submitted proof and adds it to the submissions mapping that tracks
  *      submission time, type, public inputs of the zkSnark and the submitter
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
    uint256[4] input
  )
    internal
  {
    require(development || verifyTx(a, a_p, b, b_p, c, c_p, h, k, input), "failed to verify circuit");

    bytes32 note = calcHash(input[0], input[1]);

    require(notes[note] == State.Committed, "Note is either invalid or already spent");
    notes[note] = State.Spent;

    require(dai.transfer(to, uint256(input[2])), "daiToken transfer failed");
    emit NoteStateChange(note, State.Spent);
  }
}