import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { TxDto } from './tx.dto';

@ApiTags('RelayerAPI')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {
  }

  @Get()
  @ApiCreatedResponse({ description: 'Welcome message' })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('smart-contract-info')
  @ApiCreatedResponse({ description: 'Returns link to ZeroPool smart contract on etherscan' })
  getSmartContractDetails(): string {
    return 'https://etherscan.io/address/0x5a0b54d5dc17e0aadc383d2db43b0a0d3e029c4c'
  }

  @Post('tx')
  @ApiCreatedResponse({
    description: 'Accepts signed transaction to include it into a block. Returns hash of Ethereum transaction that post a block on the smart contract'
  })
  postTransactions(@Body() tx: TxDto): string {
    return 'Ok';
  }
}
