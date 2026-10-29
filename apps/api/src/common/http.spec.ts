import { ErrorFilter } from './http';
import type { ArgumentsHost } from '@nestjs/common';
test('unexpected errors log correlation and safe cause without leaking error text to clients or logs', () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  const json = jest.fn(),
    status = jest.fn(() => ({ json }));
  const error = new Error('private-canary-password');
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({
        method: 'GET',
        path: '/api/v1/orders',
        requestId: 'request-test',
      }),
      getResponse: () => ({ status }),
    }),
  } as unknown as ArgumentsHost;
  try {
    new ErrorFilter().catch(error, host);
    expect(status).toHaveBeenCalledWith(500);
    const entry = JSON.parse(log.mock.calls[0][0]);
    expect(entry.requestId).toBe('request-test');
    expect(entry.errorType).toBe('Error');
    expect(entry.frames.length).toBeGreaterThan(0);
    expect(JSON.stringify(log.mock.calls)).not.toContain(
      'private-canary-password',
    );
    expect(JSON.stringify(json.mock.calls)).not.toContain(
      'private-canary-password',
    );
  } finally {
    log.mockRestore();
  }
});
