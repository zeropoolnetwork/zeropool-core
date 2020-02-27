import cli from 'cli-ux'
import Base from '../base';
import { tw } from 'zeropool-lib';

const axios = require('axios').default;

export default class Deposit extends Base {
  static description = 'Show ZeroPool tx history';

  static examples = [
    `$ zp deposit --amount='...' --contract='...' --mnemonic='...'
TODO: put example of response
`,
  ];

  async run(): Promise<void> {
    await super.run();

    cli.action.start(`Deposit ${ this.amount } ${ this.asset } to the contract (waiting 2 confirmations)`);
    const amountOfAsset = tw(this.amount).toNumber();
    const [blockItem, txHash] = await this.zp.deposit(this.assetAddress, amountOfAsset);

    cli.action.start(`Send transaction to relayer (waiting 2 confirmations) ${ this.relayerEndpoint }`);
    const res = await axios.post(`${ this.relayerEndpoint }/tx`, blockItem);
    cli.url('View transaction on Etherscan', this.etherscanPrefix + res.data.transactionHash);

    cli.action.stop();

    process.exit();
  }
}
