// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IMintNBurnNoteVerifier} from "./verifiers/IGroth16Verifier.sol";

import "./Requestable.sol";
import "./RLPReader.sol";

contract ZkDaiBase is Requestable {
  using RLPReader for bytes;
  using RLPReader for RLPReader.RLPItem;

  bool public development;
  ERC20 public dai;
  IMintNBurnNoteVerifier public requestVerifier;

  uint256 public constant ETH_TOKEY_TYPE = 0;
  uint256 public constant DAI_TOKEY_TYPE = 1;

  // EMPTY_NOTE_HASH = Poseidon(0, 0, 0, 0, 0, 0)
  // Computed by circomlibjs Poseidon, must match the circuit
  bytes32 public constant EMPTY_NOTE_HASH = 0x1fdb1d1757a3a3502bec7084abc047ae86a4f442b8a073d5b3482bb02eb353d5;

  constructor(bool _development, address _dai, IMintNBurnNoteVerifier _requestVerifier) {
    development = _development;
    dai = ERC20(_dai);
    requestVerifier = _requestVerifier;
  }

  // note hash --> encrypted note data
  mapping(bytes32 => bytes) public encryptedNotes;

  enum State {Invalid, Valid, Traiding, Spent}

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

  function parseUintArray2(RLPReader.RLPItem memory item) internal returns (uint256[2] memory) {
    RLPReader.RLPItem[] memory list = item.toList();
    return [list[0].toUint(), list[1].toUint()];
  }
  function parseUintArray4(RLPReader.RLPItem memory item) internal returns (uint256[4] memory) {
    RLPReader.RLPItem[] memory list = item.toList();
    return [list[0].toUint(), list[1].toUint(), list[2].toUint(), list[3].toUint()];
  }
  function parseUint2DArray2(RLPReader.RLPItem memory item) internal returns (uint256[2][2] memory) {
    RLPReader.RLPItem[] memory list = item.toList();
    RLPReader.RLPItem[] memory list1 = list[0].toList();
    RLPReader.RLPItem[] memory list2 = list[1].toList();

    return [
      [list1[0].toUint(), list1[1].toUint()],
      [list2[0].toUint(), list2[1].toUint()]
    ];
  }

  function getNoteHash(bytes memory b) internal pure returns (bytes32) {
    RLPReader.RLPItem[] memory list = b.toRlpItem().toList();
    RLPReader.RLPItem[] memory input = list[3].toList();
    // Poseidon version: input[1] is the single field element note hash
    return bytes32(input[1].toUint());
  }

  function handleIn(bytes memory trieValue) internal {
    bytes32 noteHash = getNoteHash(trieValue);
    require(notes[noteHash] == State.Invalid ||
      notes[noteHash] == State.Spent, "note is not in a requestable state.");

    require(requestedNoteProofs[noteHash].length == 0, "note is requested again");
    requestedNoteProofs[noteHash] = trieValue;
  }

  function handleOut(bytes memory trieValue) internal {
    bytes32 noteHash = getNoteHash(trieValue);
    require(notes[noteHash] == State.Valid, "note is not in a requestable state.");

    require(requestedNoteProofs[noteHash].length == 0, "note is requested again");
    requestedNoteProofs[noteHash] = trieValue;

    notes[noteHash] = State.Spent;
    emit NoteStateChange(noteHash, State.Spent);
  }
}
