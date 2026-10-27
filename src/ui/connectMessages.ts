import { EqDisabledError, ProtocolError, UnsupportedDeviceError } from '../devices/types';
import { TransportTimeoutError } from '../transport/webhid';

const BUSY =
  'The device did not reply. Close FiiO Control and any other tab or app using it, check the USB cable (try a direct port, no hub), then reload and connect again. Also make sure EQ is switched on in the device settings (EQ off can stop it replying).';
const BUSY_NAMES = ['NotAllowedError', 'NetworkError', 'InvalidStateError'];

const EQ_OFF =
  'The device is not answering EQ reads. EQ looks switched off on the device. Turn EQ on in the device settings, then reload and connect again.';

export function describeConnectError(e: unknown): string {
  if (e instanceof EqDisabledError) return EQ_OFF;
  if (e instanceof TransportTimeoutError) return BUSY;
  if (e instanceof DOMException && BUSY_NAMES.includes(e.name)) return BUSY;
  if (e instanceof UnsupportedDeviceError) return e.message;
  if (e instanceof ProtocolError) return `The device answered in an unexpected way: ${e.message}`;
  return e instanceof Error ? e.message : String(e);
}
