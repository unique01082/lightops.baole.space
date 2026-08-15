// @ts-ignore
/* eslint-disable */
import request from '../../../lib/sync-request';

/** No comments are provided by the backend GET /api/v1/health/live */
export async function healthControllerLive(options?: { [key: string]: any }) {
  return request<any>('/api/v1/health/live', {
    method: 'GET',
    ...(options || {}),
  });
}

/** No comments are provided by the backend GET /api/v1/health/ready */
export async function healthControllerReady(options?: { [key: string]: any }) {
  return request<any>('/api/v1/health/ready', {
    method: 'GET',
    ...(options || {}),
  });
}
