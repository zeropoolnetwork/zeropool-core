import { Command } from '@oclif/command';
import { flags } from '@oclif/command';

const { cosmiconfig } = require('cosmiconfig');
const explorer = cosmiconfig('zp-cli');
const debug = require('debug')('zp-cli:base');

type ConfigType = {
  contact?: string;
  mnemonic?: string;
};

export default class Base extends Command {
  static config: null | ConfigType;

  static flags = {
    help: flags.help({ char: 'h' }),

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
  };

  static args = [
    {
      name: 'contract',
      description: 'Address of ZeroPool smart contract',
    },
    {
      name: 'mnemonic',
      description: 'Mnemonic that wallet use for both Ethereum and ZeroPool',
    },
  ];

  // ZeroPool contract address
  contractAddress = '';

  // Mnemonic
  mnemonic = '';

  async init() {
    const result = await explorer.search();
    if (result) {
      const { config, filepath } = result;
      debug('parsing config', { config, filepath });
      this.config = config;
    }
  }

  getFromConfigIfExists(argName: string): string {
    return (this.config && this.config as any)[argName];
  }

  async run(): Promise<void> {
    const { args, flags } = this.parse(Base);

    this.contractAddress = flags.contract || args.contract || this.getFromConfigIfExists('contract');
    this.mnemonic = flags.mnemonic || args.mnemonic || this.getFromConfigIfExists('mnemonic');

    this.log('------------------------------------------------');
    this.log(`Mnemonic = ${this.mnemonic} from ./src/commands/history.ts`);
    this.log(`Contract Address = ${this.contractAddress} from ./src/commands/history.ts`);
    this.log('------------------------------------------------');
  }
}
