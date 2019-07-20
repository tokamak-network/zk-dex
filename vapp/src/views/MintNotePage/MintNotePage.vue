<template>
  <div>
    <el-button
      @click="mintNBurn">
      mintNBurn
    </el-button>
  </div>
</template>

<script>
import { mapState } from 'vuex'

const fs = require('fs');
const BN = require('bn.js');
const crypto = require('crypto');
const Docker = require('dockerode');
const SCALING_FACTOR = new BN('1000000000000000000');

export default {
  computed: mapState({
      coinbase: state => state.web3.coinbase,
      web3: state => state.web3.web3Instance,
      contract: state => state.contractInstance()
  }),
  methods: {
    mintNBurn() {
        // console.log("Clicked MintNBurn!!");
        // TODO : get input data from web form
        runGenProof("1111111111111121111111111111111111111111111111111111111111111111",
                    "0",
                    "0",
                    "1111111111111111111111111111111111111111111111111111111111111111",
                    "0",
                    "0");
    }
  },
}

function getNoteParams(owner, amount, type, viewKey, salt, isSmart){

  let paddedO = _toPadedObject(owner, amount, type, viewKey, salt, isSmart);
  let noteOwner = paddedO["noteOwner"];
  let splittedNoteOwner = paddedO["splittedNoteOwner"];
  let noteValue =  paddedO["noteValue"];
  let noteType = paddedO["noteType"];
  let noteViewKey = paddedO["noteViewKey"];
  let splittedNoteViewKey = paddedO["splittedNoteViewKey"];
  let noteSalt = paddedO["noteSalt"];
  let noteIsSmart = paddedO["noteIsSmart"];

  //To be hashed, raw note info
  let note = noteOwner + noteValue + noteType + noteViewKey + noteSalt + noteIsSmart;

  let noteHash = toHashed(note);

  const noteParams = noteHash.concat(noteValue, noteType, splittedNoteOwner, splittedNoteViewKey, noteSalt, noteIsSmart);
  console.log(noteParams); //for check parameters
  return noteParams;
}

function getNoteParamsForTransfer(owner, amount, type, viewKey, salt, isSmart){

  let paddedO = _toPadedObject(owner, amount, type, viewKey, salt, isSmart);
  let noteOwner = paddedO["noteOwner"];
  let splittedNoteOwner = paddedO["splittedNoteOwner"];
  let noteValue =  paddedO["noteValue"];
  let noteType = paddedO["noteType"];
  let noteViewKey = paddedO["noteViewKey"];
  let splittedNoteViewKey = paddedO["splittedNoteViewKey"];
  let noteSalt = paddedO["noteSalt"];
  let noteIsSmart = paddedO["noteIsSmart"];

  //To be hashed, raw note info
  let note = noteOwner + noteValue + noteType + noteViewKey + noteSalt + noteIsSmart;

  let noteHash = toHashed(note);

  const noteParams = noteHash.concat(splittedNoteOwner, noteValue, noteType, splittedNoteViewKey, noteSalt, noteIsSmart);
  // console.log(noteParams); //for check parameters
  return noteParams;
}

function _toPadedObject(owner, amount, type, viewKey, salt, isSmart){
  //all params should look like this "0001"(o), "0x0001"(x)
  let noteOwner = new BN(owner, 16).toString(16); //32 bytes = 256 bits
  let splittedNoteOwner = _checkLenAndReturn(noteOwner);

  let noteValue =  new BN(amount, 16).toString(16, 32); //16 bytes = 128 bits
  let noteType = new BN(type, 16).toString(16, 32); //16 bytes = 128 bits

  let noteViewKey = new BN(viewKey, 16).toString(16); //32 bytes = 256 bits

  let splittedNoteViewKey = _checkLenAndReturn(noteViewKey);

  let noteSalt = new BN(salt, 16).toString(16, 32); //16 bytes = 128 bits
  let noteIsSmart = new BN(isSmart, 16).toString(16, 32); //16 bytes = 128 bits

  let result = {
    "noteOwner" : noteOwner,
    "splittedNoteOwner": splittedNoteOwner,
    "noteValue" : noteValue,
    "noteType" : noteType,
    "noteViewKey" : noteViewKey,
    "splittedNoteViewKey" : splittedNoteViewKey,
    "noteSalt" : noteSalt,
    "noteIsSmart" : noteIsSmart
  };

  return result;
}

