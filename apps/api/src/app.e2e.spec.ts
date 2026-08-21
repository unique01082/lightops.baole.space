import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createSign, generateKeyPairSync, type KeyObject } from 'node:crypto';
import { AppModule } from './app.module';
import { configureApplication } from './app.setup';
import { PrismaService } from './prisma/prisma.service';
import { SYNC_STORE, type SyncStore } from './sync/sync.service';

function jwt(privateKey: KeyObject, payload: Record<string, unknown>, kid = 'lightops-test') {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT', kid })}.${encode(payload)}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(privateKey, 'base64url');
  return `${unsigned}.${signature}`;
}

describe('LightOps API HTTP acceptance', () => {
  let app: INestApplication;
  let origin: string;
  let privateKey: KeyObject;
  let validClaims: Record<string, unknown>;
  const exchange = jest.fn(async (_userSub: string, input: { cursor?: string }) => ({
    appliedMutationIds: [],
    changes: [],
    nextCursor: input.cursor ?? '0',
  }));

  beforeAll(async () => {
    const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
    privateKey = keys.privateKey;
    const publicJwk = keys.publicKey.export({ format: 'jwk' });
    const jwks = { keys: [{ ...publicJwk, kid: 'lightops-test', alg: 'RS256', use: 'sig' }] };
    process.env.OIDC_TRUSTED_ISSUERS_JSON = JSON.stringify([
      { issuer: 'https://id.baole.space/application/o/lightops/', jwks },
      { issuer: 'https://auth.baole.space/application/o/lightops/', jwks },
    ]);
    process.env.OIDC_AUDIENCE = 'lightops';
    validClaims = {
      sub: 'user-1',
      iss: 'https://id.baole.space/application/o/lightops/',
      aud: process.env.OIDC_AUDIENCE,
      permissions: ['app:lightops:sync'],
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 300,
    };
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ $queryRaw: jest.fn().mockResolvedValue([{ one: 1 }]) })
      .overrideProvider(SYNC_STORE)
      .useValue({ exchange } satisfies SyncStore)
      .compile();
    app = module.createNestApplication();
    configureApplication(app, { swagger: false, shutdownHooks: false });
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as { port: number };
    origin = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  const request = (path: string, init?: RequestInit) => fetch(`${origin}${path}`, init);
  const syncRequest = (token: string, body: Record<string, unknown>) =>
    request('/api/v1/sync/exchange', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('keeps liveness and readiness public', async () => {
    expect((await request('/api/v1/health/live')).status).toBe(200);
    expect((await request('/api/v1/health/ready')).status).toBe(200);
  });

  it.each([
    ['wrong issuer', { iss: 'https://attacker.invalid/' }],
    ['wrong audience', { aud: 'another-client' }],
    ['expired token', { exp: Math.floor(Date.now() / 1000) - 60 }],
  ])('rejects a token with %s', async (_label, replacement) => {
    const response = await syncRequest(jwt(privateKey, { ...validClaims, ...replacement }), {
      deviceId: 'desktop-1',
      mutations: [],
    });
    expect(response.status).toBe(401);
  });

  it('accepts the exact legacy issuer during the migration window', async () => {
    const token = jwt(privateKey, {
      ...validClaims,
      iss: 'https://auth.baole.space/application/o/lightops/',
    });
    expect((await syncRequest(token, { deviceId: 'legacy-device', mutations: [] })).status).toBe(
      201,
    );
  });

  it('rejects malformed tokens, wrong algorithms, and unknown key ids', async () => {
    expect((await syncRequest('not-a-jwt', { deviceId: 'desktop-1', mutations: [] })).status).toBe(
      401,
    );
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const none = `${encode({ alg: 'none', kid: 'lightops-test' })}.${encode(validClaims)}.`;
    expect((await syncRequest(none, { deviceId: 'desktop-1', mutations: [] })).status).toBe(401);
    expect(
      (
        await syncRequest(jwt(privateKey, validClaims, 'unknown-kid'), {
          deviceId: 'desktop-1',
          mutations: [],
        })
      ).status,
    ).toBe(401);
  });

  it('rejects an invalid signature and missing permission', async () => {
    const attacker = generateKeyPairSync('rsa', { modulusLength: 2048 });
    expect(
      (
        await syncRequest(jwt(attacker.privateKey, validClaims), {
          deviceId: 'desktop-1',
          mutations: [],
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await syncRequest(jwt(privateKey, { ...validClaims, permissions: [] }), {
          deviceId: 'desktop-1',
          mutations: [],
        })
      ).status,
    ).toBe(403);
  });

  it('accepts a valid token and rejects unknown request fields', async () => {
    const token = jwt(privateKey, validClaims);
    const valid = await syncRequest(token, { deviceId: 'desktop-1', mutations: [] });
    expect(valid.status).toBe(201);
    expect(exchange).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ deviceId: 'desktop-1', mutations: [] }),
    );

    const invalid = await syncRequest(token, {
      deviceId: 'desktop-1',
      mutations: [],
      mediaPath: '/private/photo.jpg',
    });
    expect(invalid.status).toBe(400);
  });

  it('rate limits sync exchange to 60 requests per minute per client', async () => {
    const token = jwt(privateKey, { ...validClaims, sub: 'rate-limit-user' });
    const responses = await Promise.all(
      Array.from({ length: 61 }, () =>
        syncRequest(token, { deviceId: 'rate-limit-device', mutations: [] }),
      ),
    );
    expect(responses.filter((response) => response.status === 429)).toHaveLength(1);
  });
});
