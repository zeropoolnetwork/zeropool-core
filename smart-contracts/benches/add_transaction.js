const env = process.env;
if (env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const HDWalletProvider = require('@truffle/hdwallet-provider');
const fs = require("fs");
const Web3 = require("web3");
//const ZeroPoolContract = require("../../lib/ethereum/zeropool-contract");
const path = require('path');
const _ = require('lodash');

const hdwallet = new HDWalletProvider(env.MNEMONIC, env.ETHEREUM_RPC, 0, 10);
//const privkey = "0x"+hdwallet.wallets[address]._privKey.toString("hex")
const web3 = new Web3(hdwallet);


const toBN = web3.utils.toBN;
const toWei = web3.utils.toWei;
const fromWei = web3.utils.fromWei;



(async ()=> {
    const accounts = await web3.eth.getAccounts();


    const netid = await web3.eth.net.getId();
    const blocknumber = await web3.eth.getBlockNumber();
    const zeropoolData = JSON.parse(fs.readFileSync("build/contracts/ZeroPool.json", "utf8"));
    const zeropool = new web3.eth.Contract(zeropoolData.abi, zeropoolData.networks[netid].address, { from: accounts[0] });
    const txhash = web3.utils.randomHex(32);

    const blockItem = ()=>{
        const proof = [Array(8).fill(0).map(()=> web3.utils.randomHex(32))];
        const message = Array(2).fill(0).map(()=> [Array(4).fill(0).map(()=> web3.utils.randomHex(32))]);
        const tx_external_fields = ["0x0000000000000000000000000000000000000000", message];
        const rootptr = web3.utils.randomHex(32);
        const nullifier = Array(2).fill(0).map(()=> web3.utils.randomHex(32));
        const utxo = Array(2).fill(0).map(()=> web3.utils.randomHex(32));
        const token = "0x0000000000000000000000000000000000000000";
        const delta = '0';
        const tx = [rootptr, nullifier, utxo, token, delta, tx_external_fields, proof];
        const newroot = web3.utils.randomHex(32);
        const deposit_blocknumber = "0";
        return [tx, newroot, deposit_blocknumber];
    };

    const N = 16;
    const block = Array(N).fill(0).map(()=>blockItem());

    const rollup_tx_num = await zeropool.methods.rollup_tx_num().call();
    const rollup_block_num = rollup_tx_num>>8;
    const blocknumber_exp = (parseInt(blocknumber)+1000).toString();
    
    const data =  zeropool.methods.publishBlock(block, rollup_block_num.toString(), blocknumber_exp).encodeABI();
    const gas =  await zeropool.methods.publishBlock(block, rollup_block_num.toString(), blocknumber_exp).estimateGas()
    console.log(`blob size: ${(data.length-2)/2}; gas: ${gas}; gas per tx: ${gas/N}`);
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