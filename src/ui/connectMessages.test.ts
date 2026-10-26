import { describe, expect, it } from 'vitest';
import { ProtocolError, UnsupportedDeviceError } from '../devices/types';
import { TransportTimeoutError } from '../transport/webhid';
import { describeConnectError } from './connectMessages';

const BUSY =
  'Could not talk to the BTR17. Close FiiO Control (and any other tab using the device), then connect again.';

describe('describeConnectError', () => {
  it('maps timeouts to the busy message', () => {
    expect(describeConnectError(new TransportTimeoutError())).toBe(BUSY);
  });
  it.each(['NotAllowedError', 'NetworkError', 'InvalidStateError'])('maps DOMException %s', (name) => {
    expect(describeConnectError(new DOMException('x', name))).toBe(BUSY);
  });
  it('keeps other DOMException messages', () => {
    expect(describeConnectError(new DOMException('odd', 'AbortError'))).toBe('odd');
  });
  it('keeps UnsupportedDeviceError message', () => {
    expect(describeConnectError(new UnsupportedDeviceError('Not a BTR17'))).toBe('Not a BTR17');
  });
  it('prefixes ProtocolError', () => {
    expect(describeConnectError(new ProtocolError('bad frame'))).toBe(
      'The device answered in an unexpected way: bad frame',
    );
  });
  it('falls back to message or string', () => {
    expect(describeConnectError(new Error('boom'))).toBe('boom');
    expect(describeConnectError('plain')).toBe('plain');
  });
});
