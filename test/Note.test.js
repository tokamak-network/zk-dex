const { expect } = require('chai');
const rlp = require('rlp');

const KeyStore = require('zk-dex-keystore');
const ZkDexPrivateKey = KeyStore.ZkDexPrivateKey;

const { toBN, randomHex } = require('web3-utils');

const {marshal, unmarshal} = require('../scripts/lib/util');
const { getNoteHash } = require('../scripts/helper/noteHelper');

const { getMintNBurnProof } = require('../scripts/lib/dockerUtils');

const {
  constants,
  Note,
  NoteState,
  decrypt,
  createProof
} = require('../scripts/lib/Note');

const { Wallet } = require('../scripts/lib/Wallet');

const privKey = ZkDexPrivateKey.randomPrivateKey();
const pubKey = privKey.toPubKey();

describe("Note class", () => {
  describe("#hash", () => {
    it.skip("should return correct hash", () => {
      const arr = [];
      arr.push("255813832693635097065676052633603542908");
      arr.push("329284760944238137919747288476235081528");
      arr.push("0");
      arr.push("0");
      arr.push("22685491128062564526039545674804039953");
      arr.push("22685491128062564230891640495451214097");
      arr.push("22685491128062564230891640495451214097");
      arr.push("22685491128062564230891640495451214097");
      arr.push("0");
      arr.push("0");
      arr = arr.map(toBN)


      const testNote = new Note(
        marshal(arr[3] + arr[4]),
        marshal(arr[5]),
        marshal(arr[6]),
        marshal(arr[7] + arr[8]),
        marshal(arr[9]),
        marshal(arr[10]),
      );

      const testHash = marshal(arr[0] + arr[1]);

      if(testNote.hash() !== testHash) {
        throw new Error( "note hash doesn't match!")
      }
    });

    describe('normal note', () => {
      const normalNote = new Note(
        pubKey.xToHex(), pubKey.yToHex(),
        toBN(randomHex(16)),
        constants.DAI_TOKEN_TYPE,
        toBN(randomHex(16)),
        toBN(randomHex(16)),
      );

      const smartNote = new Note(
        normalNote.hash(), null,
        toBN(randomHex(16)),
        constants.DAI_TOKEN_TYPE,
        toBN(randomHex(16)),
        toBN(randomHex(16)),
      );


      it("normal note should return correct hash", () => {

        console.log("normalNote", normalNote);

        const hash = getNoteHash(
          unmarshal(normalNote.pubKey0),
          unmarshal(normalNote.pubKey1),
          unmarshal(normalNote.value),
          unmarshal(normalNote.token),
          unmarshal(normalNote.viewingKey),
          unmarshal(normalNote.salt),
        );

        expect(normalNote.hash()).to.be.equal(marshal(hash));
      });

      it("smart note should return correct hash", () => {
        const hash = getNoteHash(
          unmarshal(smartNote.pubKey0),
          unmarshal(smartNote.pubKey1),
          unmarshal(smartNote.value),
          unmarshal(smartNote.token),
          unmarshal(smartNote.viewingKey),
          unmarshal(smartNote.salt),
        );

        expect(smartNote.hash()).to.be.equal(marshal(hash));
      });
    });
  });

})