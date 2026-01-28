/**
 * 테스트 픽스처 — 실제 BabyJubJub/Poseidon으로 계산된 하드코딩 상수
 *
 * 재생성: npx tsx vapp/src/test-utils/generateFixtures.ts
 *
 * 데이터 일관성:
 * - pk = sk * Base8 (BabyJubJub)
 * - address = Poseidon(pk.x, pk.y) & MASK_160
 * - viewingKey = Poseidon(pk.x, pk.y)
 * - noteHash = Poseidon(pkX, pkY, value, token, pkX, pkY, salt)  (7-input)
 */

// ═══════════════════════════════════════════════════════════
// 1. ACCOUNTS — BabyJubJub 키쌍 (ZK-DEX 계정)
// ═══════════════════════════════════════════════════════════

// ALICE
export const ALICE_SK = '0x00000000000000000000000000000000000000000000000000000000cafebabe'
export const ALICE_PK = { x: '0x2b52e1908bed7b1f474026b72e1c887e2c2462cf33b20b5b562e8bc096ee7083', y: '0x14f9761fff9429e5e33dc8b4b43627276fab15d753d758a24b51f1e75ec10a95' }
export const ALICE_ADDRESS = '9afb6f44f6861a2c04f602dc7dbfcf6ade13769d'
export const ALICE_ADDRESS_0X = '0x9afb6f44f6861a2c04f602dc7dbfcf6ade13769d'
export const ALICE_VK = '0x129385bea09db06851bac1249afb6f44f6861a2c04f602dc7dbfcf6ade13769d'

// BOB
export const BOB_SK = '0x00000000000000000000000000000000000000000000000000000000deadbeef'
export const BOB_PK = { x: '0x112737c85d9a368849edcecb5d24f7a953578d5b87065c1f18c93552399b89b6', y: '0x261700c8d02a9e653c79c75db1881c8514e9439d69689b727f022e33ddb46dd2' }
export const BOB_ADDRESS = 'c5c4c225e28b780ad8fd9662c128ae70011d809a'
export const BOB_ADDRESS_0X = '0xc5c4c225e28b780ad8fd9662c128ae70011d809a'
export const BOB_VK = '0x204762c8618fe7d3e0320284c5c4c225e28b780ad8fd9662c128ae70011d809a'

// CAROL
export const CAROL_SK = '0x000000000000000000000000000000000000000000000000000000001234abcd'
export const CAROL_PK = { x: '0x2e7c71efb0873da43935fb72259feefdafb6c56aeefc9e15558fbfb8376b205e', y: '0x120e9546e5eee779fc4b44c15ad586374da0063cdce38e029b4ef1c56e7458d6' }
export const CAROL_ADDRESS = '20cc3261e99b3a5d7c58d46ebc947f5341633f59'
export const CAROL_ADDRESS_0X = '0x20cc3261e99b3a5d7c58d46ebc947f5341633f59'
export const CAROL_VK = '0x00fdf59348487aa77fef4ecb20cc3261e99b3a5d7c58d46ebc947f5341633f59'

// ═══════════════════════════════════════════════════════════
// 2. ETHEREUM ADDRESSES (web3/contract 테스트용)
// ═══════════════════════════════════════════════════════════

export const ETH_ACCOUNT_1 = '0xd8a3f85aa09feebc667f6f612ed6b434322f9ffe'
export const ETH_ACCOUNT_2 = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f'
export const ETH_SIGNER = '0x5b38da6a701c568545dcfcb03fcb875f56beddc4'
export const DEX_CONTRACT = '0xe7f1725e7734ce288f8367e1bb143e90bb3f0512'
export const DAI_CONTRACT = '0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0'

// ═══════════════════════════════════════════════════════════
// 3. SALTS (결정적 값, 254-bit 필드 원소)
// ═══════════════════════════════════════════════════════════

export const SALT_1 = '0x000000000000000000000000000000000000000000000000000000000000e2e1'
export const SALT_2 = '0x000000000000000000000000000000000000000000000000000000000000e2e2'
export const SALT_3 = '0x000000000000000000000000000000000000000000000000000000000000e2e3'
export const SALT_4 = '0x000000000000000000000000000000000000000000000000000000000000e2e4'
export const SALT_5 = '0x000000000000000000000000000000000000000000000000000000000000e2e5'
export const SALT_6 = '0x000000000000000000000000000000000000000000000000000000000000e2e6'
export const SALT_7 = '0x000000000000000000000000000000000000000000000000000000000000e2e7'
export const SALT_8 = '0x000000000000000000000000000000000000000000000000000000000000e2e8'

// ═══════════════════════════════════════════════════════════
// 4. NOTES — Poseidon(pkX, pkY, value, token, pkX, pkY, salt)  (7-input)
// ═══════════════════════════════════════════════════════════

