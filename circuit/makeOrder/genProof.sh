#!/bin/bash
if [ "$#" -ne 10 ];
then
  echo "[Usage] getproof.sh args" && exit 1
else
  ./zokrates compute-witness -a ${1} ${2} ${3} ${4} ${5} ${6} ${7} ${8} ${9} ${10} > "$(date +%FT%T)_compute_witness.log"
  ./zokrates generate-proof --proving-scheme pghr13 > "$(date +%FT%T)_generate_proof.log"
  # get line no of Input field
  export noInput=$(cat proof.json | sed -n '/input/ =')
  cat proof.json | sed "${noInput}s/\[/\['0x/g" | sed "${noInput}s/\]/'\]/g" | sed "${noInput}s/\,/', '0x/g" | sed "s/'/\"/g" > makeOrderPoof.json
  cat makeOrderPoof.json
fi
