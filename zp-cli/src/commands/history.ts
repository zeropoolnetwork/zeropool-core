import {Command, flags} from '@oclif/command'

export default class History extends Command {
  static description = 'Deposit asset to ZeroPool'

  static examples = [
    `$ zp balance
hello world from ./src/commands/history.ts!
`,
  ]

  static flags = {
    help: flags.help({char: 'h'}),
    // flag with a value (-n, --name=VALUE)
    name: flags.string({char: 'n', description: 'name to print'}),
    // flag with no value (-f, --force)
    force: flags.boolean({char: 'f'}),
  }

  static args = [{name: 'file'}]

  async run() {
    const {args, flags} = this.parse(History)

    const name = flags.name || 'world'
    this.log(`hello ${name} from ./src/commands/history.ts`)

    if (args.file && flags.force) {
      this.log(`you input --force and --file: ${args.file}`)
    }
  }
}
