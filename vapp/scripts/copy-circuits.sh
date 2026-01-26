#!/bin/bash
# Copy circuit files from circuits-circom/build to vapp/public/circuits

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CIRCUITS_BUILD="../circuits-circom/build"
CIRCUITS_PUBLIC="$PROJECT_ROOT/public/circuits"

echo "Copying circuit files..."

# Create circuit directories
CIRCUITS=("mint_burn_note" "transfer_note" "make_order" "take_order" "settle_order" "convert_note")

for circuit in "${CIRCUITS[@]}"; do
    mkdir -p "$CIRCUITS_PUBLIC/$circuit"

    # Copy wasm file
    if [ -f "$CIRCUITS_BUILD/$circuit/${circuit}_js/${circuit}.wasm" ]; then
        cp "$CIRCUITS_BUILD/$circuit/${circuit}_js/${circuit}.wasm" "$CIRCUITS_PUBLIC/$circuit/"
        echo "  Copied $circuit.wasm"
    else
        echo "  WARNING: $circuit.wasm not found"
    fi

    # Copy zkey file
    if [ -f "$CIRCUITS_BUILD/$circuit/${circuit}.zkey" ]; then
        cp "$CIRCUITS_BUILD/$circuit/${circuit}.zkey" "$CIRCUITS_PUBLIC/$circuit/"
        echo "  Copied $circuit.zkey"
    else
        echo "  WARNING: $circuit.zkey not found"
    fi
done

echo "Done!"
echo ""
echo "Circuit files copied to: $CIRCUITS_PUBLIC"
echo ""
echo "Total size:"
du -sh "$CIRCUITS_PUBLIC"
