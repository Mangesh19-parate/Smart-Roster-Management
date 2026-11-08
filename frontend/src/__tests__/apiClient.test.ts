import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configApi } from '../api/client';

describe('API Client error extraction and endpoints', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('correctly parses FastAPI validation detail array into human readable message', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      json: async () => ({
        detail: [
          { loc: ['body', 'preferred_off_days'], msg: 'preferred_off_days must be 0-6' },
        ],
      }),
    });

    await expect(configApi.createEmployee({ name: 'Test' })).rejects.toThrow(
      'preferred_off_days must be 0-6'
    );
  });

  it('correctly parses FastAPI single string detail message', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      json: async () => ({
        detail: 'Assignment conflict: employee already assigned to this process',
      }),
    });

    await expect(
      configApi.updateAssignment('asgn-1', { type: 'PRIMARY' })
    ).rejects.toThrow('Assignment conflict: employee already assigned to this process');
  });

  it('calls PUT /assignments/:id when updating assignment', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'asgn-1', type: 'BACKUP' }),
    });
    globalThis.fetch = mockFetch;

    const result = await configApi.updateAssignment('asgn-1', { type: 'BACKUP' });
    expect(result).toEqual({ id: 'asgn-1', type: 'BACKUP' });
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/assignments/asgn-1',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ type: 'BACKUP' }),
      })
    );
  });
});
