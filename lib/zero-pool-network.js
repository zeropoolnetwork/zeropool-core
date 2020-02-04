const { getEthereumAddress, keccak256 } = require('./ethereum/ethereum');
const { encodeTxExternalFields, encodeTx, zeropool } = require('./ethereum/zeropool-contract');
const { transfer_compute, utxo } = require('../circom/src/inputs');
const { MerkleTree } = require('../circom/src/merkletree');
const { getProof, encryptUtxo, getKeyPair } = require("./utils");
const fs = require('fs'), proover_key = fs.readFileSync('./../circom/circuitsCompiled/transaction_pk.bin').buffer;

class ZeroPoolNetwork {

  constructor(contractAddress, privK, zpMnemonic) {
    this.ethAddress = getEthereumAddress(privK);
    this.contractAddress = contractAddress;
    this.zpKeyPair = getKeyPair(zpMnemonic);
    this.ZeroPool = zeropool(contractAddress, privK);
  }

  async deposit(tokenAddress, depositAmount) {
    const { tx, tx_data_hash } = await this.prepareDeposit(
      tokenAddress,
      depositAmount,
      [utxo(tokenAddress, depositAmount, this.ethAddress)]
    );

    const transactionDetails = await this.ZeroPool.deposit({
      token: tokenAddress,
      amount: depositAmount.toString(),
      txhash: tx_data_hash
    });

    const deposit_blocknumber = transactionDetails.blockNumber;

    const mt = new MerkleTree(32 + 1);
    mt.pushMany(tx.utxo);

    return {
      deposit_blocknumber,
      proof: tx.proof,
      message1: tx.TxExternalFields.Message[0],
      message2: tx.TxExternalFields.Message[1],
      owner: tx.TxExternalFields.owner,
      delta: tx.delta,
      token: tx.token,
      utxo: tx.utxo,
      nullifier: tx.nullifier,
      rootptr: tx.rootptr,
      new_root: mt.root
    };
  }

  async myDeposits() {
    const events = await this.ZeroPool.depositEvents();
    if (events.length === 0) {
      return [];
    }
    const myDeposits = events.filter(event => event.owner === this.ethAddress);
    const isExist$ = myDeposits.map(deposit => this.ZeroPool.isDepositExists(deposit));
    const isExist = await Promise.all(isExist$);
    return myDeposits.filter((_, i) => isExist[i]);
  }

  async depositCancel({ token, amount, txhash, owner, blocknumber }) {
    return this.ZeroPool.cancelDeposit({ token, amount, txhash, owner, blocknumber });
  }

  async lastBlockHash() {
    const lastBlocks = await this.ZeroPool.publishBlockEvents();
    if (lastBlocks.length === 0) {
      return '0x9867cc5f7f196b93bae1e27e6320742445d290f2263827498b54fec539f756af';
    }
    const lastBlock = lastBlocks[lastBlocks.length - 1];
    return lastBlock.new_root;
  }

  async utxoRootHash() {
    // let's parse all blocks...
    return 14104184488280208113507267975575830716113766176269610157743431475904840124775n;
  }

  async publishBlockItems(blocks, blocknumber_expires) {
    const rollup_cur_tx_num = await this.ZeroPool.getRollupTxNum();
    return this.ZeroPool.publishBlock(blocks, rollup_cur_tx_num >> 8, blocknumber_expires)

  }

  async prepareDeposit(token, delta, utxo_out = []) {
    const merkle_root = await this.utxoRootHash();
    const utxo_in = [];
    const {
      inputs,
      add_utxo
    } = transfer_compute(merkle_root, utxo_in, utxo_out, token, delta, 0n, this.zpKeyPair.privateKey);

    const encryptedUTXOs = add_utxo.map(utxo => encryptUtxo(this.zpKeyPair.publicKey, utxo));
    const encoded_tx_external_fields = encodeTxExternalFields(this.ethAddress, encryptedUTXOs);
    inputs.message_hash = keccak256(encoded_tx_external_fields);

    const tx_external_fields = {
      owner: this.ethAddress,
      Message: encryptedUTXOs
    };

    const proof = await getProof(inputs, proover_key);
    const rootptr = await this.lastBlockHash();

    const data_to_encode = {
      rootptr,
      nullifier: inputs.nullifier,
      utxo: inputs.utxo_out_hash,
      token: inputs.token,
      delta: inputs.delta,
      TxExternalFields: tx_external_fields,
      proof
    };
    const encoded_tx_data = encodeTx(data_to_encode);
    return {
      tx_data_hash: keccak256(encoded_tx_data),
      tx: data_to_encode
    };
  }

}


// return { proof, delta, token, rootptr,  new_root,
//
//   message1: encryptedUTXOs[0],
//   message2: encryptedUTXOs[1],
//   owner: this.ethAddress,
//   nullifier: inputs.nullifier,
//   utxo: inputs.utxo_out_hash,
//
//
//   deposit_blocknumber
// }

module.exports = ZeroPoolNetwork;

