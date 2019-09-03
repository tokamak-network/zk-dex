pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import {mintNBurnNote_Verifier as MintNoteVerifier} from "./verifiers/mintNBurnNote_Verifier.sol";

import "./Requestable.sol";
import "./RLPReader.sol";

contract ZkDaiBase is Requestable {
  using RLPReader for *;

  bool public development;
  ERC20 public dai;
  MintNoteVerifier public requestVerifier;

  uint256 public constant ETH_TOKEY_TYPE = 0;
  uint256 public constant DAI_TOKEY_TYPE = 1;

  bytes32 public constant EMPTY_NOTE_HASH = 0x5d89f056865052bcb89c910d2d62872e029fb273c3db03f8968a52a41593c1b5;

  constructor(bool _development, address _dai, MintNoteVerifier _requestVerifier) public {
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
   *      value = rlp.encode(MintNBurnVerifierProof);
   *        MintNBurnVerifierProof =
   *          [uint256[2]
   *          uint256[2]
   *          uint256[2][2]
   *          uint256[2]
   *          uint256[2]
   *          uint256[2]
   *          uint256[2]
   *          uint256[2]
   *          uint256[5]]
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
    uint256[2] memory a_p = parseUintArray2(list[1]);
    uint256[2][2] memory b = parseUint2DArray2(list[2]);
    uint256[2] memory b_p = parseUintArray2(list[3]);
    uint256[2] memory c = parseUintArray2(list[4]);
    uint256[2] memory c_p = parseUintArray2(list[5]);
    uint256[2] memory h = parseUintArray2(list[6]);
    uint256[2] memory k = parseUintArray2(list[7]);
    uint256[5] memory input = parseUintArray5(list[8]);

    require(requestVerifier.verifyTx(a, a_p, b, b_p, c, c_p, h, k, input), "failed to verify circuit");
    notes[noteHash] = State.Valid;
    emit NoteStateChange(noteHash, State.Valid);
  }

  function parseUintArray2(RLPReader.RLPItem memory item) internal returns (uint256[2] memory) {
    RLPReader.RLPItem[] memory list = item.toList();
    return [list[0].toUint(), list[1].toUint()];
  }
  function parseUintArray5(RLPReader.RLPItem memory item) internal returns (uint256[5] memory) {
    RLPReader.RLPItem[] memory list = item.toList();
    return [list[0].toUint(), list[1].toUint(), list[2].toUint(), list[3].toUint(), list[4].toUint()];
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
    RLPReader.RLPItem[] memory input = list[8].toList();
    return calcHash(input[0].toUint(), input[1].toUint());
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


  /**
  * @dev Concatenates the 2 chunks of the sha256 hash of the note
  * @notice This method is required due to the field limitations imposed by the zokrates zkSnark library
  * @param _a Most significant 128 bits of the note hash
  * @param _b Least significant 128 bits of the note hash
  */
  function calcHash(uint _a, uint _b)
    internal
    pure
    returns(bytes32 note)
  {
    bytes16 a = bytes16(uint128(_a));
    bytes16 b = bytes16(uint128(_b));
    bytes memory _note = new bytes(32);

    for (uint i = 0; i < 16; i++) {
      _note[i] = a[i];
      _note[16 + i] = b[i];
    }
    note = _bytesToBytes32(_note, 0);
  }

  function _bytesToBytes32(bytes memory b, uint offset)
    internal
    pure
    returns (bytes32 out)
  {
    for (uint i = 0; i < 32; i++) {
      out |= bytes32(b[offset + i] & 0xFF) >> (i * 8);
    }
  }
}