const { getEthereumAddress, keccak256 } = require('./ethereum/ethereum');
const ZeroPoolContract  = require('./ethereum/zeropool-contract');
const { transfer_compute, utxo } = require('../circom/src/inputs');
const { MerkleTree } = require('../circom/src/merkletree');
const { getProof, encryptUtxo, decryptUtxo, getKeyPair } = require("./utils");
const fs = require('fs'), proover_key = fs.readFileSync('./../circom/circuitsCompiled/transaction_pk.bin').buffer;

const BN254_ORDER = 16798108731015832284940804142231733909759579603404752749028378864165570215949n;
const MAX_AMOUNT = 1766847064778384329583297500742918515827483896875618958121606201292619776n;

class ZeroPoolNetwork {

  constructor(contractAddress, privK, zpMnemonic, connectionString = 'http://127.0.0.1:8545') {
    this.ethAddress = getEthereumAddress(privK);
    this.contractAddress = contractAddress;
    this.zpKeyPair = getKeyPair(zpMnemonic);
    this.ZeroPool = new ZeroPoolContract(contractAddress, privK, connectionString);
  }

  async deposit(tokenAddress, depositAmount) {
    const preparedData = await this.prepareTransaction(
      BigInt(tokenAddress),
      BigInt(depositAmount),
      [],
      [utxo(BigInt(tokenAddress), BigInt(depositAmount), this.zpKeyPair.publicKey)]
    );
    preparedData.Tx.token = tokenAddress;


    const encoded_tx = this.ZeroPool.encodeTx(preparedData.Tx);
    const tx_hash = keccak256(encoded_tx);

    const transactionDetails = await this.ZeroPool.deposit({
      token: tokenAddress,
      amount: depositAmount.toString(),
      txhash: tx_hash
    });

    const deposit_blocknumber = transactionDetails.blockNumber;

    // This one goes to publish block
    // this.publishBlockItems( [obj, obj, obj], 500)
    return {
      deposit_blocknumber,
      proof: preparedData.Tx.proof,
      message1: preparedData.Tx.TxExternalFields.Message[0],
      message2: preparedData.Tx.TxExternalFields.Message[1],
      owner: preparedData.Tx.TxExternalFields.owner,
      delta: preparedData.Tx.delta,
      token: preparedData.Tx.token,
      utxo: preparedData.Tx.utxo,
      nullifier: preparedData.Tx.nullifier,
      rootptr: preparedData.Tx.rootptr,
      new_root: preparedData.new_root
    };
  }

  async transfer(token, utxo_in = [], utxo_out = []) {
    const preparedData = await this.prepareTransaction(
      BigInt(token),
      BigInt(0),
      utxo_in,
      utxo_out
    );
    preparedData.Tx.token = token;

    return {
      deposit_blocknumber: 0,
      proof: preparedData.Tx.proof,
      message1: preparedData.Tx.TxExternalFields.Message[0],
      message2: preparedData.Tx.TxExternalFields.Message[1],
      owner: preparedData.Tx.TxExternalFields.owner,
      delta: preparedData.Tx.delta,
      token: preparedData.Tx.token,
      utxo: preparedData.Tx.utxo,
      nullifier: preparedData.Tx.nullifier,
      rootptr: preparedData.Tx.rootptr,
      new_root: preparedData.new_root
    };

  }

  async withdraw(token, utxo_in = []) {
    const preparedData = await this.prepareTransaction(
      BigInt(token),
      -utxo_in.reduce((a,b) => { a += b.amount; return a; } , 0n),
      utxo_in,
      []
    );
    preparedData.Tx.token = token;

    // BlockItem
    return {
      deposit_blocknumber: 0,
      proof: preparedData.Tx.proof,
      message1: preparedData.Tx.TxExternalFields.Message[0],
      message2: preparedData.Tx.TxExternalFields.Message[1],
      owner: preparedData.Tx.TxExternalFields.owner,
      delta: preparedData.Tx.delta,
      token: preparedData.Tx.token,
      utxo: preparedData.Tx.utxo,
      nullifier: preparedData.Tx.nullifier,
      rootptr: preparedData.Tx.rootptr,
      new_root: preparedData.new_root
    };
    // this.publishBlockItems( [obj], )
  }

  async depositCancel({ token, amount, txhash, owner, blocknumber }) {
    return this.ZeroPool.cancelDeposit({ token, amount, txhash, owner, blocknumber });
  }

