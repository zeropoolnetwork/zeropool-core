import { flags } from '@oclif/command';
import * as ZeroPoolNetwork from '../../../lib/zero-pool-network';
import Base from '../base';
import { HdWallet, DomainEthereum } from '@buttonwallet/blockchain-ts-wallet-core';

export default class History extends Base {
  static description = 'Deposit asset to ZeroPool';

  static examples = [
    `$ zp history --contract='...' --mnemonic='...'
TODO: put example of response
`,
  ];

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

  async run() {
    const { args, flags } = this.parse(History);

    // TODO: call base class to merge, args, flags and config
    // args.contract
    const contract = flags.contract || args.contract || (this.config && this.config as any).contract;
    const mnemonic = flags.mnemonic || args.mnemonic || (this.config && this.config as any).mnemonic;

    this.log('------------------------------------------------');
    this.log(`Mnemonic = ${mnemonic} from ./src/commands/history.ts`);
    this.log(`Contract Address = ${contract} from ./src/commands/history.ts`);
    this.log('------------------------------------------------');

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

    await this.showHistory(contract, mnemonic);
  }

  private async showHistory(contract: string, mnemonic: string) {
    const wallet = new HdWallet(mnemonic, '');
    const eth = wallet.generateKeyPair(DomainEthereum.Instance(), 0);
    const zp = new ZeroPoolNetwork(contract, eth.privateKey, mnemonic, 'http://127.0.0.1:8545');

    const deposits = await zp.myDeposits();
    const utxos = await zp.myUtxos();

    /*
        Actions:
        1. Deposit ETH/Token
        2.1. Deposit spending
        2.2. Cancel Deposit
        3. Transafer ETH/Token
        4. Prepare withdraw
        5. Withdraw
     */

    // todo: fetch token decimals
    // todo: fetch token names
    // todo: sort by block number
    for (const d of deposits) {
      let msg = `Deposit ${d.deposit.amount} wei\nBlock number: ${d.deposit.blocknumber}\n`;

      msg += d.spentInTx === '0'
        ? 'Have not spent yet'
        : `Spent in transaction: ${d.spentInTx}`;

      this.log(msg + '\n');
    }

    for (const utxo of utxos) {xk
      const msg = `UTXO ${utxo.amount} wei\nBlock number: ${utxo.blocknumber}`;

      this.log(msg + '\n');
    }
  }


}
