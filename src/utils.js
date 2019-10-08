const circomlib = require("circomlib");
const snarkjs = require("snarkjs");
const fs = require("fs");
const { groth, Circuit, bigInt } = snarkjs;

const { stringifyBigInts, unstringifyBigInts } = require("snarkjs/src/stringifybigint");

const buildBn128 = require("websnark/src/bn128.js");
const buildpkey = require("./buildpkey.js");
const buildwitness = require("./buildwitness.js");
const crypto = require("crypto");


const _pedersen = require("circomlib/src/pedersenHash.js");
const babyJub = require("circomlib/src/babyjub.js");
const _ = require("lodash");



function pedersen(x, size) {
  return babyJub.unpackPoint(_pedersen.hash(bigInt.leInt2Buff(x, Math.ceil(size / 8)), size))[0];
}


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




function witness(input, name) {
  const circuit = new Circuit(fload(`${__dirname}/../circuitsCompiled/${name}.json`));
  const witness = circuit.calculateWitness(input);
  return witness;
}

let bn128 = undefined;
async function proof(input, name) {
  if (typeof (bn128) === "undefined") {
    bn128 = await buildBn128();
  }

  const circuit = new Circuit(fload(`${__dirname}/../circuitsCompiled/${name}.json`));
  const witness = circuit.calculateWitness(input);

  // const pk = fload(`${__dirname}/../circuitsCompiled/${name}_pk.json`);
  // return groth.genProof(pk, witness);

  const pk = fs.readFileSync(`${__dirname}/../circuitsCompiled/${name}_pk.bin`).buffer;
  const proof = unstringifyBigInts(await bn128.groth16GenProof(buildwitness(witness), pk));
  return { proof, publicSignals: witness.slice(1, circuit.nPubInputs + circuit.nOutputs + 1) };

}

async function verify({ proof, publicSignals }, name) {
  if (typeof (bn128) === "undefined") {
    bn128 = await buildBn128();
  }
  const vk = fload(`./circuitsCompiled/${name}_vk.json`);
  //return groth.isValid(vk, proof, publicSignals);
  return await bn128.groth16Verify(vk, publicSignals, proof);
}

function pubkey(pk) {
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





_.assign(exports, { randrange, pedersen, witness, fload, verify, pubkey, linearize_vk_verifier, linearize_proof, proof });