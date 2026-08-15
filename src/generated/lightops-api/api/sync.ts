// @ts-ignore
/* eslint-disable */
import request from '../../../lib/sync-request';

/** No comments are provided by the backend POST /api/v1/sync/exchange */
export async function syncControllerExchange(
  body: LightOpsSyncAPI.SyncExchangeDto,
  options?: { [key: string]: any },
) {
  return request<LightOpsSyncAPI.SyncExchangeResponseDto>('/api/v1/sync/exchange', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}
