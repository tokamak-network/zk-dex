pragma circom 2.1.0;

include "../utils/sha256/sha256_note_address.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/math/safe_math.circom";
include "../utils/pack/pack160.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/mux1.circom";
include "../node_modules/circomlib/circuits/bitify.circom";

// SettleOrder Circuit (Address-based ownership)
// Atomic settlement of maker-taker order with price calculation
//
// Inputs:
// - Maker note (o0): maker's note being traded (normal note with address)
// - Taker stake note (o1): taker's payment to maker (smart note with address = truncated maker note hash)
// - Price: exchange rate
// - Division quotients/remainders for non-deterministic arithmetic
//
// Outputs (3 new notes, all smart notes):
// - Reward note (n0): maker's source token to taker (owner = taker's parent note hash truncated)
// - Payment note (n1): taker's target token to maker (owner = maker's note hash truncated)
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
    signal input n0OwnerAddress;   // Taker's parent note hash truncated (160-bit)
    signal input n0Type;

    // Payment note (n1) - to maker
    signal input n1h0;
    signal input n1h1;
    signal input n1OwnerAddress;   // Maker's note hash truncated (160-bit)
    signal input n1Type;

    // Change note (n2)
    signal input n2h0;
    signal input n2h1;
    signal input n2Type;

    // Price
    signal input price;

    // ===== Private Inputs =====
    // Maker note (o0)
    signal input o0OwnerAddress;   // 160-bit address
    signal input o0Value;
    signal input o0Vk0;
    signal input o0Vk1;
    signal input o0Salt;

    // Taker stake note (o1)
    signal input o1OwnerAddress;   // 160-bit (truncated maker note hash)
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
    signal input n2OwnerAddress;   // 160-bit (determined by settlement direction)
    signal input n2Value;
    signal input n2Vk0;
    signal input n2Vk1;
    signal input n2Salt;

    // Division witnesses (for non-deterministic arithmetic)
    signal input q0;               // quotient: o0Value * price / 10^18
    signal input r0;               // remainder
    signal input q1;               // quotient: o1Value / price
    signal input r1;               // remainder

    // Secret key for maker note ownership
    signal input sk;

    // Output
    signal output out;

    // ===== Constants =====
    var DECIMALS = 1000000000000000000; // 10^18

    // ===== 1. Verify maker note hash =====
    component hashO0 = Sha256NoteWithAddress();
    hashO0.ownerAddress <== o0OwnerAddress;
    hashO0.value <== o0Value;
    hashO0.tokenType <== o0Type;
    hashO0.vk0 <== o0Vk0;
    hashO0.vk1 <== o0Vk1;
    hashO0.salt <== o0Salt;

    hashO0.out[0] === o0h0;
    hashO0.out[1] === o0h1;

    // ===== 2. Verify taker stake note hash =====
    component hashO1 = Sha256NoteWithAddress();
    hashO1.ownerAddress <== o1OwnerAddress;
    hashO1.value <== o1Value;
    hashO1.tokenType <== o1Type;
    hashO1.vk0 <== o1Vk0;
    hashO1.vk1 <== o1Vk1;
    hashO1.salt <== o1Salt;

    hashO1.out[0] === o1h0;
    hashO1.out[1] === o1h1;

    // ===== 3. Verify maker note ownership (address-based) =====
    component ownership = VerifyOwnershipByAddressStrict();
    ownership.address <== o0OwnerAddress;
    ownership.sk <== sk;

    // ===== SECURITY FIX: Compute truncated maker note hash (160-bit address) =====
    // Address = h0[high 32 bits] || h1[all 128 bits] = 160 bits
    // Original Zokrates: o0h0 == o1owner0, o0h1 == o1owner1

    // Unpack o0h0 (128 bits) to get high 32 bits
    component unpackMakerH0 = Num2Bits(128);
    unpackMakerH0.in <== o0h0;

    // Unpack o0h1 (128 bits)
    component unpackMakerH1 = Num2Bits(128);
    unpackMakerH1.in <== o0h1;

    // Build truncated maker address: h0[high 32 bits] + h1[all 128 bits] = 160 bits
    component packMakerAddr = Pack160();
    // First 32 bits: high 32 bits of o0h0 (bits 96-127)
    for (var i = 0; i < 32; i++) {
        packMakerAddr.bits[i] <== unpackMakerH0.out[127 - i];  // MSB first
    }
    // Remaining 128 bits: all of o0h1
    for (var i = 0; i < 128; i++) {
        packMakerAddr.bits[32 + i] <== unpackMakerH1.out[127 - i];  // MSB first
    }

    // ===== SECURITY FIX 1: Verify stake note (o1) owner == truncated maker hash =====
    // This links the stake note to the maker's order
    // Original Zokrates: o0h0 == o1owner0 && o0h1 == o1owner1
    component stakeOwnerCheck = IsEqual();
    stakeOwnerCheck.in[0] <== o1OwnerAddress;
    stakeOwnerCheck.in[1] <== packMakerAddr.out;
    stakeOwnerCheck.out === 1;

    // ===== SECURITY FIX 2: Verify payment note (n1) owner == truncated maker hash =====
    // Payment goes to maker, so owner should be truncated maker note hash
    component paymentOwnerCheck = IsEqual();
    paymentOwnerCheck.in[0] <== n1OwnerAddress;
    paymentOwnerCheck.in[1] <== packMakerAddr.out;
    paymentOwnerCheck.out === 1;

    // ===== 4. Division proof for price calculation =====
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

    // ===== 5. Determine settlement direction =====
    // o1ValueOverPrice = q1 (ETH equivalent of taker's DAI: o1Value / price)
    // o0ValuePrice = q0 * 10^18 (DAI equivalent of maker's ETH: o0Value * price)
    signal o1ValueOverPrice;
    o1ValueOverPrice <== q1;  // q1 = floor(o1Value / price), already in wei

    signal o0ValuePrice;
    o0ValuePrice <== q0 * DECIMALS;  // Scale up: q0 * 10^18 to get DAI in wei

    // bit = 1 if o0Value >= o1ValueOverPrice, else 0
    component cmp = GreaterEqThan(252);
    cmp.in[0] <== o0Value;
    cmp.in[1] <== o1ValueOverPrice;
    signal bit;
    bit <== cmp.out;

    // ===== 6. Calculate expected values =====
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

    // ===== SECURITY FIX 3: Verify change note (n2) owner =====
    // Original Zokrates: n2owner = if bit == 1 then o0h (maker) else n0owner (taker parent)
    // If bit == 1: maker has excess, change goes to maker -> owner = truncated maker hash
    // If bit == 0: taker has excess, change goes to taker -> owner = n0OwnerAddress (taker's parent)
    component muxChangeOwner = Mux1();
    muxChangeOwner.c[0] <== n0OwnerAddress;      // if bit=0, change to taker (same as reward owner)
    muxChangeOwner.c[1] <== packMakerAddr.out;   // if bit=1, change to maker
    muxChangeOwner.s <== bit;

    component changeOwnerCheck = IsEqual();
    changeOwnerCheck.in[0] <== n2OwnerAddress;
    changeOwnerCheck.in[1] <== muxChangeOwner.out;
    changeOwnerCheck.out === 1;

    // ===== 7. Verify output note values =====
    n0Value === expectedReward;
    n1Value === expectedPayment;
    n2Value === expectedChange;

    // ===== 8. Verify output note hashes =====
    component hashN0 = Sha256NoteWithAddress();
    hashN0.ownerAddress <== n0OwnerAddress;
    hashN0.value <== n0Value;
    hashN0.tokenType <== n0Type;
    hashN0.vk0 <== n0Vk0;
    hashN0.vk1 <== n0Vk1;
    hashN0.salt <== n0Salt;

    hashN0.out[0] === n0h0;
    hashN0.out[1] === n0h1;

    component hashN1 = Sha256NoteWithAddress();
    hashN1.ownerAddress <== n1OwnerAddress;
    hashN1.value <== n1Value;
    hashN1.tokenType <== n1Type;
    hashN1.vk0 <== n1Vk0;
    hashN1.vk1 <== n1Vk1;
    hashN1.salt <== n1Salt;

    hashN1.out[0] === n1h0;
    hashN1.out[1] === n1h1;

    component hashN2 = Sha256NoteWithAddress();
    hashN2.ownerAddress <== n2OwnerAddress;
    hashN2.value <== n2Value;
    hashN2.tokenType <== n2Type;
    hashN2.vk0 <== n2Vk0;
    hashN2.vk1 <== n2Vk1;
    hashN2.salt <== n2Salt;

    hashN2.out[0] === n2h0;
    hashN2.out[1] === n2h1;

    // ===== 9. Type consistency =====
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
    n0h0, n0h1, n0OwnerAddress, n0Type,
    n1h0, n1h1, n1OwnerAddress, n1Type,
    n2h0, n2h1, n2Type,
    price
]} = SettleOrder();
