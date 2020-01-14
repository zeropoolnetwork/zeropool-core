include "lib/merkleproofmimc.circom";
include "utxo.circom";

template ForceWithdraw(n) {
    signal input root;
    signal input nullifier;
    signal input receiver;
    signal input token_address;
    signal input token_balance;
    signal input native_balance;

    signal private input mp_sibling[n]; 
    signal private input mp_path; 
    signal private input blinding;
    signal private input secret;

    component pubkey = Pubkey();
    pubkey.in <== secret;

    component utxo_in = UTXO_hasher();
    component utxo_in_commit = Owner_commit();
    utxo_in_commit.pubkey <== pubkey.out;
    utxo_in_commit.blinding <== blinding;

    utxo_in.token_address <== token_address;
    utxo_in.token_balance <== token_balance;
    utxo_in.native_balance <== native_balance;
    utxo_in.owner_commit <== utxo_in_commit.out;

    component mp_path_bits = Num2Bits(n);
    mp_path_bits.in <== mp_path;

    component utxo_in_proof = merkleproofmimc(n);
    for(var j=0; j<n; j++) {
        utxo_in_proof.sibling[j] <== mp_sibling[j];
        utxo_in_proof.path[j] <== mp_path_bits.out[j];
    }

    utxo_in_proof.leaf <== utxo_in.out;
    utxo_in_proof.root === root
}

component main = ForceWithdraw(32);