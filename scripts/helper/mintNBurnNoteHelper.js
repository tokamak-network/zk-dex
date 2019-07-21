const fs = require('fs');
const BN = require('bn.js');
const crypto = require('crypto');

const Docker = require('dockerode');

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

const noteHelper = require('./noteHelper.js');
const zokratesHelper = require('./zokratesHelper.js');

function reduceParams(params) {
  return params
    .map(p => new BN(p, 16).toString(10))
    .reduce((a, b) => `${a} ${b}`, '').trim();
}

const SCALING_FACTOR = new BN('1000000000000000000');

function getMintAndBurnCommand(owner, value, type, viewKey, salt, isSmart) {
  const params = noteHelper.getNoteParams(owner, value, type, viewKey, salt, isSmart);
  if (require.main === module) {
    zokratesHelper.printZokratesCommand(params);
  }
  return reduceParams(params);
}

function genProof(container, noteParams) {
  const runCmd = `bash getproof.sh ${noteParams}`;


  const options = {
    Cmd: ['bash', '-c', runCmd],
    WorkingDir: '/home/zokrates/circuit/mintNBurnNote',
    AttachStdout: true,
    AttachStderr: true,
  };

  container.exec(options, (err, exec) => {
    if (err) return;
    exec.start((err, stream) => {
      if (err) return;

      container.modem.demuxStream(stream, process.stdout, process.stderr);

      exec.inspect((err, data) => {
        if (err) return;
        proof = JSON.parse(data);
        return data;
      });
    });
  });
}

function runZokratesCommand(params) {
  let cmd = '';

  params.forEach((p) => {
    cmd += `${new BN(p, 16).toString(10)} `;
  });

  docker.listContainers({ all: true }, (err, containers) => {
    console.log(`err ${err}`);

    for (i = 0; i < containers.length; i++) {
      console.log(containers[i].Names);
      // if your zokrates container name is not `zokrates` is.
      // Should be change `/zokrates` to yours.
      if (containers[i].Names[0] == '/zokrates') {
        zokrates = containers[i];
      }
    }

    console.log('selected Container ID :', zokrates.Id);

    const con = docker.getContainer(zokrates.Id);

    // getCreateParams
    genProof(con, cmd);
  });
}

function test1() {
  owner = '1aba488300a9d7297a315d127837be4219107c62c61966ecdf7a75431d75cc61';
  value = '6';
  type = '0';
  viewKey = '1aba488300a9d72s97a315d127837be4219107c62c61966ecdf7a75431d75cc6';
  salt = 'c517f646255d5492089b881965cbd3da';
  isSmart = '0';

  getMintAndBurnCommand(owner, value, type, viewKey, salt, isSmart);
  // input
  // ./zokrates compute-witness -a 42506636700999808740256801842565816051 328950857246332021701192061140886785235 6 0 35527165818681367460734522247605632578 33316299488818974410722173859617164385 35527165818681367352175737833940810724 44617564583168493833591961795197099206 261982333027672377144177477746906878938 0
}

function test2() {
  owner = 'ad4aba886f3dac973beef31e714c11dff0811b69ab55b135d9c56e8b06e27f5c';
  value = '6';
  type = '0';
  viewKey = '1aba488300a9d72s97a315d127837be4219107c62c61966ecdf7a75431d75cc6';
  // salt = "1111111111111111111111111111";
  salt = 'c517f646255d5492089b881965cbd3da';
  isSmart = '0';

  getMintAndBurnCommand(owner, value, type, viewKey, salt, isSmart);
}


function test3() {
  owner = '1aba488300a9d7297a315d127837be4219107c62c61966ecdf7a75431d75cc61';
  value = '6';
  type = '0';
  viewKey = '0';
  // salt = "1111111111111111111111111111";
  salt = 'c517f646255d5492089b881965cbd3da';
  isSmart = '0';

  getMintAndBurnCommand(owner, value, type, viewKey, salt, isSmart);
  // TODO :  it makes an error, because of owner is not 64 bytes and view key is 0
  // not working : ./zokrates compute-witness -a 317338196103683763455787326016028405949 52370317287365943234144238403349548283 6 0 1991934371 238901472809632685297681554166372231397 35527165818681367352175737833940810724 44617564583168493833591961795197099206 261982333027672377144177477746906878938 0
}

function test4() {
  owner = 'ad4aba886f3dac973beef31e714c11dff0811b69ab55b135d9c56e8b06e27f5c';
  value = '6';
  type = '0';
  viewKey = '1111111111111111111111111111111111111111111111111111111111111111';
  // salt = "1111111111111111111111111111";
  salt = 'c517f646255d5492089b881965cbd3da';
  isSmart = '0';

  getMintAndBurnCommand(owner, value, type, viewKey, salt, isSmart);
  // not working : ./zokrates compute-witness -a 317338196103683763455787326016028405949 52370317287365943234144238403349548283 6 0 1991934371 238901472809632685297681554166372231397 35527165818681367352175737833940810724 44617564583168493833591961795197099206 261982333027672377144177477746906878938 0
}

function test5() {
  owner = '1111111111111111111111111111111111111111111111111111111111111111';
  value = '0';
  type = '0';
  viewKey = '1111111111111111111111111111111111111111111111111111111111111111';
  salt = '0';
  isSmart = '0';

  getMintAndBurnCommand(owner, value, type, viewKey, salt, isSmart);
}

// test1();
// test2();
// test3();

module.exports = {
  getMintAndBurnCommand,
};
