import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

type ApplicationOptions = {
  swagger?: boolean;
  shutdownHooks?: boolean;
};

export function configureApplication(
  app: INestApplication,
  { swagger = true, shutdownHooks = true }: ApplicationOptions = {},
) {
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
  );
  if (shutdownHooks) app.enableShutdownHooks();

  if (swagger) {
    const config = new DocumentBuilder()
      .setTitle('LightOps Sync API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
  }
}
