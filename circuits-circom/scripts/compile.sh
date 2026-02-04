#!/bin/bash

# Compile all circom circuits
# Usage: ./scripts/compile.sh [circuit_name]
# If no circuit name provided, compiles all circuits

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$PROJECT_DIR/build"
MAIN_DIR="$PROJECT_DIR/main"

# Circuit names
CIRCUITS=(
    "mint_burn_note"
    "make_order"
    "take_order"
    "convert_note"
    "transfer_note"
    "settle_order"
    "private_voting"
)

compile_circuit() {
    local circuit=$1
    local circuit_file="$MAIN_DIR/${circuit}.circom"
    local output_dir="$BUILD_DIR/$circuit"

    echo "Compiling $circuit..."

    # Create output directory
    mkdir -p "$output_dir"

    # Compile with circom
    $CIRCOM_BIN "$circuit_file" \
        --r1cs \
        --wasm \
        --sym \
        --c \
        -o "$output_dir" \
        -l "$PROJECT_DIR/node_modules"

    echo "✓ $circuit compiled successfully"
    echo "  - R1CS: $output_dir/${circuit}.r1cs"
    echo "  - WASM: $output_dir/${circuit}_js/${circuit}.wasm"
    echo ""
}

# Main
echo "==================================="
echo "Circom Circuit Compiler"
echo "==================================="
echo ""

# Check if circom 2.x is installed
CIRCOM_BIN=""
if [ -f "$HOME/.cargo/bin/circom" ]; then
    CIRCOM_BIN="$HOME/.cargo/bin/circom"
elif command -v circom &> /dev/null; then
    # Check version
    if circom --version 2>&1 | grep -q "2\."; then
        CIRCOM_BIN="circom"
    fi
fi

if [ -z "$CIRCOM_BIN" ]; then
    echo "Error: circom 2.x is not installed"
    echo "Install with: cargo install circom"
    exit 1
fi

echo "Using circom: $CIRCOM_BIN"
echo "$($CIRCOM_BIN --version)"
echo ""

# Compile specific circuit or all
if [ -n "$1" ]; then
    compile_circuit "$1"
else
    for circuit in "${CIRCUITS[@]}"; do
        compile_circuit "$circuit"
    done
fi

echo "==================================="
echo "Compilation complete!"
echo "==================================="
