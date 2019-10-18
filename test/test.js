const { randrange, witness, pubkey, proof, verify } = require("../src/utils.js");
const babyJub = require("circomlib/src/babyjub.js");

const _ = require("lodash");
const { utxoRandom, utxoHash, depositCompute, utxoToAsset, addSignatures,
  withdrawalCompute,
  transferCompute, transferPreCompute,
  transfer2Compute,
  proofLength, packAsset, utxo
} = require("../src/inputs.js")
const { MerkleTree } = require("../src/merkletree.js");
const assert = require("assert");

function depositTest() {
  const u = utxoRandom();
  const { inputs } = depositCompute({ asset: utxoToAsset(u), owner: u.owner });
  const w = witness(inputs);
}

async function depositTest_Proof_and_verify() {
  const u = utxoRandom();
  const { inputs } = depositCompute({ asset: utxoToAsset(u), owner: u.owner });
  const pi = await proof(inputs);
  assert(await verify(pi), "wrong proof or verification key.");

}

async function withdrawalTest_Proof_and_verify() {
  const st = genRandomState({ assetId: true });
  const mp_path = randrange2(0, st.utxos.length);
  const fee = 1n;

  const receiver = randrange(0n, 1n << 160n);
  const mp_sibling = mp_path.map(e => st.tree.proof(e));
  const u0 = st.utxos[mp_path[0]];
  const asset = packAsset({  // half of amount and native amount of utxo u0
    assetId:u0.assetId, 
    amount:u0.amount/2n, 
    nativeAmount:u0.nativeAmount/2n }); 
  const root = st.tree.root;
  const utxo_in = mp_path.map(i => st.utxos[i]);

  const { inputs } = withdrawalCompute({ asset, receiver, utxo_in, mp_sibling, mp_path, root, privkey:st.pk, fee });
  const pi = await proof(inputs);
  assert(await verify(pi), 'Verifier should return true');
}


function genRandomState(fixed) {
  const max_test_elements = Math.min(32, 1 << proofLength);
  if (typeof fixed === "undefined") fixed = {};
  const pk = randrange(0n, babyJub.subOrder);
  const owner = pubkey(pk);
  const assetId = fixed.assetId ? randrange(0n, 1n << 16n) : undefined;

  const utxos = Array(max_test_elements).fill(0).map(() => utxoRandom({ assetId, owner }));
  const tree = new MerkleTree(proofLength + 1);
  utxos.forEach(u => tree.push(utxoHash(u)));
  return { pk, utxos, tree };
}

function randrange2(from, to){
  const n = to-from;
  assert(n >= 2);
  const a = randrange(from, to);
  const b = ((a - from + randrange(1, n)) % n) + from;
  return [a,b];
}

async function withdrawalTest() {
  const st = genRandomState({ assetId: true });
  const mp_path = randrange2(0, st.utxos.length);
  const fee = 1n;

  const receiver = randrange(0n, 1n << 160n);
  const mp_sibling = mp_path.map(e => st.tree.proof(e));
  const u0 = st.utxos[mp_path[0]];
  const asset = packAsset({  // half of amount and native amount of utxo u0
    assetId:u0.assetId, 
    amount:u0.amount/2n, 
    nativeAmount:u0.nativeAmount/2n }); 
  const root = st.tree.root;
  const utxo_in = mp_path.map(i => st.utxos[i]);

  const { inputs } = withdrawalCompute({ asset, receiver, utxo_in, mp_sibling, mp_path, root, privkey:st.pk, fee });
  const w = witness(inputs);

}

