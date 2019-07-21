pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "./MintNotes.sol";
import "./SpendNotes.sol";
import "./LiquidateNotes.sol";


contract ZkDai is MintNotes, SpendNotes, LiquidateNotes {
  constructor(
    bool _development,
    address _dai,
    MintNoteVerifier _mintNoteVerifier,
    SpendNoteVerifier _spendNoteVerifier
  )
    public
    MintNotes(_mintNoteVerifier)
    SpendNotes(_spendNoteVerifier)
    LiquidateNotes(_mintNoteVerifier)
    ZkDaiBase(_development, _dai, _mintNoteVerifier)
  {}

  /**
  * @dev Transfers specified number of dai tokens to itself and submits the zkSnark proof to mint a new note
  * @notice params: a, a_p, b, b_p, c, c_p, h, k zkSnark parameters
  * @param input Public inputs of the zkSnark
  */
  function mint(
    uint256[2] calldata a,
    uint256[2] calldata a_p,
    uint256[2][2] calldata b,
    uint256[2] calldata b_p,
    uint256[2] calldata c,
    uint256[2] calldata c_p,
    uint256[2] calldata h,
    uint256[2] calldata k,
    uint256[5] calldata input,
    bytes calldata encryptedNote
  )
    external
    payable
  {
    if (input[3] == ETH_TOKEY_TYPE) {
      require(msg.value == input[2],"ether amount doesn't match");
    } else if (input[3] == DAI_TOKEY_TYPE) {
      require(msg.value == 0, "msg.value should be 0 for creating dai note");
      require(
        dai.transferFrom(msg.sender, address(this), input[2]),
        "dai transfer failed"
      );
    }

    MintNotes.submit(a, a_p, b, b_p, c, c_p, h, k, input, encryptedNote);
  }

  /**
  * @dev Submits the zkSnark proof to be able to spend a note and create two new notes
  * @notice params: a, a_p, b, b_p, c, c_p, h, k zkSnark parameters
  * @param input Public inputs of the zkSnark
  */
  function spend(
    uint256[2] calldata a,
    uint256[2] calldata a_p,
    uint256[2][2] calldata b,
    uint256[2] calldata b_p,
    uint256[2] calldata c,
    uint256[2] calldata c_p,
    uint256[2] calldata h,
    uint256[2] calldata k,
    uint256[9] calldata input,
    bytes calldata encryptedNote1,
    bytes calldata encryptedNote2
  )
    external
  {
    SpendNotes.submit(a, a_p, b, b_p, c, c_p, h, k, input, encryptedNote1, encryptedNote2);
  }

  /**
  * @dev Liquidate a note to transfer the equivalent amount of dai to the recipient
  * @param to Recipient of the dai tokens
  * @notice params: a, a_p, b, b_p, c, c_p, h, k zkSnark parameters
  * @param input Public inputs of the zkSnark
  */
  function liquidate(
    address payable to,
    uint256[2] calldata a,
    uint256[2] calldata a_p,
    uint256[2][2] calldata b,
    uint256[2] calldata b_p,
    uint256[2] calldata c,
    uint256[2] calldata c_p,
    uint256[2] calldata h,
    uint256[2] calldata k,
    uint256[5] calldata input
  )
    external
  {
    LiquidateNotes.submit(to, a, a_p, b, b_p, c, c_p, h, k, input);

    if (input[3] == ETH_TOKEY_TYPE) {
      to.transfer(input[2]);
    } else if (input[3] == DAI_TOKEY_TYPE) {
      require(
        dai.transfer(to, input[2]),
        "dai transfer failed"
      );
    }
  }
}