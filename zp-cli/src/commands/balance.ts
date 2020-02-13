import { flags } from '@oclif/command';
import Base from '../base';
import * as ethUtils from '../../../lib/ethereum/ethereum';
import cli from "cli-ux";

export default class Balance extends Base {
  static description = 'Deposit asset to ZeroPool';

  static examples = [
    `$ zp balance
hello world from ./src/hello.ts!
`,
  ];

  static flags = {
    help: flags.help({ char: 'h' }),
    // flag with a value (-n, --name=VALUE)
    name: flags.string({ char: 'n', description: 'name to print' }),
    // flag with no value (-f, --force)
    force: flags.boolean({ char: 'f' }),
  };

  static args = [{ name: 'file' }];

  async run() {
    await super.run()
    const { args, flags } = this.parse(Balance);

    cli.action.start(`Fetching balance`);
    const balances = await this.zp.getBalance();
    if (Object.keys(balances).length === 0) {
      this.log(`Your balance: 0 zpETH`);
      return;
    }
    this.log(`Your balance: ${ethUtils.fw(balances['0x0'])} zpETH`);
  }

}
