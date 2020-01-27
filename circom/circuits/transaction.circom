include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/bitify.circom";

include "lib/merkleproofposeidon.circom";
include "lib/poseidon.circom";
include "utxo.circom";



template Transaction(n) {

    signal input root;
    signal input nullifier[2];
    signal input utxo_out_hash[2];
    signal input token;
    signal input delta;
    signal input message_hash;


    signal private input mp_sibling[2][n]; 
    signal private input mp_path[2]; 
    signal private input utxo_in_data[2][2];
    signal private input utxo_out_data[2][2];
    signal private input secret;
    signal private input secret_token;


    component mp[2];
    component mp_path_bits[2];

    for(var i=0; i<2; i++) {
        mp_path_bits[i] = Num2Bits(n);
        mp_path_bits[i].in <== mp_path[i];

        mp[i] = merkleproofposeidon(n);
        for(var j=0; j<n; j++) {
            mp[i].sibling[j] <== mp_sibling[i][j];
            mp[i].path[j] <== mp_path_bits[i].out[j];
        }
    }


    component pubkey = Pubkey();
    pubkey.in <== secret;

    component utxo_in[2];
    component utxo_in_invalid[2];
    component utxo_in_commit[2];

    for(var i=0; i<2; i++) {
        utxo_in[i] = UTXO_hasher();
        utxo_in_commit[i] = Owner_commit();
        utxo_in_commit[i].pubkey <== pubkey.out;
        utxo_in_commit[i].blinding <== utxo_in_data[i][1];
        utxo_in[i].token <== secret_token;
        utxo_in[i].amount <== utxo_in_data[i][0];
        utxo_in[i].owner_commit <== utxo_in_commit[i].out;

        mp[i].leaf <== utxo_in[i].out;
        (mp[i].root - root) * utxo_in[i].amount === 0;

        utxo_in_invalid[i] = Num2Bits(240);
        utxo_in_invalid[i].in <== utxo_in[i].amount;

    }

    component utxo_out[2];
    component utxo_out_invalid[2];
    for(var i=0; i<2; i++) {
        utxo_out[i] = UTXO_hasher();
        utxo_out[i].token <== secret_token;
        utxo_out[i].amount <== utxo_out_data[i][0];
        utxo_out[i].owner_commit <== utxo_out_data[i][1];

        utxo_out_invalid[i] = Num2Bits(240);
        utxo_out_invalid[i].in <== utxo_out[i].amount;
    }

    component message_hash_invalid = IsZero();
    message_hash_invalid.in <== message_hash + 1;
    message_hash_invalid.out === 0;



    utxo_in[0].amount + utxo_in[1].amount + delta === utxo_out[0].amount + utxo_out[1].amount;
    (secret_token - token) * delta === 0;
}

component main = Transaction(32);