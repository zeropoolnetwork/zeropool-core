import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return '<h1>ZeroPool Relayer</h1><br>• Swagger Docs:&nbsp<a href="/docs">/docs</a>';
  }

  publishBlock(): string {
    return 'Ok';
  }
}