function withdrawalTest2() {
  const st = genRandomState({ assetId: true });
  const mp_path = [randrange(0, st.utxos.length), 0];
  const fee = 1n;

  const receiver = randrange(0n, 1n << 160n);
  const mp_sibling = [st.tree.proof(mp_path[0]),  Array(proofLength).fill(0n)];
  const u0 = st.utxos[mp_path[0]];
  const asset = packAsset({  // half of amount and native amount of utxo u0
    assetId:u0.assetId, 
    amount:u0.amount/2n, 
    nativeAmount:u0.nativeAmount/2n }); 
  const root = st.tree.root;
  const utxo_in = [st.utxos[mp_path[0]], utxo(u0.assetId, 0n, 0n, randrange(0n, 1n<<253n), u0.owner)];

  const { inputs } = withdrawalCompute({ asset, receiver, utxo_in, mp_sibling, mp_path, root, privkey:st.pk, fee });
  const w = witness(inputs);

}



function transferTest() {
  const st = genRandomState({ assetId: true });
  const mp_path = randrange2(0, st.utxos.length);

  const fee = 1n;
  const txbound = randrange(0n, 1n << 160n);
  const mp_sibling = mp_path.map(e => st.tree.proof(e));

  const u0 = st.utxos[mp_path[0]];
  const utxo_out = _.defaults({ amount:u0.amount/2n, nativeAmount:u0.nativeAmount/2n }, u0);

  const root = st.tree.root;
  const utxo_in = mp_path.map(i => st.utxos[i]);

  const { inputs } = transferCompute({ utxo_in, utxo_out, mp_sibling, mp_path, root, txbound, fee, privkey:st.pk });
  const w = witness(inputs);
}



function transferTest_Proof_and_verify() {
  const st = genRandomState({ assetId: true });
  const mp_path = randrange2(0, st.utxos.length);

  const fee = 1n;
  const txbound = randrange(0n, 1n << 160n);
  const mp_sibling = mp_path.map(e => st.tree.proof(e));

  const u0 = st.utxos[mp_path[0]];
  const utxo_out = _.defaults({ amount:u0.amount/2n, nativeAmount:u0.nativeAmount/2n }, u0);

  const root = st.tree.root;
  const utxo_in = mp_path.map(i => st.utxos[i]);

  const { inputs } = transferCompute({ utxo_in, utxo_out, mp_sibling, mp_path, root, txbound, fee, privkey:st.pk });
  const pi = await proof(inputs);
  assert(await verify(pi), 'Verifier should return true');
}


function transferTest2() {
  const st = genRandomState();
  const mp_path = randrange2(0, st.utxos.length);

  const fee = 1n;
  const txbound = randrange(0n, 1n << 160n);
  const mp_sibling = mp_path.map(e => st.tree.proof(e));

  const u0 = st.utxos[mp_path[0]];
  const utxo_out = _.defaults({ amount:u0.amount, nativeAmount:u0.nativeAmount/2n }, u0);

  const root = st.tree.root;
  const utxo_in = mp_path.map(i => st.utxos[i]);

  const { inputs } = transferCompute({ utxo_in, utxo_out, mp_sibling, mp_path, root, txbound, fee, privkey:st.pk });
  const w = witness(inputs);
}

function transferTest3() {
  const st = genRandomState({ assetId: true });
  const mp_path = [randrange(0, st.utxos.length), 0];
  const fee = 1n;
  const mp_sibling = [st.tree.proof(mp_path[0]),  Array(proofLength).fill(0n)];

  const txbound = randrange(0n, 1n << 160n);

  const u0 = st.utxos[mp_path[0]];
  const utxo_out = _.defaults({ amount:u0.amount/2n, nativeAmount:u0.nativeAmount/2n }, u0);

  const root = st.tree.root;
  const utxo_in = [st.utxos[mp_path[0]], utxo(u0.assetId, 0n, 0n, randrange(0n, 1n<<253n), u0.owner)];

  const { inputs } = transferCompute({ utxo_in, utxo_out, mp_sibling, mp_path, root, txbound, fee, privkey:st.pk });
  const w = witness(inputs);
}


