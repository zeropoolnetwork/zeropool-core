import cli from 'cli-ux'
import Base from '../base';
import { tw } from 'zeropool-lib';
const axios = require('axios').default;

export default class Transfer extends Base {
  static description = 'Show ZeroPool tx history';

  static examples = [
    `$ zp deposit --amount='...' --contract='...' --mnemonic='...'
TODO: put example of response
`,
  ];

  async run(): Promise<void> {
    await super.run();
    // todo: check not enough funds

    cli.action.start(`Prepare transfer transaction ${this.amount} ${this.asset}`);
    const amountOfAsset = tw(this.amount).toNumber();
    const [blockItem, txHash] = await this.zp.transfer(this.assetAddress, this.to, amountOfAsset);

    cli.action.start(`Send transaction to relayer (waiting 2 confirmations) ${this.relayerEndpoint}`);
    const res = await axios.post(`${this.relayerEndpoint}/tx`, blockItem);
    cli.url('View transaction on Etherscan', this.etherscanPrefix + res.data.transactionHash);

    cli.action.stop();

    process.exit();
  }
}
