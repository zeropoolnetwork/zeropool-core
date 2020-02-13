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
    await super.run()

    cli.action.start(`Prepare deposit transaction ${this.amount} ${this.asset}`)

    const amountOfAsset = ethUtils.tw(this.amount);
    const blockItemObj = await this.zp.deposit(this.assetAddress, amountOfAsset);

    cli.action.start(`Send transaction to relayer ${this.relayerEndpoint}`)

    const res = await axios.post(`${this.relayerEndpoint}/tx`, blockItemObj);

    this.log("Transaction hash: " + res.data.transactionHash);
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