function transfer2Test() {
  const st = genRandomState({ assetId: true });
  let [mp_path, ext] = randrange2(0, st.utxos.length);
  mp_path = [mp_path];

  const fee = 1n;
  const txbound = randrange(0n, 1n << 160n);
  const mp_sibling = [st.tree.proof(mp_path[0])];

  const u0 = st.utxos[mp_path[0]];
  const utxo_out = _.defaults({ amount:u0.amount/2n, nativeAmount:u0.nativeAmount/2n }, u0);

  const root = st.tree.root;
  const utxo_in = [u0, st.utxos[ext]];

  const { inputs } = transfer2Compute({ utxo_in, utxo_out, mp_sibling, mp_path, root, txbound, fee, privkey:st.pk });
  const w = witness(inputs);
}

function transfer2Test_Proof_and_verify() {
  const st = genRandomState({ assetId: true });
  let [mp_path, ext] = randrange2(0, st.utxos.length);
  mp_path = [mp_path];

  const fee = 1n;
  const txbound = randrange(0n, 1n << 160n);
  const mp_sibling = [st.tree.proof(mp_path[0])];

  const u0 = st.utxos[mp_path[0]];
  const utxo_out = _.defaults({ amount:u0.amount/2n, nativeAmount:u0.nativeAmount/2n }, u0);

  const root = st.tree.root;
  const utxo_in = [u0, st.utxos[ext]];

  const { inputs } = transfer2Compute({ utxo_in, utxo_out, mp_sibling, mp_path, root, txbound, fee, privkey:st.pk });
  const pi = await proof(inputs);
  assert(await verify(pi), 'Verifier should return true');
}


function transfer2Test2() {
  const st = genRandomState();
  let [mp_path, ext] = randrange2(0, st.utxos.length);
  mp_path = [mp_path];

  const fee = 1n;
  const txbound = randrange(0n, 1n << 160n);
  const mp_sibling = [st.tree.proof(mp_path[0])];

  const u0 = st.utxos[mp_path[0]];
  const utxo_out = _.defaults({ amount:u0.amount, nativeAmount:u0.nativeAmount/2n }, u0);

  const root = st.tree.root;
  const utxo_in = [u0, st.utxos[ext]];

  const { inputs } = transfer2Compute({ utxo_in, utxo_out, mp_sibling, mp_path, root, txbound, fee, privkey:st.pk });
  const w = witness(inputs);
}





function transfer2Test3() {
  const st = genRandomState({ assetId: true });
  let ext = randrange(0, st.utxos.length);
  let mp_path = [0];

  const fee = 1n;
  const txbound = randrange(0n, 1n << 160n);
  const mp_sibling = [Array(proofLength).fill(0n)];

  const u1 = st.utxos[ext];
  const utxo_out = _.defaults({ amount:u1.amount, nativeAmount:u1.nativeAmount/2n }, u1);

  const root = st.tree.root;
  const utxo_in = [utxo(u1.assetId, 0n, 0n, randrange(0n, 1n<<253n), u1.owner), u1];

  const { inputs } = transfer2Compute({ utxo_in, utxo_out, mp_sibling, mp_path, root, txbound, fee, privkey:st.pk });
  const w = witness(inputs);
}







describe("Deposit", function () {
  this.timeout(80000000);
  it("Should prove deposit", depositTest)
  it("Should prove and verify deposit", depositTest_Proof_and_verify);
})

describe("Withdrawal", function () {
  this.timeout(80000000);
  it("Should prove and verify withdrawal", withdrawalTest_Proof_and_verify);
  it("Should withdraw for 2 inputs", withdrawalTest);
  it("Should withdraw for 1 input", withdrawalTest2);
})

describe("Transfer", function () {
  this.timeout(80000000);
  it("Should prove and verify transfer", transferTest_Proof_and_verify);
  it("Should transfer for 2 same asset type inputs", transferTest);
  it("Should transfer for 2 different asset inputs", transferTest2);
  it("Should transfer for 1 input", transferTest3);
})

describe("Partial transfer", function () {
  this.timeout(80000000);
  it("Should prove and verify partial transfer", transfer2Test_Proof_and_verify);
  it("Should process partial transfer for 2 same asset type inputs", transfer2Test);
  it("Should process partial transfer for 2 different asset inputs", transfer2Test2);
  it("Should process partial transfer for 1 input", transfer2Test3);
})

