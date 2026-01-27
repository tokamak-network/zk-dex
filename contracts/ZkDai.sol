// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./MintNotes.sol";
import "./SpendNotes.sol";
import "./LiquidateNotes.sol";


/**
 * @title ZkDai
 * @dev Main contract that composes minting, spending, and liquidating of private notes
 *      backed by ETH or DAI tokens. Provides user-facing functions (mint, spend, liquidate)
 *      that handle token transfers and delegate zk-SNARK proof verification to the
 *      respective modules.
 */
contract ZkDai is MintNotes, SpendNotes, LiquidateNotes {
  /**
   * @dev Initializes the ZkDai contract with development mode, DAI token address,
   *      and the Groth16 verifier contracts for minting and spending notes.
   * @param _development When true, bypasses zk-SNARK proof verification for testing
   * @param _dai The address of the DAI ERC20 token contract
   * @param _mintNoteVerifier The verifier contract for mint and liquidate note proofs
   * @param _spendNoteVerifier The verifier contract for transfer (spend) note proofs
   */
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
  * @notice Input format (snarkjs/Poseidon): [output, noteHash, value, tokenType]
  * @param input Public inputs of the zkSnark
  */
  function mint(
    uint256[2] calldata a,
    uint256[2][2] calldata b,
    uint256[2] calldata c,
    uint256[4] calldata input,
    bytes calldata encryptedNote
  )
    external
    payable
  {
    // input[2] = value, input[3] = tokenType (Poseidon version)
    if (input[3] == ETH_TOKEN_TYPE) {
      require(msg.value == input[2],"ether amount doesn't match");
    } else if (input[3] == DAI_TOKEN_TYPE) {
      require(msg.value == 0, "msg.value should be 0 for creating dai note");
      require(
        dai.transferFrom(msg.sender, address(this), input[2]),
        "dai transfer failed"
      );
    }

    MintNotes.submit(a, b, c, input, encryptedNote);
  }

  /**
  * @dev Submits the zkSnark proof to be able to spend a note and create two new notes
  * @notice Groth16 proof format: a, b, c
  * @notice Input format (snarkjs/Poseidon): [output, o0Hash, o1Hash, newHash, changeHash]
  * @param input Public inputs of the zkSnark
  */
  function spend(
    uint256[2] calldata a,
    uint256[2][2] calldata b,
    uint256[2] calldata c,
    uint256[5] calldata input,
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
  * @notice Input format (snarkjs/Poseidon): [output, noteHash, value, tokenType]
  * @param input Public inputs of the zkSnark
  */
  function liquidate(
    address payable to,
    uint256[2] calldata a,
    uint256[2][2] calldata b,
    uint256[2] calldata c,
    uint256[4] calldata input
  )
    external
  {
    LiquidateNotes.submit(to, a, b, c, input);

    // input[2] = value, input[3] = tokenType (Poseidon version)
    if (input[3] == ETH_TOKEN_TYPE) {
      to.transfer(input[2]);
    } else if (input[3] == DAI_TOKEN_TYPE) {
      require(
        dai.transfer(to, input[2]),
        "dai transfer failed"
      );
    }
  }
}
