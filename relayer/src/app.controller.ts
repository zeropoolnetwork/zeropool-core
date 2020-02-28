import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import zp from './zeroPool';
import { BlockItemDto } from './transaction.dto';

// import { AppServiceRx } from "./app.service-rx";

@ApiTags('RelayerAPI')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {
  }

  @Get()
  @ApiExcludeEndpoint()
  welcomePage(): string {
    return `
        <div style="display: flex; justify-content: center; align-items: center; flex-direction: column; height: 80vh">
            <img src="https://zeropoolnetwork.github.io/zeropool-core/img/zeropool.svg" width="300px"></img>
            <a href="/docs">RELAYER API DOCS</a>
        </div>`;
  }

  // @Get('smart-contract-info')
  // @ApiCreatedResponse({description: 'Returns link to ZeroPool smart contract on etherscan'})
  // getSmartContractDetails(): string {
  //     if (NetworkConfig.etherscan_prefix) {
  //         return `${NetworkConfig.etherscan_prefix}/address/${NetworkConfig.contract}`
  //     }
  //     return NetworkConfig.contract;
  // }

  // TODO: add network parameter. Rinkeby, Mainnet
  @Post('tx')
  @ApiCreatedResponse({
    description: 'Accepts signed transaction to include it into a block. ' +
      'Returns hash of Ethereum transaction that post a block on the smart contract',
  })
  async postTransactions(@Body() tx: BlockItemDto): Promise<any> {
    return await this.appService.publishBlockItem(tx);
  }

  @Get('relayer')
  @ApiCreatedResponse({
    description: 'Get relayer ethereum address for gas donations',
  })
  getRelayerAddress(): string {
    return zp.ZeroPool.web3Ethereum.ethAddress;
  }

  // @Post('tx-rx')
  // @ApiCreatedResponse({
  //     description: 'Accepts signed transaction to include it into a block. ' +
  //         'Returns hash of Ethereum transaction that post a block on the smart contract'
  // })
  // async postTransactionsRx(@Body() tx: TransactionDto): Promise<any> {
  //     return await this.appServiceRx.handleTx(tx);
  // }

}
