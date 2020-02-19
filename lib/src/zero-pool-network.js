const { getEthereumAddress, keccak256 } = require('./ethereum/ethereum');
const ZeroPoolContract = require('./ethereum/zeropool/zeropool-contract');
const { transfer_compute, utxo, nullifier } = require('../../circom/src/inputs');
const { MerkleTree } = require('../../circom/src/merkletree');
const { getProof, encryptUtxo, decryptUtxo, getKeyPair } = require("./utils");

class ZeroPoolNetwork {

  constructor(
      contractAddress,
      privK,
      zpMnemonic,
      transactionJson,
      prooverKey,
      connectionString = 'http://127.0.0.1:8545'
  ) {

    this.transactionJson = transactionJson;
    this.prooverKey = prooverKey;
    this.ethAddress = getEthereumAddress(privK);
    this.contractAddress = contractAddress;
    this.zpKeyPair = getKeyPair(zpMnemonic);
    this.ZeroPool = new ZeroPoolContract(contractAddress, privK, connectionString);
  }

  async deposit(token, amount) {
    const preparedData = await this.prepareBlockItem(
      token,
      BigInt(amount),
      [],
      [utxo(BigInt(token), BigInt(amount), this.zpKeyPair.publicKey)]
    );

    const transactionDetails = await this.ZeroPool.deposit({
      token: token,
      amount: amount.toString(),
      txhash: preparedData.tx_hash
    });

    const deposit_blocknumber = transactionDetails.blockNumber;

    // This one goes to publish block
    // this.publishBlockItems( [obj, obj, obj], 500)
    return {
      deposit_blocknumber: toHex(deposit_blocknumber),
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

  async transfer(token, toPubKey, amount) {
    const utxo = await this.calculateUtxo(BigInt(token), BigInt(toPubKey),  BigInt(amount));
    if (utxo instanceof Error) {
      return utxo;
    }
    const utxo_zero_delta = BigInt(0);
    const preparedData = await this.prepareBlockItem(
      token,
      utxo_zero_delta,
      utxo.utxo_in,
      utxo.utxo_out
    );

    return {
      deposit_blocknumber: '0x0',
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

  async prepareWithdraw(token, numInputs) {
    const utxos = await this.myUtxos();
    if (utxos.length < numInputs) {
      throw new Error('not enough utxos');
    }
    const utxo_in = utxos.slice(0, numInputs);
    const utxo_delta = utxo_in.reduce((a, b) => {
      a += b.amount;
      return a;
    }, 0n);

    const preparedData = await this.prepareBlockItem(
      token,
      utxo_delta * -1n,
      utxo_in,
      []
    );

    // BlockItem
    return {
      deposit_blocknumber: '0x0',
      proof: preparedData.Tx.proof,
      message1: preparedData.Tx.TxExternalFields.Message[0],
      message2: preparedData.Tx.TxExternalFields.Message[1],
      owner: preparedData.Tx.TxExternalFields.owner,
      delta: preparedData.Tx.delta,
      token: preparedData.Tx.token,
      utxo: preparedData.Tx.utxo,
      nullifier: preparedData.Tx.nullifier,
      rootptr: preparedData.Tx.rootptr,
      new_root: preparedData.new_root,
      tx_hash: preparedData.tx_hash
    };
    // this.publishBlockItems( [obj], )
  }

  depositCancel({ token, amount, txhash, owner, blocknumber }) {
    return this.ZeroPool.cancelDeposit({ token, amount, txhash, owner, blocknumber });
  }

  withdraw({ token, amount, txhash, owner, blocknumber }) {
    return this.ZeroPool.withdraw({ token, amount, txhash, owner, blocknumber });
  }

  async calculateUtxo(token, toPubKey, sendingAmount) {
    const utxos = await this.myUtxos();
    if (utxos.length === 0) {
      return new Error('you have not utxo');
    }

    const utxo_in = [];
    const utxo_out = [];
    let tmpAmount = 0n;
    for (let i = 0; i < utxos.length; i++) {
      if (i === 2) {
        return new Error('sending amount does not fit in two inputs');
      }
      tmpAmount += utxos[i].amount;
      utxo_in.push(utxos[i]);
      if (tmpAmount === sendingAmount) {
        utxo_out.push(utxo(token, sendingAmount, toPubKey));
        break;
      } else if (tmpAmount > sendingAmount) {
        utxo_out.push(utxo(token, sendingAmount, toPubKey));
        utxo_out.push(utxo(token, tmpAmount - sendingAmount, this.zpKeyPair.publicKey));
        break;
      }
    }

    return { utxo_in, utxo_out }
  }

  // Publish block
  async publishBlockItems(blocks, blocknumber_expires) {
    const rollup_cur_tx_num = await this.ZeroPool.getRollupTxNum();
    return this.ZeroPool.publishBlock(blocks, rollup_cur_tx_num >> 8, blocknumber_expires)
  }

  async myDeposits() {
    const events = await this.ZeroPool.getDepositEvents();
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

  async prepareBlockItem(token, delta, utxo_in = [], utxo_out = []) {
    const { _, hashes } = await this.getUtxosFromContract();
    const mt = new MerkleTree(32 + 1);
    if (hashes.length !== 0) {
      mt.pushMany(hashes);
    }

    const {
      inputs,
      add_utxo
    } = transfer_compute(mt.root, utxo_in, utxo_out, BigInt(token), delta, 0n, this.zpKeyPair.privateKey);

    const encryptedUTXOs = add_utxo.map(utxo => encryptUtxo(utxo.pubkey, utxo));
    const encoded_tx_external_fields = this.ZeroPool.encodeTxExternalFields(this.ethAddress, encryptedUTXOs);
    inputs.message_hash = keccak256(encoded_tx_external_fields);

    const tx_external_fields = {
      owner: delta === 0n ? "0x0000000000000000000000000000000000000000" : this.ethAddress,
      Message: encryptedUTXOs
    };

    const proof = await getProof(this.transactionJson, inputs, this.prooverKey);
    const rootPointer
      = hashes.length / 2;

    mt.push(...inputs.utxo_out_hash);

    const Tx = {
      rootptr: rootPointer,
      nullifier: inputs.nullifier,
      utxo: inputs.utxo_out_hash,
      delta: inputs.delta,
      TxExternalFields: tx_external_fields,
      proof,
      token
    };

    const encoded_tx = this.ZeroPool.encodeTx(Tx);
    const tx_hash = keccak256(encoded_tx);

    return {
      Tx: normilizeTx(Tx),
      new_root: toHex(mt.root),
      tx_hash
    };
  }

  async myHistory() {
    const { utxos, hashes, blocknumbers } = await this.getUtxosFromContract();

    const myUtxo = [];
    utxos.forEach((encryptedUtxo, i) => {
      try {
        const utxo = decryptUtxo(this.zpKeyPair.privateKey, encryptedUtxo, hashes[i]);
        if (utxo.amount.toString() !== '0') {
          utxo.blocknumber = blocknumbers[i];
          myUtxo.push(utxo);
        }
      } catch (e) {
      }
    });

    const deposits = await this.myDeposits();

    // todo: fetch withdrawals
    return {
      utxos: myUtxo,
      deposits
    };
  }

  async getBalance() {
    const balances = {};
    const utxos = await this.myUtxos();

    for (let i = 0; i < utxos.length; i++) {
      const asset = toHex(utxos[i].token);
      if (!balances[asset]) {
        balances[asset] = Number(utxos[i].amount);
        continue;
      }
      balances[asset] += Number(utxos[i].amount);
    }

    return balances;
  }

  async myUtxos() {
    const { utxos, hashes, blocknumbers, nullifiers } = await this.getUtxosFromContract();
    if (utxos.length === 0) {
      return [];
    }

    const mt = new MerkleTree(32 + 1);
    mt.pushMany(hashes);

    const myUtxo = [];

    for (const [i, encryptedUtxo] of utxos.entries()) {

      const p = new Promise( (resolve) => {
        setTimeout(() => resolve(), 1);
      });
      await p;

      try {
        const utxo = decryptUtxo(this.zpKeyPair.privateKey, encryptedUtxo, hashes[i]);
        if (utxo.amount.toString() !== '0') {
          utxo.mp_sibling = mt.proof(i);
          utxo.mp_path = i;
          utxo.blocknumber = blocknumbers[i];

          const utxoNullifier = nullifier(utxo, this.zpKeyPair.privateKey);
          if(!nullifiers.find(x => x === utxoNullifier)) {
            myUtxo.push(utxo);
          }
        }
      } catch (e) {
        // Here can't decode UTXO errors appears
        // console.log('Catch error:', e)
      }
    }

    // utxos.forEach( async (encryptedUtxo, i) => {});

    const sorted = myUtxo.sort((a,b) => {
      // console.log(`a.amount = ${a.amount}`);
      // console.log(typeof a.amount);
      // console.log(`b.amount = ${b.amount}`);
      // console.log(typeof b.amount);

      const diff = b.amount - a.amount;
      if ( diff < 0) {
        return -1
      }
      else if (diff > 0){
        return 1;
      }
      else {
        return 0
      }
    });

    return sorted;
  }

  async getUtxosFromContract() {
    const blocks = await this.ZeroPool.publishBlockEvents();
    if (blocks.length === 0) {
      return { utxos: [], hashes: [] };
    }

    const allUtxos = [];
    const allHashes = [];
    const inBlockNumber = [];
    const nullifiers = [];
    blocks.forEach(block => {
      block.BlockItems.forEach(item => {
        nullifiers.push(...item[0].nullifier.map(BigInt));

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
      nullifiers,
      utxos: allUtxos,
      hashes: allHashes,
      blocknumbers: inBlockNumber
    };
  }

}

const toHex = (x) => '0x' + x.toString(16);

function normilizeTx(Tx) {
  Tx.rootptr = toHex(Tx.rootptr);
  Tx.nullifier = Tx.nullifier.map(x => toHex(x));
  Tx.utxo = Tx.utxo.map(x => toHex(x));
  Tx.delta = toHex(Tx.delta);
  Tx.TxExternalFields.Message[0] = Tx.TxExternalFields.Message[0].map(x => toHex(x));
  Tx.TxExternalFields.Message[1] = Tx.TxExternalFields.Message[1].map(x => toHex(x));
  Tx.proof = Tx.proof.map(x => toHex(x));
  // Tx.token = Tx.token;
  return Tx;
}

module.exports = ZeroPoolNetwork;

