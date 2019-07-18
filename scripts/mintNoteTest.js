const fs = require('fs');
const BN = require('bn.js');
const crypto = require('crypto');

const Docker = require('dockerode');

const noteHelper = require('./helper/noteHelper.js');
const zokratesHelper = require('./helper/zokratesHelper.js');

const SCALING_FACTOR = new BN('1000000000000000000');

let Proof // global Variable to store Proof.

// generate compute-witness params with helper function.
function getMintAndBurnCmd(owner, value, type, viewKey, salt, isSmart){
  let params = noteHelper.getNoteParams(owner, value, type, viewKey, salt, isSmart);
  let cmd = 'bash genProof.sh ';

    params.forEach(p => {
    cmd += `${new BN(p, 16).toString(10)} `
    })

  return cmd
}

// This function should be load input arguments from App(Vuejs).
function loadArgs() {
  owner = "1111111111111111111111111111111111111111111111111111111111111111";
  value = "0"
  type = "0"
  viewKey = "1111111111111111111111111111111111111111111111111111111111111111";
  salt = "0";
  isSmart = "0";

  return getMintAndBurnCmd(owner, value, type, viewKey, salt, isSmart);
}


async function execute(container, circuitName, cmd) {
   // set generated proof file when compute is complate.
   const fileName = `../circuit/${circuitName}/${circuitName}Proof.json`; // localHost file path
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
            console.log(JSON.parse(Proof));
          });
        });

};


(async() => {
    const docker = new Docker({socketPath: '/var/run/docker.sock'});

    // hardcoded containerId
    // ex> docker inspect zokrates
    //     [
    //         {
    //             "Id": "d7c4e8f00c785ac10d4c2a01e3c3b23797393a3acec38a301ca50fd87a074d4b",
    //             "Created": "2019-07-16T13:51:00.0483562Z",
    //
    const containerId = "d7c4e8f00c785ac10d4c2a01e3c3b23797393a3acec38a301ca50fd87a074d4b";
    const runCmd = loadArgs(); // TODO : get params from App Fields.

    // Execute 'generate Proof' on zokrates docker container
    const container = await docker.getContainer(containerId);
    await execute(container, "mintNBurnNote", runCmd);


})().catch(e => console.error('error', e));
