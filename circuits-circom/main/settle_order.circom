pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/is_smart.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/mux1.circom";
include "../node_modules/circomlib/circuits/bitify.circom";

// SettleOrder Circuit
// Faithful port of Zokrates settleOrder.code
//
// Note = (owner0, owner1, value, type, vk0, vk1, salt)
//
// Atomic settlement of maker-taker order with price calculation.
//
// o0 = makerNote (regular note)
// o1 = takerNoteToMaker (smart note, parentHash = makerNote hash)
// n0 = newNoteToTaker (smart note, parentHash = order.parentNote)
// n1 = newNoteToMaker (smart note, parentHash = makerNote hash)
// n2 = changeNote (smart note, parentHash depends on settlement direction)
//
// Price math:
//   o0Value * price = q0 * 10^18 + r0
//   o1Value = q1 * price + r1
//   if o0Value >= o1Value/price: maker has excess
//   else: taker has excess
//
// Public inputs: [o0Hash, o0Type, o1Hash, o1Type,
//                 n0Hash, n0ParentHash, n0Type,
//                 n1Hash, n1ParentHash, n1Type,
//                 n2Hash, n2Type, price]
template SettleOrder() {
    // ===== Public Inputs =====
    // Maker note (o0)
    signal input o0Hash;
    signal input o0Type;

    // Taker stake note (o1)
    signal input o1Hash;
    signal input o1Type;

    // Reward note (n0) - to taker
    signal input n0Hash;
    signal input n0ParentHash;     // taker's parent note hash
    signal input n0Type;

    // Payment note (n1) - to maker
    signal input n1Hash;
    signal input n1ParentHash;     // should == makerNote hash
    signal input n1Type;

    // Change note (n2)
    signal input n2Hash;
    signal input n2Type;

    // Price
    signal input price;

    // ===== Private Inputs =====
    // Maker note (o0) - regular note
    signal input o0Owner0;         // pkX
    signal input o0Owner1;         // pkY
    signal input o0Value;
    signal input o0Vk0;
    signal input o0Vk1;
    signal input o0Salt;

    // Taker stake note (o1) - smart note
    signal input o1Owner0;         // parentHash_hi (should reconstruct to o0Hash)
    signal input o1Owner1;         // parentHash_lo
    signal input o1Value;
    signal input o1Vk0;
    signal input o1Vk1;
    signal input o1Salt;

    // Reward note (n0) - smart note
    signal input n0Value;
    signal input n0Vk0;
    signal input n0Vk1;
    signal input n0Salt;

    // Payment note (n1) - smart note
    signal input n1Value;
    signal input n1Vk0;
    signal input n1Vk1;
    signal input n1Salt;

    // Change note (n2) - smart note
    signal input n2Owner0;         // parentHash_hi (depends on direction)
    signal input n2Owner1;         // parentHash_lo
    signal input n2Value;
    signal input n2Vk0;
    signal input n2Vk1;
    signal input n2Salt;

    // Division witnesses
    signal input q0;               // o0Value * price / 10^18
    signal input r0;               // remainder
    signal input q1;               // o1Value / price
    signal input r1;               // remainder

    // Secret key for maker
    signal input sk;

    // Output
    signal output out;

    // ===== Constants =====
    var DECIMALS = 1000000000000000000; // 10^18

    // ===== 1. Verify maker note ownership =====
    component ownership = ProofOfOwnershipStrict();
    ownership.pk[0] <== o0Owner0;
    ownership.pk[1] <== o0Owner1;
    ownership.sk <== sk;

    // ===== 2. Verify maker note hash (regular note) =====
    component hashO0 = PoseidonNote();
    hashO0.owner0 <== o0Owner0;
    hashO0.owner1 <== o0Owner1;
    hashO0.value <== o0Value;
    hashO0.tokenType <== o0Type;
    hashO0.vk0 <== o0Vk0;
    hashO0.vk1 <== o0Vk1;
    hashO0.salt <== o0Salt;
    hashO0.out === o0Hash;

    // ===== 3. Verify taker stake note hash (smart note) =====
    component hashO1 = PoseidonNote();
    hashO1.owner0 <== o1Owner0;
    hashO1.owner1 <== o1Owner1;
    hashO1.value <== o1Value;
    hashO1.tokenType <== o1Type;
    hashO1.vk0 <== o1Vk0;
    hashO1.vk1 <== o1Vk1;
    hashO1.salt <== o1Salt;
    hashO1.out === o1Hash;

    // ===== 4. Verify stake note (o1) parentHash == maker note hash =====
    // Reconstruct parentHash from (o1Owner0, o1Owner1) and compare with o0Hash
    signal o1ParentReconstructed;
    o1ParentReconstructed <== o1Owner0 * (2**128) + o1Owner1;
    o1ParentReconstructed === o0Hash;

    // ===== 5. Verify payment note (n1) parentHash == maker note hash =====
    n1ParentHash === o0Hash;

    // ===== 6. Division proof for price calculation =====
    // o0Value * price = q0 * 10^18 + r0
    signal o0ValueTimesPrice;
    o0ValueTimesPrice <== o0Value * price;

    signal q0TimesDecimals;
    q0TimesDecimals <== q0 * DECIMALS;

    signal expectedO0;
    expectedO0 <== q0TimesDecimals + r0;
    o0ValueTimesPrice === expectedO0;

    // r0 < 10^18
    component r0Valid = LessThan(252);
    r0Valid.in[0] <== r0;
    r0Valid.in[1] <== DECIMALS;
    r0Valid.out === 1;

    // o1Value = q1 * price + r1
    signal q1TimesPrice;
    q1TimesPrice <== q1 * price;

    signal expectedO1;
    expectedO1 <== q1TimesPrice + r1;
    o1Value === expectedO1;

    // r1 < price
    component r1Valid = LessThan(252);
    r1Valid.in[0] <== r1;
    r1Valid.in[1] <== price;
    r1Valid.out === 1;

    // ===== 7. Determine settlement direction =====
    // o0ValuePrice = q0 (units of target token after price conversion)
    signal o0ValuePrice;
    o0ValuePrice <== q0;

    // o1ValueOverPrice = q1 * 10^18 (units of source token)
    signal o1ValueOverPrice;
    o1ValueOverPrice <== q1 * DECIMALS;

    // bit = 1 if o0Value >= o1ValueOverPrice, else 0
    component cmp = GreaterEqThan(252);
    cmp.in[0] <== o0Value;
    cmp.in[1] <== o1ValueOverPrice;
    signal bit;
    bit <== cmp.out;

    // ===== 8. Calculate expected values =====
    // if bit == 1: reward = o1ValueOverPrice, payment = o1Value, change = o0Value - o1ValueOverPrice
    // if bit == 0: reward = o0Value, payment = o0ValuePrice, change = o1Value - o0ValuePrice

    component muxReward = Mux1();
    muxReward.c[0] <== o0Value;
    muxReward.c[1] <== o1ValueOverPrice;
    muxReward.s <== bit;

    component muxPayment = Mux1();
    muxPayment.c[0] <== o0ValuePrice;
    muxPayment.c[1] <== o1Value;
    muxPayment.s <== bit;

    signal changeIfBit1;
    changeIfBit1 <== o0Value - o1ValueOverPrice;

    signal changeIfBit0;
    changeIfBit0 <== o1Value - o0ValuePrice;

    component muxChange = Mux1();
    muxChange.c[0] <== changeIfBit0;
    muxChange.c[1] <== changeIfBit1;
    muxChange.s <== bit;

    // ===== 9. Verify output note values =====
    n0Value === muxReward.out;
    n1Value === muxPayment.out;
    n2Value === muxChange.out;

    // ===== 10. Verify change note (n2) parentHash =====
    // If bit == 0: taker has excess, change to taker -> parentHash = n0ParentHash
    // If bit == 1: maker has excess, change to maker -> parentHash = o0Hash
    // Reconstruct n2's parentHash from (n2Owner0, n2Owner1)
    signal n2ParentReconstructed;
    n2ParentReconstructed <== n2Owner0 * (2**128) + n2Owner1;

    component muxChangeOwner = Mux1();
    muxChangeOwner.c[0] <== n0ParentHash;
    muxChangeOwner.c[1] <== o0Hash;
    muxChangeOwner.s <== bit;

    n2ParentReconstructed === muxChangeOwner.out;

    // ===== 11. Verify isSmart for all smart notes =====
    component smartO1 = IsSmartStrict();
    smartO1.owner0 <== o1Owner0;

    // n0 and n1: split their parentHash to get owner0
    component splitN0 = SplitTo128();
    splitN0.in <== n0ParentHash;

    component smartN0 = IsSmartStrict();
    smartN0.owner0 <== splitN0.hi;

    component splitN1 = SplitTo128();
    splitN1.in <== n1ParentHash;

    component smartN1 = IsSmartStrict();
    smartN1.owner0 <== splitN1.hi;

    component smartN2 = IsSmartStrict();
    smartN2.owner0 <== n2Owner0;

    // ===== 12. Verify output note hashes (all smart notes) =====
    component hashN0 = PoseidonNote();
    hashN0.owner0 <== splitN0.hi;
    hashN0.owner1 <== splitN0.lo;
    hashN0.value <== n0Value;
    hashN0.tokenType <== n0Type;
    hashN0.vk0 <== n0Vk0;
    hashN0.vk1 <== n0Vk1;
    hashN0.salt <== n0Salt;
    hashN0.out === n0Hash;

    component hashN1 = PoseidonNote();
    hashN1.owner0 <== splitN1.hi;
    hashN1.owner1 <== splitN1.lo;
    hashN1.value <== n1Value;
    hashN1.tokenType <== n1Type;
    hashN1.vk0 <== n1Vk0;
    hashN1.vk1 <== n1Vk1;
    hashN1.salt <== n1Salt;
    hashN1.out === n1Hash;

    component hashN2 = PoseidonNote();
    hashN2.owner0 <== n2Owner0;
    hashN2.owner1 <== n2Owner1;
    hashN2.value <== n2Value;
    hashN2.tokenType <== n2Type;
    hashN2.vk0 <== n2Vk0;
    hashN2.vk1 <== n2Vk1;
    hashN2.salt <== n2Salt;
    hashN2.out === n2Hash;

    // ===== 13. Type consistency =====
    n0Type === o0Type;
    n1Type === o1Type;

    component muxChangeType = Mux1();
    muxChangeType.c[0] <== o1Type;
    muxChangeType.c[1] <== o0Type;
    muxChangeType.s <== bit;
    n2Type === muxChangeType.out;

    out <== 1;
}

component main {public [
    o0Hash, o0Type,
    o1Hash, o1Type,
    n0Hash, n0ParentHash, n0Type,
    n1Hash, n1ParentHash, n1Type,
    n2Hash, n2Type,
    price
]} = SettleOrder();
