const _ = require("lodash");
const assert = require("assert");
const babyJub = require("circomlib/src/babyjub.js");
const { bn128 } = require("snarkjs");
const { MerkleTree } = require("./merkletree.js");


const hash2 = poseidon.createHash(2, 8, 53);
const hash3 = poseidon.createHash(3, 8, 53);

const PROOF_LENGTH = 32;
const MIN_AMOUNT = -1n << 240n;
const MAX_AMOUNT = 1n << 240n;




function pubkey(secret) {
    return babyJub.mulPointEscalar(babyJub.Base8, secret)[0];
}

function owner_commit(pubkey, blinding) {
    return hash2([pubkey, blinding]);
}

function empty_utxo(token, pubkey) {
    const blinding = fr_random();
    const mp_path = 0n;
    const mp_sibling = Array(PROOF_LENGTH).fill(0n);
    return utxo(token, 0n, pubkey, blinding, mp_sibling, mp_path); 
}

function utxo(token, amount, pubkey, blinding, mp_sibling, mp_path) {
    if (typeof blinding === "undefined") blinding = fr_random();
    return { token, amount, pubkey, blinding, mp_sibling, mp_path};
}

function utxo_hash(utxo) {
    return hash3(out_utxo_inputs(utxo));
}

function out_utxo_inputs({ token, amount, pubkey, blinding }) {
  return [ token, amount, owner_commit(pubkey, blinding) ];
}

function in_utxo_inputs({ token, amount, blinding }) {
    return [ token, amount, blinding ];
  }

function utxo_random(fixed) {
  return _.defaults(
    fixed,
    utxo(randrange(0n, 1n << 160n), randrange(0n, 1n << 128n), randrange(0n, bn128.r))
  );
}


function fr_random() {
  return randrange(0n, bn128.r);
}


function nullifier(utxo, secret) {
    return hash2(utxo_hash(utxo), secret);
}


function transfer_compute({root, utxo_in, utxo_out, token, delta, message_hash, secret}) {
    assert(delta > MIN_AMOUNT && delta < MAX_AMOUNT);
    for(let i in utxo_in) assert(utxo_in[i].amount >= 0n && utxo_in[i].amount < MAX_AMOUNT);
    for(let i in utxo_out) assert(utxo_out[i].amount >= 0n && utxo_out[i].amount < MAX_AMOUNT);

    const pubk = pubkey(secret);
    utxo_in = _.concat(utxo_in, Array(2-utxo_in.length).fill(0).map(_=>empty_utxo(token, pubk)));
    
    if (utxo_out.length==0) {
        assert(utxo_in[0].amount + utxo_in[1].amount + delta == 0n);
        utxo_out = Array(2).fill(0).map(_=>empty_utxo(token, pubk));
    } else if (utxo_out.length==1) {
        const new_amount = delta + utxo_in[0].amount+utxo_in[1].amount - utxo_in[0].amount;
        assert(new_amount >= 0n);
        utxo_out.push(utxo(token, new_amount, pubk));
    } else {
        assert(utxo_in[0].amount + utxo_in[1].amount + delta == utxo_out[0].amount + utxo_out[1].amount);
    }

    assert(utxo_in[0].token == token && utxo_in[1].token == token && utxo_out[0].token == token && utxo_out[1].token == token);
    const secret_token = token;
    token = delta!=0n ? token : 0n;
    delta = delta < 0n ? bn128.r + delta : delta;

/*
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
*/

    const inputs = {
        root,
        nullifier: utxo_in.map(u => nullifier(u, secret)),
        utxo_out_hash: utxo_out.map(u => utxo_hash(u)),
        token,
        delta,
        message_hash,
        mp_sibling: utxo_in.map(u => u.mp_sibling),
        mp_path: utxo_in.map(u => mp_path),
        utxo_in_data: utxo_in.map(u => in_utxo_inputs(u).slice(1)),
        utxo_out_data: utxo_out.map(u => out_utxo_inputs(u).slice(1)),
        secret,
        secret_token
    };

    const add_utxo = utxo_out;
    const add_nullifier = utxo_in.map(u => nullifier(u, secret));

    return {inputs, add_utxo, add_nullifier}
}



module.exports = {
    pubkey,
    owner_commit,
    empty_utxo,
    PROOF_LENGTH,
    utxo,
    utxo_hash,
    out_utxo_inputs,
    in_utxo_inputs,
    utxo_random,
    fr_random,
    nullifier,
    transfer_compute
}