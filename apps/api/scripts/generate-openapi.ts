import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { generateKeyPairSync } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AppModule } from '../src/app.module';

async function generate() {
  process.env.SKIP_DATABASE_CONNECT = '1';
  process.env.OIDC_AUDIENCE ??= 'lightops';
  const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  process.env.OIDC_TRUSTED_ISSUERS_JSON ??= JSON.stringify([
    {
      issuer: 'https://id.baole.space/application/o/lightops/',
      jwks: {
        keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'openapi-build-only', alg: 'RS256' }],
      },
    },
  ]);
  const app = await NestFactory.create(AppModule, { logger: ['error'], abortOnError: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
  );
  const config = new DocumentBuilder()
    .setTitle('LightOps Sync API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  const outputDirectory = join(process.cwd(), 'openapi');
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    join(outputDirectory, 'lightops-v1.json'),
    `${JSON.stringify(document, null, 2)}\n`,
  );
  await app.close();
}

generate().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
