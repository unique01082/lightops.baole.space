import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { createPublicKey, type JsonWebKey } from 'node:crypto';
import { ExtractJwt, Strategy } from 'passport-jwt';

type SecretCallback = (error: Error | null, secret?: string | Buffer) => void;
type StaticJwk = JsonWebKey & { kid: string; alg?: string };

export function createStaticJwksProvider(jwksJson: string) {
  let keys: StaticJwk[];
  try {
    const parsed = JSON.parse(jwksJson) as { keys?: StaticJwk[] };
    keys = Array.isArray(parsed.keys) ? parsed.keys : [];
  } catch {
    throw new Error('OIDC_JWKS_JSON must contain valid JWKS JSON');
  }
  if (!keys.length) throw new Error('OIDC_JWKS_JSON must contain at least one signing key');

  return (_request: Request, rawToken: string, done: SecretCallback) => {
    try {
      const encodedHeader = rawToken.split('.')[0];
      const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8')) as {
        alg?: string;
        kid?: string;
      };
      if (header.alg !== 'RS256' || !header.kid) {
        return done(new Error('JWT must use RS256 and include a key id'));
      }
      const jwk = keys.find((candidate) => candidate.kid === header.kid);
      if (!jwk) return done(new Error(`No static JWKS key matches kid ${header.kid}`));
      const pem = createPublicKey({ key: jwk, format: 'jwk' }).export({
        type: 'spki',
        format: 'pem',
      });
      return done(null, pem);
    } catch (error) {
      return done(error instanceof Error ? error : new Error(String(error)));
    }
  };
}

export type AuthUser = {
  sub: string;
  email?: string;
  permissions: string[];
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    const issuer = config.getOrThrow<string>('OIDC_ISSUER');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      audience: config.getOrThrow<string>('OIDC_AUDIENCE'),
      issuer,
      algorithms: ['RS256'],
      secretOrKeyProvider: createStaticJwksProvider(config.getOrThrow<string>('OIDC_JWKS_JSON')),
    });
  }

  validate(payload: Record<string, unknown>): AuthUser {
    if (typeof payload.sub !== 'string' || !payload.sub) {
      throw new UnauthorizedException('Token subject is required');
    }
    const permissions = Array.isArray(payload.permissions)
      ? payload.permissions.filter((value): value is string => typeof value === 'string')
      : [];
    return {
      sub: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      permissions,
    };
  }
}
