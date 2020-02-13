import cli from 'cli-ux'
import Base from '../base';
import * as ethUtils from '../../../lib/ethereum/ethereum';

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
    const withdrawAmount = myUtxo.slice(numOfInputs - 1).reduce((acc: any, item: any) => {
      return acc + item.amount;
    }, 0n);
    const blockItemObj = await this.zp.prepareWithdraw(this.assetAddress, numOfInputs);

    cli.action.start(`Send transaction to relayer ${this.relayerEndpoint}`);

    const res = await axios.post(`${this.relayerEndpoint}/tx`, blockItemObj);

    this.log("Prepare withdraw - Transaction hash: " + res.data.transactionHash);

    cli.action.start(`Withdraw ${this.relayerEndpoint}`);
    const withdrawRes = await this.zp.withdraw({
      token: this.assetAddress,
      amount: Number(withdrawAmount),
      owner: this.zp.ethAddress,
      blocknumber: res.data.blockNumber - 1,
      txhash: blockItemObj.tx_hash
    });

    this.log("Withdraw - Transaction hash: " + withdrawRes.transactionHash);


    //
    // TODO: some print in a console
    // const blockItemObj2 = await this.makeDeposit();
    // publishBlockItems

    // TODO: return eth transaction hash from relayer if possible
    // cli.url('https://etherscan.io/tx/0x3fd80cffa3c06ff693d8685e8feb3526fb23ad7caa62186d46e718492351fcf3', 'https://etherscan.io/tx/0x3fd80cffa3c06ff693d8685e8feb3526fb23ad7caa62186d46e718492351fcf3')

    cli.action.stop()

    // TODO: Fix, we shouldn't call this,
    //  NodeJs process doesn't exit occurs some were in ZeroPoolNetwork or depper
    process.exit();
  }
}
