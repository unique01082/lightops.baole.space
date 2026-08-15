import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';

function context(permissions: string[]): ExecutionContext {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({
      getRequest: () => ({ user: { sub: 'user-1', permissions } }),
    }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  it('allows the LightOps sync permission', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['app:lightops:sync']),
    } as unknown as Reflector;
    expect(new PermissionsGuard(reflector).canActivate(context(['app:lightops:sync']))).toBe(true);
  });

  it('rejects a token without the LightOps sync permission', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['app:lightops:sync']),
    } as unknown as Reflector;
    expect(() => new PermissionsGuard(reflector).canActivate(context([]))).toThrow(
      ForbiddenException,
    );
  });
});