/** Alice의 ETH 노트 — 1 ETH, VALID */
export const NOTE_ALICE_ETH_VALID = {
  hash: '16184009537927529309008792380990690517432017151752497224111719359760374765868',
  hashHex: '0x23c7d3253569e1241d83f2f23e4af7aa1a393b08ca8ea06bea5643813835192c',
  owner: ALICE_ADDRESS,
  pkX: ALICE_PK.x,
  pkY: ALICE_PK.y,
  value: '0x0000000000000000000000000000000000000000000000000de0b6b3a7640000',
  token: '0x0',
  state: '0x1',
  isSmart: '0x0',
  salt: SALT_1,
}

/** Alice의 DAI 노트 — 100 DAI, VALID */
export const NOTE_ALICE_DAI_VALID = {
  hash: '17303909591552797504398132633364379184411144242090030152733968285406401836265',
  hashHex: '0x2641aa6ee117a4ba0eddb352c2e4892c984121d36cbfc56a59572557d01ab4e9',
  owner: ALICE_ADDRESS,
  pkX: ALICE_PK.x,
  pkY: ALICE_PK.y,
  value: '0x0000000000000000000000000000000000000000000000056bc75e2d63100000',
  token: '0x1',
  state: '0x1',
  isSmart: '0x0',
  salt: SALT_2,
}

/** Alice의 ETH 노트 — 1 ETH, SPENT */
export const NOTE_ALICE_ETH_SPENT = {
  hash: '14376447923601927383723423711905046235301763101196191411174220335449278071926',
  hashHex: '0x1fc8c7faa1f32c30356fd0d74630863f3b28d7d1ef4bf299dd0c422aa97d4476',
  owner: ALICE_ADDRESS,
  pkX: ALICE_PK.x,
  pkY: ALICE_PK.y,
  value: '0x0000000000000000000000000000000000000000000000000de0b6b3a7640000',
  token: '0x0',
  state: '0x3',
  isSmart: '0x0',
  salt: SALT_3,
}

/** Alice의 DAI 노트 — 50 DAI, VALID (2번째) */
export const NOTE_ALICE_DAI_VALID_2 = {
  hash: '3847330385811826305151497065508814855960830865699403721578506681392596303648',
  hashHex: '0x088183074ecbdf947ee67d57655abb82f20307888a2e33ad8578acc2df68bf20',
  owner: ALICE_ADDRESS,
  pkX: ALICE_PK.x,
  pkY: ALICE_PK.y,
  value: '0x000000000000000000000000000000000000000000000002b5e3af16b1880000',
  token: '0x1',
  state: '0x1',
  isSmart: '0x0',
  salt: SALT_4,
}

/** Bob의 ETH 노트 — 2 ETH, VALID */
export const NOTE_BOB_ETH_VALID = {
  hash: '10721546294160825156647224350062807577422692299298588730045272263234755827375',
  hashHex: '0x17b42e1e9781082701d8e2b43f727355021b7bad31054ae2a83f80fe0dd916af',
  owner: BOB_ADDRESS,
  pkX: BOB_PK.x,
  pkY: BOB_PK.y,
  value: '0x0000000000000000000000000000000000000000000000001bc16d674ec80000',
  token: '0x0',
  state: '0x1',
  isSmart: '0x0',
  salt: SALT_5,
}

/** Bob의 DAI 노트 — 100 DAI, VALID */
export const NOTE_BOB_DAI_VALID = {
  hash: '16801552358700818184991428771929573868123678176995603606713639793926280995262',
  hashHex: '0x252557757ff9554ab64efaf0440bb8ceb6c13131f1dd868181ccae9dd0b261be',
  owner: BOB_ADDRESS,
  pkX: BOB_PK.x,
  pkY: BOB_PK.y,
  value: '0x0000000000000000000000000000000000000000000000056bc75e2d63100000',
  token: '0x1',
  state: '0x1',
  isSmart: '0x0',
  salt: SALT_6,
}

/** Alice의 ETH 노트 — 1 ETH, INVALID */
export const NOTE_ALICE_INVALID = {
  hash: '2540624819923677263543983074851878973373094303942057818134375928325375132320',
  hashHex: '0x059df1541624e18ed7142b0721c0d553548de43bd23cc0bc620d5ae1399602a0',
  owner: ALICE_ADDRESS,
  pkX: ALICE_PK.x,
  pkY: ALICE_PK.y,
  value: '0x0000000000000000000000000000000000000000000000000de0b6b3a7640000',
  token: '0x0',
  state: '0x0',
  isSmart: '0x0',
  salt: SALT_7,
}

/** Alice의 ETH 스마트 노트 — 1 ETH, VALID, isSmart */
export const NOTE_ALICE_SMART = {
  hash: '2371687239892058399682172832281888409330305753295708997917917302056226144514',
  hashHex: '0x053e53d0fa262c347fee6c9a41096d7907b23f0cc7fc1332276da7efa76c4102',
  owner: ALICE_ADDRESS,
  pkX: ALICE_PK.x,
  pkY: ALICE_PK.y,
  value: '0x0000000000000000000000000000000000000000000000000de0b6b3a7640000',
  token: '0x0',
  state: '0x1',
  isSmart: '0x1',
  salt: SALT_8,
}

// ═══════════════════════════════════════════════════════════
// 5. ORDERS — 실제 노트 해시와 계정 주소 참조
// ═══════════════════════════════════════════════════════════

