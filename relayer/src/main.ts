import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AppConfig } from "./app.config";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });

  const options = new DocumentBuilder()
    .setTitle('ZeroPool Relayer')
    .setDescription('Relayer accepts requests for publishing transactions')
    .setVersion('1.0')
    .addTag('RelayerAPI')
    .build();

  // app.use(json({ limit: '50mb' })); // json limit

  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('docs', app, document);

  await app.listen(AppConfig.port);
}
bootstrap();
