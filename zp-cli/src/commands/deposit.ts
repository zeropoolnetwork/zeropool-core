import Base from '../base'
import cli from 'cli-ux'

async function wait2sec(): Promise<boolean> {
  return new Promise(resolve => {
    setTimeout(() => resolve(true), 2000)
  })
}

export default class Deposit extends Base {
  static description = 'Show ZeroPool tx history'

  static examples = [
    `$ zp deposit --amount='...' --contract='...' --mnemonic='...'
TODO: put example of response
`,
  ]

  async run() {
    super.run()
    cli.action.start(`Making deposit ${this.amountOfAsset} ${this.assetAddress}`)

    await wait2sec()

    cli.action.stop('finished deposit')
    await cli.url('https://etherscan.io/tx/0x3fd80cffa3c06ff693d8685e8feb3526fb23ad7caa62186d46e718492351fcf3', 'https://etherscan.io/tx/0x3fd80cffa3c06ff693d8685e8feb3526fb23ad7caa62186d46e718492351fcf3')
  }
}
