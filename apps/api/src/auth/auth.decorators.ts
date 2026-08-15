import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'lightops:isPublic';
export const PERMISSIONS_KEY = 'lightops:permissions';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
