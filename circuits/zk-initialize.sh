#!/bin/bash
# Iterating all directories under circuit
# setup circuit only matched name directory & code file.

TARGET_DIR=${1:-*/}

for d in $TARGET_DIR ; do
    DIR=${d%?}

    CODE_FILE=${DIR}.code
    cd $DIR

    if [ -f "$CODE_FILE" ]; then

        echo "Working on $DIR"
        rm zokrates
        echo "Create symbolic link of zokrates"

        ln -sF ../../zokrates ./
        echo "circuit $DIR compile"
        ./zokrates compile -i $DIR.code 1> /dev/null

        echo "$DIR setup"
        ./zokrates setup --proving-scheme pghr13 1> /dev/null

        echo "$DIR export verifier"
        ./zokrates export-verifier --proving-scheme pghr13 --output "${DIR}_Verifier.sol" --contract-name "${DIR}_Verifier" 1> /dev/null

        if [ -f "${DIR}_Verifier.sol" ]; then
        echo "Move verifier contract"
        mv "${DIR}_Verifier.sol"  "../../contracts/verifiers/${DIR}_Verifier.sol"
        fi

        echo "$DIR initialized"
        echo ""

    fi

    cd ..
done
