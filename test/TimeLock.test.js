/**
 * TimeLock Contract Tests (Truffle version)
 * Tests for the TimeLock smart contract
 */

const TimeLock = artifacts.require('TimeLock');
const MockDai = artifacts.require('MockDai');
const CreateTimeLockVerifier = artifacts.require('CreateTimeLockVerifier');
const SpendTimeLockVerifier = artifacts.require('SpendTimeLockVerifier');
const MintBurnNoteVerifier = artifacts.require('MintBurnNoteVerifier');

const crypto = require('crypto');

contract('TimeLock Contract', (accounts) => {
  let timeLock;
  let mockDai;
  const owner = accounts[0];
  const user = accounts[1];

  // Test values
  const noteValue = web3.utils.toWei('1', 'ether'); // 1 ETH
  const daiValue = web3.utils.toWei('50', 'ether'); // 50 DAI (mint gives 100 DAI)
  const ETH_TOKEN_TYPE = 0;
  const DAI_TOKEN_TYPE = 1;

  // Helper to generate random note hash
  function randomNoteHash() {
    return '0x' + crypto.randomBytes(32).toString('hex');
  }

  // Helper to create mock proof
  function mockProof() {
    return {
      a: ['1', '2'],
      b: [['3', '4'], ['5', '6']],
      c: ['7', '8']
    };
  }

  // Helper to get current blockchain time
  async function getBlockTime() {
    const block = await web3.eth.getBlock('latest');
    return block.timestamp;
  }

  // Helper to increase blockchain time
  async function increaseTime(seconds) {
    await web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_increaseTime',
      params: [seconds],
      id: Date.now()
    }, () => {});
    await web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_mine',
      params: [],
      id: Date.now()
    }, () => {});
  }

  // Helper to set next block timestamp and mine
  async function setNextBlockTimestamp(timestamp) {
    await web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_setNextBlockTimestamp',
      params: [timestamp],
      id: Date.now()
    }, () => {});
  }

  beforeEach(async () => {
    // Get deployed contracts from migration
    mockDai = await MockDai.deployed();
    timeLock = await TimeLock.deployed();

    // Mint DAI to user (mint() mints 100 DAI to msg.sender)
    await mockDai.mint({ from: user });

    // Approve DAI spending
    await mockDai.approve(timeLock.address, web3.utils.toWei('1000000', 'ether'), { from: user });
  });

  describe('Create Time-Lock Notes', () => {
    it('should create time-locked note with ETH', async () => {
      const noteHash = randomNoteHash();
      const blockTime = await getBlockTime();
      const unlockTime = blockTime + 3600; // 1 hour from now
      const proof = mockProof();
      const encryptedNote = '0x1234';

      // Public inputs: [output, noteHash, value, tokenType, unlockTime]
      const input = ['1', noteHash, noteValue, ETH_TOKEN_TYPE.toString(), unlockTime.toString()];

      const tx = await timeLock.createTimeLock(
        proof.a,
        proof.b,
        proof.c,
        input,
        encryptedNote,
        { from: user, value: noteValue }
      );

      // Check event
      assert.equal(tx.logs.length > 0, true, 'Should emit events');

      const timeLockCreatedEvent = tx.logs.find(l => l.event === 'TimeLockCreated');
      assert.equal(timeLockCreatedEvent !== undefined, true, 'Should emit TimeLockCreated');
      assert.equal(timeLockCreatedEvent.args.noteHash, noteHash, 'Note hash should match');
      assert.equal(timeLockCreatedEvent.args.value.toString(), noteValue, 'Value should match');

      // Verify note state
      const noteState = await timeLock.notes(noteHash);
      assert.equal(noteState.toString(), '1', 'Note should be Valid (1)');

      const isTimeLocked = await timeLock.isTimeLocked(noteHash);
      assert.equal(isTimeLocked, true, 'Should be marked as time-locked');
    });

    it('should create time-locked note with DAI', async () => {
      const noteHash = randomNoteHash();
      const blockTime = await getBlockTime();
      const unlockTime = blockTime + 3600;
      const proof = mockProof();
      const encryptedNote = '0x5678';

      const input = ['1', noteHash, daiValue, DAI_TOKEN_TYPE.toString(), unlockTime.toString()];

      const balanceBefore = await mockDai.balanceOf(user);

      await timeLock.createTimeLock(
        proof.a,
        proof.b,
        proof.c,
        input,
        encryptedNote,
        { from: user }
      );

      const balanceAfter = await mockDai.balanceOf(user);
      const diff = web3.utils.toBN(balanceBefore).sub(web3.utils.toBN(balanceAfter));
      assert.equal(diff.toString(), daiValue, 'DAI should be transferred');
    });

    it('should reject unlock time in the past', async () => {
      const noteHash = randomNoteHash();
      const blockTime = await getBlockTime();
      const unlockTime = blockTime - 100; // In the past
      const proof = mockProof();

      const input = ['1', noteHash, noteValue, ETH_TOKEN_TYPE.toString(), unlockTime.toString()];

      try {
        await timeLock.createTimeLock(
          proof.a,
          proof.b,
          proof.c,
          input,
          '0x',
          { from: user, value: noteValue }
        );
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.include(error.message, 'Unlock time must be in future');
      }
    });

    it('should reject duplicate note', async () => {
      const noteHash = randomNoteHash();
      const blockTime = await getBlockTime();
      const unlockTime = blockTime + 3600;
      const proof = mockProof();

      const input = ['1', noteHash, noteValue, ETH_TOKEN_TYPE.toString(), unlockTime.toString()];

      // First creation should succeed
      await timeLock.createTimeLock(
        proof.a,
        proof.b,
        proof.c,
        input,
        '0x',
        { from: user, value: noteValue }
      );

      // Second creation with same note hash should fail
      try {
        await timeLock.createTimeLock(
          proof.a,
          proof.b,
          proof.c,
          input,
          '0x',
          { from: user, value: noteValue }
        );
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.include(error.message, 'Note already exists');
      }
    });

    it('should reject ETH value mismatch', async () => {
      const noteHash = randomNoteHash();
      const blockTime = await getBlockTime();
      const unlockTime = blockTime + 3600;
      const proof = mockProof();

      const input = ['1', noteHash, noteValue, ETH_TOKEN_TYPE.toString(), unlockTime.toString()];

      try {
        await timeLock.createTimeLock(
          proof.a,
          proof.b,
          proof.c,
          input,
          '0x',
          { from: user, value: web3.utils.toWei('0.5', 'ether') } // Wrong value
        );
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.include(error.message, 'ETH value mismatch');
      }
    });
  });

  describe('Spend Time-Lock Notes', () => {
    let inputNoteHash;
    let unlockTime;

    beforeEach(async () => {
      // Create a time-locked note first
      inputNoteHash = randomNoteHash();
      const blockTime = await getBlockTime();
      unlockTime = blockTime + 60; // 60 seconds from current block time
      const proof = mockProof();

      const input = ['1', inputNoteHash, noteValue, ETH_TOKEN_TYPE.toString(), unlockTime.toString()];

      await timeLock.createTimeLock(
        proof.a,
        proof.b,
        proof.c,
        input,
        '0x1234',
        { from: user, value: noteValue }
      );
    });

    it('should allow spending after unlock time', async () => {
      // Advance time past the unlock time (60 seconds for the lock + 10 extra)
      await increaseTime(70);

      // Get actual block timestamp after time advancement
      const currentTime = await getBlockTime();

      const outputNoteHash = randomNoteHash();
      const proof = mockProof();
      const encryptedNote = '0x9abc';

      // Public inputs: [output, noteHash, outputHash, currentTime, tokenType]
      const input = ['1', inputNoteHash, outputNoteHash, currentTime.toString(), ETH_TOKEN_TYPE.toString()];

      const tx = await timeLock.spendTimeLock(
        proof.a,
        proof.b,
        proof.c,
        input,
        encryptedNote,
        { from: user }
      );

      // Check events
      const timeLockSpentEvent = tx.logs.find(l => l.event === 'TimeLockSpent');
      assert.equal(timeLockSpentEvent !== undefined, true, 'Should emit TimeLockSpent');

      // Verify states
      const inputState = await timeLock.notes(inputNoteHash);
      assert.equal(inputState.toString(), '3', 'Input note should be Spent (3)');

      const outputState = await timeLock.notes(outputNoteHash);
      assert.equal(outputState.toString(), '1', 'Output note should be Valid (1)');

      const isOutputTimeLocked = await timeLock.isTimeLocked(outputNoteHash);
      assert.equal(isOutputTimeLocked, false, 'Output should not be time-locked');
    });

    it('should reject spending non-timelock note', async () => {
      // Advance time past the unlock time
      await increaseTime(70);

      // Get actual block timestamp
      const currentTime = await getBlockTime();

      const fakeNoteHash = randomNoteHash();
      const outputNoteHash = randomNoteHash();
      const proof = mockProof();

      const input = ['1', fakeNoteHash, outputNoteHash, currentTime.toString(), ETH_TOKEN_TYPE.toString()];

      try {
        await timeLock.spendTimeLock(
          proof.a,
          proof.b,
          proof.c,
          input,
          '0x',
          { from: user }
        );
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.include(error.message, 'Input note not valid');
      }
    });
  });

  describe('View Functions', () => {
    it('should correctly identify time-lock notes', async () => {
      const noteHash = randomNoteHash();

      let isLocked = await timeLock.isTimeLocked(noteHash);
      assert.equal(isLocked, false, 'Should not be time-locked initially');

      const blockTime = await getBlockTime();
      const unlockTime = blockTime + 3600;
      const proof = mockProof();
      const input = ['1', noteHash, noteValue, ETH_TOKEN_TYPE.toString(), unlockTime.toString()];

      await timeLock.createTimeLock(
        proof.a,
        proof.b,
        proof.c,
        input,
        '0x',
        { from: user, value: noteValue }
      );

      isLocked = await timeLock.isTimeLocked(noteHash);
      assert.equal(isLocked, true, 'Should be time-locked after creation');
    });
  });
});
