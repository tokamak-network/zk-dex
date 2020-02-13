//  run with jest

const express = require('express');
const bodyParser = require('body-parser');
const keythereum = require('keythereum');
const { range } = require('lodash');
const rlp = require('rlp');

const moxios = require('moxios');
const request = require('supertest');

const {
  addZkPrefix,
  removeZkPrefix,
} = require('zk-dex-keystore/lib/utils');

const { ZkDexAddress, ZkDexPublicKey } = require('zk-dex-keystore/lib/Account');

const Web3 = require('web3');
const web3Utils = require('web3-utils');
const Contract = require('truffle-contract');

require('dotenv').config();

const router = require('./router');

const { initialized } = require('../scripts/lib/dockerUtils');
const { constants, Note, NoteState } = require('../scripts/lib/Note');
const { marshal, unmarshal } = require('../scripts/lib/util');
const { ZkDexService } = require('./zkdex-service');
const DB = require('./localstorage');

const PROVIDER_URL = 'ws://localhost:8545';
const web3 = new Web3(PROVIDER_URL);

const ZkDex = Contract(require('../build/contracts/ZkDex.json'));
const Dai = Contract(require('../build/contracts/MockDai.json'));

ZkDex.setProvider(web3.currentProvider);
Dai.setProvider(web3.currentProvider);

const { BN, toHex, toBN, padRight } = web3Utils;


const USE_DUMMY = process.env.USE_DUMMY === 'true';

console.log('USE_DUMMY', USE_DUMMY);

const initApp = async () => {
  const app = express();
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));
  router(app);

  const zkdexService = new ZkDexService();
  await zkdexService.init(PROVIDER_URL);

  app.zkdexService = zkdexService;

  return { app, zkdexService };
};

const ether = n => web3Utils.toBN(n).mul(web3Utils.toBN(1e18.toString(10)));

