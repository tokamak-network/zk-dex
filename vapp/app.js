var express = require('express');
var cors = require('cors')

var app = express();
app.use(cors()) // Use this after the variable declaration

app.get('/', function (req, res) {
  runGenProof(
    "1111111111111121111111111111111111111111111111111111111111111111",
    "0",
    "0",
    "1111111111111111111111111111111111111111111111111111111111111111",
    "0",
    "0"
  ).then(proof => {
    return res.send(proof);
  })
});

app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});

const fs = require('fs')
const BN = require('bn.js')
const crypto = require('crypto')
const Docker = require('dockerode')

function getNoteParams(owner, amount, type, viewKey, salt, isSmart) {
  let paddedO = _toPadedObject(owner, amount, type, viewKey, salt, isSmart)
  let noteOwner = paddedO["noteOwner"]
  let splittedNoteOwner = paddedO["splittedNoteOwner"]
  let noteValue = paddedO["noteValue"]
  let noteType = paddedO["noteType"]
  let noteViewKey = paddedO["noteViewKey"]
  let splittedNoteViewKey = paddedO["splittedNoteViewKey"]
  let noteSalt = paddedO["noteSalt"]
  let noteIsSmart = paddedO["noteIsSmart"]
  //To be hashed, raw note info
  let note = noteOwner + noteValue + noteType + noteViewKey + noteSalt + noteIsSmart
  let noteHash = toHashed(note)
  const noteParams = noteHash.concat(noteValue, noteType, splittedNoteOwner, splittedNoteViewKey, noteSalt, noteIsSmart)
  console.log(noteParams) //for check parameters
  return noteParams
}

function getNoteParamsForTransfer(owner, amount, type, viewKey, salt, isSmart) {
  let paddedO = _toPadedObject(owner, amount, type, viewKey, salt, isSmart)
  let noteOwner = paddedO["noteOwner"]
  let splittedNoteOwner = paddedO["splittedNoteOwner"]
  let noteValue = paddedO["noteValue"]
  let noteType = paddedO["noteType"]
  let noteViewKey = paddedO["noteViewKey"]
  let splittedNoteViewKey = paddedO["splittedNoteViewKey"]
  let noteSalt = paddedO["noteSalt"]
  let noteIsSmart = paddedO["noteIsSmart"]
  //To be hashed, raw note info
  let note = noteOwner + noteValue + noteType + noteViewKey + noteSalt + noteIsSmart
  let noteHash = toHashed(note)
  const noteParams = noteHash.concat(splittedNoteOwner, noteValue, noteType, splittedNoteViewKey, noteSalt, noteIsSmart)
  // console.log(noteParams) //for check parameters
  return noteParams
}

function _toPadedObject(owner, amount, type, viewKey, salt, isSmart) {
  //all params should look like this "0001"(o), "0x0001"(x)
  let noteOwner = new BN(owner, 16).toString(16) //32 bytes = 256 bits
  let splittedNoteOwner = _checkLenAndReturn(noteOwner)
  let noteValue = new BN(amount, 16).toString(16, 32) //16 bytes = 128 bits
  let noteType = new BN(type, 16).toString(16, 32) //16 bytes = 128 bits
  let noteViewKey = new BN(viewKey, 16).toString(16) //32 bytes = 256 bits
  let splittedNoteViewKey = _checkLenAndReturn(noteViewKey)
  let noteSalt = new BN(salt, 16).toString(16, 32) //16 bytes = 128 bits
  let noteIsSmart = new BN(isSmart, 16).toString(16, 32) //16 bytes = 128 bits
  let result = {
    "noteOwner": noteOwner,
    "splittedNoteOwner": splittedNoteOwner,
    "noteValue": noteValue,
    "noteType": noteType,
    "noteViewKey": noteViewKey,
    "splittedNoteViewKey": splittedNoteViewKey,
    "noteSalt": noteSalt,
    "noteIsSmart": noteIsSmart
  }
  return result
}

function _checkLenAndReturn(targetHex) {
  let splittedData
  let targetLen = targetHex.length
  let remainLen = 64 - targetLen
  if (targetHex == "0") {
    splittedData = ["0".repeat(32), "0".repeat(32)]
  } else if (targetLen < 32) {
    splittedData = ["0".repeat(32), "0".repeat(32 - noteOwnerLen).concat(noteOwner.slice(0, 32))]
  } else if (targetLen > 32 && targetLen < 64) {
    splittedData = ["0".repeat(remainLen).concat(targetHex.slice(0, 32 - remainLen)), targetHex.slice(32 - remainLen)]
  } else {
    splittedData = [targetHex.slice(0, 32), targetHex.slice(32)]
  }
  return splittedData
}

function toHashed(encodedValue) {
  const buf = Buffer.from(encodedValue, 'hex')
  const digest = crypto.createHash('sha256').update(buf).digest('hex')
  // console.log('digest', digest)
  // split into 128 bits each
  return [digest.slice(0, 32), digest.slice(32)]
}

function getMintAndBurnCmd(owner, value, type, viewKey, salt, isSmart) {
  // TODO : we should check process empty arguments
  console.log("input Args : ", owner, value, type, viewKey, salt, isSmart)
  let params = getNoteParams(owner, value, type, viewKey, salt, isSmart)
  console.log(params)
  let cmd = 'bash genProof.sh '
  params.forEach(p => {
    cmd += `${new BN(p, 16).toString(10)} `
  })
  return cmd
}

function runGenProof(owner, value, type, viewKey, salt, isSmart) {
  const docker = new Docker({
    socketPath: '/var/run/docker.sock'
  })

  return new Promise(resolve => {
    let zokrates
    docker.listContainers({ all: true }, function(err, containers) {
      for (let i = 0; i < containers.length; i++) {
        // if your zokrates container name is not `zokrates` is.
        // Should be change `/zokrates` to yours.
        if (containers[i].Names[0] == '/zokrates') {
          zokrates = containers[i]
        }
      }
      const runCmd = getMintAndBurnCmd(owner, value, type, viewKey, salt, isSmart)
      // Execute 'generate Proof' on zokrates docker container
      const container = docker.getContainer(zokrates.Id)
      // execute(container, 'mintNBurnNote', runCmd).then(proof => {
      //   resolve(proof)
      // })
      console.log('runCmd', runCmd)
      execute(container, 'mintNBurnNote', runCmd).then(proof => {
        resolve(proof)
      })
    })
  });
}

function execute(container, circuitName, cmd) {
  const containerPath = `/home/zokrates/circuit/${circuitName}` // zokerates container Path
  const fileName = `/Users/thomashin/Workspace/zk-dex/circuit/${circuitName}/mintNBurnProof.json`
  
  var options = {
    Cmd: ['bash', '-c', cmd],
    WorkingDir: containerPath,
    AttachStdout: true,
    AttachStderr: true
  }

  return new Promise((resolve, reject) => {
    console.log('exec')
    container.exec(options)
      .then(function(exec) {
        exec.start({
          hijack: true,
          stdin: true
        }, (err, stream) => {
          // if (err) reject(err)
          stream.on('end', err => {
            console.log('err1', err)
          })
          stream.on('data', data => {
            // console.log(data)
            const proof = fs.readFileSync(fileName, 'utf8')
            resolve(proof)
          })
        })
      })
      .catch(function (err) {
        console.log('err2', err)
      })
  })
}