function _checkLenAndReturn(targetHex){
  let splittedData;
  let targetLen = targetHex.length;
  let remainLen = 64 - targetLen;

  if(targetHex == "0"){
    splittedData = ["0".repeat(32), "0".repeat(32)];
  } else if(targetLen < 32){
    splittedData = ["0".repeat(32), "0".repeat(32-noteOwnerLen).concat(noteOwner.slice(0,32))];
  } else if(targetLen > 32 && targetLen < 64){
    splittedData = ["0".repeat(remainLen).concat(targetHex.slice(0, 32-remainLen)), targetHex.slice(32-remainLen)];
  } else {
    splittedData = [targetHex.slice(0, 32), targetHex.slice(32)];
  }

  return splittedData;
}

function toHashed(encodedValue){
  const buf = Buffer.from(encodedValue, 'hex');
  const digest = crypto.createHash('sha256').update(buf).digest('hex');
  // console.log('digest', digest)
  // split into 128 bits each
  return [digest.slice(0, 32), digest.slice(32)]
}


function getMintAndBurnCmd(owner, value, type, viewKey, salt, isSmart) {
  // TODO : we should check process empty arguments
  console.log("input Args : ", owner, value, type, viewKey, salt, isSmart);
  let params = getNoteParams(owner, value, type, viewKey, salt, isSmart);
  console.log(params);

  let cmd = 'bash genProof.sh ';

    params.forEach(p => {
    cmd += `${new BN(p, 16).toString(10)} `
    })

  return cmd
}

async function execute(container, circuitName, cmd) {
   // set generated proof file when compute is complate.
   const fileName = `./circuit/${circuitName}/${circuitName}Proof.json`; // localHost file path
   const containerPath = `/home/zokrates/circuit/${circuitName}` // zokerates container Path

   const exec = await container.exec({
        Cmd: ['bash', '-c', cmd],
        WorkingDir: containerPath,
        AttachStdout: true,
        AttachStderr: true
    });
    let message = cmd;
    await exec.start({hijack:true, stdin: true}, (err, stream) => {
        console.log('err', err); //err null
        stream.on('end', (err) => {
        console.log('on end', err) // called once with empty arg
        })
        stream.on('data', (data) => {
        console.log('on data', message + data.toString()); // not called

            // After 'compute-witness' process stream data out, then read proofFile.
            Proof = fs.readFileSync(fileName, 'utf8');
            // TODO : return Proof to Vuejs App

            return JSON.parse(Proof);
          });
        });

}

async function runGenProof(owner, value, type, viewKey, salt, isSmart) {
        const docker = new Docker({socketPath: '/var/run/docker.sock'});

        // hardcoded containerId
        // ex> docker inspect zokrates
        //     [
        //         {
        //             "Id": "d7c4e8f00c785ac10d4c2a01e3c3b23797393a3acec38a301ca50fd87a074d4b",
        //             "Created": "2019-07-16T13:51:00.0483562Z",
        //
        const containerId = "367d2bf92cdf4bb372dabe32695514f94d472faff3cafccb238b66313e65ea5f";

        const runCmd = getMintAndBurnCmd(owner, value, type, viewKey, salt, isSmart);

        // Execute 'generate Proof' on zokrates docker container
        const container = await docker.getContainer(containerId);
        const result = await execute(container, "mintNBurnNote", runCmd);

    return result
}

</script>
