import Base from '../base';
import { fw } from 'zeropool-lib';
import cli from "cli-ux";

export default class Balance extends Base {
  static description = 'Get ZeroPool balance';

  static examples = [
    `$ zp balance
hello world from ./src/hello.ts!
`,
  ];

  async run() {
    await super.run();
    const { args, flags } = this.parse(Balance);

    cli.action.start(`Fetching balance`);
    const balances = await this.zp.getBalance();
    if (Object.keys(balances).length === 0) {
      this.log(`Your balance: 0 zpETH`);
      return;
    }
    this.log(`Your balance: ${ fw(balances['0x0']) } zpETH`);
  }

}
