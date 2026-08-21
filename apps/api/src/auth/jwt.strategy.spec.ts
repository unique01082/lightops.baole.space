import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateKeyPairSync } from 'node:crypto';
import { createTrustedKeyProvider, JwtStrategy } from './jwt.strategy';

function strategy() {
  const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const config = {
    getOrThrow: (key: string) => {
      if (key === 'OIDC_TRUSTED_ISSUERS_JSON')
        return JSON.stringify([
          {
            issuer: 'https://id.baole.space/application/o/lightops/',
            jwks: { keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'test', alg: 'RS256' }] },
          },
        ]);
      if (key === 'OIDC_AUDIENCE') return 'lightops';
      throw new Error(`Unexpected config ${key}`);
    },
  } as unknown as ConfigService;
  return new JwtStrategy(config);
}

describe('JwtStrategy', () => {
  it('resolves a signing key from the configured static JWKS without network access', async () => {
    const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const jwk = publicKey.export({ format: 'jwk' });
    const provider = createTrustedKeyProvider(
      JSON.stringify([
        {
          issuer: 'https://id.baole.space/application/o/lightops/',
          jwks: { keys: [{ ...jwk, kid: 'key-1', alg: 'RS256' }] },
        },
      ]),
    );
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'key-1' })).toString(
      'base64url',
    );

    const pem = await new Promise<string>((resolve, reject) => {
      const payload = Buffer.from(
        JSON.stringify({ iss: 'https://id.baole.space/application/o/lightops/' }),
      ).toString('base64url');
      provider({} as never, `${header}.${payload}.signature`, (error, key) => {
        if (error) reject(error);
        else resolve(String(key));
      });
    });

    expect(pem).toContain('BEGIN PUBLIC KEY');
  });

  it('normalizes Authentik permissions and identity claims', () => {
    expect(
      strategy().validate({
        sub: 'user-1',
        email: 'user@example.com',
        permissions: ['app:lightops:sync', 42],
        roles: ['member'],
        groups: ['operators'],
        iss: 'https://id.baole.space/application/o/lightops/',
        aud: 'lightops',
        exp: 2_000_000_000,
      }),
    ).toEqual({
      sub: 'user-1',
      email: 'user@example.com',
      permissions: ['app:lightops:sync'],
      roles: ['member'],
      groups: ['operators'],
      iss: 'https://id.baole.space/application/o/lightops/',
      aud: 'lightops',
      exp: 2_000_000_000,
    });
  });

  it('rejects unknown and attacker-controlled issuers before key lookup', async () => {
    const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const provider = createTrustedKeyProvider(
      JSON.stringify([
        {
          issuer: 'https://id.baole.space/application/o/lightops/',
          jwks: { keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'key-1', alg: 'RS256' }] },
        },
      ]),
    );
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'key-1' })).toString(
      'base64url',
    );
    const payload = Buffer.from(
      JSON.stringify({ iss: 'https://attacker.invalid/', jku: 'https://attacker.invalid/jwks' }),
    ).toString('base64url');
    await expect(
      new Promise((resolve, reject) =>
        provider({} as never, `${header}.${payload}.signature`, (error, key) =>
          error ? reject(error) : resolve(key),
        ),
      ),
    ).rejects.toThrow('not trusted');
  });

  it('rejects a signed token without a subject', () => {
    expect(() => strategy().validate({ permissions: [] })).toThrow(UnauthorizedException);
  });
});
