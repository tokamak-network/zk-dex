pragma solidity ^0.5.0;

import {transferNote_Verifier as SpendNoteVerifier} from "./verifiers/transferNote_Verifier.sol";
import "./ZkDaiBase.sol";


contract SpendNotes is ZkDaiBase {
  uint8 internal constant NUM_PUBLIC_INPUTS = 9;

  bytes32 public constant EMPTY_NOTE_HASH = 0x38723a2e5e8a17aa7950dc008209944e898f69a7bd10a23c839d341e935fd5ca;

  SpendNoteVerifier public spendNoteVerifier;

  constructor(SpendNoteVerifier _spendNoteVerifier) public {
    spendNoteVerifier = _spendNoteVerifier;
  }

  /**
  * @dev Hashes the submitted proof and adds it to the submissions mapping that tracks
  *      submission time, type, public inputs of the zkSnark and the submitter
  *      public input
  *       - [0, 1]  = old note hash
  *       - [2, 3]  = new note 1 hash
  *       - [4, 5]  = new note 2 hash
  *       - [6, 7]  = original note hash (in case of smart note)
  *       - [8]     = output
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
    uint256[9] memory input,
    bytes memory encryptedNote1,
    bytes memory encryptedNote2
  )
    internal
  {
    require(development || spendNoteVerifier.verifyTx(a, a_p, b, b_p, c, c_p, h, k, input), "Failed to verify circuit");
    bytes32[4] memory _notes = get4Notes(input);

    // check that the first note (among public params) is valid and
    // new notes should not be existing at this point
    require(notes[_notes[0]] == State.Valid, "Note is either invalid or already spent");
    require(notes[_notes[1]] == State.Invalid, "output note1 is already minted");
    require(notes[_notes[2]] == State.Invalid, "output note2 is already minted");
    require(_notes[3] == EMPTY_NOTE_HASH || notes[_notes[3]] != State.Invalid, "original is already minted");

    notes[_notes[0]] = State.Spent;
    notes[_notes[1]] = State.Valid;
    notes[_notes[2]] = State.Valid;

    encryptedNotes[_notes[1]] = encryptedNote1;
    encryptedNotes[_notes[2]] = encryptedNote2;

    emit NoteStateChange(_notes[0], State.Spent);
    emit NoteStateChange(_notes[1], State.Valid);
    emit NoteStateChange(_notes[2], State.Valid);
  }

  function get4Notes(uint256[9] memory input)
    internal
    pure
    returns(bytes32[4] memory notes)
  {
    notes[0] = calcHash(input[0], input[1]);
    notes[1] = calcHash(input[2], input[3]);
    notes[2] = calcHash(input[4], input[5]);
    notes[3] = calcHash(input[6], input[7]);
  }

  function isEmptyHash(bytes32 note) internal pure returns (bool) {
    return true;
  }
}