#!/bin/bash
# Iterating all directories under circuit
for d in */ ; do
    DIR=${d%?}

    echo "Workding on $DIR"
    cd $DIR
    rm zokrates
    echo "Create symbolic link of zokrates"
 
    ln -s ../../zokrates ./
    echo "circuit $d compile"
    ./zokrates compile -i $DIR.code

    echo "$d setup"
    ./zokrates setup --proving-scheme pghr13

    echo "$d export verifier"
    ./zokrates export-verifier --proving-scheme pghr13

    cp verifier.sol ../contracts/$DIR_verifier.sol
    cd ..
done
