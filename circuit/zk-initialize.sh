#!/bin/bash
# Iterating all directories under circuit
for d in */ ; do
    DIR=${d%?}

    echo "Working on $DIR"
    cd $DIR
    rm zokrates
    echo "Create symbolic link of zokrates"
 
    ln -sF ../../zokrates ./
    echo "circuit $d compile"
    ./zokrates compile -i $DIR.code

    echo "$d setup"
    ./zokrates setup --proving-scheme pghr13

    echo "$d export verifier"
    ./zokrates export-verifier --proving-scheme pghr13

    echo "Replace contract Name"
    sed -e s/Verifier/$DIR-Verifier/g verifier.sol > $DIR-verifier.sol
    cp $DIR-verifier.sol  "../../contracts/$DIR-verifier.sol"

    cd ..
done
