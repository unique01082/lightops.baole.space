import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import {
  createLocalJWKSet,
  createRemoteJWKSet,
  decodeJwt,
  decodeProtectedHeader,
  exportSPKI,
  type JSONWebKeySet,
  type JWTHeaderParameters,
} from 'jose';
import { ExtractJwt, Strategy } from 'passport-jwt';

type SecretCallback = (error: Error | null, secret?: string | Buffer) => void;
type TrustedIssuerInput = { issuer: string; jwksUri?: string; jwks?: JSONWebKeySet };
type KeyResolver = (header: JWTHeaderParameters) => Promise<CryptoKey>;

function parseTrustedIssuers(value: string) {
  let inputs: TrustedIssuerInput[];
  try {
    inputs = JSON.parse(value) as TrustedIssuerInput[];
  } catch {
    throw new Error('OIDC_TRUSTED_ISSUERS_JSON must be valid JSON');
  }
  if (!Array.isArray(inputs) || !inputs.length)
    throw new Error('OIDC_TRUSTED_ISSUERS_JSON must contain at least one issuer');
  const resolvers = new Map<string, KeyResolver>();
  for (const input of inputs) {
    const issuerUrl = new URL(input.issuer);
    if (
      issuerUrl.protocol !== 'https:' ||
      !issuerUrl.href.endsWith('/') ||
      issuerUrl.search ||
      issuerUrl.hash
    )
      throw new Error('Every trusted issuer must be an exact HTTPS URL with a trailing slash');
    if (resolvers.has(issuerUrl.href))
      throw new Error(`Duplicate trusted issuer: ${issuerUrl.href}`);
    if (input.jwksUri) {
      const jwksUrl = new URL(input.jwksUri);
      if (
        jwksUrl.protocol !== 'https:' ||
        jwksUrl.username ||
        jwksUrl.password ||
        jwksUrl.search ||
        jwksUrl.hash
      )
        throw new Error('Every JWKS URI must be a fixed HTTPS URL');
      const remote = createRemoteJWKSet(jwksUrl, {
        timeoutDuration: 5_000,
        cooldownDuration: 30_000,
        cacheMaxAge: 600_000,
      });
      resolvers.set(issuerUrl.href, (header) => remote(header) as Promise<CryptoKey>);
    } else if (input.jwks?.keys?.length) {
      const local = createLocalJWKSet(input.jwks);
      resolvers.set(issuerUrl.href, (header) => local(header) as Promise<CryptoKey>);
    } else {
      throw new Error(`Trusted issuer ${issuerUrl.href} requires jwksUri`);
    }
  }
  return resolvers;
}

export function createTrustedKeyProvider(trustedIssuersJson: string) {
  const resolvers = parseTrustedIssuers(trustedIssuersJson);
  return (_request: Request, rawToken: string, done: SecretCallback) => {
    void (async () => {
      if (!rawToken || rawToken.length > 16_384) throw new Error('JWT is malformed');
      const header = decodeProtectedHeader(rawToken);
      if (header.alg !== 'RS256' || !header.kid)
        throw new Error('JWT must use RS256 and include a key id');
      const issuer = decodeJwt(rawToken).iss;
      const resolver = typeof issuer === 'string' ? resolvers.get(issuer) : undefined;
      if (!resolver) throw new Error('JWT issuer is not trusted');
      return exportSPKI(await resolver(header as JWTHeaderParameters));
    })().then(
      (pem) => done(null, pem),
      (reason) => done(reason instanceof Error ? reason : new Error(String(reason))),
    );
  };
}

const normalizeStrings = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : typeof value === 'string' && value.trim()
      ? [value.trim()]
      : [];

export type AuthUser = {
  sub: string;
  email?: string;
  name?: string;
  preferredUsername?: string;
  roles: string[];
  permissions: string[];
  groups: string[];
  iss: string;
  aud: string | string[];
  exp: number;
  iat?: number;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    const trustedJson = config.getOrThrow<string>('OIDC_TRUSTED_ISSUERS_JSON');
    const issuers = [...parseTrustedIssuers(trustedJson).keys()];
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      audience: config.getOrThrow<string>('OIDC_AUDIENCE'),
      issuer: issuers,
      algorithms: ['RS256'],
      ignoreExpiration: false,
      secretOrKeyProvider: createTrustedKeyProvider(trustedJson),
      jsonWebTokenOptions: { clockTolerance: 5 },
    });
  }

  validate(payload: Record<string, unknown>): AuthUser {
    if (
      typeof payload.sub !== 'string' ||
      !payload.sub ||
      typeof payload.iss !== 'string' ||
      (typeof payload.aud !== 'string' && !Array.isArray(payload.aud)) ||
      typeof payload.exp !== 'number'
    )
      throw new UnauthorizedException('Required token claims are missing');
    return {
      sub: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      name: typeof payload.name === 'string' ? payload.name : undefined,
      preferredUsername:
        typeof payload.preferred_username === 'string' ? payload.preferred_username : undefined,
      roles: normalizeStrings(payload.roles),
      permissions: normalizeStrings(payload.permissions),
      groups: normalizeStrings(payload.groups),
      iss: payload.iss,
      aud: payload.aud as string | string[],
      exp: payload.exp,
      iat: typeof payload.iat === 'number' ? payload.iat : undefined,
    };
  }
}
