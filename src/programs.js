/* Programm-Assets und Markenfarben aus dem offiziellen Logo-Paket (PNG mit Alphakanal).
   Die Piktogramme (icon-*) sind daraus freigestellt — dadurch ist kein Ausstanzen
   des Hintergrunds zur Laufzeit mehr nötig. */
import logoKnowledge from './assets/programs/knowledge.png';
import logoOrphan from './assets/programs/orphan.png';
import logoSight from './assets/programs/sight.png';
import logoWater from './assets/programs/water.png';
import logoHealth from './assets/programs/health.png';
import logoFood from './assets/programs/food.png';
import logoCommunity from './assets/programs/community.png';
import logoDisaster from './assets/programs/disaster.png';

import iconKnowledge from './assets/programs/icon-knowledge.png';
import iconOrphan from './assets/programs/icon-orphan.png';
import iconSight from './assets/programs/icon-sight.png';
import iconWater from './assets/programs/icon-water.png';
import iconHealth from './assets/programs/icon-health.png';
import iconFood from './assets/programs/icon-food.png';
import iconCommunity from './assets/programs/icon-community.png';
import iconDisaster from './assets/programs/icon-disaster.png';

/** logo = vollständiges Logo (Label), icon = freigestelltes Piktogramm (Schild in der Szene) */
export const BRAND = {
  knowledge: { logo: logoKnowledge, icon: iconKnowledge, color: 0x2e8b57 },
  orphan:    { logo: logoOrphan,    icon: iconOrphan,    color: 0xe89a3c },
  sight:     { logo: logoSight,     icon: iconSight,     color: 0x6b2456 },
  water:     { logo: logoWater,     icon: iconWater,     color: 0x1b6ca8 },
  health:    { logo: logoHealth,    icon: iconHealth,    color: 0x2b3a7a },
  food:      { logo: logoFood,      icon: iconFood,      color: 0xa07a42 },
  community: { logo: logoCommunity, icon: iconCommunity, color: 0xd4622e },
  disaster:  { logo: logoDisaster,  icon: iconDisaster,  color: 0xd33a2c }
};
