pragma solidity ^0.4.25;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";


contract ZkDaiBase {
  bool public development;
  ERC20 public dai;

  constructor(bool _development, address _dai) public {
    development = _development;
    dai = ERC20(_dai);
  }

  // note hash --> encrypted note data
  mapping(bytes32 => bytes) public encryptedNotes;

  enum State {Invalid, Committed, Traiding, Spent}
  // maps note to State
  mapping(bytes32 => State) public notes;

  event NoteStateChange(bytes32 note, State state);

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
    bytes16 a = bytes16(_a);
    bytes16 b = bytes16(_b);
    bytes memory _note = new bytes(32);

    for (uint i = 0; i < 16; i++) {
      _note[i] = a[i];
      _note[16 + i] = b[i];
    }
    note = _bytesToBytes32(_note, 0);
  }

  function _bytesToBytes32(bytes b, uint offset)
    internal
    pure
    returns (bytes32 out)
  {
    for (uint i = 0; i < 32; i++) {
      out |= bytes32(b[offset + i] & 0xFF) >> (i * 8);
    }
  }
}