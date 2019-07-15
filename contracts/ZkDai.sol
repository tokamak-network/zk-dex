pragma solidity ^0.4.25;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "./MintNotes.sol";
import "./SpendNotes.sol";
import "./LiquidateNotes.sol";


contract ZkDai is MintNotes, SpendNotes, LiquidateNotes {
  constructor(bool _development, address _dai) public ZkDaiBase(_development, _dai) {}

  /**
  * @dev Transfers specified number of dai tokens to itself and submits the zkSnark proof to mint a new note
  * @notice params: a, a_p, b, b_p, c, c_p, h, k zkSnark parameters
  * @param input Public inputs of the zkSnark
  */
  function mintDAI(
    uint256[2] a,
    uint256[2] a_p,
    uint256[2][2] b,
    uint256[2] b_p,
    uint256[2] c,
    uint256[2] c_p,
    uint256[2] h,
    uint256[2] k,
    uint256[4] input,
    bytes encryptedNote
  )
    external
  {
    require(
      dai.transferFrom(msg.sender, address(this), uint256(input[2])),
      "daiToken transfer failed"
    );
    MintNotes.submit(a, a_p, b, b_p, c, c_p, h, k, input, encryptedNote);
  }

  /**
  * @dev Transfers specified number of dai tokens to itself and submits the zkSnark proof to mint a new note
  * @notice params: a, a_p, b, b_p, c, c_p, h, k zkSnark parameters
  * @param input Public inputs of the zkSnark
  */
  function mintETH(
    uint256[2] a,
    uint256[2] a_p,
    uint256[2][2] b,
    uint256[2] b_p,
    uint256[2] c,
    uint256[2] c_p,
    uint256[2] h,
    uint256[2] k,
    uint256[4] input,
    bytes encryptedNote
  )
    external
    payable
  {
    require(msg.value == uint256(input[2]), "eth transfer failed");
    MintNotes.submit(a, a_p, b, b_p, c, c_p, h, k, input, encryptedNote);
  }

  /**
  * @dev Submits the zkSnark proof to be able to spend a note and create two new notes
  * @notice params: a, a_p, b, b_p, c, c_p, h, k zkSnark parameters
  * @param input Public inputs of the zkSnark
  */
  function spend(
    uint256[2] a,
    uint256[2] a_p,
    uint256[2][2] b,
    uint256[2] b_p,
    uint256[2] c,
    uint256[2] c_p,
    uint256[2] h,
    uint256[2] k,
    uint256[7] input,
    bytes encryptedNote1,
    bytes encryptedNote2
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
    address to,
    uint256[2] a,
    uint256[2] a_p,
    uint256[2][2] b,
    uint256[2] b_p,
    uint256[2] c,
    uint256[2] c_p,
    uint256[2] h,
    uint256[2] k,
    uint256[4] input
  )
    external
  {
    LiquidateNotes.submit(to, a, a_p, b, b_p, c, c_p, h, k, input);
  }
}