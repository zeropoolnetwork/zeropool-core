include "./lib/merkleproofposeidon.circom"
include "./lib/poseidon.circom";
include "../node_modules/circomlib/circuits/bitify.circom";

template TreeBuilder(n) {
    signal input old_root;
    signal input new_root;
    signal input id;
    signal input utxo[2];
    signal private input sibling[n-1];

    component id_bits = Num2Bits(n-1);
    id_bits.in <== id;

    component proof_zeros = merkleproofposeidon(n-1);
    for(var i = 0; i < n-1; i++) {
        proof_zeros.sibling[i] <== sibling[i];
        proof_zeros.path[i] <== id_bits.out[i];
    }
    proof_zeros.leaf <== 3193090221241211970002919215846211184824251841300455796635909287157453409439; // = hash(0, 0)
    proof_zeros.root === old_root;

    component utxo_pair = Poseidon_3(2);
    utxo_pair.inputs[0] <== utxo[0];
    utxo_pair.inputs[1] <== utxo[1];

    component proof_new = merkleproofposeidon(n-1);
    for(var i = 0; i < n-1; i++) {
        proof_new.sibling[i] <== sibling[i];
        proof_new.path[i] <== id_bits.out[i];
    }
    proof_new.leaf <== utxo_pair.out;
    proof_new.root === new_root;
}

component main = TreeBuilder(32);