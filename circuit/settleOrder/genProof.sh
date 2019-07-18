#!/bin/bash
if [ "$#" -ne 51 ];
then
  echo "[Usage] getproof.sh args" && exit 1
else
  ./zokrates compute-witness -a ${1} ${2} ${3} ${4} ${5} ${6} ${7} ${8} ${9} ${10} ${11} ${12} ${13} ${14} ${15} ${16} ${17} ${18} ${19} ${20} ${21} ${22} ${23} ${24} ${25} ${26} ${27} ${28} ${29} ${30} ${31} ${32} ${33} ${34} ${35} ${36} ${37} ${38} ${39} ${40} ${41} ${42} ${43} ${44} ${45} ${46} ${47} ${48} ${49} ${50} ${51} ${52} > "$(date +%FT%T)_compute_witness.log"
  ./zokrates generate-proof --proving-scheme pghr13 > "$(date +%FT%T)_generate_proof.log"

  # Next line for fixing 'input' field of proof.json, but zokrates 4.9 version no longer necessary fixing.
  # get line no of Input field
  # export noInput=$(cat proof.json | sed -n '/input/ =')
  # cat proof.json | sed "${noInput}s/\[/\['0x/g" | sed "${noInput}s/\]/'\]/g" | sed "${noInput}s/\,/', '0x/g" | sed "s/'/\"/g" > settleOrderPoof.json
  mv proof.json settleOrderProof.json
  cat settleOrderProof.json
  rm witness # Prevent when could not generate witness file, then generate-proof can use previous one
fi
