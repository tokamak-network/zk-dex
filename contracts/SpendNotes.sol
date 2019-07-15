pragma solidity ^0.4.25;

import {Verifier as SpendNoteVerifier} from "./verifiers/SpendNoteVerifier.sol";
import "./ZkDaiBase.sol";


contract SpendNotes is SpendNoteVerifier, ZkDaiBase {
  uint8 internal constant NUM_PUBLIC_INPUTS = 9;

  /**
  * @dev Hashes the submitted proof and adds it to the submissions mapping that tracks
  *      submission time, type, public inputs of the zkSnark and the submitter
  *      public input
  *       - [0, 1]  = old note hash
  *       - [2, 3]  = new note 1 hash
  *       - [4, 5]  = new note 2 hash
  *       - [6]     = output
*/
  function submit(
    uint256[2] a,
    uint256[2] a_p,
    uint256[2][2] b,
    uint256[2] b_p,
    uint256[2] c,
    uint256[2] c_p,
    uint256[2] h,
    uint256[2] k,
    uint256[7] input,
    bytes memory encryptedNote1,
    bytes memory encryptedNote2
  )
    internal
  {
    require(development || spendVerifyTx(a, a_p, b, b_p, c, c_p, h, k, input), "Failed to verify circuit");
    bytes32[3] memory _notes = get3Notes(input);

    // check that the first note (among public params) is committed and
    // new notes should not be existing at this point
    require(notes[_notes[0]] == State.Committed, "Note is either invalid or already spent");
    require(notes[_notes[1]] == State.Invalid, "output note1 is already minted");
    require(notes[_notes[2]] == State.Invalid, "output note2 is already minted");

    notes[_notes[0]] = State.Spent;
    notes[_notes[1]] = State.Committed;
    notes[_notes[2]] = State.Committed;

    encryptedNotes[_notes[1]] = encryptedNote1;
    encryptedNotes[_notes[2]] = encryptedNote2;

    emit NoteStateChange(_notes[0], State.Spent);
    emit NoteStateChange(_notes[1], State.Committed);
    emit NoteStateChange(_notes[2], State.Committed);
  }

  function get3Notes(uint256[7] input)
    internal
    pure
    returns(bytes32[3] notes)
  {
    notes[0] = calcHash(input[0], input[1]);
    notes[1] = calcHash(input[2], input[3]);
    notes[2] = calcHash(input[4], input[5]);
  }
}