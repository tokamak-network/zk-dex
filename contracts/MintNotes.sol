// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IMintNBurnNoteVerifier} from "./verifiers/IGroth16Verifier.sol";
import "./ZkDaiBase.sol";


/**
 * @title MintNotes
 * @dev Abstract contract providing note minting functionality. Verifies Groth16 zk-SNARK
 *      proofs to create new private notes and stores their encrypted data on-chain.
 */
abstract contract MintNotes is ZkDaiBase {
  uint8 internal constant MINT_NUM_PUBLIC_INPUTS = 4;

  IMintNBurnNoteVerifier public mintNoteVerifier;

  /**
   * @dev Initializes the mint notes module with the Groth16 verifier contract for
   *      mint note proofs.
   * @param _mintNoteVerifier The verifier contract for validating mint note zk-SNARK proofs
   */
  constructor(IMintNBurnNoteVerifier _mintNoteVerifier) {
    mintNoteVerifier = _mintNoteVerifier;
  }

  /**
  * @dev Hashes the submitted proof and adds it to the submissions mapping that tracks
  *      submission time, type, public inputs of the zkSnark and the submitter
  *      public input (Groth16/snarkjs format - Poseidon version)
  *       - [0] = output (always 1 for valid proof)
  *       - [1] = note hash (single field element)
  *       - [2] = note value
  *       - [3] = note type
  */
  function submit(
    uint256[2] memory a,
    uint256[2][2] memory b,
    uint256[2] memory c,
    uint256[4] memory input,
    bytes memory encryptedNote
  )
    internal
  {
    require(development || mintNoteVerifier.verifyProof(a, b, c, input), "Failed to verify circuit");

    bytes32 note = bytes32(input[1]);
    require(notes[note] == State.Invalid, "Note was already minted");

    notes[note] = State.Valid;
    encryptedNotes[note] = encryptedNote;

    emit NoteStateChange(note, State.Valid);
  }
}
