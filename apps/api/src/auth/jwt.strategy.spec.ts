import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateKeyPairSync } from 'node:crypto';
import { createStaticJwksProvider, JwtStrategy } from './jwt.strategy';

function strategy() {
  const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const config = {
    getOrThrow: (key: string) => {
      if (key === 'OIDC_ISSUER') return 'https://auth.baole.space/';
      if (key === 'OIDC_AUDIENCE') return 'lightops';
      return JSON.stringify({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'test' }] });
    },
  } as unknown as ConfigService;
  return new JwtStrategy(config);
}

describe('JwtStrategy', () => {
  it('resolves a signing key from the configured static JWKS without network access', async () => {
    const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const jwk = publicKey.export({ format: 'jwk' });
    const provider = createStaticJwksProvider(JSON.stringify({ keys: [{ ...jwk, kid: 'key-1' }] }));
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'key-1' })).toString(
      'base64url',
    );

    const pem = await new Promise<string>((resolve, reject) => {
      provider({} as never, `${header}.e30.signature`, (error, key) => {
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
      }),
    ).toEqual({
      sub: 'user-1',
      email: 'user@example.com',
      permissions: ['app:lightops:sync'],
    });
  });

  it('rejects a signed token without a subject', () => {
    expect(() => strategy().validate({ permissions: [] })).toThrow(UnauthorizedException);
  });
});
