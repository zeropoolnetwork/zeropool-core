import cli from 'cli-ux'
import Base from '../base';
import * as ethUtils from '../../../lib/ethereum/ethereum';
const axios = require('axios').default;

export default class Transfer extends Base {
  static description = 'Show ZeroPool tx history'

  static examples = [
    `$ zp deposit --amount='...' --contract='...' --mnemonic='...'
TODO: put example of response
`,
  ];

  async run(): Promise<void> {
    await super.run();
    // todo: check not enough funds

    cli.action.start(`Prepare transfer transaction ${this.amount} ${this.asset}`)
    const amountOfAsset = ethUtils.tw(this.amount).toNumber();
    const blockItemObj = await this.zp.transfer(this.assetAddress, this.to, amountOfAsset);

    cli.action.start(`Send transaction to relayer (waiting 2 confirmations) ${this.relayerEndpoint}`)
    const res = await axios.post(`${this.relayerEndpoint}/tx`, blockItemObj);
    cli.url('View transaction on Etherscan', this.etherscanPrefix + res.data.transactionHash);

    cli.action.stop();

    process.exit();
  }
}
