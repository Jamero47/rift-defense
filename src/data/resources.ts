import type { ResourceId } from '../core/types';

export const RESOURCES: Record<ResourceId, { name: string; color: number; icon: string }> = {
  holz: { name: 'Holz', color: 0xb07a45, icon: 'icon_holz' },
  metall: { name: 'Metall', color: 0x9aa5b1, icon: 'icon_metall' },
  kristall: { name: 'Kristall', color: 0x67e8f9, icon: 'icon_kristall' },
};
