import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient, setAccessToken } from '../lib/apiClient';

describe('Single-Flight 401 Token Refresh', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setAccessToken('expired_token');
  });

  it('triggers only ONE refresh call when multiple requests return 401 simultaneously', async () => {
    let refreshCallsCount = 0;

    // Mock global fetch
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString();

      // Refresh endpoint call
      if (url.includes('/auth/refresh')) {
        refreshCallsCount++;
        // Add tiny artificial latency so concurrent requests overlap
        await new Promise((resolve) => setTimeout(resolve, 20));
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { accessToken: 'new_fresh_token' },
          }),
        } as unknown as Response;
      }

      // Business endpoints
      const authHeader = (init?.headers as Record<string, string>)?.[
        'Authorization'
      ];

      // If called with old token, return 401
      if (authHeader === 'Bearer expired_token') {
        return {
          ok: false,
          status: 401,
          json: async () => ({
            success: false,
            error: { code: 'UNAUTHENTICATED', message: 'Token expired' },
          }),
        } as unknown as Response;
      }

      // If called with new token, succeed
      if (authHeader === 'Bearer new_fresh_token') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { message: `Success on ${url}` },
          }),
        } as unknown as Response;
      }

      return {
        ok: false,
        status: 500,
        json: async () => ({ success: false }),
      } as unknown as Response;
    });

    // Fire 3 parallel requests with expired token
    const [res1, res2, res3] = await Promise.all([
      apiClient.get<{ success: boolean; data: { message: string } }>('/menu/items'),
      apiClient.get<{ success: boolean; data: { message: string } }>('/tables/status'),
      apiClient.get<{ success: boolean; data: { message: string } }>('/orders/queue'),
    ]);

    // Verify all 3 requests eventually succeeded after refresh
    expect(res1.data.message).toContain('/menu/items');
    expect(res2.data.message).toContain('/tables/status');
    expect(res3.data.message).toContain('/orders/queue');

    // CRITICAL: Refresh endpoint was called exactly ONCE (single-flight mutex verified)
    expect(refreshCallsCount).toBe(1);
  });
});
