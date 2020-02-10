import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'ZeroPool Relayer';
  }

  publishBlock(): string {
    return 'Ok';
  }
}
