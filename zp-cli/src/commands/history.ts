import {flags} from '@oclif/command'
import Base from '../base'

export default class History extends Base {
  static description = 'Deposit asset to ZeroPool'

  static examples = [
    `$ zp history --contract='...' --mnemonic='...'
TODO: put example of response
`,
  ]

  static flags = {
    help: flags.help({char: 'h'}),

    contract: flags.string({
      char: 'a',
      description: 'ZeroPool smart contract address',
    }),

    mnemonic: flags.string({
      char: 'm',
      description: 'Mnemonic that is used for both Ethereum and ZeroPool address generation',
    }),

    // flag with a value (-n, --name=VALUE)
    // name: flags.string({char: 'n', description: 'name to print'}),

    // flag with no value (-f, --force)
    // force: flags.boolean({char: 'f'}),
  }

  static args = [
    {
      name: 'contract',
      description: 'Address of ZeroPool smart contract',
    },
    {
      name: 'mnemonic',
      description: 'Mnemonic that wallet use for both Ethereum and ZeroPool',
    },
  ]

  async run() {
    const {args, flags} = this.parse(History)

    // TODO: call base class to merge, args, flags and config
    // args.contract
    const contract = flags.contract || args.contract || (this.config && this.config as any).contract
    const mnemonic = flags.mnemonic || args.mnemonic || (this.config && this.config as any).mnemonic

    this.log(`Mnemonic = ${mnemonic} from ./src/commands/history.ts`)
    this.log(`Contract Address = ${contract} from ./src/commands/history.ts`)

    // if (typeof flags.contract === undefined) {
    //   debugger
    //   if (this.config && this.config.name) {
    //     flags.contract = this.config.name
    //   }
    // }

    // const name = flags.name || 'world'
    // this.log(`hello ${name} from ./src/commands/history.ts`)

    // if (args.file && flags.force) {
    //   this.log(`you input --force and --file: ${args.file}`)
    // }
  }
}
