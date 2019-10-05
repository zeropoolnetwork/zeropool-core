const _ = require("lodash");
const assert = require("assert");
const babyJub = require("circomlib/src/babyjub.js");
const { pedersen, randrange } = require("./utils.js");
const { MerkleTree } = require("./merkletree.js");

const poseidon = require("circomlib/src/poseidon.js").createHash(6, 8, 57);


const proofLength = 2;

const defaultInputs = (proofLength) => ({
  root: 0n,
  n0: 0n,
  n1_or_u_in: 0n,
  out_u0: 0n,
  out_u1_or_asset: 0n,
  txtype: 0n,

  mp_sibling: [Array(proofLength).fill(0n), Array(proofLength).fill(0n)],
  mp_path: Array(2).fill(0n),
  utxo_in: [Array(4).fill(0n), Array(4).fill(0n)],
  utxo_out: [Array(5).fill(0n), Array(5).fill(0n)],
  privkey:0n
})

function trimInputs(inputs) {
  inputs.utxo_in = inputs.utxo_in.map(x=>x.slice(0,4));
  return inputs;
}


function utxo(assetId, amount, nativeAmount, uid, owner) {
  return { assetId, amount, nativeAmount, uid, owner };
}

function utxoInputs({ assetId, amount, nativeAmount, uid, owner }) {
  return [ assetId, amount, nativeAmount, uid, owner ];
}

function utxoRandom(fixed) {
  return _.defaults(
    fixed,
    utxo(randrange(0n, 1n << 8n), randrange(0n, 1n << 32n), randrange(0n, 1n << 32n), randrange(0n, 1n << 253n), randrange(0n, babyJub.p))
  );
}

function parseAsset(asset) {
  const assetId = asset & 0xffffn;
  const amount = (asset >> 16n) & 0xffffffffffffffffn;
  const nativeAmount =  (asset >> 80n) & 0xffffffffffffffffn;
  return {assetId, amount, nativeAmount}
}

function packAsset({assetId, amount, nativeAmount}) {
  return assetId + (amount << 16n) + (nativeAmount << 80n);
}

function utxoFromAsset(asset, uid, owner) {
  return _.defaults({ owner, uid }, parseAsset(asset));
}

function utxoToAsset(utxo) { return packAsset(utxo) };


function uidRandom() {
  return randrange(0n, 1n << 253n);
}


function depositCompute({ asset, owner }) {
  const uid = uidRandom();
  const utxo = utxoFromAsset(asset, uid, owner);
  const utxo_out = [utxoInputs(utxo)];
  const out_u0 = utxoHash(utxo);
  const out_u1_or_asset = asset;
  const inputs = _.defaultsDeep({ utxo_out, out_u0, out_u1_or_asset }, defaultInputs(proofLength));
  const add_nullifier = [];
  const add_utxo = [utxo];
  trimInputs(inputs);
  return { inputs, add_utxo, add_nullifier };
}

function getNullifier(utxo, privkey) {
  const preimage = utxo.uid+(privkey << 253n);
  return pedersen(pedersen(preimage, 504), 254);
}

function withdrawalCompute({ asset, receiver, utxo_in, mp_sibling, mp_path, root, privkey, fee}) {
  const asset_utxo = utxoFromAsset(asset);
  const spend_out = spendUtxoPair(utxo_in, asset_utxo, fee, utxo_in[0].owner);
  assert(spend_out != null, "cannot compute spend");

  let utxo_out = [spend_out.utxo];
  if (spend_out.in_swap) [utxo_in[0], utxo_in[1]] = [utxo_in[1], utxo_in[0]];

  assert((0n <= receiver) && (receiver < (1n << 160n)), "receiver must be 160bit number");
  assert((utxo_in[0].assetId == asset_utxo.assetId) && (utxo_in[0].assetId == utxo_in[1].assetId), "assets must be same");
  assert(utxo_in[0].owner == utxo_in[1].owner, "owner must be same");
  for (let i = 0; i < 2; i++)
    assert(root == MerkleTree.computeRoot(mp_sibling[i], mp_path[i], utxoHash(utxo_in[i])));



  const txtype = (1n << 224n) + (fee << 160n) + receiver;
  const out_u0 = utxoHash(utxo_out[0]);
  const add_utxo = [utxo_out];
  const out_u1_or_asset = asset;

  const n0 = getNullifier(utxo_in[0], privkey);
  const n1_or_u_in = getNullifier(utxo_in[1], privkey);
  const add_nullifier = [n0, n1_or_u_in];


  utxo_in = utxo_in.map(utxoInputs);
  utxo_out = utxo_out.map(utxoInputs);

  const inputs = _.defaultsDeep(
    { mp_path, mp_sibling, utxo_in, root, txtype, out_u0, out_u1_or_asset, n0, n1_or_u_in, utxo_out, privkey},
    defaultInputs(proofLength)
  );
  trimInputs(inputs);
  return { inputs, add_utxo, add_nullifier };

}


function spendUtxoPair(utxo_in, utxo_spend, fee, owner) {
  assert(utxo_in.length == 2);
  if (typeof owner === "undefined") owner = 0n;
  const uid = uidRandom();
  const total_amount = {};
  
  utxo_in.forEach(u => total_amount[u.assetId] = _.get(total_amount, u.assetId, 0n) + u.amount);
  utxo_in.forEach(u => total_amount["native"] = _.get(total_amount, "native", 0n) + u.nativeAmount);
 
  total_amount[utxo_spend.assetId] -= utxo_spend.amount;
  total_amount["native"] -= utxo_spend.nativeAmount + fee;
  if ((total_amount[utxo_spend.assetId] < 0n) || (total_amount["native"] < 0n))
    return null;


  if (_.keys(total_amount).length > 1)
    for (let k in total_amount)
      if (total_amount[k] == 0n)
        delete total_amount[k];

  const k = _.keys(total_amount);
  if (k.length > 2)
    return null;

  const utxo_rem = utxo(BigInt(k[0]), total_amount[k[0]], total_amount["native"], owner, uid);
  if (utxo_in[1].assetId == utxo_spend.assetId)
    return {utxo:utxo_rem, in_swap:false}
  else
    return {utxo:utxo_rem, in_swap:true};

}



