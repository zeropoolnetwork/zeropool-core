import { Body, Controller, Get, HttpStatus, Post, Res } from '@nestjs/common';
import { ApiCreatedResponse, ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { zp } from './zeroPool';
import { GasDonationDto, TransactionDto } from './transaction.dto';

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

    @Post('tx/donation')
    @ApiCreatedResponse({
        description: 'Accepts ethereum donation transaction to include it into a block and deposit transaction to subchain ',
    })
    async postGasDonation(@Body() gd: GasDonationDto, @Res() res): Promise<void> {
        const processedGasTx = await this.appService.publishGasDonation(gd.gasTx, gd.donationHash).toPromise();

        if (processedGasTx.error) {
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(processedGasTx.error);
            return res.end();
        }

        if (typeof processedGasTx.txData === 'string') {
            res.status(HttpStatus.OK).send({
                transactionHash: processedGasTx.txData
            });
            return res.end();
        }

        res.status(HttpStatus.OK).send(processedGasTx.txData);
        res.end();
    }

    @Post('tx')
    @ApiCreatedResponse({
        description: 'Accepts ethereum donation transaction to include it into a block and deposit transaction to subchain ' +
            'Returns hash of Ethereum subchain transaction that post a block on the smart contract',
    })
    async postTransaction(@Body() wtx: TransactionDto, @Res() res): Promise<void> {
        const [processedTx, processedGasTx] =
            await this.appService.publishTransaction(wtx.tx, wtx.depositBlockNumber, wtx.gasTx).toPromise();

        if (processedTx.error) {
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(processedTx.error);
            return res.end();
        }

        if (processedGasTx.error) {
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(processedGasTx.error);
            return res.end();
        }

        if (typeof processedTx.txData === 'string') {
            res.status(HttpStatus.OK).send({
                transactionHash: processedTx.txData
            });
            return res.end();
        }

        res.status(HttpStatus.OK).send(processedTx.txData);
        res.end();
    }

    @Get('relayer')
    @ApiCreatedResponse({
        description: 'Get relayer ethereum address for gas donations',
    })
    getRelayerAddress(): any {
        return {
            address: zp.ZeroPool.web3Ethereum.ethAddress,
        };
    }

}
