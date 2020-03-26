import { Body, Controller, Get, HttpException, HttpStatus, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { zp } from './zeroPool';
import { GasDonationRequest, RelayerAddressResponse, TransactionRequest, TransactionResponse } from './transaction.dto';
import { Observable } from "rxjs";
import { map, take } from "rxjs/operators";

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

    @Post('tx/donation')
    @ApiCreatedResponse({
        description: 'Accepts ethereum donation transaction to include it into a block and deposit transaction to subchain ',
    })
    postGasDonation(@Body() gd: GasDonationRequest): Observable<TransactionResponse> {
        return this.appService.publishGasDonation(gd.gasTx, gd.donationHash).pipe(
            map((processedGasTx) => {
                if (processedGasTx.error) {
                    throw new HttpException(processedGasTx.error, HttpStatus.INTERNAL_SERVER_ERROR)
                }

                if (typeof processedGasTx.txData === 'string') {
                    return {
                        transactionHash: processedGasTx.txData
                    };
                }

                return processedGasTx.txData;
            }),
            take(1)
        );
    }

    @Post('tx')
    @ApiCreatedResponse({
        description: 'Accepts ethereum donation transaction to include it into a block and deposit transaction to subchain ' +
            'Returns hash of Ethereum subchain transaction that post a block on the smart contract',
    })
    postTransaction(@Body() wtx: TransactionRequest): Observable<TransactionResponse> {
        return this.appService.publishTransaction(wtx.tx, wtx.depositBlockNumber, wtx.gasTx).pipe(
            map(([processedTx, processedGasTx]) => {
                if (processedTx.error) {
                    throw new HttpException(processedTx.error, HttpStatus.INTERNAL_SERVER_ERROR)
                }

                if (processedGasTx.error) {
                    throw new HttpException(processedGasTx.error, HttpStatus.INTERNAL_SERVER_ERROR)
                }

                if (typeof processedTx.txData === 'string') {
                    return {
                        transactionHash: processedTx.txData
                    }
                }

                return processedTx.txData;
            }),
            take(1)
        );
    }

    @Get('relayer')
    @ApiCreatedResponse({
        description: 'Get relayer ethereum address for gas donations',
    })
    getRelayerAddress(): RelayerAddressResponse {
        return {
            address: zp.ZeroPool.web3Ethereum.ethAddress,
        };
    }

}
