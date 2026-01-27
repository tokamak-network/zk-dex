// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Requestable
 * @dev Interface for contracts that support cross-chain request processing between
 *      root chain and child chain via Plasma-style exits and entries.
 */
interface Requestable {
  /**
   * @dev Applies a cross-chain request in the root chain. For exit requests, the note
   *      is imported (handleIn); for enter requests, the note is exported (handleOut).
   * @param isExit Whether the request is an exit (true) or an enter (false)
   * @param requestId The unique identifier of the cross-chain request
   * @param requestor The address that initiated the request
   * @param trieKey The trie key associated with the request
   * @param trieValue The RLP-encoded proof data (Groth16 proof and public inputs)
   * @return success Whether the request was applied successfully
   */
  function applyRequestInRootChain(
    bool isExit,
    uint256 requestId,
    address requestor,
    bytes32 trieKey,
    bytes calldata trieValue
  ) external returns (bool success);

  /**
   * @dev Applies a cross-chain request in the child chain. For exit requests, the note
   *      is exported (handleOut); for enter requests, the note is imported (handleIn).
   *      The direction is inverted compared to root chain processing.
   * @param isExit Whether the request is an exit (true) or an enter (false)
   * @param requestId The unique identifier of the cross-chain request
   * @param requestor The address that initiated the request
   * @param trieKey The trie key associated with the request
   * @param trieValue The RLP-encoded proof data (Groth16 proof and public inputs)
   * @return success Whether the request was applied successfully
   */
  function applyRequestInChildChain(
    bool isExit,
    uint256 requestId,
    address requestor,
    bytes32 trieKey,
    bytes calldata trieValue
  ) external returns (bool success);
}