describe('Vapp API Router', () => {
  // contract instances
  let zkdex;
  let dai;

  // express app
  let app;

  let zkdexService;

  const userKey = web3Utils.randomHex(16);

  const vk = web3Utils.randomHex(16);

  const passphrase = 'test-passphrase';

  const zkdexAddresses = [];
  let zkdexAccounts;

  let ethAccounts;

  beforeAll(async () => {
    const res = await initApp();
    app = res.app;
    zkdexService = res.zkdexService;

    await initialized();
    moxios.install();

    ethAccounts = await web3.eth.getAccounts();
    zkdex = await ZkDex.deployed();
    dai = await Dai.deployed();

    await Promise.all(ethAccounts.map(a => dai.mint({ from: a })));
    await Promise.all(ethAccounts.map(a =>
      dai.approve(zkdex.address, ether(10000), {
        from: a,
      }))
    );
  });

  afterAll(() => {
    moxios.uninstall();
    zkdexService.close();
  });

  describe('Without Circuit', () => {
    describe('/vk', () => {
      test('it should create new vk', () => request(app)
        .post(`/vk/${userKey}`)
        .send({ vk })
        .expect(200));

      test('it should get vk', () => request(app)
        .get(`/vk/${userKey}`)
        .expect(200, { vks: [vk] }));
    });

    describe('/accounts', () => {
      test('it should create new account', done => request(app)
        .post(`/accounts/${userKey}`)
        .send({ passphrase })
        .end((err, res) => {
          if (err) return done(err);
          expect(res.status).toEqual(200);
          zkdexAddresses.push(res.body.address);
          done();
        }));

      test('it should create second account', done => request(app)
        .post(`/accounts/${userKey}`)
        .send({ passphrase })
        .end((err, res) => {
          if (err) return done(err);
          expect(res.status).toEqual(200);
          zkdexAddresses.push(res.body.address);
          done();
        }));

      test('it should fetch 2 accounts', done => request(app)
        .get(`/accounts/${userKey}`)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.status).toEqual(200);
          expect(res.body.addresses.length).toEqual(2);
          zkdexAccounts = DB.getAccounts(userKey);
          done();
        }));

      test('it should delete 1st account', (done) => {
        console.log('zkdexAddresses', zkdexAddresses);
        const address = zkdexAddresses[0];
        return request(app)
          .delete(`/accounts/${userKey}`)
          .send({ address })
          .end((err, res) => {
            if (err) return done(err);
            expect(res.status).toEqual(200);
            expect(res.body.address).toEqual(address);
            zkdexAddresses.shift(0);
            zkdexAccounts = DB.getAccounts(userKey);
            done();
          });
      });

      test('it should delete 2nd account', (done) => {
        const address = zkdexAddresses[0];
        expect(address).toBeTruthy();
        return request(app)
          .delete(`/accounts/${userKey}`)
          .send({ address })
          .end((err, res) => {
            if (err) return done(err);

            expect(res.status).toEqual(200);
            expect(res.body.address).toEqual(address);
            zkdexAddresses.shift(0);
            zkdexAccounts = DB.getAccounts(vk);
            done();
          });
      });

      test('it should fetch empty accounts', done => request(app)
        .get(`/accounts/${userKey}`)
        .send({ passphrase })
        .end((err, res) => {
          if (err) return done(err);
          expect(res.status).toEqual(200);
          expect(res.body.addresses).toEqual([]);
          done();
        }));

      test('it should create new account again', done => request(app)
        .post(`/accounts/${userKey}`)
        .send({ passphrase })
        .end((err, res) => {
          if (err) return done(err);
          expect(res.status).toEqual(200);
          zkdexAddresses.push(res.body.address);
          done();
        }));

      test('it should create new account again', done => request(app)
        .post(`/accounts/${userKey}`)
        .send({ passphrase })
        .end((err, res) => {
          if (err) return done(err);
          expect(res.status).toEqual(200);
          zkdexAddresses.push(res.body.address);
          done();
        }));

      test('it should fetch 2 accounts', done => request(app)
        .get(`/accounts/${userKey}`)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.status).toEqual(200);

          const accounts = DB.getAccounts(userKey);

          expect(res.body.addresses).toEqual(accounts.map(account => addZkPrefix(account.address)));
          expect(res.body.addresses.length).toEqual(2);

          zkdexAccounts = accounts;
          done();
        }));


      test('it should unlock account', (done) => {
        const address = zkdexAddresses[0];

        return request(app)
          .post(`/accounts/${userKey}/unlock`)
          .send({ passphrase, address })
          .end((err, res) => {
            if (err) return done(err);
            expect(res.status).toEqual(200);
            expect(res.body.address).toEqual(address);
            expect(res.body.success).toBeTruthy();
            done();
          });
      });


    // TODO: import
    });
  });

  describe('With Circuit', () => {
    const TIMEOUT = USE_DUMMY ? 20000 : 360000; // 1 hour
    const makerUserKey = web3Utils.randomHex(4);
    const takerUserKey = web3Utils.randomHex(4);
    const makerVk = web3Utils.randomHex(constants.VK_BYTES);
    const takerVk = web3Utils.randomHex(constants.VK_BYTES);

    // ZkDexPrivateKey
    let makerPrivKey;
    let takerPrivKey;

    // ZkDexPublicKey
    let makerPubKey;
    let takerPubKey;

    // base58-encoded zk-address
    let makerZkAddress;
    let takerZkAddress;

    // make note
    let daiNote; // daiNote -> daiNote0 + daiNote1
    let ethNote;
    const daiAmount = ether('20');
    const ethAmount = ether('100');

    // spend note
    let daiNote0; // maker note --> make order
    let daiNote1; // taker note --> liquidated
    const spendDaiNoteAmount = daiAmount.div(toBN('2'));

    // over payment order
    const price = ether('2');
    const stakeEthAmount = ethAmount;
    const rewardDaiAmount = spendDaiNoteAmount;
    const paymentEthAmount = spendDaiNoteAmount.mul(price).div(ether('1'));
    const changeEthAmount = stakeEthAmount.sub(paymentEthAmount);
    let changeNoteOwner;

    let makerNote;
    let takerNote;

    let stakeNote;

    let orderId;
    let order;


    beforeAll(async () => {
      // clear other private keys
      zkdexService._privKeys.clear();

      let res;

      // register maker / taker vk
      await request(app)
        .post(`/vk/${makerUserKey}`)
        .send({ vk: makerVk }).expect(200);

      await request(app)
        .post(`/vk/${takerUserKey}`)
        .send({ vk: takerVk }).expect(200);

      // create accounts
      res = await request(app)
        .post(`/accounts/${makerUserKey}`)
        .send({ passphrase })
        .expect(200);
      makerZkAddress = res.body.address;

      res = await request(app)
        .post(`/accounts/${takerUserKey}`)
        .send({ passphrase })
        .expect(200);
      takerZkAddress = res.body.address;

      // convert address to pubkey
      makerPubKey = ZkDexAddress.fromBase58(removeZkPrefix(makerZkAddress)).toPubKey();
      takerPubKey = ZkDexAddress.fromBase58(removeZkPrefix(takerZkAddress)).toPubKey();

      // unlock accounts
      await request(app)
        .post(`/accounts/${makerUserKey}/unlock`)
        .send({ passphrase, address: makerZkAddress, duration: 0 })
        .expect(200, { address: makerZkAddress, success: true });
      await request(app)
        .post(`/accounts/${takerUserKey}/unlock`)
        .send({ passphrase, address: takerZkAddress, duration: 0 })
        .expect(200, { address: takerZkAddress, success: true });

      console.log(`
      makerVk: ${makerVk}
      takerVk: ${takerVk}

      makerUserKey: ${makerUserKey}
      takerUserKey: ${takerUserKey}

      makerPubKey: ${makerPubKey.xToHex()}, ${makerPubKey.yToHex()}
      takerPubKey: ${takerPubKey.xToHex()}, ${takerPubKey.yToHex()}
      `);
    });

    // helper functions
    async function getProof (url, params, owners) {
      const res = await request(app)
        .post(url)
        .send({ params, owners })
        .expect(200);
      return res.body.proof;
    }

    function waitNotes (notes, checkHash = true) {
      let cnt = 0;
      const len = notes.length;

      return new Promise((resolve, reject) => {
        zkdexService.on('note', function (err, decryptedNote) {
          cnt++;

          if (cnt === len) {
            this.removeAllListeners();
          }

          const note = notes.shift();

          if (err) return reject(err);

          // console.error(`
          //   expected note:  ${note.toString()}
          //   decrypted note: ${decryptedNote.toString()}
          //   `);


          if (checkHash && (note.hash() !== decryptedNote.hash())) {
            return reject(new Error('decrypted hash mismatch'));
          }

          if (cnt === len) {
            resolve();
          }
        });

        wait(15 * len).then(() => {
          if (cnt !== len) reject(new Error(`ZkDex service did not received Note#${notes[0].hash()}`));
        }).catch(reject);
      });
    }

    function waitOrder (orderId, e = 'order') {
      console.log(`
        Waiting Order#${orderId} -- eventName: ${e}
      `);

      orderId = toBN(orderId).toNumber();
      let resolved = false;
      return new Promise((resolve, reject) => {
        zkdexService.on(e, function (err, order) {
          if (err) {
            this.removeAllListeners();
            return reject(err);
          }

          console.log(`
          eventName    : ${e}
          emitteOrderId: ${order.orderId}
          targetOrderId: ${orderId}
          same?        : ${order.orderId === orderId}
          `);
          if (order.orderId === orderId) {
            this.removeAllListeners();
            resolved = true;

            console.warn(`
        Catch Order#${orderId} -- eventName: ${e}`);
            resolve(order);
          }
        });

        wait(30).then(() => {
          if (!resolved) {
            console.error(`ZkDex service did not received Order#${orderId} ${e}`);
            reject(new Error(`ZkDex service did not received Order#${orderId} ${e}`));
          }
        }).catch(reject);
      });
    }

    async function createNote (
      // new note data
      pubKey0, pubKey1, tokenType, value,
      // zk-dex user key
      userKey,
      // ethereum transaction sender
      from,
      // note encryption key
      encKey
    ) {
      const note = new Note(pubKey0, pubKey1, value, tokenType, '0x00', getSalt());
      const address = (new ZkDexPublicKey(pubKey0, pubKey1)).toAddress().toString();
      const proof = await getProof(
        '/circuits/mintNBurnNote',
        [
          note,
        ],
        [{ userKey, address }]
      );

      const prom = waitNotes([note]);

      await zkdex.mint(...proof, note.encrypt(encKey), {
        from,
        value: tokenType === constants.ETH_TOKEN_TYPE ? value : 0,
      });

      await prom;

      return note;
    }

    // TODO: add unlocked account test case

    describe('/notes', () => {
      test('it should create a DAI note', async () => {
        daiNote = await createNote(
          makerPubKey.xToHex(), makerPubKey.yToHex(),
          constants.DAI_TOKEN_TYPE,
          daiAmount,
          makerUserKey,
          ethAccounts[0],
          makerVk,
        );
      }, TIMEOUT);

      test('it should fetch maker\'s DAI note', done => request(app)
        .get(`/notes/${makerUserKey}`)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.status).toEqual(200);
          expect(res.body.notes.length).toEqual(1);
          expect(Note.hashFromJSON(res.body.notes[0])).toEqual(daiNote.hash());
          done();
        }));

      test('it should create a ETH note', async () => {
        ethNote = await createNote(
          takerPubKey.xToHex(), takerPubKey.yToHex(),
          constants.ETH_TOKEN_TYPE,
          ethAmount,
          takerUserKey,
          ethAccounts[1],
          takerVk,
        );
      }, TIMEOUT);

      test('it should fetch taker\'s ETH notes', done => request(app)
        .get(`/notes/${takerUserKey}`)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.status).toEqual(200);
          expect(res.body.notes.length).toEqual(1);
          expect(Note.hashFromJSON(res.body.notes[0])).toEqual(ethNote.hash());
          done();
        }));

      test('it should spend a DAI note', async () => {
        daiNote0 = new Note(
          makerPubKey.xToHex(), makerPubKey.yToHex(),
          spendDaiNoteAmount,
          constants.DAI_TOKEN_TYPE,
          '0x00',
          getSalt(),
        );

        daiNote1 = new Note(
          takerPubKey.xToHex(), takerPubKey.yToHex(),
          spendDaiNoteAmount,
          constants.DAI_TOKEN_TYPE,
          '0x00',
          getSalt(),
        );

        const proof = await getProof(
          '/circuits/transferNote',
          [
            daiNote,
            null,
            daiNote0,
            daiNote1,
          ],
          [
            { userKey: makerUserKey, address: makerZkAddress },
            { userKey: null, address: null },
          ]
        );

        await zkdex.spend(
          ...proof,
          daiNote0.encrypt(makerVk),
          daiNote1.encrypt(takerVk),
          {
            from: ethAccounts[0],
          }
        );

        await waitNotes([daiNote0, daiNote1]);
      }, TIMEOUT);

      test('it should fetch maker\'s 2 notes', done => request(app)
        .get(`/notes/${makerUserKey}`)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.status).toEqual(200);
          expect(res.body.notes.length).toEqual(2);
          expect(Note.hashFromJSON(res.body.notes[0])).toEqual(daiNote.hash());
          expect(Note.hashFromJSON(res.body.notes[1])).toEqual(daiNote0.hash());
          done();
        }));

      test('it should fetch taker\'s 2 notes', done => request(app)
        .get(`/notes/${takerUserKey}`)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.status).toEqual(200);
          expect(res.body.notes.length).toEqual(2);
          expect(Note.hashFromJSON(res.body.notes[0])).toEqual(ethNote.hash());
          expect(Note.hashFromJSON(res.body.notes[1])).toEqual(daiNote1.hash());
          done();
        }));

      test('it should fetch maker\'s transfer history', done => request(app)
        .get(`/notes/${makerUserKey}/history`)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.status).toEqual(200);
          expect(res.body.histories.length).toEqual(1);

          const history = res.body.histories[0];

          expect(history.oldNote0Hash).toEqual(daiNote.hash());
          expect(history.oldNote1Hash).toEqual(constants.EMPTY_NOTE_HASH);
          expect(history.newNote0Hash).toEqual(daiNote0.hash());
          expect(history.newNote1Hash).toEqual(daiNote1.hash());
          done();
        }));

      test('it should liquidate dai note 1', async () => {
        const proof = await getProof(
          '/circuits/mintNBurnNote',
          [daiNote1],
          [{ userKey: takerUserKey, address: takerZkAddress }],
        );

        const from = ethAccounts[2];
        const daiBalance0 = await dai.balanceOf(from);
        await zkdex.liquidate(from, ...proof, { from });
        const daiBalance1 = await dai.balanceOf(from);

        expect(daiBalance1.sub(daiBalance0).toString('hex', 64)).toEqual(unmarshal(daiNote1.value));
      }, TIMEOUT);
    });

    describe('/orders', () => {
      beforeAll(() => {
        makerNote = daiNote0;
        takerNote = ethNote;

        stakeNote = Note.createSmartNote(
          makerNote.hash(),
          stakeEthAmount,
          constants.ETH_TOKEN_TYPE,
          takerVk,
          getSalt(),
        );

        console.log(`
        makerNote: ${makerNote.hash()} ${JSON.stringify(makerNote, null, 2)}
        takerNote: ${takerNote.hash()} ${JSON.stringify(takerNote, null, 2)}
        stakeNote: ${stakeNote.hash()} ${JSON.stringify(stakeNote, null, 2)}
        `);

        changeNoteOwner = takerNote.hash();
      });

      describe('Make Order', () => {
        test('it should make a new order#0', async () => {
          orderId = Number(await zkdex.getOrderCount());

          const proof = await getProof('/circuits/makeOrder',
            [
              makerNote,
            ],
            [
              { userKey: makerUserKey, address: makerZkAddress },
            ]
          );

          console.log(`
            makerNoteHash   : ${makerNote.hash()}
            proof.input     : ${JSON.stringify(proof.slice(-1)[0], null, 2)}
          `);

          const prom = waitOrder(orderId, 'order:created');

          await zkdex.makeOrder(
            makerVk,
            constants.ETH_TOKEN_TYPE,
            toHex(price),
            ...proof,
            {
              from: ethAccounts[0],
            },
          );

          order = await prom;
        }, TIMEOUT);

        test('it should fetch all orders', done => request(app)
          .get('/orders')
          .expect(200)
          .end((err, res) => {
            if (err) return done(err);
            order = res.body.orders.pop();
            expect(order).not.toBeUndefined();
            expect(order.makerViewingKey).toEqual(padRight(makerVk, 64));
            expect(order.makerNote).toEqual(makerNote.hash());

            done();
          })
        );

        test('it should fetch new order by id', done => request(app)
          .get(`/orders/${orderId}`)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err);
            expect(res.body.order).not.toBeUndefined();
            expect(res.body.order.makerViewingKey).toEqual(padRight(makerVk, 64));
            expect(res.body.order.makerNote).toEqual(makerNote.hash());
            order = res.body.order;

            done();
          })
        );

        test('it should fetch orders by maker', done => request(app)
          .get(`/accounts/${makerUserKey}/orders`)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err);
            expect(res.body.orders.length).toEqual(1);
            order = res.body.orders.pop();
            expect(order).not.toBeUndefined();
            expect(order.orderId).toEqual(orderId);

            // maker info
            expect(order.makerInfo.makerUserKey).toEqual(makerUserKey);
            expect(Note.hashFromJSON(order.makerInfo.makerNote)).toEqual(makerNote.hash());

            done();
          })
        );
      });

      describe('Take Order', () => {
        test('it should take order', async () => {
          const proof = await getProof(
            '/circuits/takeOrder',
            [
              takerNote,
              stakeNote,
            ],
            [{ userKey: takerUserKey, address: takerZkAddress }],
          );
          const prom = waitOrder(orderId, 'order:taken');

          await zkdex.takeOrder(
            orderId,
            ...proof,
            stakeNote.encrypt(makerVk),
            {
              from: ethAccounts[0],
            }
          );

          order = await prom;
        }, TIMEOUT);

        test('make should have new vk', done => request(app)
          .get(`/vk/${makerUserKey}`)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err);
            const vks = res.body.vks;
            const i = vks.indexOf(makerVk);
            const newVk = vks[i + 1];
            expect(newVk).not.toBeUndefined();
            done();
          })
        );

        test('it should fetch orders by taker', done => request(app)
          .get(`/accounts/${takerUserKey}/orders`)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err);
            expect(res.body.orders.length).toEqual(1);
            order = res.body.orders.pop();
            expect(order).not.toBeUndefined();
            expect(order.orderId).toEqual(orderId);

            // maker info
            expect(order.takerInfo.takerUserKey).toEqual(takerUserKey);
            expect(Note.hashFromJSON(order.takerInfo.takerNote)).toEqual(takerNote.hash());

            done();
          })
        );

        test('it should fetch orders by maker', done => request(app)
          .get(`/accounts/${makerUserKey}/orders`)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err);

            expect(res.body.orders.length).toEqual(1);
            order = res.body.orders.pop();
            expect(order).not.toBeUndefined();
            expect(order.orderId).toEqual(orderId);
            expect(order.taken).toEqual(true);

            // maker info
            expect(order.makerInfo.makerUserKey).toEqual(makerUserKey);
            expect(Note.hashFromJSON(order.makerInfo.stakeNote)).toEqual(stakeNote.hash());

            // notes used to settle
            expect(web3Utils.hexToNumberString(order.makerInfo.rewardNote.value))
              .toEqual(web3Utils.hexToNumberString(rewardDaiAmount));
            expect(web3Utils.hexToNumberString(order.makerInfo.paymentNote.value))
              .toEqual(web3Utils.hexToNumberString(paymentEthAmount));
            expect(web3Utils.hexToNumberString(order.makerInfo.changeNote.value))
              .toEqual(web3Utils.hexToNumberString(changeEthAmount));

            const e = marshal(
              unmarshal(order.makerInfo.changeNote.pubKey0).slice(constants.PUBKEY_BYTES, constants.PUBKEY_BYTES * 2)
              + unmarshal(order.makerInfo.changeNote.pubKey1).slice(constants.PUBKEY_BYTES, constants.PUBKEY_BYTES * 2)
            );

            expect(e).toEqual(changeNoteOwner);

            done();
          })
        );
      });


      describe('Settle Order', () => {
        test('should settle order', async () => {
          const proof = await getProof(
            '/circuits/settleOrder',
            [
              order.makerInfo.makerNote,
              order.makerInfo.stakeNote,
              order.makerInfo.rewardNote,
              order.makerInfo.paymentNote,
              order.makerInfo.changeNote,
              toHex(price),
            ],
            [{ userKey: makerUserKey, address: makerZkAddress }],
          );


          const prom = waitOrder(orderId, 'order:settled');

          // console.error(`settleorder proof length: ${proof.length}`);

          await zkdex.settleOrder(
            orderId,
            ...proof,
            rlp.encode([
              Note.fromJSON(order.makerInfo.rewardNote).encrypt(order.makerInfo.rewardNoteEncKey),
              Note.fromJSON(order.makerInfo.paymentNote).encrypt(order.makerInfo.paymentNoteEncKey),
              Note.fromJSON(order.makerInfo.changeNote).encrypt(order.makerInfo.changeNoteEncKey),
            ]),
            {
              from: ethAccounts[0],
            }
          );

          order = await prom;
        }, TIMEOUT);

        test('should fetch order by id', done => request(app)
          .get(`/orders/${orderId}`)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err);
            expect(res.body.order.settled).toEqual(true);
            expect(res.body.order.taken).toEqual(true);
            order = res.body.order;

            done();
          }), TIMEOUT);

        test('should convert smart notes', async () => {
          console.log(`
------------------------------
------------------------------


          order:
${JSON.stringify(order, null, 2)}

------------------------------
------------------------------
`);

          // smart notes
          const rewardNote = order.takerInfo.rewardNote; // owned by takerNote
          const paymentNote = order.makerInfo.paymentNote; // owned by makerNote

          // converted notes
          const convertedNote0 = new Note(
            takerPubKey.xToHex(), takerPubKey.yToHex(),
            rewardNote.value,
            rewardNote.token,
            '0x00',
            getSalt(),
          );
          const convertedNote1 = new Note(
            makerPubKey.xToHex(), makerPubKey.yToHex(),
            paymentNote.value,
            paymentNote.token,
            '0x00',
            getSalt(),
          );

          const proof0 = await getProof(
            '/circuits/convertNote',
            [rewardNote, takerNote, convertedNote0],
            [{ userKey: takerUserKey, address: takerZkAddress }]
          );

          const proof1 = await getProof(
            '/circuits/convertNote',
            [paymentNote, makerNote, convertedNote1],
            [{ userKey: makerUserKey, address: makerZkAddress }]
          );

          const prom = waitNotes([convertedNote0, convertedNote1]);

          await zkdex.convertNote(
            ...proof0,
            convertedNote0.encrypt(takerVk),
            {
              from: ethAccounts[0],
            },
          );

          await zkdex.convertNote(
            ...proof1,
            convertedNote1.encrypt(makerVk),
            {
              from: ethAccounts[0],
            },
          );

          await prom;

          expect(await zkdex.notes(order.rewardNote)).toEqual(NoteState.Spent);
          expect(await zkdex.notes(order.paymentNote)).toEqual(NoteState.Spent);
          expect(await zkdex.notes(convertedNote0.hash())).toEqual(NoteState.Valid);
          expect(await zkdex.notes(convertedNote1.hash())).toEqual(NoteState.Valid);
        }, TIMEOUT);
      });
    });
  });
});

function getSalt () {
  return web3Utils.randomHex(16);
}

async function waitBlock (n) {
  n = web3Utils.toBN(n);
  const bn1 = await web3.eth.getBlockNumber();
  const expected = bn1 + n;

  return new Promise(async (resolve) => {
    const f = () => setTimeout(async () => {
      const bn2 = await web3.eth.getBlockNumber();

      if (bn2 < expected) {
        return f();
      }
      resolve();
    }, 500);

    f();
  });
}

function wait (t) {
  const sec = t * 1000;
  return new Promise((resolve) => {
    setTimeout(resolve, sec);
  });
}
