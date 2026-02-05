const TimeLock = artifacts.require('TimeLock');

module.exports = async function(callback) {
  try {
    const timeLock = await TimeLock.deployed();
    const accounts = await web3.eth.getAccounts();

    // 현재 블록 타임스탬프
    const block = await web3.eth.getBlock('latest');
    console.log('Current timestamp:', block.timestamp);

    // 1분 후로 unlock time 설정
    const unlockTime = Number(block.timestamp) + 60;

    // 테스트용 mock 데이터
    const mockProof = {
      a: ['1', '2'],
      b: [['3', '4'], ['5', '6']],
      c: ['7', '8']
    };

    // 랜덤 노트 해시
    const noteHash = web3.utils.randomHex(32);

    // input: [output, noteHash, value, tokenType, unlockTime]
    const value = web3.utils.toWei('0.001', 'ether');
    const input = ['1', noteHash, value, '0', unlockTime.toString()];

    console.log('TimeLock address:', timeLock.address);
    console.log('Development mode:', await timeLock.development());
    console.log('Account:', accounts[0]);
    console.log('Value:', value);
    console.log('UnlockTime:', unlockTime);
    console.log('NoteHash:', noteHash);

    // 직접 호출 테스트
    const tx = await timeLock.createTimeLock(
      mockProof.a,
      mockProof.b,
      mockProof.c,
      input,
      '0x1234',
      { from: accounts[0], value: value }
    );
    console.log('Success! TX:', tx.tx);

    callback();
  } catch (err) {
    console.log('Error:', err.message);
    callback(err);
  }
};