/** Alice가 ETH를 DAI로 교환하는 매도 주문 (가격 100) */
export const ORDER_1 = {
  hash: NOTE_ALICE_ETH_VALID.hashHex,
  maker: ALICE_ADDRESS,
  price: '100',
  sourceToken: '0x0',
  targetToken: '0x1',
  sourceAmount: '1000000000000000000',
  targetAmount: '100000000000000000000',
  state: '0x0', // CREATED
}

/** Bob이 ETH를 DAI로 교환하는 매도 주문 (가격 200) */
export const ORDER_2 = {
  hash: NOTE_BOB_ETH_VALID.hashHex,
  maker: BOB_ADDRESS,
  price: '200',
  sourceToken: '0x0',
  targetToken: '0x1',
  sourceAmount: '2000000000000000000',
  targetAmount: '400000000000000000000',
  state: '0x0', // CREATED
}

/** 가격 100, TAKEN 상태 주문 */
export const ORDER_3_TAKEN = {
  hash: NOTE_ALICE_ETH_SPENT.hashHex,
  maker: ALICE_ADDRESS,
  price: '100',
  sourceToken: '0x0',
  targetToken: '0x1',
  sourceAmount: '1000000000000000000',
  targetAmount: '100000000000000000000',
  state: '0x1', // TAKEN
}

// ═══════════════════════════════════════════════════════════
// 6. ORDER HISTORY
// ═══════════════════════════════════════════════════════════

/** 진행 중인 주문 이력 (state=0) */
export const ORDER_HISTORY_ONGOING = {
  orderId: NOTE_ALICE_ETH_VALID.hashHex,
  type: '0x0',
  state: '0',
  price: '100',
  makerNote: NOTE_ALICE_ETH_VALID.hashHex,
  makerNoteAmount: '1000000000000000000',
}

/** 진행 중인 주문 이력 (state=1) */
export const ORDER_HISTORY_TAKEN = {
  orderId: NOTE_BOB_ETH_VALID.hashHex,
  type: '0x0',
  state: '1',
  price: '200',
  makerNote: NOTE_BOB_ETH_VALID.hashHex,
  makerNoteAmount: '2000000000000000000',
}

/** 완료된 주문 이력 (state=2) */
export const ORDER_HISTORY_COMPLETED = {
  orderId: NOTE_ALICE_ETH_SPENT.hashHex,
  type: '0x0',
  state: '2',
  price: '100',
  makerNote: NOTE_ALICE_ETH_SPENT.hashHex,
  makerNoteAmount: '1000000000000000000',
}

// ═══════════════════════════════════════════════════════════
// 7. KEYSTORE (scrypt + AES-256-GCM 형식)
// ═══════════════════════════════════════════════════════════

export const MOCK_KEYSTORE = {
  crypto: {
    cipher: 'aes-256-gcm' as const,
    ciphertext: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
    cipherparams: {
      iv: 'deadbeefcafebabe0123456789abcdef',
    },
    kdf: 'scrypt' as const,
    kdfparams: {
      n: 16384,
      r: 8,
      p: 1,
      dklen: 32,
      salt: 'cafebabe12345678deadbeef90abcdef0011223344556677889900aabbccddeeff',
    },
    mac: '11223344aabbccdd55667788eeff0011',
  },
  version: 1,
}

// ═══════════════════════════════════════════════════════════
// 8. PROOF (Groth16 BN128 형식)
// ═══════════════════════════════════════════════════════════

export const MOCK_PROOF = {
  proof: {
    a: [
      '0x2b52e1908bed7b1f474026b72e1c887e2c2462cf33b20b5b562e8bc096ee7083',
      '0x14f9761fff9429e5e33dc8b4b43627276fab15d753d758a24b51f1e75ec10a95',
    ],
    b: [
      [
        '0x112737c85d9a368849edcecb5d24f7a953578d5b87065c1f18c93552399b89b6',
        '0x261700c8d02a9e653c79c75db1881c8514e9439d69689b727f022e33ddb46dd2',
      ],
      [
        '0x2e7c71efb0873da43935fb72259feefdafb6c56aeefc9e15558fbfb8376b205e',
        '0x120e9546e5eee779fc4b44c15ad586374da0063cdce38e029b4ef1c56e7458d6',
      ],
    ],
    c: [
      '0x102002aa79aa2b97fcf5a86a191984577783a74a858ba629a8a83dacd5a75535',
      '0x0dd698bf355e0e65eb84c04c53afb9d18db55f890c0b747e3d6896c2f2185019',
    ],
    input: [
      NOTE_ALICE_ETH_VALID.hash,
    ],
  },
  publicSignals: [
    NOTE_ALICE_ETH_VALID.hash,
    '1000000000000000000',
  ],
}

// ═══════════════════════════════════════════════════════════
// 9. HELPER: Note 객체 타입 (store 테스트용 간략 형태)
// ═══════════════════════════════════════════════════════════

export interface NoteFixture {
  hash: string
  hashHex: string
  owner: string
  pkX: string
  pkY: string
  value: string
  token: string
  state: string
  isSmart: string
  salt: string
}
