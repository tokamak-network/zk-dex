pragma circom 2.1.0;

include "../utils/sha256/sha256_1536bit.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/is_smart.circom";
include "../utils/math/safe_math.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/mux1.circom";

// SettleOrder Circuit
// Atomic settlement of maker-taker order with price calculation
//
// Inputs:
// - Maker note (o0): maker's note being traded
// - Taker stake note (o1): taker's payment to maker
// - Price: exchange rate
// - Division quotients/remainders for non-deterministic arithmetic
//
// Outputs (3 new notes):
// - Reward note (n0): maker's source token to taker
// - Payment note (n1): taker's target token to maker
// - Change note (n2): remainder to appropriate party
//
// Math:
// - makerValue * price = q0 * 10^18 + r0 (price normalization)
// - takerValue = q1 * price + r1
// - Conditional distribution based on which party has excess
template SettleOrder() {
    // ===== Public Inputs =====
    // Maker note (o0)
    signal input o0h0;
    signal input o0h1;
    signal input o0Type;

    // Taker stake note (o1)
    signal input o1h0;
    signal input o1h1;
    signal input o1Type;

    // Reward note (n0) - to taker
    signal input n0h0;
    signal input n0h1;
    signal input n0Owner0;     // Taker's parent note hash (public)
    signal input n0Owner1;
    signal input n0Type;

    // Payment note (n1) - to maker
    signal input n1h0;
    signal input n1h1;
    signal input n1Owner0;     // Maker's note hash (public)
    signal input n1Owner1;
    signal input n1Type;

    // Change note (n2)
    signal input n2h0;
    signal input n2h1;
    signal input n2Type;

    // Price
    signal input price;

    // ===== Private Inputs =====
    // Maker note (o0)
    signal input o0Owner0;
    signal input o0Owner1;
    signal input o0Value;
    signal input o0Vk0;
    signal input o0Vk1;
    signal input o0Salt;

    // Taker stake note (o1)
    signal input o1Owner0;
    signal input o1Owner1;
    signal input o1Value;
    signal input o1Vk0;
    signal input o1Vk1;
    signal input o1Salt;

    // Reward note (n0)
    signal input n0Value;
    signal input n0Vk0;
    signal input n0Vk1;
    signal input n0Salt;

    // Payment note (n1)
    signal input n1Value;
    signal input n1Vk0;
    signal input n1Vk1;
    signal input n1Salt;

    // Change note (n2)
    signal input n2Owner0;
    signal input n2Owner1;
    signal input n2Value;
    signal input n2Vk0;
    signal input n2Vk1;
    signal input n2Salt;

    // Division witnesses (for non-deterministic arithmetic)
    signal input q0;           // quotient: o0Value * price / 10^18
    signal input r0;           // remainder
    signal input q1;           // quotient: o1Value / price
    signal input r1;           // remainder

    // Secret key for maker note ownership
    signal input sk;

    // Output
    signal output out;

    // ===== Constants =====
    var DECIMALS = 1000000000000000000; // 10^18

    // ===== 1. Verify maker note hash =====
    component hashO0 = Sha256_1536bit();
    hashO0.in[0] <== o0Owner0;
    hashO0.in[1] <== o0Owner1;
    hashO0.in[2] <== o0Value;
    hashO0.in[3] <== o0Type;
    hashO0.in[4] <== o0Vk0;
    hashO0.in[5] <== o0Vk1;
    hashO0.in[6] <== o0Salt;

    hashO0.out[0] === o0h0;
    hashO0.out[1] === o0h1;

    // ===== 2. Verify taker stake note hash =====
    component hashO1 = Sha256_1536bit();
    hashO1.in[0] <== o1Owner0;
    hashO1.in[1] <== o1Owner1;
    hashO1.in[2] <== o1Value;
    hashO1.in[3] <== o1Type;
    hashO1.in[4] <== o1Vk0;
    hashO1.in[5] <== o1Vk1;
    hashO1.in[6] <== o1Salt;

    hashO1.out[0] === o1h0;
    hashO1.out[1] === o1h1;

    // ===== 3. Verify maker note ownership =====
    component ownership = ProofOfOwnershipStrict();
    ownership.pk[0] <== o0Owner0;
    ownership.pk[1] <== o0Owner1;
    ownership.sk <== sk;

    // ===== 4. Verify taker stake note is smart note =====
    component isSmart = IsSmartStrict();
    isSmart.owner0 <== o1Owner0;

    // ===== 5. Division proof for price calculation =====
    // o0Value * price = q0 * 10^18 + r0
    signal o0ValueTimesPrice;
    o0ValueTimesPrice <== o0Value * price;

    signal q0TimesDecimals;
    q0TimesDecimals <== q0 * DECIMALS;

    signal expectedO0;
    expectedO0 <== q0TimesDecimals + r0;
    o0ValueTimesPrice === expectedO0;

    // Verify remainder is valid: r0 < 10^18
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

    // Verify remainder is valid: r1 < price
    component r1Valid = LessThan(252);
    r1Valid.in[0] <== r1;
    r1Valid.in[1] <== price;
    r1Valid.out === 1;

    // ===== 6. Determine settlement direction =====
    // o1ValueOverPrice = q1 (integer division of o1Value / price)
    // o0ValuePrice = q0 (o0Value * price / 10^18)
    signal o1ValueOverPrice;
    o1ValueOverPrice <== q1;

    signal o0ValuePrice;
    o0ValuePrice <== q0;

    // bit = 1 if o0Value >= o1ValueOverPrice, else 0
    component cmp = GreaterEqThan(252);
    cmp.in[0] <== o0Value;
    cmp.in[1] <== o1ValueOverPrice;
    signal bit;
    bit <== cmp.out;

    // ===== 7. Calculate expected values =====
    // if bit == 1: reward = o1ValueOverPrice, payment = o1Value, change = o0Value - o1ValueOverPrice
    // if bit == 0: reward = o0Value, payment = o0ValuePrice, change = o1Value - o0ValuePrice

    component muxReward = Mux1();
    muxReward.c[0] <== o0Value;
    muxReward.c[1] <== o1ValueOverPrice;
    muxReward.s <== bit;
    signal expectedReward;
    expectedReward <== muxReward.out;

    component muxPayment = Mux1();
    muxPayment.c[0] <== o0ValuePrice;
    muxPayment.c[1] <== o1Value;
    muxPayment.s <== bit;
    signal expectedPayment;
    expectedPayment <== muxPayment.out;

    // Change calculation
    signal changeIfBit1;
    changeIfBit1 <== o0Value - o1ValueOverPrice;

    signal changeIfBit0;
    changeIfBit0 <== o1Value - o0ValuePrice;

    component muxChange = Mux1();
    muxChange.c[0] <== changeIfBit0;
    muxChange.c[1] <== changeIfBit1;
    muxChange.s <== bit;
    signal expectedChange;
    expectedChange <== muxChange.out;

    // ===== 8. Verify output note values =====
    n0Value === expectedReward;
    n1Value === expectedPayment;
    n2Value === expectedChange;

    // ===== 9. Verify all output notes are smart notes =====
    component isSmartN0 = IsSmartStrict();
    isSmartN0.owner0 <== n0Owner0;

    component isSmartN1 = IsSmartStrict();
    isSmartN1.owner0 <== n1Owner0;

    component isSmartN2 = IsSmartStrict();
    isSmartN2.owner0 <== n2Owner0;

    // ===== 10. Verify output note hashes =====
    component hashN0 = Sha256_1536bit();
    hashN0.in[0] <== n0Owner0;
    hashN0.in[1] <== n0Owner1;
    hashN0.in[2] <== n0Value;
    hashN0.in[3] <== n0Type;
    hashN0.in[4] <== n0Vk0;
    hashN0.in[5] <== n0Vk1;
    hashN0.in[6] <== n0Salt;

    hashN0.out[0] === n0h0;
    hashN0.out[1] === n0h1;

    component hashN1 = Sha256_1536bit();
    hashN1.in[0] <== n1Owner0;
    hashN1.in[1] <== n1Owner1;
    hashN1.in[2] <== n1Value;
    hashN1.in[3] <== n1Type;
    hashN1.in[4] <== n1Vk0;
    hashN1.in[5] <== n1Vk1;
    hashN1.in[6] <== n1Salt;

    hashN1.out[0] === n1h0;
    hashN1.out[1] === n1h1;

    component hashN2 = Sha256_1536bit();
    hashN2.in[0] <== n2Owner0;
    hashN2.in[1] <== n2Owner1;
    hashN2.in[2] <== n2Value;
    hashN2.in[3] <== n2Type;
    hashN2.in[4] <== n2Vk0;
    hashN2.in[5] <== n2Vk1;
    hashN2.in[6] <== n2Salt;

    hashN2.out[0] === n2h0;
    hashN2.out[1] === n2h1;

    // ===== 11. Type consistency =====
    // n0Type should match o0Type (reward in maker's token)
    n0Type === o0Type;
    // n1Type should match o1Type (payment in taker's token)
    n1Type === o1Type;
    // Change type determined by settlement direction
    component muxChangeType = Mux1();
    muxChangeType.c[0] <== o1Type;  // if bit=0, change is taker's token
    muxChangeType.c[1] <== o0Type;  // if bit=1, change is maker's token
    muxChangeType.s <== bit;
    n2Type === muxChangeType.out;

    out <== 1;
}

component main {public [
    o0h0, o0h1, o0Type,
    o1h0, o1h1, o1Type,
    n0h0, n0h1, n0Owner0, n0Owner1, n0Type,
    n1h0, n1h1, n1Owner0, n1Owner1, n1Type,
    n2h0, n2h1, n2Type,
    price
]} = SettleOrder();
