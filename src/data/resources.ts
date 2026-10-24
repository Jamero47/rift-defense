import type { ResourceId } from '../core/types';

/** Dauerhafte Ressourcen der Stadt. */
export const RESOURCES: Record<ResourceId, { name: string; color: number; icon: string }> = {
  gold: { name: 'Gold', color: 0xfacc15, icon: 'icon_gold' },
  holz: { name: 'Holz', color: 0xb07a45, icon: 'icon_holz' },
  stein: { name: 'Stein', color: 0x9ca3af, icon: 'icon_stein' },
  magie: { name: 'Magiekristalle', color: 0x67e8f9, icon: 'icon_kristall' },
  nahrung: { name: 'Nahrung', color: 0xf59e0b, icon: 'icon_nahrung' },
};

/** Währung im Kampf: Gegner lassen sie fallen, man beschwört damit Türme. Verfällt nach der Nacht. */
export const RIFT_CRYSTAL = { name: 'Rift-Kristalle', short: 'Kristalle', icon: 'icon_rift', color: '#e879f9' };
