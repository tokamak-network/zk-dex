<template>
  <div
    v-loading="loading"
    style="height: 100%; text-align: center; margin-top: 150px;"
  >
    <div>
      <el-button
        @click="generateProof">
        generate proof
      </el-button>
    </div>
    <div>
      <p>proof: {{ proof }}</p>
      <p>account: {{ this.coinbase }}</p>
      <p>value: {{ value }}</p>
      <p>token type: dai</p>
      <p>viewing key: {{ viewingKey }}</p>
      <p>salt: {{ salt }}</p>
    </div>
    <div>
      <el-button
        v-bind:disabled="proof === ''"
        @click="mintNote">
        mint note
      </el-button>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import { fetchProof } from '../../api/index';
import Web3Utils from 'web3-utils'
import { Note, dummyProofCreateNote } from '../../services/web3/Note'

const ether = (n) => Web3Utils.toBN(n).mul(Web3Utils.toBN(1e18.toString(10)));

const fs = require('fs');
const BN = require('bn.js');
const crypto = require('crypto');
const Docker = require('dockerode');
const SCALING_FACTOR = new BN('1000000000000000000');

export default {
  data() {
    return {
      loading: false,
      proof: '',
      value: null,
      salt: null
    }
  },
  computed: mapState({
<<<<<<< HEAD
      coinbase: state => state.web3.coinbase,
      web3: state => state.web3.web3Instance,
      contract: state => state.contractInstance()
=======
    myNotes: state => state.myNotes,
    viewingKey: state => state.viewingKey,
    wallet: state => state.wallet,
    dex: state => state.dexContractInstance,
    dai: state => state.daiContractInstance,

    web3: state => state.web3.web3Instance,
    coinbase: state => state.web3.coinbase
>>>>>>> ea2946e1f936141b756063e917dfb63eb9451f9b
  }),
  created () {
    this.value = 3000
    this.salt = Web3Utils.randomHex(16)
  },
  methods: {
<<<<<<< HEAD
    mintNBurn() {
        // console.log("Clicked MintNBurn!!");
        // TODO : get input data from web form
        runGenProof("1111111111111121111111111111111111111111111111111111111111111111",
                    "0",
                    "0",
                    "1111111111111111111111111111111111111111111111111111111111111111",
                    "0",
                    "0");
=======
    generateProof() {
      this.loading = true
      // fetchProof()
      //   .then(
      //     proof => {
      //       this.loading = false
      //       this.proof = JSON.stringify(proof.data.proof, null, 2)
      //     }
      //   )
      //   .catch()
      setTimeout(() => {
        this.loading = false
        this.proof =
`{
  "proof": {
    "A": ["0x1ebd3ba93ae1f0a7cb61c4c0223b2d3f593cd9ea7976cd5e5b47c6761456c847", "0x2044c32f4c51c765693a20c65217290d7b3e2ad6ead397f9390b673a17e96079"],
    "A_p": ["0x1df310dc80836414fb0332d06628eca5b172b56a4e6892a09f8a01069f47cc5a", "0x180361828a69a9b3165ef17661447d7b5b4061df0e1b2366e33e4b9765f0cfcc"],
    "B": [
      ["0x17a7b64179ee2c86f962a09a25ea39253401d0b054f159605118ce8ed83e22e5", "0x28c8b5151c180db95e9eb1ccba363fb798931f01d38591d3a6081328ce45c94c"],
      ["0x194a069c0a2b7c0f198a3d2a6c7753de5d9abe8956348a07d611bc782ffb0146", "0x6800507968aa736f3ee6b10c8ea7f5fcfd157858f11d36ca800becf7a96e525"]
    ],

    "B_p": ["0x2886bcd342c57300ac74e2a3ec3870bd6d82b13a66ab2bd3425a8a423e28df6d", "0x1445d5c9b234318356cd23d5889f12704529b05a3777b67a2a468d4f05c4d853"],
    "C": ["0x230a584beb0fcab0bfcde7ac17d4fe7b7399115018e1dffb2e3a42d68f84c90c", "0x24052feb5111e81d06043638d33a5d90bcc755ae22bafcef551d3ea8946b6ec7"],
    "C_p": ["0x6e7f7364bea9aef0f94b9a7695be1f4860d9e952ba12c988c12ee502665563f", "0x88053e7a885b8b2a052d2db836a20f0e1da7c3e7e4da9007fafc70baf0513b"],
    "H": ["0x2de3d197c35b71922e5f28d740f618e754c3385602ac096489c0d1cf0591b604", "0x11068548997da3e4631e1f8557fddc182ceab9b360e32377290d0d952367e624"],
    "K": ["0x219fd00e97e37d2ebfa37c5a42766c3af1b855d702839df857bf907af66e39be", "0x9ded2a2660333cd94bea038de71504c76a5b5b28837ac9ce0a02b4f19f29f1a"]
  },
  "input": []
}`
      }, 3000)
    },
    mintNote() {
      this.web3.eth.sendTransaction({
        from: this.coinbase,
        to: this.coinbase,
        value: 0,
        gas: 7000000
      }, () => {
        this.myNotes.push({
          token: 'dai',
          value: '3000',
          status: 'valid'
        })
        this.$router.push({ path: '/main' })
      })
>>>>>>> ea2946e1f936141b756063e917dfb63eb9451f9b
    }
    // mintNote() {
    //   const DAI_TOKEN_TYPE = Web3Utils.padLeft('0x1', 64)

    //   const note = new Note(this.coinbase, this.value, DAI_TOKEN_TYPE, this.viewingKey, this.salt);
    //   const vk = this.wallet.getVk(this.coinbase)

    //   this.dai.approve(this.dex.address, this.value, { from: this.coinbase, gas: 7000000 })
    //     .then(tx => {
    //       console.log('tx', tx)
    //     })
    //     .then(() => {
    //       // this.dex.mint(
    //       //   ...(
    //       //     dummyProofCreateNote(note)
    //       //   ),
    //       //   note.encrypt(),
    //       //   {
    //       //     from: this.coinbase
    //       //   }
    //       // )
    //       this.myNotes.push({
    //         token: 'dai',
    //         value: '3000',
    //         status: 'valid'
    //       })
    //     })
    //     .then(() => {
    //       console.log('test', this.wallet.getNotes(this.coinbase))
    //       this.$router.push({ path: '/main' })
    //     })
    //     .catch(error => {
    //       console.log('error', error)
    //     })
    // },
  }
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
