// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ITransferNoteVerifier} from "./verifiers/IGroth16Verifier.sol";
import "./ZkDaiBase.sol";


abstract contract SpendNotes is ZkDaiBase {
  uint8 internal constant SPEND_NUM_PUBLIC_INPUTS = 9;

  ITransferNoteVerifier public spendNoteVerifier;

  constructor(ITransferNoteVerifier _spendNoteVerifier) {
    spendNoteVerifier = _spendNoteVerifier;
  }

  /**
  * @dev Hashes the submitted proof and adds it to the submissions mapping that tracks
  *      submission time, type, public inputs of the zkSnark and the submitter
  *      public input (Groth16/snarkjs format - outputs come first)
  *       - [0]     = output (always 1 for valid proof)
  *       - [1, 2]  = old note 1 hash
  *       - [3, 4]  = old note 2 hash
  *       - [5, 6]  = new note 1 hash
  *       - [7, 8]  = new note 2 hash
*/
  function submit(
    uint256[2] memory a,
    uint256[2][2] memory b,
    uint256[2] memory c,
    uint256[9] memory input,
    bytes memory encryptedNote1,
    bytes memory encryptedNote2
  )
    internal
  {
    require(development || spendNoteVerifier.verifyProof(a, b, c, input), "Failed to verify circuit");
    bytes32[4] memory _notes = get4Notes(input);

    // check that the first note (among public params) is valid and
    // new notes should not be existing at this point
    require(_notes[0] == EMPTY_NOTE_HASH || notes[_notes[0]] == State.Valid, "Input note 1 cannot be spent");
    require(_notes[1] == EMPTY_NOTE_HASH || notes[_notes[1]] == State.Valid, "Input note 2 cannot be spent");
    require(_notes[2] == EMPTY_NOTE_HASH || notes[_notes[2]] == State.Invalid, "Output note 1 was already minted");
    require(_notes[3] == EMPTY_NOTE_HASH || notes[_notes[3]] == State.Invalid, "Output note 2 was already minted");

    if (_notes[0] != EMPTY_NOTE_HASH) {
      notes[_notes[0]] = State.Spent;
      emit NoteStateChange(_notes[0], State.Spent);
    }

    if (_notes[1] != EMPTY_NOTE_HASH) {
      notes[_notes[1]] = State.Spent;
      emit NoteStateChange(_notes[1], State.Spent);
    }

    if (_notes[2] != EMPTY_NOTE_HASH) {
      notes[_notes[2]] = State.Valid;
      encryptedNotes[_notes[2]] = encryptedNote1;
      emit NoteStateChange(_notes[2], State.Valid);
    }

    if (_notes[3] != EMPTY_NOTE_HASH) {
      notes[_notes[3]] = State.Valid;
      encryptedNotes[_notes[3]] = encryptedNote2;
      emit NoteStateChange(_notes[3], State.Valid);
    }
  }

  function get4Notes(uint256[9] memory input)
    internal
    pure
    returns(bytes32[4] memory noteHashes)
  {
    // snarkjs format: output first, then note hashes
    noteHashes[0] = calcHash(input[1], input[2]);
    noteHashes[1] = calcHash(input[3], input[4]);
    noteHashes[2] = calcHash(input[5], input[6]);
    noteHashes[3] = calcHash(input[7], input[8]);
  }

  function isEmptyHash(bytes32 note) internal pure returns (bool) {
    return true;
  }
}
