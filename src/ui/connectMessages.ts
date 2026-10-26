import { ProtocolError, UnsupportedDeviceError } from '../devices/types';
import { TransportTimeoutError } from '../transport/webhid';

const BUSY =
  'Could not talk to the BTR17. Close FiiO Control (and any other tab using the device), then connect again.';
const BUSY_NAMES = ['NotAllowedError', 'NetworkError', 'InvalidStateError'];

export function describeConnectError(e: unknown): string {
  if (e instanceof TransportTimeoutError) return BUSY;
  if (e instanceof DOMException && BUSY_NAMES.includes(e.name)) return BUSY;
  if (e instanceof UnsupportedDeviceError) return e.message;
  if (e instanceof ProtocolError) return `The device answered in an unexpected way: ${e.message}`;
  return e instanceof Error ? e.message : String(e);
}
