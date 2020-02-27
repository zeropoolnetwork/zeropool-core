import cli from 'cli-ux'
import Base from '../base';

const axios = require('axios').default;

export default class Withdraw extends Base {
  static description = 'Show ZeroPool tx history'

  static examples = [
    `$ zp deposit --amount='...' --contract='...' --mnemonic='...'
TODO: put example of response
`,
  ];

  async run(): Promise<void> {
    await super.run();

    cli.action.start(`Prepare withdraw transaction ${this.asset}`);

    const numOfInputs = 1;
    const myUtxo = await this.zp.myUtxos();
    // @ts-ignore
    const withdrawAmount = myUtxo.slice(0, numOfInputs).reduce((acc: any, item: any) => {
      return acc + item.amount;
    }, 0n);
    const [blockItem, txHash] = await this.zp.prepareWithdraw(this.assetAddress, numOfInputs);

    cli.action.start(`Send transaction to relayer (waiting 2 confirmations) ${this.relayerEndpoint}`);
    const res = await axios.post(`${this.relayerEndpoint}/tx`, blockItem);
    cli.url('View transaction on Etherscan', this.etherscanPrefix + res.data.transactionHash);

    cli.action.start(`Withdraw (waiting 2 confirmations)`);
    const withdrawRes = await this.zp.withdraw({
      utxo: {
        token: this.assetAddress,
        owner: this.zp.ethAddress,
        amount: Number(withdrawAmount)
      },
      blockNumber: res.data.blockNumber - 1,
      txHash: txHash
    });
    // @ts-ignore
    cli.url('View Withdraw on Etherscan', this.etherscanPrefix + withdrawRes.transactionHash);

    cli.action.stop();

    process.exit();

  }
}
