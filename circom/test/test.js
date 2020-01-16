const { randrange, witness, pubkey, proof, verify } = require("../src/utils.js");
const babyJub = require("circomlib/src/babyjub.js");

const _ = require("lodash");
const { utxoRandom, utxoHash, depositCompute, utxoToAsset, addSignatures,
  withdrawalCompute,
  utxoInputs,
  transferCompute, transferPreCompute,
  transfer2Compute,
  proofLength, packAsset, utxo
} = require("../src/inputs.js")
const { MerkleTree } = require("../src/merkletree.js");
const { encrypt, decrypt } = require("../src/encryption.js");
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



async function transferTest_Proof_and_verify() {
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

async function transfer2Test_Proof_and_verify() {
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

function encryptTest() {
  const pubKey = [
    9179550441814258414336739131252062158057167577995767508431647464699901649684n,
    15092101126901756937911767887030010246302360884612259821573390588901923188459n
  ];
  const utxo = {
    assetId: 85n,
    amount: 4219925223n,
    nativeAmount: 3320827541n,
    uid: 2082071685281033905346184349328171758866971813771434328771816734846992666050n,
    owner: 3791958887471292474768165332220121304066918570773855424825239064715169170912n
  };
  encrypt(utxoInputs(utxo), pubKey[0]);
}

function decryptTest() {
  const privKey = 1879139644264711098766524847951922888129634477451845645281549573079289595793n;
  const cypherText = [
    4652674298416466529380278059742373018567225081978321523336324598911986394519n,
    5875917077606016595684830479902113782199608844796571149660504968149660461958n,
    21268892945616729527714043385654305481204489065351999684973631197118060542201n,
    12006926897408637333958989009586988976344511963094674180406328153307436346731n,
    6447936968145025969248643070791583287713322321125327116717405805231721367300n,
    17131268120344785447103148324642364326991087945185634145279029420381856170484n,
    12648392855612686137378097586828308290123122709667222747462743578855591884458n
  ];
  decrypt(cypherText, privKey);
}

function encryptionTest() {
  const privKey = 1879139644264711098766524847951922888129634477451845645281549573079289595793n;
  const pubKey = [
    9179550441814258414336739131252062158057167577995767508431647464699901649684n,
    15092101126901756937911767887030010246302360884612259821573390588901923188459n
  ];

  const utxo = utxoInputs({
    assetId: 85n,
    amount: 4219925223n,
    nativeAmount: 3320827541n,
    uid: 2082071685281033905346184349328171758866971813771434328771816734846992666050n,
    owner: 3791958887471292474768165332220121304066918570773855424825239064715169170912n
  });

  const encryptedUtxo = encrypt(utxo, pubKey[0]);
  const decryptedUtxo = decrypt(encryptedUtxo, privKey);

  assert.deepStrictEqual(utxo, decryptedUtxo, "Decrypted utxo should be the same as a previous one");
}

describe("Deposit", function () {
  this.timeout(80000000);
  it("Should prove deposit", depositTest);
  it("Should prove and verify deposit", depositTest_Proof_and_verify);
});

describe("Withdrawal", function () {
  this.timeout(80000000);
  it("Should prove and verify withdrawal", withdrawalTest_Proof_and_verify);
  it("Should withdraw for 2 inputs", withdrawalTest);
  it("Should withdraw for 1 input", withdrawalTest2);
});

describe("Transfer", function () {
  this.timeout(80000000);
  it("Should prove and verify transfer", transferTest_Proof_and_verify);
  it("Should transfer for 2 same asset type inputs", transferTest);
  it("Should transfer for 2 different asset inputs", transferTest2);
  it("Should transfer for 1 input", transferTest3);
});

describe("Partial transfer", function () {
  this.timeout(80000000);
  it("Should prove and verify partial transfer", transfer2Test_Proof_and_verify);
  it("Should process partial transfer for 2 same asset type inputs", transfer2Test);
  it("Should process partial transfer for 2 different asset inputs", transfer2Test2);
  it("Should process partial transfer for 1 input", transfer2Test3);
});

describe("Ecryption", function () {
  this.timeout(80000000);
  it("Should encrypt", encryptTest);
  it("Should decrypt", decryptTest);
  it("Should encrypt and decrypt", encryptionTest);
});
