import {Command} from '@oclif/command'

const {cosmiconfig} = require('cosmiconfig')
const explorer = cosmiconfig('zp-cli')
const debug = require('debug')('zp-cli:base')

type ConfigType = {
  contact?: string;
  mnemonic?: string;
};

export default abstract class Base extends Command {
  static config: null | ConfigType;

  async init() {
    const result = await explorer.search()
    if (result) {
      const {config, filepath} = result
      debug('parsing config', {config, filepath})
      this.config = config
    }
  }
}
