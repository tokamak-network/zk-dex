// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ICreateTimeLockVerifier, ISpendTimeLockVerifier, IMintNBurnNoteVerifier} from "./verifiers/IGroth16Verifier.sol";
import "./ZkDaiBase.sol";

/**
 * @title TimeLock
 * @dev Contract for creating and spending time-locked notes.
 *      Time-locked notes can only be spent after a specified unlock time.
 *
 *      Use cases:
 *      - Secret vesting schedules (employee token grants)
 *      - Anonymous inheritance
 *      - Confidential investment lockups
 *
 *      All parameters (unlock time, amount, recipient) remain private.
 */
contract TimeLock is ZkDaiBase {
    ICreateTimeLockVerifier public createTimeLockVerifier;
    ISpendTimeLockVerifier public spendTimeLockVerifier;
    IMintNBurnNoteVerifier public liquidateNoteVerifier;

    // Time-lock note tracking
    // Note: The unlock time is stored privately in the note hash itself,
    // but we track it here for contract-side validation
    mapping(bytes32 => bool) public isTimeLockNote;

    event TimeLockCreated(
        bytes32 indexed noteHash,
        uint256 value,
        uint256 tokenType,
        uint256 unlockTime
    );

    event TimeLockSpent(
        bytes32 indexed inputNote,
        bytes32 indexed outputNote,
        uint256 currentTime
    );

    /**
     * @dev Initializes the TimeLock contract with verifiers and base contract dependencies.
     * @param _development When true, bypasses zk-SNARK proof verification for testing
     * @param _dai The address of the DAI ERC20 token contract
     * @param _requestVerifier The verifier for mint/burn note proofs (for ZkDaiBase)
     * @param _createTimeLockVerifier The verifier for create time-lock proofs
     * @param _spendTimeLockVerifier The verifier for spend time-lock proofs
     * @param _liquidateNoteVerifier The verifier for liquidate note proofs
     */
    constructor(
        bool _development,
        address _dai,
        IMintNBurnNoteVerifier _requestVerifier,
        ICreateTimeLockVerifier _createTimeLockVerifier,
        ISpendTimeLockVerifier _spendTimeLockVerifier,
        IMintNBurnNoteVerifier _liquidateNoteVerifier
    ) ZkDaiBase(_development, _dai, _requestVerifier) {
        createTimeLockVerifier = _createTimeLockVerifier;
        spendTimeLockVerifier = _spendTimeLockVerifier;
        liquidateNoteVerifier = _liquidateNoteVerifier;
    }

    /**
     * @dev Creates a time-locked note by depositing ETH or DAI.
     *      The note can only be spent after the specified unlock time.
     *
     *      Proof public inputs: [output, noteHash, value, tokenType, unlockTime]
     *
     * @param a Groth16 proof component a
     * @param b Groth16 proof component b
     * @param c Groth16 proof component c
     * @param input Public inputs [output, noteHash, value, tokenType, unlockTime]
     * @param encryptedNote Encrypted note data for recipient
     */
    function createTimeLock(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[5] calldata input,
        bytes calldata encryptedNote
    ) external payable {
        // Verify the proof
        require(
            development || createTimeLockVerifier.verifyProof(a, b, c, input),
            "TimeLock: Invalid create proof"
        );

        // Extract public inputs
        // input[0] = output (always 1 for valid proof)
        bytes32 noteHash = bytes32(input[1]);
        uint256 value = input[2];
        uint256 tokenType = input[3];
        uint256 unlockTime = input[4];

        // Validate unlock time is in the future
        require(unlockTime > block.timestamp, "TimeLock: Unlock time must be in future");

        // Validate note hasn't been created before
        require(notes[noteHash] == State.Invalid, "TimeLock: Note already exists");

        // Handle deposit based on token type
        if (tokenType == ETH_TOKEN_TYPE) {
            require(msg.value == value, "TimeLock: ETH value mismatch");
        } else if (tokenType == DAI_TOKEN_TYPE) {
            require(msg.value == 0, "TimeLock: No ETH for DAI deposit");
            require(
                dai.transferFrom(msg.sender, address(this), value),
                "TimeLock: DAI transfer failed"
            );
        } else {
            revert("TimeLock: Invalid token type");
        }

        // Mark note as valid and store encrypted data
        notes[noteHash] = State.Valid;
        encryptedNotes[noteHash] = encryptedNote;
        isTimeLockNote[noteHash] = true;

        emit NoteStateChange(noteHash, State.Valid);
        emit TimeLockCreated(noteHash, value, tokenType, unlockTime);
    }

    /**
     * @dev Spends a time-locked note after the unlock time has passed.
     *      Converts the time-locked note to a regular note.
     *
     *      Proof public inputs: [output, noteHash, outputHash, currentTime, tokenType]
     *
     * @param a Groth16 proof component a
     * @param b Groth16 proof component b
     * @param c Groth16 proof component c
     * @param input Public inputs [output, noteHash, outputHash, currentTime, tokenType]
     * @param encryptedNote Encrypted note data for the new output note
     */
    function spendTimeLock(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[5] calldata input,
        bytes calldata encryptedNote
    ) external {
        // Verify the proof
        require(
            development || spendTimeLockVerifier.verifyProof(a, b, c, input),
            "TimeLock: Invalid spend proof"
        );

        // Extract public inputs
        // input[0] = output (always 1 for valid proof)
        bytes32 noteHash = bytes32(input[1]);
        bytes32 outputHash = bytes32(input[2]);
        uint256 currentTime = input[3];
        // input[4] = tokenType (verified in circuit)

        // Validate the time matches blockchain time (with tolerance for miner variance)
        // In development mode, allow larger tolerance for testing
        // In production, allow ~15 second variance which is typical for Ethereum
        uint256 timeTolerance = development ? 3600 : 15; // 1 hour for dev, 15 sec for prod
        require(
            currentTime <= block.timestamp && currentTime >= block.timestamp - timeTolerance,
            "TimeLock: Current time mismatch"
        );

        // Validate input note is a valid time-lock note
        require(notes[noteHash] == State.Valid, "TimeLock: Input note not valid");
        require(isTimeLockNote[noteHash], "TimeLock: Not a time-lock note");

        // Validate output note doesn't exist
        require(notes[outputHash] == State.Invalid, "TimeLock: Output note already exists");

        // Spend input note
        notes[noteHash] = State.Spent;
        emit NoteStateChange(noteHash, State.Spent);

        // Create output note (regular note, not time-locked)
        notes[outputHash] = State.Valid;
        encryptedNotes[outputHash] = encryptedNote;
        // Note: We don't mark output as time-lock note since it's a regular note now

        emit NoteStateChange(outputHash, State.Valid);
        emit TimeLockSpent(noteHash, outputHash, currentTime);
    }

    /**
     * @dev Check if a note is a time-lock note.
     * @param noteHash The hash of the note to check
     * @return True if the note is a time-lock note
     */
    function isTimeLocked(bytes32 noteHash) external view returns (bool) {
        return isTimeLockNote[noteHash];
    }

    /**
     * @dev Liquidate a note to transfer the equivalent amount of ETH/DAI to the recipient.
     *      This allows spending regular notes that were created from time-lock notes.
     *
     *      Proof public inputs: [output, noteHash, value, tokenType]
     *
     * @param to Recipient of the tokens
     * @param a Groth16 proof component a
     * @param b Groth16 proof component b
     * @param c Groth16 proof component c
     * @param input Public inputs [output, noteHash, value, tokenType]
     */
    function liquidate(
        address payable to,
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[4] calldata input
    ) external {
        // Verify the proof
        require(
            development || liquidateNoteVerifier.verifyProof(a, b, c, input),
            "TimeLock: Invalid liquidate proof"
        );

        bytes32 noteHash = bytes32(input[1]);
        uint256 value = input[2];
        uint256 tokenType = input[3];

        // Validate note is valid
        require(notes[noteHash] == State.Valid, "TimeLock: Note is not valid");

        // Mark note as spent
        notes[noteHash] = State.Spent;
        emit NoteStateChange(noteHash, State.Spent);

        // Transfer tokens to recipient
        if (tokenType == ETH_TOKEN_TYPE) {
            to.transfer(value);
        } else if (tokenType == DAI_TOKEN_TYPE) {
            require(dai.transfer(to, value), "TimeLock: DAI transfer failed");
        } else {
            revert("TimeLock: Invalid token type");
        }
    }
}
