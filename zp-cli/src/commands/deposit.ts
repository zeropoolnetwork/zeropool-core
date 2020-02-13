import cli from 'cli-ux'
import Base from '../base';
import * as ethUtils from '../../../lib/ethereum/ethereum';
const axios = require('axios').default;

export default class Deposit extends Base {
  static description = 'Show ZeroPool tx history'

  static examples = [
    `$ zp deposit --amount='...' --contract='...' --mnemonic='...'
TODO: put example of response
`,
  ]

  async run(): Promise<void> {
    await super.run();

    cli.action.start(`Deposit ${this.amount} ${this.asset} to the contract (waiting 2 confirmations)`);
    const amountOfAsset = ethUtils.tw(this.amount);
    const blockItemObj = await this.zp.deposit(this.assetAddress, amountOfAsset);

    cli.action.start(`Send transaction to relayer (waiting 2 confirmations) ${this.relayerEndpoint}`);
    const res = await axios.post(`${this.relayerEndpoint}/tx`, blockItemObj);
    cli.url('View transaction on Etherscan', this.etherscanPrefix + res.data.transactionHash);

    cli.action.stop();

    process.exit();
  }
}
