#!/bin/bash
# Iterating all directories under circuit
# setup circuit only matched name directory & code file.

for d in */ ; do
    DIR=${d%?}

    CODE_FILE=${DIR}/${DIR}.code

    if [ -f "$CODE_FILE" ]; then

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
    fi

    VERIFIER_FILE=${DIR}/verifier.sol

    if [ -f "$VERIFIER_FILE" ]; then
       echo "Replace contract Name"
       sed -e s/Verifier/${DIR}Verifier/g verifier.sol > ${DIR}Verifier.sol
       cp $DIR-verifier.sol  "../../contracts/$DIR-verifier.sol"
    fi

    cd ..
done
