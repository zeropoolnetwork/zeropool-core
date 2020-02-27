include "lib/poseidon.circom";
include "../node_modules/circomlib/circuits/pointbits.circom";
include "../node_modules/circomlib/circuits/compconstant.circom";


template Pubkey() {
    var BABYJUB_SUBORDER = 2736030358979909402780800718157159386076813972158567259200215660948447373041;
    var BABYJUB_G8 = [
        5299619240641551281634865583518297030282874472190772894086521144482721001553,
        16950150798460657717958625567821834550301663161624707787222815936182638968203
    ];

    signal input in;
    signal output out;

    component secret_invalid = CompConstant(BABYJUB_SUBORDER-1);
    component secret_bits = Num2Bits(251);
    secret_bits.in <== in;

    for (var i=0; i<251; i++) {
        secret_invalid.in[i] <== secret_bits.out[i];
    }
    for (var i = 251; i<254; i++) {
        secret_invalid.in[i] <== 0;
    }
    secret_invalid.out === 0;


    component pubkey = EscalarMulFix(251, BABYJUB_G8);
    for(var i=0; i<251; i++){
        pubkey.e[i] <== secret_bits.out[i];
    }

    out <== pubkey.out[0];

}

template UTXO_hasher() {
    signal input token;
    signal input amount;
    signal input owner_commit;

    signal output out;

    component hasher = Poseidon_4(3);
    hasher.inputs[0] <== token;
    hasher.inputs[1] <== amount;
    hasher.inputs[2] <== owner_commit;

    out <== hasher.out;
}

template Owner_commit() {
    signal input pubkey;
    signal input blinding;

    signal output out;

    component hasher1 = Poseidon_3(2);
    hasher1.inputs[0] <== pubkey;
    hasher1.inputs[1] <== blinding;

    out <== hasher1.out;
}

template Nullifier() {
    signal input secret;
    signal input utxo_hash;

    signal output out;
    
    component hasher = Poseidon_3(2);
    hasher.inputs[0] <== secret;
    hasher.inputs[1] <== utxo_hash;

    out <== hasher.out;
}
