const fs = require('fs');
const BN = require('bn.js');
const crypto = require('crypto');

var Docker = require('dockerode');
var docker = new Docker({socketPath: '/var/run/docker.sock'});

const noteHelper = require('./helper/noteHelper.js');
const zokratesHelper = require('./helper/zokratesHelper.js');

const SCALING_FACTOR = new BN('1000000000000000000');

function getMintAndBurnParams(owner, value, type, viewKey, salt, isSmart){
  let params = noteHelper.getNoteParams(owner, value, type, viewKey, salt, isSmart);
  return params
}

function genProof(container, circuitName, noteParams) {
  var runCmd = "bash genProof.sh " + noteParams
  var containerPath = '/home/zokrates/circuit/' + circuitName
  console.log(containerPath)

  var options = {
    Cmd: ['bash', '-c', runCmd],
    WorkingDir: containerPath,
    AttachStdout: true,
    AttachStderr: true
  };

  container.exec(options, function(err, exec) {
    if (err) return;
    exec.start(function(err, stream) {
      if (err) return;

      container.modem.demuxStream(stream, process.stdout, process.stderr);

      exec.inspect(function(err, data) {
        if (err) return;
        // proof = JSON.parse(data);
        return data;
      });
    });
  });
}

function runZokratesCommand(params) {
    let cmd = '';

    params.forEach(p => {
    cmd += `${new BN(p, 16).toString(10)} `
    })

    docker.listContainers({all: true}, function(err, containers) {
    console.log('err ' + err);

    for (i = 0; i < containers.length; i++) {
        console.log(containers[i].Names);
        // if your zokrates container name is not `zokrates` is.
        // Should be change `/zokrates` to yours.
        if (containers[i].Names[0] == '/zokrates') {
                zokrates = containers[i];
            }
        }

    console.log("selected Container ID :", zokrates.Id);

    var con = docker.getContainer(zokrates.Id);

    // getCreateParams
    genProof(con, "mintNBurnNote", cmd);

    });
}

// Test Create Note
// owner is SmartNote hash - it is hash(Owner + Amount) from Note.
function test(){
  owner = "1111111111111111111111111111111111111111111111111111111111111111";
  value = "0"
  type = "0"
  viewKey = "1111111111111111111111111111111111111111111111111111111111111111";
  salt = "0";
  isSmart = "0";

  var params = getMintAndBurnParams(owner, value, type, viewKey, salt, isSmart);
  runZokratesCommand(params);

}

test();
