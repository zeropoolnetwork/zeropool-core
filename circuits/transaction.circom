include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/bitify.circom";

include "lib/merkleproofposeidon.circom";
include "utxo.circom";

template Transaction(n) {


    signal input root;
    signal input nullifier[2];
    signal input utxo_out_hash[2];
    signal input cmd;
    signal input fee;

    signal private input mp_sibling[2][n]; 
    signal private input mp_path[2]; 
    signal private input utxo_in_data[2][4];
    signal private input utxo_out_data[2][4];
    signal private input secret;

    component pubkey = Pubkey();
    pubkey.in <== secret;



    component utxo_in[2];
    component utxo_in_invalid[2][2];
    component utxo_in_commit[2];

    for(var i=0; i<2; i++) {
        utxo_in[i] = UTXO_hasher();
        utxo_in_commit[i] = Owner_commit();
        utxo_in_commit[i].pubkey <== pubkey.out;
        utxo_in_commit[i].blinding <== utxo_in_data[i][3];
        utxo_in[i].token_address <== utxo_in_data[i][0];
        utxo_in[i].token_balance <== utxo_in_data[i][1];
        utxo_in[i].native_balance <== utxo_in_data[i][2];
        utxo_in[i].owner_commit <== utxo_in_commit[i].out;


        utxo_in_invalid[i][0] = Num2Bits(240);
        utxo_in_invalid[i][0].in <== utxo_in_data[i][1];

        utxo_in_invalid[i][1] = Num2Bits(240);
        utxo_in_invalid[i][1].in <== utxo_in_data[i][2];

    }

    component utxo_out[2];
    component utxo_out_invalid[2][2];
    for(var i=0; i<2; i++) {
        utxo_out[i] = UTXO_hasher();
        utxo_out[i].token_address <== utxo_out_data[i][0];
        utxo_out[i].token_balance <== utxo_out_data[i][1];
        utxo_out[i].native_balance <== utxo_out_data[i][2];
        utxo_out[i].owner_commit <== utxo_out_data[i][3];

        utxo_out_invalid[i][0] = Num2Bits(240);
        utxo_out_invalid[i][0].in <== utxo_out_data[i][1];

        utxo_out_invalid[i][1] = Num2Bits(240);
        utxo_out_invalid[i][1].in <== utxo_out_data[i][2];
    }

    component cmd_invalid = IsZero();
    cmd_invalid.in <== cmd + 1;
    cmd_invalid.out === 0;

    component fee_invalid = Num2Bits(240);
    fee_invalid.in <== fee;

    component utxo_in_proof[2];
    component mp_path_bits[2];

    for(var i=0; i<2; i++) {
        mp_path_bits[i] = Num2Bits(n);
        mp_path_bits[i].in <== mp_path[i];

        utxo_in_proof[i] = merkleproofposeidon(n);
        for(var j=0; j<n; j++) {
            utxo_in_proof[i].sibling[j] <== mp_sibling[i][j];
            utxo_in_proof[i].path[j] <== mp_path_bits[i].out[j];
        }
        utxo_in_proof[i].leaf <== utxo_in[i].out;

        (utxo_in_proof[i].root - root) * (utxo_in[i].token_balance + utxo_in[i].native_balance) === 0;
    }

    utxo_in[0].token_address === utxo_out[0].token_address;
    utxo_in[1].token_address === utxo_out[1].token_address;

    utxo_in[0].native_balance + utxo_in[1].native_balance === utxo_out[0].native_balance + utxo_out[1].native_balance + fee;
    utxo_in[0].token_balance + utxo_in[1].token_balance === utxo_out[0].token_balance + utxo_out[1].token_balance;
    (utxo_in[0].token_balance - utxo_out[0].token_balance) * (utxo_in[0].token_address - utxo_in[1].token_address) === 0;
}

component main = Transaction(32);