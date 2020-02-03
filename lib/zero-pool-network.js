const { getEthereumAddress, keccak256 } = require('./ethereum/ethereum');
const { encodeTxExternalFields, encodeTx, zeropool } = require('./ethereum/zeropool-contract');
const { transfer_compute, utxo } = require('../circom/src/inputs');
const { getProof, encryptUtxo, getKeyPair } = require("./utils");
const fs = require('fs'), proover_key = fs.readFileSync('./../circom/circuitsCompiled/transaction_pk.bin').buffer;

class ZeroPoolNetwork {

  constructor(contractAddress, privK, zpMnemonic) {
    this.ethAddress = getEthereumAddress(privK);
    this.contractAddress = contractAddress;
    this.zpMnemonic = zpMnemonic;
    this.ZeroPool = zeropool(contractAddress, privK);
  }

  async deposit(tokenAddress, depositAmount) {
    const keyPair = getKeyPair(this.zpMnemonic);
    const depositData = await getDepositData(
      {
        privateKey: keyPair.privateKey,
        publicKey: keyPair.publicKey
      },
      {
        ethereum_address: this.ethAddress,
        token_address: tokenAddress,
        deposit_amount: depositAmount,
        rootptr: 0n // todo: compute from the all fetched UTXOs
      });

    return this.ZeroPool.deposit(depositData);
  }

  async myDeposits() {
    const events = await this.ZeroPool.depositEvents();
    if (!events) {
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

}

async function getDepositData({ privateKey, publicKey }, { ethereum_address, token_address, deposit_amount, rootptr }) {

  const utxo_in = [];
  const utxo_out = [
    utxo(token_address, deposit_amount, publicKey),
    utxo(token_address, 0n, publicKey)
  ];
  const delta = deposit_amount;

  const encryptedUTXOs = utxo_out.map(utxo => encryptUtxo(publicKey, utxo));

  const tx_external_fields = {
    owner: ethereum_address,
    Message: encryptedUTXOs
  };
  const encoded_tx_external_fields = encodeTxExternalFields(ethereum_address, encryptedUTXOs);

  const message_hash = keccak256(encoded_tx_external_fields);

  // todo: fetch utxo root
  const { inputs } = transfer_compute(rootptr, utxo_in, utxo_out, token_address, delta, message_hash, privateKey);
  const proof = await getProof(inputs, proover_key);

  const data_to_encode = {
    // todo: fetch rootptr from the last BlockItem.new_root
    rootptr,
    nullifier: inputs.nullifier,
    utxo: inputs.utxo_out_hash,
    token: inputs.token,
    delta: inputs.delta,
    TxExternalFields: tx_external_fields,
    proof
  };

  const encoded_tx_data = encodeTx(data_to_encode);
  const tx_data_hash = keccak256(encoded_tx_data);
  return {
    token: token_address,
    amount: deposit_amount.toString(),
    txhash: tx_data_hash
  }
}

module.exports = ZeroPoolNetwork;

