const { getEthereumAddress, keccak256 } = require('./ethereum/ethereum');
const { ethPrivateKey, zpMnemonic, contractAddress } = require('./init-env');
const { encodeTxExternalFields, encodeTx, zeropool } = require('./ethereum/zeropool-contract');
const { transfer_compute, utxo } = require('../circom/src/inputs');
const { getProof, encryptUtxo, getKeyPair } = require("./utils");

const fs = require('fs'),
  proover_key = fs.readFileSync('./../circom/circuitsCompiled/transaction_pk.bin').buffer;

(async function main() {
  const ZeroPool = zeropool(contractAddress, ethPrivateKey);

  const keyPair = getKeyPair(zpMnemonic);
  const depositData = await getDepositData(
    {
      privateKey: keyPair.privateKey,
      publicKey: keyPair.publicKey
    },
    {
      ethereum_address: getEthereumAddress(ethPrivateKey),
      token_address: "0x0000000000000000000000000000000000000000",
      deposit_amount: 1010000n,
      root: 0n // todo: compute from the all fetched UTXOs
    });

  const txData = await ZeroPool.deposit(depositData);
  console.log(txData);
})();


async function getDepositData({ privateKey, publicKey }, { ethereum_address, token_address, deposit_amount, root }) {

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

  const { inputs } = transfer_compute(root, utxo_in, utxo_out, token_address, delta, message_hash, privateKey);
  const proof = await getProof(inputs, proover_key);

  const data_to_encode = {
    // todo: fetch rootptr from the last BlockItem.new_root
    rootptr: root,
    nullifier: inputs.nullifier,
    utxo: inputs.utxo_out_hash,
    token: inputs.token,
    delta: inputs.delta,
    TxExternalFields: tx_external_fields,
    proof: proof
  };

  const encoded_tx_data = encodeTx(data_to_encode);
  const tx_data_hash = keccak256(encoded_tx_data);
  return {
    token: token_address,
    amount: deposit_amount.toString(),
    txhash: tx_data_hash
  }
}


