const circomlib = require("circomlib");
const snarkjs = require("snarkjs");
const fs = require("fs");
const { groth, Circuit, bigInt } = snarkjs;

const { stringifyBigInts, unstringifyBigInts } = require("snarkjs/src/stringifybigint");

const buildBn128 = require("websnark/src/bn128.js");
const buildwitness = require("./buildwitness.js");
const crypto = require("crypto");


const babyJub = require("circomlib/src/babyjub.js");
const _ = require("lodash");



function randrange(from, to) {
  if (from == to)
    return from;
  if (from > to)
    [from, to] = [to, from];
  const interval = to - from;
  if (typeof from === "number")
    return from + Math.floor(Math.random() * interval);
  let t = 0;
  while (interval > bigInt.one.shl(t*8))
    t++;
  return from + bigInt.leBuff2int(crypto.randomBytes(t)) % interval;
}



const fload = f => unstringifyBigInts(JSON.parse(fs.readFileSync(f)))
const getCircomJson = ()=>fload(`${__dirname}/../circuitsCompiled/transaction.json`)
const getCircomVerofierJson = ()=>fload(`${__dirname}/../circuitsCompiled/transaction_vk.json`)
const getWebsnarkPK = () => fs.readFileSync(`${__dirname}/../circuitsCompiled/transaction_pk.bin`).buffer

function witness(input) {
  const circuit = new Circuit(getCircomJson());
  const witness = circuit.calculateWitness(input);
  return witness;
}

let bn128 = undefined;
async function proof(input) {
  if (typeof (bn128) === "undefined") {
    bn128 = await buildBn128();
  }

  const circuit = new Circuit(getCircomJson());
  const witness = circuit.calculateWitness(input);

  const pk = getWebsnarkPK();
  const proof = unstringifyBigInts(await bn128.groth16GenProof(buildwitness(witness), pk));
  return { proof, publicSignals: witness.slice(1, circuit.nPubInputs + circuit.nOutputs + 1) };

}

async function verify({ proof, publicSignals }) {
  if (typeof (bn128) === "undefined") {
    bn128 = await buildBn128();
  }
  const vk = getCircomVerofierJson();
  return await bn128.groth16Verify(vk, publicSignals, proof);
}

function get_pubkey(pk) {
  return babyJub.mulPointEscalar(babyJub.Base8, pk)[0];
}


function linearize_vk_verifier(vk_verifier) {
  const result = Array(14 + 2 * vk_verifier.IC.length);
  result[0] = vk_verifier.vk_alfa_1[0];
  result[1] = vk_verifier.vk_alfa_1[1];

  result[2] = vk_verifier.vk_beta_2[0][1];
  result[3] = vk_verifier.vk_beta_2[0][0];
  result[4] = vk_verifier.vk_beta_2[1][1];
  result[5] = vk_verifier.vk_beta_2[1][0];

  result[6] = vk_verifier.vk_gamma_2[0][1];
  result[7] = vk_verifier.vk_gamma_2[0][0];
  result[8] = vk_verifier.vk_gamma_2[1][1];
  result[9] = vk_verifier.vk_gamma_2[1][0];

  result[10] = vk_verifier.vk_delta_2[0][1];
  result[11] = vk_verifier.vk_delta_2[0][0];
  result[12] = vk_verifier.vk_delta_2[1][1];
  result[13] = vk_verifier.vk_delta_2[1][0];

  for (let i = 0; i < vk_verifier.IC.length; i++) {
    result[14 + 2 * i] = vk_verifier.IC[i][0];
    result[14 + 2 * i + 1] = vk_verifier.IC[i][1];
  }
  return result;
}

function linearize_proof(proof) {
  const result = Array(8);
  result[0] = proof.pi_a[0];
  result[1] = proof.pi_a[1];

  result[2] = proof.pi_b[0][1];
  result[3] = proof.pi_b[0][0];
  result[4] = proof.pi_b[1][1];
  result[5] = proof.pi_b[1][0];

  result[6] = proof.pi_c[0];
  result[7] = proof.pi_c[1];

  return result;
}


function bigint_to_hex(x, sz) {
  const zeros = "0000000000000000000000000000000000000000000000000000000000000000";
  sz = typeof sz === "undefined" ? 32 : sz;
  const xdata = x.toString(16);
  return "0x" + zeros.substring(x.length, sz*2) + xdata;
}

function subgroupDecompress(x) {
    x = bigInt(x);
    const p = babyJub.p;
    const x2 = x.mul(x, p);
    const t = babyJub.A.mul(x2).sub(bigInt.one).mul(babyJub.D.mul(x2).sub(bigInt.one).inverse(p)).affine(p);
    const y = snarkjs.bn128.Fr.sqrt(t);

    if(babyJub.inSubgroup([x,y]))
        return [x,y];
    
    if(babyJub.inSubgroup([x,-y]))
        return [x,-y];
    
    throw("Not a compressed point at subgroup");
}

function fr_random() {
    return randrange(0n, snarkjs.bn128.r);
}

function fs_random() {
    return randrange(0n, babyJub.subOrder);
}

function u160_random() {
    return randrange(0n, 1n<<160n);
}

  


module.exports = { fr_random, fs_random, u160_random, randrange, witness, fload, verify, get_pubkey, linearize_vk_verifier, linearize_proof, proof, subgroupDecompress, bigint_to_hex };