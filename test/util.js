/**
 * Test utilities for ZK-DEX
 * Supports both legacy PGHR13 proofs (development mode) and Groth16 proofs
 */

const fs = require('fs');
const BN = require('bn.js');

/**
 * Sleep for a specified number of seconds
 * @param {number} seconds - Number of seconds to sleep
 */
function sleep(seconds) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

/**
 * Parse a PGHR13 proof file (legacy ZoKrates format)
 * @param {string} filePath - Path to the proof JSON file
 * @returns {Array} Proof array for contract call
 */
function parseProof(filePath) {
    const rx2 = /([0-9]+)[,]/gm;
    let proofJson = fs.readFileSync(filePath, 'utf8');

    proofJson.match(rx2).forEach((p) => {
        proofJson = proofJson.replace(p, `"${p.slice(0, p.length - 1)}",`);
    });

    proofJson = JSON.parse(proofJson);
    const { proof } = proofJson;
    const { input } = proofJson;

    input.forEach((i, key) => {
        if (typeof i === 'number') i = i.toString();
        input[key] = `0x${new BN(i, 10).toString('hex')}`;
    });

    const _proof = [];
    Object.keys(proof).forEach(key => _proof.push(proof[key]));
    _proof.push(input);
    return _proof;
}

/**
 * Parse a Groth16 proof object for contract call
 * @param {Object} proof - Groth16 proof object { a, b, c, input }
 * @returns {Array} Proof array for contract call [a, b, c, input]
 */
function parseGroth16Proof(proof) {
    return [proof.a, proof.b, proof.c, proof.input];
}

/**
 * Create a dummy Groth16 proof for development mode testing
 * @param {Array} publicInputs - Array of public inputs
 * @returns {Object} Dummy proof object
 */
function createDummyGroth16Proof(publicInputs) {
    return {
        a: ['0x1', '0x2'],
        b: [['0x3', '0x4'], ['0x5', '0x6']],
        c: ['0x7', '0x8'],
        input: publicInputs.map(x => typeof x === 'string' ? x : '0x' + x.toString(16))
    };
}

/**
 * Convert BigInt or number to hex string
 * @param {bigint|number|string} value - Value to convert
 * @returns {string} Hex string
 */
function toHex(value) {
    if (typeof value === 'string') {
        return value.startsWith('0x') ? value : '0x' + value;
    }
    if (typeof value === 'bigint') {
        return '0x' + value.toString(16);
    }
    return '0x' + value.toString(16);
}

/**
 * Pad a hex string to 64 characters (256 bits)
 * @param {string} hex - Hex string to pad
 * @returns {string} Padded hex string
 */
function padHex(hex) {
    const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
    return '0x' + clean.padStart(64, '0');
}

module.exports = {
    sleep,
    parseProof,
    parseGroth16Proof,
    createDummyGroth16Proof,
    toHex,
    padHex
};
