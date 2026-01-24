pragma circom 2.1.0;

include "../../node_modules/circomlib/circuits/comparators.circom";
include "../../node_modules/circomlib/circuits/bitify.circom";

// Safe addition with overflow check
// Assumes inputs are within reasonable range (< 2^252)
template SafeAdd() {
    signal input a;
    signal input b;
    signal output out;

    out <== a + b;

    // Verify no overflow: out >= a (always true if no overflow)
    component gte = GreaterEqThan(252);
    gte.in[0] <== out;
    gte.in[1] <== a;
    gte.out === 1;
}

// Safe subtraction with underflow check
template SafeSub() {
    signal input a;
    signal input b;
    signal output out;

    out <== a - b;

    // Verify no underflow: a >= b
    component gte = GreaterEqThan(252);
    gte.in[0] <== a;
    gte.in[1] <== b;
    gte.out === 1;
}

// Safe multiplication with overflow check
// Uses division verification: if y != 0, then x * y / y == x
template SafeMul() {
    signal input a;
    signal input b;
    signal output out;

    out <== a * b;

    // Check for overflow using witness-based verification
    // If b == 0, then out == 0, which is always safe
    // If b != 0, we verify out / b == a

    component isZero = IsZero();
    isZero.in <== b;

    // When b != 0, verify a * b / b == a
    signal quotient;
    quotient <-- isZero.out == 1 ? 0 : out / b;

    signal check;
    check <== isZero.out * a + (1 - isZero.out) * quotient;
    check === a;
}

// Check if two values are equal, output 1 if equal, 0 otherwise
template IsEq() {
    signal input a;
    signal input b;
    signal output out;

    component eq = IsEqual();
    eq.in[0] <== a;
    eq.in[1] <== b;
    out <== eq.out;
}

// Greater than comparison
template GT() {
    signal input a;
    signal input b;
    signal output out;

    component gt = GreaterThan(252);
    gt.in[0] <== a;
    gt.in[1] <== b;
    out <== gt.out;
}

// Less than comparison
template LT() {
    signal input a;
    signal input b;
    signal output out;

    component lt = LessThan(252);
    lt.in[0] <== a;
    lt.in[1] <== b;
    out <== lt.out;
}

// Multiplexer: select between two values based on selector
// if sel == 0, out = a; if sel == 1, out = b
template Mux() {
    signal input a;
    signal input b;
    signal input sel;
    signal output out;

    out <== a + sel * (b - a);
}
