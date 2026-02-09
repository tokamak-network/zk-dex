const TimeLock = artifacts.require('TimeLock');

module.exports = async function(callback) {
  try {
    const timeLock = await TimeLock.deployed();
    const accounts = await web3.eth.getAccounts();

    console.log('=== TimeLock Spend Debug ===');
    console.log('TimeLock address:', timeLock.address);
    console.log('Development mode:', await timeLock.development());

    // Get all TimeLockCreated events
    const events = await timeLock.getPastEvents('TimeLockCreated', { fromBlock: 0 });
    console.log('\nTimeLockCreated events:', events.length);

    for (const event of events) {
      const noteHash = event.returnValues.noteHash;
      const value = event.returnValues.value;
      const tokenType = event.returnValues.tokenType;
      const unlockTime = event.returnValues.unlockTime;

      console.log('\n--- Note ---');
      console.log('Hash:', noteHash);
      console.log('Value:', value);
      console.log('TokenType:', tokenType);
      console.log('UnlockTime:', unlockTime);

      // Check note state
      const state = await timeLock.notes(noteHash);
      console.log('State:', state.toString(), state.toString() === '1' ? '(Valid)' : '(Not Valid)');

      // Check if time-lock note
      const isTimeLocked = await timeLock.isTimeLocked(noteHash);
      console.log('IsTimeLocked:', isTimeLocked);

      // Current block timestamp
      const block = await web3.eth.getBlock('latest');
      console.log('Current block.timestamp:', block.timestamp);
      console.log('UnlockTime passed:', Number(block.timestamp) >= Number(unlockTime));

      // If note is valid and unlocked, try to spend it
      if (state.toString() === '1' && Number(block.timestamp) >= Number(unlockTime)) {
        console.log('\n>>> Attempting to spend this note...');

        const mockProof = {
          a: ['1', '2'],
          b: [['3', '4'], ['5', '6']],
          c: ['7', '8']
        };

        // Generate random output hash
        const outputHash = web3.utils.randomHex(32);
        const currentTime = block.timestamp;

        // input: [output, noteHash, outputHash, currentTime, tokenType]
        const input = ['1', noteHash, outputHash, currentTime.toString(), tokenType];

        console.log('Input:', input);

        try {
          const tx = await timeLock.spendTimeLock(
            mockProof.a,
            mockProof.b,
            mockProof.c,
            input,
            '0x1234',
            { from: accounts[0] }
          );
          console.log('SUCCESS! TX:', tx.tx);
        } catch (err) {
          console.log('FAILED:', err.message);
        }
      }
    }

    callback();
  } catch (err) {
    console.log('Error:', err.message);
    callback(err);
  }
};
