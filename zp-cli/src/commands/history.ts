import { flags } from '@oclif/command';
import * as ZeroPoolNetwork from '../../../lib/zero-pool-network';
import Base from '../base';
import { HdWallet, DomainEthereum } from '@buttonwallet/blockchain-ts-wallet-core';

export default class History extends Base {
  static description = 'Show ZeroPool tx history';

  static examples = [
    `$ zp history --contract='...' --mnemonic='...'
TODO: put example of response
`,
  ];

  async run() {
    await super.run();

    // const { args, flags } = this.parse(History);

    await this.showHistory(this.contractAddress, this.mnemonic);
  }

  private async showHistory(contract: string, mnemonic: string) {
    const wallet = new HdWallet(mnemonic, '');
    const eth = wallet.generateKeyPair(DomainEthereum.Instance(), 0);
    const zp = new ZeroPoolNetwork(contract, eth.privateKey, mnemonic, 'http://127.0.0.1:8545');

    const history = await zp.myHistory();
    /*
        Actions:
        1. Deposit ETH/Token
        2.1. Deposit spending
        2.2. Cancel Deposit
        3. Transafer ETH/Token
        4. Prepare withdraw
        5. Withdraw
     */

    // todo: we can have utxos from ZP mnemonic but didn't have deposits from new private key
    // todo: fetch token decimals
    // todo: fetch token names
    // todo: sort by block number
    for (const d of history.deposits) {
      let msg = `Deposit ${d.deposit.amount} wei\nBlock number: ${d.deposit.blocknumber}\n`;

      msg += d.spentInTx === '0'
        ? 'Have not spent yet'
        : `Spent in transaction: ${d.spentInTx}`;

      this.log(msg + '\n');
    }

    for (const utxo of history.utxos) {
      const msg = `UTXO ${utxo.amount} wei\nBlock number: ${utxo.blocknumber}`;

      this.log(msg + '\n');
    }
  }


}
