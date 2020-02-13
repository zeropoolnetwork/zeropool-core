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
    const blockItemObj = this.zp.deposit(this.assetAddress, amountOfAsset);

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

  makeDeposit(): Promise<any> {
    // TODO: move to base class
    const wallet = new HdWallet(this.mnemonic, '');
    const eth = wallet.generateKeyPair(DomainEthereum.Instance(), 0);
    const zp = new ZeroPoolNetwork(this.contractAddress, eth.privateKey, this.mnemonic, this.rpcEndpoint);

    // TODO: move to base class
    const assetAddress = this.asset === 'ETH'
      ? ETH_ASSET_ADDRESS
      : this.asset // TODO: In case of main-net (by endpoint or flag) resolve 'DAI' into addresses

    // TODO: move to base class
    const amountOfAsset = ethUtils.tw(this.amount);

    return zp.deposit(assetAddress, amountOfAsset);
  }


}
