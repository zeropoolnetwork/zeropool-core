import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppServiceRx } from "./app.service-rx";

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, AppServiceRx],
})
export class AppModule {}
