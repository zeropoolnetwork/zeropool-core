import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { TransactionDto } from './transactgion.dto';
import { NetworkConfig } from './app.config';

@ApiTags('RelayerAPI')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {
  }

  @Get()
  @ApiCreatedResponse({ description: 'Welcome message' })
  welcomePage(): string {
    return '<h1>ZeroPool Relayer</h1><br>• Swagger Docs:&nbsp<a href="/docs">/docs</a>';
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
      'Returns hash of Ethereum transaction that post a block on the smart contract'
  })
  async postTransactions(@Body() tx: TransactionDto): Promise<string> {
    await this.appService.publishBlockItem(tx);
    return 'Ok';
  }

}
