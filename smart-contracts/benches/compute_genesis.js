const env = process.env;
if (env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const HDWalletProvider = require('@truffle/hdwallet-provider');
const fs = require("fs");
const Web3 = require("web3");
//const ZeroPoolContract = require("../../lib/ethereum/zeropool-contract");
const _ = require('lodash');

const hdwallet = new HDWalletProvider(env.MNEMONIC, env.ETHEREUM_RPC, 0, 10);
//const privkey = "0x"+hdwallet.wallets[address]._privKey.toString("hex")
const web3 = new Web3(hdwallet);


const toBN = web3.utils.toBN;
const toWei = web3.utils.toWei;
const fromWei = web3.utils.fromWei;


const path = require("path");
const snarkjs = require("snarkjs");
const assert = require("assert");
const {utxo, utxo_random, obj_utxo_inputs, utxo_hash, transfer_compute, PROOF_LENGTH} = require("../../circom/src/inputs");
const {randrange, fr_random, u160_random, fs_random, proof, verify, get_pubkey} = require("../../circom/src/utils");
const babyJub = require("circomlib/src/babyjub.js");
const {MerkleTree} = require("../../circom/src/merkletree");
const {linearize_proof, bigint_to_hex} = require("../../circom/src/utils");
const {stringifyBigInts} = require("snarkjs/src/stringifybigint");

const bigInt = require("snarkjs").bigInt;
const blake2b = require('blake2b');





(async ()=> {
// prepare genesis data

    const secret = bigInt.leBuff2int(blake2b(32).update(Buffer.from("zeropool")).digest()).mod(babyJub.subOrder);
    const pubkey = get_pubkey(secret);
    const token = 0n;
    const mt = new MerkleTree(PROOF_LENGTH+1);

    utxo_in = [
        utxo(0n, 0n, pubkey, 0n, Array(32).fill(0n), 0n),
        utxo(0n, 0n, pubkey, 1n, Array(32).fill(0n), 0n)
    ];

    utxo_out = [
        utxo(0n, 0n, 0n, 0n),
        utxo(0n, 0n, 0n, 1n)
    ];

    const root = mt.root;


    const delta = 0n;
    const message_hash = BigInt(web3.utils.keccak256("0x"+ Array(9*32).fill("00").join("")));


    const {inputs} = transfer_compute(root, utxo_in, utxo_out, token, delta, message_hash, secret);
    const pi = await proof(inputs);


    const blockItem = ()=>{
        const proof = linearize_proof(pi.proof).map(x=>bigint_to_hex(x));
        const message = Array(2).fill(0).map(()=> [Array(4).fill(0n)]).map(x=>bigint_to_hex(x));
        const tx_external_fields = [bigint_to_hex(0n), message];
        const rootptr = bigint_to_hex(pi.publicSignals[0]);
        const nullifier = [pi.publicSignals[1], pi.publicSignals[2]].map(x=>bigint_to_hex(x));
        const utxo = [pi.publicSignals[3], pi.publicSignals[4]].map(x=>bigint_to_hex(x));
        const token = bigint_to_hex(pi.publicSignals[5], 20);
        const delta = bigint_to_hex(pi.publicSignals[6]);
        const tx = [rootptr, nullifier, utxo, token, delta, tx_external_fields, proof];
        const newroot = bigint_to_hex(root);
        const deposit_blocknumber = bigint_to_hex(0n);
        return [tx, newroot, deposit_blocknumber];
    };

 

    const accounts = await web3.eth.getAccounts();


    const netid = await web3.eth.net.getId();
    const blocknumber = await web3.eth.getBlockNumber();
    const zeropoolData = JSON.parse(fs.readFileSync("build/contracts/ZeroPool.json", "utf8"));
    const zeropool = new web3.eth.Contract(zeropoolData.abi, zeropoolData.networks[netid].address, { from: accounts[0] });
 

    const block = [blockItem()];

    const rollup_tx_num = await zeropool.methods.rollup_tx_num().call();
    const rollup_block_num = rollup_tx_num>>8;
    const blocknumber_exp = (parseInt(blocknumber)+1000).toString();
    
    const data =  zeropool.methods.publishBlock(block, rollup_block_num.toString(), blocknumber_exp).encodeABI();
    const gas =  await zeropool.methods.publishBlock(block, rollup_block_num.toString(), blocknumber_exp).estimateGas()
    console.log(`blob size: ${(data.length-2)/2}; gas: ${gas}; gas per tx: ${gas/N}`);
    process.exit();

    await zeropool.methods.publishBlock(block, rollup_block_num.toString(), blocknumber_exp).send();

    process.exit();
})();


async function testDeposit() {
    const accounts = await web3.eth.getAccounts();
    const netid = await web3.eth.net.getId();
    const zeropoolData = JSON.parse(fs.readFileSync("build/contracts/ZeroPool.json", "utf8"));
    const zeropool = new web3.eth.Contract(zeropoolData.abi, zeropoolData.networks[netid].address, { from: accounts[0] });
    const txhash = web3.utils.randomHex(32);
    console.log(fromWei(await web3.eth.getBalance(accounts[0])));
    await zeropool.methods.deposit('0x0000000000000000000000000000000000000000', toWei('1'), txhash).send({value: toWei('1')});
    console.log(fromWei(await web3.eth.getBalance(accounts[0])));
}