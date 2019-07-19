const BN = require('bn.js');

function printZokratesCommand(params) {
  let cmd = './zokrates compute-witness -a '
  params.forEach(p => {
    cmd += `${new BN(p, 16).toString(10)} `
  })
  console.log(cmd);
  return cmd;
}

module.exports = {
  printZokratesCommand,
}
