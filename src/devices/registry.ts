import { FIIO_VENDOR_ID, FIIO_MODELS } from './fiio/models';
import { KTMICRO_MODELS } from './ktmicro/models';
import { WALKPLAY_MODELS } from './walkplay/models';

export function matchFamily(
  vendorId: number,
  productId: number,
  _productName?: string,
): 'fiio' | 'walkplay' | 'ktmicro' | null {
  if (vendorId === FIIO_VENDOR_ID && FIIO_MODELS.some((m) => m.productId === productId)) return 'fiio';
  if (WALKPLAY_MODELS.some((m) => m.vendorId === vendorId && m.productId === productId)) return 'walkplay';
  if (KTMICRO_MODELS.some((m) => m.vendorId === vendorId && m.productId === productId)) return 'ktmicro';
  return null;
}
