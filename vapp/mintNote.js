const fs = require('fs');
const BN = require('bn.js');

const Docker = require('dockerode');

const noteHelper = require('./scripts/helper/noteHelper.js');

let Proof // global Variable to store Proof.

// generate compute-witness params with helper function.
function getMintAndBurnCmd(owner, value, type, viewKey, salt, isSmart) {
  // TODO : we should check process empty arguments
  console.log("input Args : ", owner, value, type, viewKey, salt, isSmart);
  let params = noteHelper.getNoteParams(owner, value, type, viewKey, salt, isSmart);
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


// runGenProof("1111111111111121111111111111111111111111111111111111111111111111",
//              "0",
//              "0",
//              "1111111111111111111111111111111111111111111111111111111111111111",
//              "0",
//              "0"
//              );

export default runGenProof // vuejs can import only default exported..

// module.exports = {
//     runGenProof
// }
