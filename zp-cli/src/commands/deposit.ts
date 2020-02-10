import cli from 'cli-ux'
import * as ethUtils from '../../../lib/ethereum/ethereum';
import * as ZeroPoolNetwork from '../../../lib/zero-pool-network';
import Base from '../base';
import { HdWallet, DomainEthereum } from '@buttonwallet/blockchain-ts-wallet-core';


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
    const blockItemObj = await this.makeDeposit();
    // TODO: log tx object
    cli.action.start(`Send transaction to relayer ${this.relayerEndpoint}`)
    // TODO: put actual relayer call in place
    const blockItemObj2 = await this.makeDeposit();
    // publishBlockItems
    // cli.url('https://etherscan.io/tx/0x3fd80cffa3c06ff693d8685e8feb3526fb23ad7caa62186d46e718492351fcf3', 'https://etherscan.io/tx/0x3fd80cffa3c06ff693d8685e8feb3526fb23ad7caa62186d46e718492351fcf3')

    cli.action.stop()

    // TODO: Fix, we shouldn't call this,
    //  NodeJs process doesn't exit occurs some were in ZeroPoolNetwork or depper
    process.exit();
  }

  async makeDeposit(): Promise<any> {
    const wallet = new HdWallet(this.mnemonic, '');
    const eth = wallet.generateKeyPair(DomainEthereum.Instance(), 0);
    const zp = new ZeroPoolNetwork(this.contractAddress, eth.privateKey, this.mnemonic, 'http://127.0.0.1:8545');

    const assetAddress = this.asset === 'ETH'
      // TODO: Define constant
      ? '0x0000000000000000000000000000000000000000'
      // TODO: In case of main-net (by endpoint or flag) resolve 'DAI' into addresses
      : this.asset

    const amountOfAsset = ethUtils.tw(this.amount);

    return await zp.deposit(assetAddress, amountOfAsset);
  }


}