  // Publish block
  async publishBlockItems(blocks, blocknumber_expires) {
    const rollup_cur_tx_num = await this.ZeroPool.getRollupTxNum();
    return this.ZeroPool.publishBlock(blocks, rollup_cur_tx_num >> 8, blocknumber_expires)
  }

  async myDeposits() {
    const events = await this.ZeroPool.depositEvents();
    if (events.length === 0) {
      return [];
    }
    const myDeposits = events.filter(event => event.owner === this.ethAddress);
    const txHums$ = myDeposits.map(deposit => this.ZeroPool.getDepositTxNum(deposit));
    const txHums = await Promise.all(txHums$);
    return myDeposits.map((deposit, i) => {
      if (txHums[i] === '115792089237316195423570985008687907853269984665640564039457584007913129639935') {
        return {
          deposit,
          isExists: true,
          isSpent: false,
          spentInTx: 0
        }
      } else if (txHums[i] === '0') {
        return {
          deposit,
          isExists: false,
          isSpent: false,
          spentInTx: 0
        }
      }

      return {
        deposit,
        isExists: true,
        isSpent: true,
        spentInTx: txHums[i]
      }
    });
  }

  async utxoRootHash() {
    const { _, hashes } = await this.getUtxosFromContract();
    const mt = new MerkleTree(32 + 1);
    if (hashes.length === 0) {
      return mt.root;
    }
    mt.pushMany(hashes);
    return mt.root;
  }

  async prepareTransaction(token, delta, utxo_in = [], utxo_out = []) {
    const {_, hashes} = await this.getUtxosFromContract();
    const mt = new MerkleTree(32 + 1);
    if (hashes.length !== 0) {
      mt.pushMany(hashes);
    }

    const {
      inputs,
      add_utxo
    } = transfer_compute(mt.root, utxo_in, utxo_out, token, delta, 0n, this.zpKeyPair.privateKey);

    const encryptedUTXOs = add_utxo.map(utxo => encryptUtxo(this.zpKeyPair.publicKey, utxo));
    const encoded_tx_external_fields = this.ZeroPool.encodeTxExternalFields(this.ethAddress, encryptedUTXOs);
    inputs.message_hash = keccak256(encoded_tx_external_fields);

    const tx_external_fields = {
      owner: delta === 0n ? "0x0000000000000000000000000000000000000000" : this.ethAddress,
      Message: encryptedUTXOs
    };

    const proof = await getProof(inputs, proover_key);
    const rootPointer
      = hashes.length / 2;

    mt.push(...inputs.utxo_out_hash);

    return {
      Tx: {
        rootptr: rootPointer,
        nullifier: inputs.nullifier,
        utxo: inputs.utxo_out_hash,
        token: inputs.token,
        delta: inputs.delta,
        TxExternalFields: tx_external_fields,
        proof
      },
      new_root: mt.root
    };
  }

  async myUtxos() {
    const { utxos, hashes, blocknumbers } = await this.getUtxosFromContract();
    if (utxos.length === 0) {
      return [];
    }

    const mt = new MerkleTree(32 + 1);
    mt.pushMany(hashes);

    const myUtxo = [];
    utxos.forEach((encryptedUtxo, i) => {
      try {
        const utxo = decryptUtxo(this.zpKeyPair.privateKey, encryptedUtxo, hashes[i]);
        if (utxo.amount.toString() !== '0') {
          utxo.mp_sibling = mt.proof(i);
          utxo.mp_path = i;
          utxo.blocknumber = blocknumbers[i];
          myUtxo.push(utxo);
        }
      } catch (e) {
      }
    });

    return myUtxo;
  }

  async getUtxosFromContract() {
    const blocks = await this.ZeroPool.publishBlockEvents();
    if (blocks.length === 0) {
      return { utxos: [], hashes: [] };
    }

    const allUtxos = [];
    const allHashes = [];
    const inBlockNumber = [];
    blocks.forEach(block => {
      block.BlockItems.forEach(item => {
        const hashPack = item[0].utxo.map(BigInt);
        item[0].TxExternalFields.Message.forEach((msg, i) => {
          const utxo = msg.data.map(BigInt);
          allUtxos.push(utxo);
          allHashes.push(hashPack[i]);
          inBlockNumber.push(block.blocknumber);
        })
      });
    });

    return {
      utxos: allUtxos,
      hashes: allHashes,
      blocknumbers: inBlockNumber
    };
  }

}


module.exports = ZeroPoolNetwork;