function transferPreCompute({ utxo_in, utxo_out, mp_sibling, mp_path, root, txbound, receiver }) {
  if (typeof txbound === "undefined") txbound = 0n;
  if (typeof receiver === "undefined") receiver = utxo_in[0].owner;
  if (!(utxo_out instanceof Array)) {
    utxo_out = [utxo_out];
  }
  if (utxo_out.length == 1) {
    utxo_out = spendUtxoPair(utxo_in, utxo_out[0], receiver);
    assert(utxo_out != null, "cannot spend utxo pair");
  }

  assert((0n <= txbound) && (txbound < (1n << 160n)), "txbound must be 160bit number");
  assert(utxo_in[0].owner == utxo_in[1].owner, "owner must be same");
  for (let i = 0; i < 2; i++)
    assert(root == MerkleTree.computeRoot(mp_sibling[i], mp_path[i], utxoHash(utxo_in[i])));

  const same_inputs = _.eq(utxo_in[0], utxo_in[1]);
  const txtype = (2n << 160n) + txbound;
  return { utxo_in, utxo_out, txtype, mp_sibling, mp_path, root, same_inputs };
}


function transferCompute({ same_inputs, utxo_in, utxo_out, txtype, mp_sibling, mp_path, root, ecvrf, eddsa }) {

  const out_u1 = utxoHash(utxo_out[0]);
  const add_utxo = utxo_out;
  const out_u2_or_asset = utxoHash(utxo_out[1]);

  const n1 = ecvrf[0][0];
  const n2_or_u_in = ecvrf[1][0];
  const add_nullifier = [n1, n2_or_u_in];

  utxo_out = utxo_out.map(utxoInputs);
  utxo_in = utxo_in.map(utxoInputs);
  ecvrf = ecvrf.map(x => x.slice(1));
  const inputs = _.defaultsDeep(
    { mp_path, mp_sibling, utxo_in, root, txtype, out_u1, out_u2_or_asset, ecvrf, n1, n2_or_u_in, utxo_out, eddsa },
    defaultInputs(proofLength)
  );

  return { inputs, add_utxo, add_nullifier };

}




function transfer2PreCompute({ utxo_in, utxo_out, mp_sibling, mp_path, root, txbound, receiver }) {
  if (typeof txbound === "undefined") txbound = 0n;
  if (typeof receiver === "undefined") receiver = utxo_in[0].owner;
  if (!(utxo_out instanceof Array)) {
    utxo_out = [utxo_out];
  }
  if (utxo_out.length == 1) {
    utxo_out = spendUtxoPair(utxo_in, utxo_out[0], receiver);
    assert(utxo_out != null, "cannot spend utxo pair");
  }

  assert((0n <= txbound) && (txbound < (1n << 160n)), "txbound must be 160bit number");
  assert(utxo_in[0].owner == utxo_in[1].owner, "owner must be same");
  assert(root == MerkleTree.computeRoot(mp_sibling[0], mp_path[0], utxoHash(utxo_in[0])));
  assert((mp_path.length == 1) && (mp_sibling.length == 1));

  const txtype = (3n << 160n) + txbound;
  return { utxo_in, utxo_out, txtype, mp_sibling, mp_path, root };
}


function transfer2Compute({ utxo_in, utxo_out, txtype, mp_sibling, mp_path, root, ecvrf, eddsa }) {

  const out_u1 = utxoHash(utxo_out[0]);
  const add_utxo = utxo_out;
  const out_u2_or_asset = utxoHash(utxo_out[1]);

  const n1 = ecvrf[0][0];
  const n2_or_u_in = utxoHash(utxo_in[1]);
  const add_nullifier = [n1, n2_or_u_in];

  utxo_out = utxo_out.map(utxoInputs);
  utxo_in = utxo_in.map(utxoInputs);
  ecvrf = ecvrf.map(x => x.slice(1));
  const inputs = _.defaultsDeep(
    { mp_path, mp_sibling, utxo_in, root, txtype, out_u1, out_u2_or_asset, ecvrf, n1, n2_or_u_in, utxo_out, eddsa },
    defaultInputs(proofLength)
  );

  return { inputs, add_utxo, add_nullifier };

}







function utxoHash(utxo) {
  const inputs = utxoInputs(utxo);
  console.log(inputs);
  [1n << 16n, 1n << 64n, 1n << 64n, 1n << 253n, babyJub.p].forEach((v, i) => assert((0n <= inputs[i]) && (inputs[i] < v), `wrong value at utxo[${i}]: ${inputs[i]}`));
  const mantice = inputs[0] + (inputs[1] << 16n) + (inputs[2] << 80n) + (inputs[3] << 144n) +  (inputs[4] << 397n);
  return pedersen(mantice, 651);
}



_.assign(exports, {
  utxo, utxoInputs, utxoRandom, utxoToAsset, utxoFromAsset, utxoHash,
  depositCompute,
  withdrawalCompute,
  transferCompute, transferPreCompute,
  transfer2Compute, transfer2PreCompute,
  proofLength, packAsset
});
