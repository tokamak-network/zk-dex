// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IMintNBurnNoteVerifier} from "./verifiers/IGroth16Verifier.sol";

import "./Requestable.sol";
import "./RLPReader.sol";

/**
 * @title ZkDaiBase
 * @dev Base contract for the ZkDai privacy system. Manages note state, encrypted note
 *      storage, cross-chain request handling via Plasma-style exits/entries, and
 *      RLP-encoded proof parsing. Notes transition through Invalid, Valid, Trading,
 *      and Spent states as they are minted, transferred, and liquidated.
 */
contract ZkDaiBase is Requestable {
  using RLPReader for bytes;
  using RLPReader for RLPReader.RLPItem;

  bool public development;
  ERC20 public dai;
  IMintNBurnNoteVerifier public requestVerifier;

  uint256 public constant ETH_TOKEN_TYPE = 0;
  uint256 public constant DAI_TOKEN_TYPE = 1;

  // EMPTY_NOTE_HASH = Poseidon(0, 0, 0, 0, 0, 0, 0)
  // Computed by circomlibjs Poseidon with 7 inputs (owner0, owner1, value, tokenType, vk0, vk1, salt)
  bytes32 public constant EMPTY_NOTE_HASH = 0x0a47ead74da5372e7d2598e4f93c389bf03e8330219f8bf1e49b362f73491a26;

  /**
   * @dev Initializes the base contract with development mode flag, DAI token address,
   *      and the verifier used for cross-chain note request proofs.
   * @param _development When true, bypasses zk-SNARK proof verification for testing
   * @param _dai The address of the DAI ERC20 token contract
   * @param _requestVerifier The verifier contract for mint/burn note proofs used in cross-chain requests
   *
   * Security: Development mode is restricted to local networks only (chainId 1337 or 31337).
   *           Attempting to deploy with development=true on production networks will revert.
   */
  constructor(bool _development, address _dai, IMintNBurnNoteVerifier _requestVerifier) {
    // Security check: Prevent development mode on production networks
    // Development mode bypasses ZK proof verification and MUST NOT be enabled in production
    if (_development) {
      // Allow only on local test networks (Ganache: 1337, Hardhat: 31337)
      require(
        block.chainid == 1337 || block.chainid == 31337,
        "ZkDaiBase: Development mode only allowed on local networks (chainId 1337 or 31337)"
      );
    }

    development = _development;
    dai = ERC20(_dai);
    requestVerifier = _requestVerifier;
  }

  // note hash --> encrypted note data
  mapping(bytes32 => bytes) public encryptedNotes;

  enum State {Invalid, Valid, Trading, Spent}

  // maps note to State
  mapping(bytes32 => State) public notes;

  event NoteStateChange(bytes32 note, State state);


  // MintNBurnVerifier proof of notes to be requested
  mapping(bytes32 => bytes) public requestedNoteProofs;
  mapping(bytes32 => bool) public verifiedProofs;

  /**
   * @dev Applying request in root chain consume a lot of gas.
   *      So, optimistic approach is required but it will be implemented
   *      after this hackathon.
   *
   *      value = rlp.encode(Groth16Proof);
   *        Groth16Proof =
   *          [uint256[2]     // a
   *          uint256[2][2]   // b
   *          uint256[2]      // c
   *          uint256[4]]     // input (Poseidon version: output, noteHash, value, tokenType)
   */
  function applyRequestInRootChain(
    bool isExit,
    uint256 requestId,
    address requestor,
    bytes32 trieKey,
    bytes calldata trieValue
  ) external returns (bool success) {
    if (isExit) {
      handleIn(trieValue);
    } else {
      handleOut(trieValue);
    }

    return true;
  }

  /**
   * @dev Handles cross-chain note requests in the child chain. The direction is inverted
   *      relative to root chain: exits trigger handleOut (note export) and enters trigger
   *      handleIn (note import via proof storage).
   * @param isExit Whether the request is an exit (true) or an enter (false)
   * @param requestId The unique identifier of the cross-chain request
   * @param requestor The address that initiated the request
   * @param trieKey The trie key associated with the request
   * @param trieValue The RLP-encoded Groth16 proof data
   * @return success Whether the request was processed successfully
   */
  function applyRequestInChildChain(
    bool isExit,
    uint256 requestId,
    address requestor,
    bytes32 trieKey,
    bytes calldata trieValue
  ) external returns (bool success) {
    if (isExit) {
      handleOut(trieValue);
    } else {
      handleIn(trieValue);
    }

    return true;
  }

  /**
   * @dev Verifies a previously stored cross-chain note request by running the zk-SNARK
   *      proof through the request verifier. On successful verification, the note is
   *      activated by setting its state to Valid.
   * @param noteHash The hash of the note whose stored proof should be verified
   * @return success Whether the verification succeeded (implicitly returns via require)
   */
  function verifyRequest(bytes32 noteHash) external returns (bool success) {
    RLPReader.RLPItem[] memory list = requestedNoteProofs[noteHash].toRlpItem().toList();

    uint256[2] memory a = parseUintArray2(list[0]);
    uint256[2][2] memory b = parseUint2DArray2(list[1]);
    uint256[2] memory c = parseUintArray2(list[2]);
    uint256[4] memory input = parseUintArray4(list[3]);

    require(requestVerifier.verifyProof(a, b, c, input), "failed to verify circuit");
    notes[noteHash] = State.Valid;
    emit NoteStateChange(noteHash, State.Valid);
  }

  /**
   * @dev Parses an RLP-encoded item into a fixed-size array of 2 uint256 values.
   *      Used to decode the 'a' and 'c' components of Groth16 proofs.
   * @param item The RLP item containing a list of 2 encoded uint256 values
   * @return A fixed-size array of 2 uint256 values decoded from the RLP item
   */
  function parseUintArray2(RLPReader.RLPItem memory item) internal returns (uint256[2] memory) {
    RLPReader.RLPItem[] memory list = item.toList();
    return [list[0].toUint(), list[1].toUint()];
  }
  /**
   * @dev Parses an RLP-encoded item into a fixed-size array of 4 uint256 values.
   *      Used to decode the public input component of Groth16 proofs.
   * @param item The RLP item containing a list of 4 encoded uint256 values
   * @return A fixed-size array of 4 uint256 values decoded from the RLP item
   */
  function parseUintArray4(RLPReader.RLPItem memory item) internal returns (uint256[4] memory) {
    RLPReader.RLPItem[] memory list = item.toList();
    return [list[0].toUint(), list[1].toUint(), list[2].toUint(), list[3].toUint()];
  }
  /**
   * @dev Parses an RLP-encoded item into a 2x2 matrix of uint256 values.
   *      Used to decode the 'b' component of Groth16 proofs.
   * @param item The RLP item containing a nested list of 2x2 encoded uint256 values
   * @return A fixed-size 2x2 array of uint256 values decoded from the RLP item
   */
  function parseUint2DArray2(RLPReader.RLPItem memory item) internal returns (uint256[2][2] memory) {
    RLPReader.RLPItem[] memory list = item.toList();
    RLPReader.RLPItem[] memory list1 = list[0].toList();
    RLPReader.RLPItem[] memory list2 = list[1].toList();

    return [
      [list1[0].toUint(), list1[1].toUint()],
      [list2[0].toUint(), list2[1].toUint()]
    ];
  }

  /**
   * @dev Extracts the note hash from RLP-encoded Groth16 proof data. Decodes the
   *      top-level RLP list, accesses the public inputs (4th element), and returns
   *      the note hash from input[1] (Poseidon version).
   * @param b The raw RLP-encoded bytes containing a full Groth16 proof (a, b, c, input)
   * @return The note hash extracted from the proof's public inputs as a bytes32 value
   */
  function getNoteHash(bytes memory b) internal pure returns (bytes32) {
    RLPReader.RLPItem[] memory list = b.toRlpItem().toList();
    RLPReader.RLPItem[] memory input = list[3].toList();
    // Poseidon version: input[1] is the single field element note hash
    return bytes32(input[1].toUint());
  }

  /**
   * @dev Processes an incoming note request by storing the RLP-encoded proof data for
   *      later verification. The note must be in an Invalid or Spent state to be eligible
   *      for import. The proof is not verified at this stage to save gas; call
   *      verifyRequest() separately to activate the note.
   * @param trieValue The RLP-encoded Groth16 proof data for the note being imported
   */
  function handleIn(bytes memory trieValue) internal {
    bytes32 noteHash = getNoteHash(trieValue);
    require(notes[noteHash] == State.Invalid ||
      notes[noteHash] == State.Spent, "note is not in a requestable state.");

    require(requestedNoteProofs[noteHash].length == 0, "note is requested again");
    requestedNoteProofs[noteHash] = trieValue;
  }

  /**
   * @dev Processes an outgoing note request by marking the note as Spent. The note must
   *      be in a Valid state to be exported. The proof data is stored for reference, and
   *      the note state is immediately transitioned to Spent.
   * @param trieValue The RLP-encoded Groth16 proof data for the note being exported
   */
  function handleOut(bytes memory trieValue) internal {
    bytes32 noteHash = getNoteHash(trieValue);
    require(notes[noteHash] == State.Valid, "note is not in a requestable state.");

    require(requestedNoteProofs[noteHash].length == 0, "note is requested again");
    requestedNoteProofs[noteHash] = trieValue;

    notes[noteHash] = State.Spent;
    emit NoteStateChange(noteHash, State.Spent);
  }
}
