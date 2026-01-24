// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./MintNotes.sol";
import "./SpendNotes.sol";
import "./LiquidateNotes.sol";


contract ZkDai is MintNotes, SpendNotes, LiquidateNotes {
  constructor(
    bool _development,
    address _dai,
    IMintNBurnNoteVerifier _mintNoteVerifier,
    ITransferNoteVerifier _spendNoteVerifier
  )
    MintNotes(_mintNoteVerifier)
    SpendNotes(_spendNoteVerifier)
    LiquidateNotes(_mintNoteVerifier)
    ZkDaiBase(_development, _dai, _mintNoteVerifier)
  {}

  /**
  * @dev Transfers specified number of dai tokens to itself and submits the zkSnark proof to mint a new note
  * @notice Groth16 proof format: a, b, c
  * @notice Input format (snarkjs order): [output, nh0, nh1, value, tokenType]
  * @param input Public inputs of the zkSnark
  */
  function mint(
    uint256[2] calldata a,
    uint256[2][2] calldata b,
    uint256[2] calldata c,
    uint256[5] calldata input,
    bytes calldata encryptedNote
  )
    external
    payable
  {
    // input[3] = value, input[4] = tokenType (snarkjs order: output first)
    if (input[4] == ETH_TOKEY_TYPE) {
      require(msg.value == input[3],"ether amount doesn't match");
    } else if (input[4] == DAI_TOKEY_TYPE) {
      require(msg.value == 0, "msg.value should be 0 for creating dai note");
      require(
        dai.transferFrom(msg.sender, address(this), input[3]),
        "dai transfer failed"
      );
    }

    MintNotes.submit(a, b, c, input, encryptedNote);
  }

  /**
  * @dev Submits the zkSnark proof to be able to spend a note and create two new notes
  * @notice Groth16 proof format: a, b, c
  * @param input Public inputs of the zkSnark
  */
  function spend(
    uint256[2] calldata a,
    uint256[2][2] calldata b,
    uint256[2] calldata c,
    uint256[9] calldata input,
    bytes calldata encryptedNote1,
    bytes calldata encryptedNote2
  )
    external
  {
    SpendNotes.submit(a, b, c, input, encryptedNote1, encryptedNote2);
  }

  /**
  * @dev Liquidate a note to transfer the equivalent amount of dai to the recipient
  * @param to Recipient of the dai tokens
  * @notice Groth16 proof format: a, b, c
  * @notice Input format (snarkjs order): [output, nh0, nh1, value, tokenType]
  * @param input Public inputs of the zkSnark
  */
  function liquidate(
    address payable to,
    uint256[2] calldata a,
    uint256[2][2] calldata b,
    uint256[2] calldata c,
    uint256[5] calldata input
  )
    external
  {
    LiquidateNotes.submit(to, a, b, c, input);

    // input[3] = value, input[4] = tokenType (snarkjs order: output first)
    if (input[4] == ETH_TOKEY_TYPE) {
      to.transfer(input[3]);
    } else if (input[4] == DAI_TOKEY_TYPE) {
      require(
        dai.transfer(to, input[3]),
        "dai transfer failed"
      );
    }
  }
}
