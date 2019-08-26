const Docker = require('dockerode');
const BN = require('bn.js');
const Web3Utils = require('web3-utils');
const util = require('./util');

const { constants } = require('./Note');
const { 
  getMintAndBurnCmd,
  getTransferCmd,
  getMakeOrderCmd,
  getTakeOrderCmd,
  getSettleOrderCmd,
} = require('../helper/cmdHelper');

const docker = new Docker();

const SCALING_FACTOR = new BN('1000000000000000000');

let c; // zokrates docker container
const cName = 'zokrates';
const cmdBase = './genProof.sh';

async function execute(circuitName, cmd) {
  // set generated proof file when compute is complate.
  const workingDir = `/home/zokrates/circuits/${circuitName}`; // zokerates container Path

  const exec = await c.exec({
    //  Cmd: ['bash', '-c', "ls -al"],
    Cmd: cmd.split(' '),
    WorkingDir: workingDir,
    AttachStdout: true,
    AttachStderr: true,
  });

  return new Promise(async (resolve, reject) => {
    await exec.start({ hijack: true, stdin: true }, (err, stream) => {
      if (err) {
        console.error(`Failed to execute ${cmd}`, err); // err null
        return reject(err);
      }

      let proof;
      const chunks = [];

      stream.on('end', (err) => {
        if (err) {
          console.error(`Failed to execute ${cmd}`, err); // err null
          return reject(err);
        }

        try {
          proof = chunks[chunks.length - 1];
          const i = proof.indexOf('{');
          proof = proof.slice(i);
          proof = JSON.parse(proof);
        } catch (e) {
          return reject(new Error(`Failed to parse proof json: ${e.message}`));
        }

        if (!proof) {
          return reject(new Error('proof is empty'));
        }

        return resolve(proof);
      });

      stream.on('data', (data) => {
        chunks.push(data.toString());
      });
    });
  });
}

const convert = v => Web3Utils.toBN(v, 16);

async function getMintNBurnProof(note, sk) {
  const cmdArgs = getMintAndBurnCmd(
    convert(note.owner),
    convert(note.value),
    convert(note.token),
    convert(note.viewKey),
    convert(note.salt),
    convert(sk),
  );

  const proof = await execute('mintNBurnNote', `${cmdBase} ${cmdArgs}`);
  return util.parseProofObj(proof);
}

async function getTransferProof(oldNote, sk, newNote1, newNote2, originalNote = null) {
  if (!originalNote) {
    originalNote = constants.EMPTY_NOTE;
  }
  const cmdArgs = getTransferCmd(
    convert(oldNote.owner),
    convert(oldNote.value),
    convert(oldNote.token),
    convert(oldNote.viewKey),
    convert(oldNote.salt),
    convert(sk),
    convert(newNote1.owner),
    convert(newNote1.value),
    convert(newNote1.token),
    convert(newNote1.viewKey),
    convert(newNote1.salt),
    convert(newNote2.owner),
    convert(newNote2.value),
    convert(newNote2.token),
    convert(newNote2.viewKey),
    convert(newNote2.salt),
    convert(originalNote.owner),
    convert(originalNote.value),
    convert(originalNote.token),
    convert(originalNote.viewKey),
    convert(originalNote.salt),
  );

  console.log(cmdArgs);

  const proof = await execute('transferNote', `${cmdBase} ${cmdArgs}`);
  return util.parseProofObj(proof);
}

async function getMakeOrderProof(makerNote, sk) {
  const cmdArgs = getMakeOrderCmd(
    convert(makerNote.owner),
    convert(makerNote.value),
    convert(makerNote.token),
    convert(makerNote.viewKey),
    convert(makerNote.salt),
    convert(sk),
  );

  console.log(cmdArgs);

  const proof = await execute('makeOrder', `${cmdBase} ${cmdArgs}`);
  return util.parseProofObj(proof);
}

async function getTakeOrderProof(parentNote, sk, stakeNote, makerNoteHash) {
  const cmdArgs = getTakeOrderCmd(
    convert(parentNote.owner),
    convert(parentNote.value),
    convert(parentNote.token),
    convert(parentNote.viewKey),
    convert(parentNote.salt),
    convert(sk),
    convert(makerNoteHash),
    convert(stakeNote.value),
    convert(stakeNote.token),
    convert(stakeNote.viewKey),
    convert(stakeNote.salt),
  );

  console.log(cmdArgs);

  const proof = await execute('takeOrder', `${cmdBase} ${cmdArgs}`);
  return util.parseProofObj(proof);
}

async function getSettleOrderProof(makerNote, sk, stakeNote, rewardNote, paymentNote, changeNote, price) {
  const cmdArgs = getSettleOrderCmd(
    convert(makerNote.owner),
    convert(makerNote.value),
    convert(makerNote.token),
    convert(makerNote.viewKey),
    convert(makerNote.salt),
    convert(sk),
    convert(stakeNote.owner),
    convert(stakeNote.value),
    convert(stakeNote.token),
    convert(stakeNote.viewKey),
    convert(stakeNote.salt),
    convert(rewardNote.owner),
    convert(rewardNote.value),
    convert(rewardNote.token),
    convert(rewardNote.viewKey),
    convert(rewardNote.salt),
    convert(paymentNote.owner),
    convert(paymentNote.value),
    convert(paymentNote.token),
    convert(paymentNote.viewKey),
    convert(paymentNote.salt),
    convert(changeNote.owner),
    convert(changeNote.value),
    convert(changeNote.token),
    convert(changeNote.viewKey),
    convert(changeNote.salt),
    convert(price),
    convert(util.getQuotient(Web3Utils.toBN(makerNote.value).mul(Web3Utils.toBN(price)), SCALING_FACTOR)),
    convert(util.getRemainder(Web3Utils.toBN(makerNote.value).mul(Web3Utils.toBN(price)), SCALING_FACTOR)),
    convert(util.getQuotient(Web3Utils.toBN(stakeNote.value), Web3Utils.toBN(price))),
    convert(util.getRemainder(Web3Utils.toBN(stakeNote.value), Web3Utils.toBN(price))),
  );

  console.log(cmdArgs);

  const proof = await execute('settleOrder', `${cmdBase} ${cmdArgs}`);
  return util.parseProofObj(proof);
}

(async () => {
  try {
    const containers = await docker.listContainers();

    c = containers
      .filter(c => c.Names[0].includes(cName))[0];

    console.log('zokrates docker container running ', c.Id);
    c = await docker.getContainer(c.Id);
  } catch (e) {
    console.error('Failed to connect docker container', e);
    process.exit(-1);
  }
})();

module.exports = {
  getMintNBurnProof,
  getTransferProof,
  getMakeOrderProof,
  getTakeOrderProof,
  getSettleOrderProof,
};
