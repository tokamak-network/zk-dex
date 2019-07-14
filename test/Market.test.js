const Market = artifacts.require("Market");
const MockDai = artifacts.require("MockDai");
const util = require('./util')

const SCALING_FACTOR = 10**18;

contract('Market', function(accounts) {
  let dai, market;

  // Initial setup
  before(async () => {
    dai = await MockDai.new();
    market = await Market.new(0, 10**18, dai.address);

    // check dai balance and approve the zkdai contract to be able to move tokens
    assert.equal(await dai.balanceOf.call(accounts[0]), 100 * SCALING_FACTOR, '100 dai tokens were not assigned to the 1st account');
    assert.equal(await dai.balanceOf.call(market.address), 0, 'Zkdai contract should have 0 dai tokens');
    assert.equal(await dai.balanceOf.call(accounts[0]), 100 * SCALING_FACTOR, 'user should have 100 dai tokens');
    await dai.approve(market.address, 5 * SCALING_FACTOR);

    const proof = util.parseProof('./test/mintNoteProof.json');
    // the zk proof corresponds to a secret note of value 5
    const mint = await market.mint(...proof, {value: 10**18});
    const proofHash = mint.logs[0].args.proofHash;
    assert.equal(await dai.balanceOf.call(market.address), 5 * SCALING_FACTOR, 'Zkdai contract should have 5 dai tokens');
    assert.equal(await dai.balanceOf.call(accounts[0]), 95 * SCALING_FACTOR, 'user should have 95 dai');
    await util.sleep(1);
    await market.commit(proofHash);
  });


})