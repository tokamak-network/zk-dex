const Docker = require('dockerode');
const BN = require('bn.js');
const Web3Utils = require('web3-utils');
const util = require('./util');
const noteHelper = require('../helper/noteHelper');

const { constants } = require('./Note');
const { getMintAndBurnCommand } = require('../helper/mintNBurnNoteHelper');
const { getTransferParams } = require('../helper/transferNoteHelper');
const { getMakeOrderCommand } = require('../helper/makeOrderHelper');
const { getTakeOrderCommand } = require('../helper/takeOrderHelper');
const { getSettleOrderCommand } = require('../helper/settleOrderHelper');


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
        console.log(data.toString());
        chunks.push(data.toString());
      });
    });
  });
}

const convert = v => Web3Utils.toBN(v, 16);

async function getMintNBurnProof(note) {
  const cmdArgs = getMintAndBurnCommand(
    convert(note.owner),
    convert(note.value),
    convert(note.token),
    convert(note.viewingKey),
    convert(note.salt),
    convert(note.isSmart),
  );
  console.log('cmdArgs', cmdArgs);

  const proof = await execute('mintNBurnNote', `${cmdBase} ${cmdArgs}`);
  return util.parseProofObj(proof);
}

async function getTransferProof(oldNote, newNote1, newNote2, originalNote = null) {
  if (!originalNote) {
    originalNote = constants.EMPTY_NOTE;
  }
  const cmdArgs = getTransferParams(
    convert(oldNote.owner),
    convert(oldNote.value),
    convert(oldNote.token),
    convert(oldNote.viewingKey),
    convert(oldNote.salt),
    convert(oldNote.isSmart),
    convert(newNote1.owner),
    convert(newNote1.value),
    convert(newNote1.token),
    convert(newNote1.viewingKey),
    convert(newNote1.salt),
    convert(newNote1.isSmart),
    convert(newNote2.owner),
    convert(newNote2.value),
    convert(newNote2.token),
    convert(newNote2.viewingKey),
    convert(newNote2.salt),
    convert(newNote2.isSmart),
    convert(originalNote.owner),
    convert(originalNote.value),
    convert(originalNote.token),
    convert(originalNote.viewingKey),
    convert(originalNote.salt),
    convert(originalNote.isSmart),
  );

  const proof = await execute('transferNote', `${cmdBase} ${cmdArgs}`);
  return util.parseProofObj(proof);
}

async function getMakeOrderProof(makerNote) {
  const cmdArgs = getMakeOrderCommand(
    convert(makerNote.owner),
    convert(makerNote.value),
    convert(makerNote.token),
    convert(makerNote.viewingKey),
    convert(makerNote.salt),
    convert(makerNote.isSmart),
  );

  const proof = await execute('makeOrder', `${cmdBase} ${cmdArgs}`);
  return util.parseProofObj(proof);
}

async function getTakeOrderProof(makerNoteHash, parentNote, stakeNote) {
  const cmdArgs = getTakeOrderCommand(
    convert(parentNote.owner),
    convert(parentNote.value),
    convert(parentNote.token),
    convert(parentNote.viewingKey),
    convert(parentNote.salt),
    convert(parentNote.isSmart),
    convert(makerNoteHash),
    convert(stakeNote.value),
    convert(stakeNote.token),
    convert(stakeNote.viewingKey),
    convert(stakeNote.salt),
    convert(stakeNote.isSmart),
  );
  const proof = await execute('takeOrder', `${cmdBase} ${cmdArgs}`);
  return util.parseProofObj(proof);
}

async function getSettleOrderProof(makerNote, stakeNote, rewardNote, paymentNote, changeNote, price) {
  const cmdArgs = getSettleOrderCommand(
    convert(makerNote.owner),
    convert(makerNote.value),
    convert(makerNote.token),
    convert(makerNote.viewingKey),
    convert(makerNote.salt),
    convert(makerNote.isSmart),
    convert(stakeNote.owner),
    convert(stakeNote.value),
    convert(stakeNote.token),
    convert(stakeNote.viewingKey),
    convert(stakeNote.salt),
    convert(stakeNote.isSmart),
    convert(rewardNote.owner),
    convert(rewardNote.value),
    convert(rewardNote.token),
    convert(rewardNote.viewingKey),
    convert(rewardNote.salt),
    convert(rewardNote.isSmart),
    convert(paymentNote.owner),
    convert(paymentNote.value),
    convert(paymentNote.token),
    convert(paymentNote.viewingKey),
    convert(paymentNote.salt),
    convert(paymentNote.isSmart),
    convert(changeNote.owner),
    convert(changeNote.value),
    convert(changeNote.token),
    convert(changeNote.viewingKey),
    convert(changeNote.salt),
    convert(changeNote.isSmart),
    convert(price),
  );

  const proof = await execute('settleOrder', `${cmdBase} ${cmdArgs}`);
  return util.parseProofObj(proof);
}

function hash(note) {
  return util.marshal(noteHelper.getNoteHash(
    util.unmarshal(note.owner),
    util.unmarshal(note.value),
    util.unmarshal(note.token),
    util.unmarshal(note.viewingKey),
    util.unmarshal(note.salt),
    util.unmarshal(note.isSmart),
  ));
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
