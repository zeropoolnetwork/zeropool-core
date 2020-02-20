import { Command, flags } from '@oclif/command'
import { DomainEthereum, HdWallet } from '@buttonwallet/blockchain-ts-wallet-core';
import { getEthereumAddress, ZeroPoolNetwork } from 'zeropool-lib';
import { cosmiconfig } from 'cosmiconfig';
import { Config } from 'cosmiconfig/dist/types';

import * as fs from 'fs';
import * as path from 'path';
// @ts-ignore
import * as transactionJson from './../../circom/circuitsCompiled/transaction.json';
import { IConfig } from "@oclif/config";

const prooverKeyPath = path.join(__dirname, '../../circom/circuitsCompiled/transaction_pk.bin');
const prooverKey = fs.readFileSync(prooverKeyPath).buffer;

// For other assets we use contract address, for ethereum use 0x0000000000000000000000000000000000000000
const ETH_ASSET_ADDRESS = '0x0000000000000000000000000000000000000000';

const debug = require('debug')('zp-cli:base');

type ConfigType = {
  contact?: string;
  ethSecret?: string;
  value?: string;
  asset?: string;
  rpc: string;
  relayer?: string;
};

export default class Base extends Command {
  constructor(argv: string[], config: IConfig, zp: ZeroPoolNetwork) {
    super(argv, config);
    this.zp = zp;
  }

  etherscanPrefix = 'https://rinkeby.etherscan.io/tx/';

  static config: null | ConfigType = null;

  static flags = {
    help: flags.help({ char: 'h' }),

    // flag with a value (-c, --config=VALUE)
    config: flags.string({
      char: 'c',
      description: 'Path to config',
    }),

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

    // flag with a value (-m, --zpMnemonic=VALUE)
    zpMnemonic: flags.string({
      char: 'm',
      description: 'Mnemonic that is used for ZeroPool address generation',
    }),

    ethSecret: flags.string({
      char: 's',
      description: 'Mnemonic or Private Key that is used for Ethereum address generation',
    }),

    // flag with a value (-z, --contract=VALUE)
    contract: flags.string({
      char: 'z',
      description: 'ZeroPool smart contract address',
    }),

    rpc: flags.string({
      char: 'e',
      description: 'Ethereum JSON-RPC endpoint',
    }),

    relayer: flags.string({
      char: 'r',
      description: 'Relayer endpoint',
    }),

    to: flags.string({
      char: 't',
      description: 'Destination address (public key)',
    }),
  };

  static args = [
    {
      name: 'config',
      description: 'path to config file',
    },
    {
      name: 'contract',
      description: 'Address of ZeroPool smart contract',
    },
    {
      name: 'zpMnemonic',
      description: 'Mnemonic that is used for ZeroPool address generation',
    },
    {
      name: 'ethSecret',
      description: 'Mnemonic or Private Key that is used for Ethereum address generation',
    },
    {
      name: 'asset',
      description: 'ETH or address of asset that will be deposited',
    },
    {
      name: 'value',
      description: 'Amount of asset to deposit in ETH (10^18 Wei)',
    },
    {
      name: 'rpc',
      description: 'Ethereum JSON-RPC endpoint',
    },
    {
      name: 'relayer',
      description: 'Relayer endpoint',
    },
    {
      name: 'to',
      description: 'Destination address (public key)',
    },
  ];


  // ZeroPool contract address
  contractAddress = '';

  // Mnemonic that we use for both ZeroPool and Ethereum
  zpMnemonic = '';
  ethSecret = '';

  amount = 0;

  to = '';

  asset = ''; // Address or 'ETH'
  rpcEndpoint = '';
  relayerEndpoint = '';

  // @ts-ignore
  wallet: HdWallet;
  // @ts-ignore
  ethAddress: string;
  // @ts-ignore
  assetAddress: string;

  // @ts-ignore
  zp: ZeroPoolNetwork;

  async loadConfig(pathToConfig?: string): Promise<Config> {
    const explorer = cosmiconfig('alice');
    const result = pathToConfig
      ? await explorer.load(pathToConfig)
      : await explorer.search();

    if (result) {
      const { config, filepath } = result;
      debug('parsing config', { config, filepath });
      return config;
    }
  }

  async run(): Promise<void> {
    const { args, flags } = this.parse(Base)

    const pathToConfig = flags.config || args.config;

    const config = await this.loadConfig(pathToConfig);
    const fromConfigSafe = (argName: string) => config && config[argName];

    this.contractAddress = flags.contract || args.contract || fromConfigSafe('contract');
    this.ethSecret = flags.ethSecret || args.ethSecret || fromConfigSafe('ethSecret');
    this.zpMnemonic = flags.zpMnemonic || args.zpMnemonic || fromConfigSafe('zpMnemonic');
    this.amount = flags.value || args.value || fromConfigSafe('value');
    this.asset = flags.asset || args.asset || fromConfigSafe('asset');
    this.rpcEndpoint = flags.rpc || args.rpc || fromConfigSafe('rpc');
    this.relayerEndpoint = flags.relayer || args.relayer || fromConfigSafe('relayer');
    this.to = flags.to || args.to;

    if (HdWallet.isValidMnemonic(this.ethSecret)) {
      const hdWallet = new HdWallet(this.ethSecret, '');
      const wallet = hdWallet.generateKeyPair(DomainEthereum.Instance(), 0);
      this.ethSecret = wallet.privateKey;

      this.ethAddress = wallet.address;
    } else {
      this.ethAddress = getEthereumAddress(this.ethSecret);
    }

    // ethAccount:
    // {
    //    privateKey: string;
    //    publicKey: string;
    //    address: string;
    // }


    this.zp = new ZeroPoolNetwork(
      this.contractAddress,
      this.ethSecret,
      this.zpMnemonic,
      transactionJson,
      prooverKey,
      this.rpcEndpoint
    );

    this.log('-------------------------------------------------');
    this.log(`ZeroPool contract address = ${ this.contractAddress }`);
    this.log(`Your eth address = ${ this.ethAddress }`);
    this.log(`Your zp address = ${ "0x" + this.zp.zpKeyPair.publicKey.toString(16) }`);
    this.log('-------------------------------------------------');

    this.assetAddress = this.asset === 'ETH'
      ? ETH_ASSET_ADDRESS
      : this.asset // TODO: In case of main-net (by endpoint or flag) resolve 'DAI' into addresses
  }
}
