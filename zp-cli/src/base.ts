import {Command} from '@oclif/command'
import {flags} from '@oclif/command'

const {cosmiconfig} = require('cosmiconfig')
const explorer = cosmiconfig('zp-cli')
const debug = require('debug')('zp-cli:base')

type ConfigType = {
  contact?: string;
  mnemonic?: string;
  value?: string;
  asset?: string;
};

export default class Base extends Command {
  static config: null | ConfigType;

  static flags = {
    help: flags.help({char: 'h'}),

    // flag with a value (-v, --value=VALUE)
    value: flags.string({
      char: 'v',
      description: 'Amount of asset to deposit in ETH (10^18 Wei)',
    }),

    // flag with a value (-a, --asset=VALUE)
    asset: flags.string({
      char: 'a',
      description: 'ETH or address of asset that will be deposited',
    }),

    // flag with a value (-m, --mnemonic=VALUE)
    mnemonic: flags.string({
      char: 'm',
      description: 'Mnemonic that is used for both Ethereum and ZeroPool address generation',
    }),

    // flag with a value (-z, --contract=VALUE)
    contract: flags.string({
      char: 'z',
      description: 'ZeroPool smart contract address',
    }),
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
    {
      name: 'asset',
      description: 'ETH or address of asset that will be deposited',
      default: 'ETH',
    },
    {
      name: 'value',
      description: 'Amount of asset to deposit in ETH (10^18 Wei)',
    },
  ]

  // ZeroPool contract address
  contractAddress = '';

  // Mnemonic that we use for both ZeroPool and Ethereum
  mnemonic = '';

  amountOfAsset = 0;

  assetAddress: string | 'ETH' = 'ETH';

  async init() {
    const result = await explorer.search()
    if (result) {
      const {config, filepath} = result
      debug('parsing config', {config, filepath})
      this.config = config
    }
  }

  getFromConfigIfExists(argName: string): string {
    return (this.config && this.config as any)[argName]
  }

  async run(): Promise<void> {
    const {args, flags} = this.parse(Base)

    this.contractAddress = flags.contract || args.contract || this.getFromConfigIfExists('contract')
    this.mnemonic = flags.mnemonic || args.mnemonic || this.getFromConfigIfExists('mnemonic')
    this.amountOfAsset = flags.value || args.value || this.getFromConfigIfExists('value')
    this.assetAddress = flags.asset || args.asset || this.getFromConfigIfExists('asset')

    this.log(`Mnemonic = ${this.mnemonic} from ./src/base.ts`)
    this.log(`Contract Address = ${this.contractAddress} from ./src/base.ts`)
  }
}
