// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ITransferNoteVerifier} from "./verifiers/IGroth16Verifier.sol";
import "./ZkDaiBase.sol";


/**
 * @title SpendNotes
 * @dev Abstract contract providing note spending (transfer) functionality. Verifies
 *      Groth16 zk-SNARK proofs to spend up to two existing notes and create up to
 *      two new notes, enabling private value transfers with change outputs.
 */
abstract contract SpendNotes is ZkDaiBase {
  uint8 internal constant SPEND_NUM_PUBLIC_INPUTS = 5;

  ITransferNoteVerifier public spendNoteVerifier;

  /**
   * @dev Initializes the spend notes module with the Groth16 verifier contract for
   *      transfer note proofs.
   * @param _spendNoteVerifier The verifier contract for validating transfer note zk-SNARK proofs
   */
  constructor(ITransferNoteVerifier _spendNoteVerifier) {
    spendNoteVerifier = _spendNoteVerifier;
  }

  /**
  * @dev Hashes the submitted proof and adds it to the submissions mapping that tracks
  *      submission time, type, public inputs of the zkSnark and the submitter
  *      public input (Groth16/snarkjs format - Poseidon version)
  *       - [0] = output (always 1 for valid proof)
  *       - [1] = old note 0 hash (single field element)
  *       - [2] = old note 1 hash (single field element)
  *       - [3] = new note hash (single field element)
  *       - [4] = change note hash (single field element)
*/
  function submit(
    uint256[2] memory a,
    uint256[2][2] memory b,
    uint256[2] memory c,
    uint256[5] memory input,
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

  /**
   * @dev Extracts the 4 note hashes from the transfer circuit's public inputs. The first
   *      input (index 0) is the proof output flag and is skipped. Inputs 1-4 correspond
   *      to old note 0, old note 1, new note, and change note respectively.
   * @param input The 5-element public input array from the transfer zk-SNARK proof
   * @return noteHashes A fixed-size array of 4 note hashes (old0, old1, new, change)
   */
  function get4Notes(uint256[5] memory input)
    internal
    pure
    returns(bytes32[4] memory noteHashes)
  {
    // Poseidon version: each input is a single field element note hash
    noteHashes[0] = bytes32(input[1]);  // old note 0
    noteHashes[1] = bytes32(input[2]);  // old note 1
    noteHashes[2] = bytes32(input[3]);  // new note
    noteHashes[3] = bytes32(input[4]);  // change note
  }
}
