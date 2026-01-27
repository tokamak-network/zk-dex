#!/bin/bash

# Setup trusted ceremony for all circuits
# Downloads powers of tau and generates zkey files

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$PROJECT_DIR/build"
PTAU_DIR="$PROJECT_DIR/ptau"

# Powers of Tau file (adjust size based on circuit complexity)
# pot22 supports up to 2^22 constraints (~4M), pot20 supports ~1M (sufficient for all circuits)
# Override via environment variable: PTAU_SIZE=20 bash scripts/setup.sh
PTAU_SIZE="${PTAU_SIZE:-22}"
PTAU_FILE="$PTAU_DIR/powersOfTau28_hez_final_${PTAU_SIZE}.ptau"
PTAU_URL="https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_${PTAU_SIZE}.ptau"

# Circuit names
CIRCUITS=(
    "mint_burn_note"
    "make_order"
    "take_order"
    "convert_note"
    "transfer_note"
    "settle_order"
)

download_ptau() {
    mkdir -p "$PTAU_DIR"

    if [ -f "$PTAU_FILE" ]; then
        echo "Powers of Tau file already exists: $PTAU_FILE"
        return
    fi

    echo "Downloading Powers of Tau (pot${PTAU_SIZE})..."
    echo "URL: $PTAU_URL"
    echo "This may take a while..."
    curl -L --fail --retry 3 --retry-delay 5 -o "$PTAU_FILE" "$PTAU_URL"
    echo "✓ Downloaded Powers of Tau ($(du -h "$PTAU_FILE" | cut -f1))"
}

setup_circuit() {
    local circuit=$1
    local circuit_dir="$BUILD_DIR/$circuit"
    local r1cs="$circuit_dir/${circuit}.r1cs"
    local zkey="$circuit_dir/${circuit}.zkey"
    local vkey="$circuit_dir/${circuit}_vkey.json"

    echo "Setting up $circuit..."

    if [ ! -f "$r1cs" ]; then
        echo "Error: R1CS file not found: $r1cs"
        echo "Please run compile.sh first"
        exit 1
    fi

    # Generate zkey (Groth16)
    echo "  Generating zkey..."
    snarkjs groth16 setup "$r1cs" "$PTAU_FILE" "${circuit_dir}/${circuit}_0000.zkey"

    # Contribute to ceremony (add randomness)
    echo "  Contributing to ceremony..."
    local entropy
    entropy="$(od -A n -t x1 -N 64 /dev/urandom | tr -d ' \n')"
    snarkjs zkey contribute "${circuit_dir}/${circuit}_0000.zkey" "$zkey" \
        --name="ZK-DEX contribution" -v -e="$entropy"

    # Remove intermediate file
    rm "${circuit_dir}/${circuit}_0000.zkey"

    # Export verification key
    echo "  Exporting verification key..."
    snarkjs zkey export verificationkey "$zkey" "$vkey"

    echo "✓ $circuit setup complete"
    echo "  - zkey: $zkey"
    echo "  - vkey: $vkey"
    echo ""
}

# Main
echo "==================================="
echo "Trusted Setup for ZK-DEX Circuits"
echo "==================================="
echo ""

# Check if snarkjs is installed
if ! command -v snarkjs &> /dev/null; then
    echo "Error: snarkjs is not installed"
    echo "Install with: npm install -g snarkjs"
    exit 1
fi

# Download powers of tau
download_ptau

echo ""
echo "Running trusted setup..."
echo ""

# Setup specific circuit or all
if [ -n "$1" ]; then
    setup_circuit "$1"
else
    for circuit in "${CIRCUITS[@]}"; do
        setup_circuit "$circuit"
    done
fi

echo "==================================="
echo "Setup complete!"
echo "==================================="
