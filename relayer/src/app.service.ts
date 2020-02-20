import { Injectable } from '@nestjs/common';
import { ZeroPoolContract } from 'zeropool-lib';
import { DomainEthereum, HdWallet } from '@buttonwallet/blockchain-ts-wallet-core';
import { Mnemonic, NetworkConfig } from './app.config';
import { BlockItemDto } from './transaction.dto';

@Injectable()
export class AppService {

  private zpContract: ZeroPoolContract;

  constructor() {
    const wallet = new HdWallet(Mnemonic, '');
    const eth = wallet.generateKeyPair(DomainEthereum.Instance(), 0);

    this.zpContract = new ZeroPoolContract(NetworkConfig.contract, eth.privateKey, NetworkConfig.rpc);

  }

  async publishBlock(block: BlockItemDto[], blockNumberExpires: number): Promise<any> {
    const rollupCurTxNum = await this.zpContract.getRollupTxNum();
    return this.zpContract.publishBlock(block, +rollupCurTxNum >> 8, blockNumberExpires);
  }

  publishBlockItem(blockItem: BlockItemDto): Promise<any> {
    const blockNumberExpires = 50000000; // todo: fetch it from Blockchain
    return this.publishBlock([blockItem], blockNumberExpires);
  }
}
