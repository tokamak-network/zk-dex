#!/bin/bash

# Generate Solidity verifier contracts from zkey files

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$PROJECT_DIR/build"
CONTRACTS_DIR="$(dirname "$PROJECT_DIR")/contracts/verifiers"

# Function to get contract name from circuit name
get_contract_name() {
    case "$1" in
        "mint_burn_note") echo "MintBurnNote" ;;
        "make_order") echo "MakeOrder" ;;
        "take_order") echo "TakeOrder" ;;
        "convert_note") echo "ConvertNote" ;;
        "transfer_note") echo "TransferNote" ;;
        "settle_order") echo "SettleOrder" ;;
        *) echo "$1" ;;
    esac
}

# List of circuits
CIRCUITS="mint_burn_note make_order take_order convert_note transfer_note settle_order"

generate_verifier() {
    local circuit=$1
    local contract_name=$(get_contract_name "$circuit")
    local zkey="$BUILD_DIR/$circuit/${circuit}.zkey"
    local verifier="$CONTRACTS_DIR/${contract_name}Verifier.sol"

    echo "Generating verifier for $circuit..."

    if [ ! -f "$zkey" ]; then
        echo "Error: zkey file not found: $zkey"
        echo "Please run setup.sh first"
        exit 1
    fi

    # Generate Solidity verifier
    snarkjs zkey export solidityverifier "$zkey" "$verifier"

    # Rename the contract to match expected naming
    # snarkjs generates "Groth16Verifier", we rename to "{contract_name}Verifier"
    sed -i.bak "s/contract Groth16Verifier/contract ${contract_name}Verifier/g" "$verifier"
    rm -f "${verifier}.bak"

    # Update Solidity version to match project
    sed -i.bak "s/pragma solidity \^0.6.11;/pragma solidity ^0.5.8;/g" "$verifier"
    rm -f "${verifier}.bak"

    echo "✓ Generated: $verifier"
}

# Main
echo "==================================="
echo "Solidity Verifier Generator"
echo "==================================="
echo ""

# Check if snarkjs is installed
if ! command -v snarkjs &> /dev/null; then
    echo "Error: snarkjs is not installed"
    exit 1
fi

# Create contracts directory if not exists
mkdir -p "$CONTRACTS_DIR"

# Generate specific verifier or all
if [ -n "$1" ]; then
    generate_verifier "$1"
else
    for circuit in $CIRCUITS; do
        generate_verifier "$circuit"
    done
fi

echo ""
echo "==================================="
echo "Verifier generation complete!"
echo "==================================="
echo ""
echo "Note: You may need to update the contract imports in:"
echo "  - contracts/MintNotes.sol"
echo "  - contracts/SpendNotes.sol"
echo "  - contracts/LiquidateNotes.sol"
echo "  - contracts/ZkDex.sol"
echo ""
echo "The new verifiers use Groth16 format:"
echo "  verifyProof(uint[2] a, uint[2][2] b, uint[2] c, uint[N] input)"
