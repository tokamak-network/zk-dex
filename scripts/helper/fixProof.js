const fs = require('fs');
const path = require('path');
const jsonic = require('jsonic');

function fix(str) {
  const out = jsonic(str);
  out.input = out.input.map((i) => {
    if (i.startsWith('0x')) return i;
    return `0x${i}`;
  });
  return out;
}

function fixProofJson() {
  const filePath = path.join(__dirname, '../zk-related', 'proof.json');
  const out = fix(fs.readFileSync(filePath, 'utf-8'));

  fs.writeFileSync(filePath, JSON.stringify(out, null, 2));
  return out;
}

module.exports = {
  fix,
  fixProofJson,
};
