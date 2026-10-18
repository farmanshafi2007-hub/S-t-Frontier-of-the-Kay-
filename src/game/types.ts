export type GamePhase = 'title' | 'playing' | 'paused' | 'victory' | 'gameover';

export type WeaponType = 'kilij' | 'bow' | 'lance';

export type WeatherType = 'clear' | 'mist' | 'rain' | 'snow';

export type CameraPreset = 'chase' | 'close' | 'far' | 'cinematic';

export type HorseArmorType = 'unarmored' | 'kayi_leather' | 'seljuk_scale' | 'cataphract_steel';

export type HorseSaddleType = 'nomad_light' | 'kayi_chieftain' | 'royal_velvet';

export interface EquineLoadoutStats {
  armor: HorseArmorType;
  saddle: HorseSaddleType;
  armorLabel: string;
  saddleLabel: string;
  staminaRegenPerSec: number; // e.g., 14 to 26
  maxStamina: number;
  gallopBonusKmh: number;
  armorDefenseBonus: number;
}

export type FactionTerritory =
  | 'kayi_oba'
  | 'waterfall_lake'
  | 'byzantine_fort'
  | 'mongol_pass'
  | 'caravanserai';

export type SoldierBrainTactic =
  | 'Patrolling'
  | 'Flanking Left'
  | 'Flanking Right'
  | 'Shield Wall'
  | 'Kiting & Aiming'
  | 'Cavalry Charge'
  | 'Striking'
  | 'Tactical Retreat'
  | 'Rallying Squad';

export interface QuestObjective {
  id: string;
  title: string;
  subtitle: string;
  targetX: number;
  targetZ: number;
  progress: number;
  goal: number;
  completed: boolean;
  rewardHonor: number;
}

export interface CombatFeedItem {
  id: number;
  text: string;
  type: 'hit' | 'crit' | 'quest' | 'mount' | 'block';
  timestamp: number;
}

export interface WorldAlertBanner {
  id: number;
  title: string;
  subtitle: string;
  category: 'weather' | 'territory' | 'quest';
}

export interface EnemyInfo {
  id: string;
  name: string;
  faction: 'Byzantine Garrison' | 'Noyan Steppe Horde';
  archetype: 'vanguard' | 'marksman' | 'captain' | 'raider';
  tactic: SoldierBrainTactic;
  hp: number;
  maxHp: number;
  isMounted: boolean;
  isBlocking: boolean;
  windupProgress: number;
}

export interface EnterableBuildingInfo {
  id: string;
  name: string;
  subtitle: string;
  x: number;
  z: number;
  residents: string[];
}

export interface HudState {
  phase: GamePhase;
  playerHp: number;
  playerMaxHp: number;
  playerStamina: number;
  playerMaxStamina: number;
  horseStamina: number;
  horseMaxStamina: number;
  equineLoadout: EquineLoadoutStats;
  isMounted: boolean;
  canMountNearby: boolean;
  distanceToHorse: number;
  speedKmh: number;
  maxSpeedKmh: number;
  gaitLabel: 'Idle' | 'Walk' | 'Trot' | 'Canter' | 'Gallop' | 'Sprint';
  weapon: WeaponType;
  arrowsCount: number;
  honorScore: number;
  enemiesDefeated: number;
  tribePopulation: number;
  childrenCount: number;
  nearbyBuilding: EnterableBuildingInfo | null;
  activeInterior: EnterableBuildingInfo | null;
  alpRetinueFollowing: boolean;
  activeAlpsCount: number;
  timeOfDay: number;
  timeScale: number;
  weather: WeatherType;
  cameraPreset: CameraPreset;
  regionName: string;
  territoryFaction: string;
  compassHeading: number;
  playerPos: { x: number; z: number };
  horsePos: { x: number; z: number };
  activeQuest: QuestObjective;
  questIndex: number;
  totalQuests: number;
  lockedEnemy: EnemyInfo | null;
  combatFeed: CombatFeedItem[];
  worldAlert: WorldAlertBanner | null;
  isBlocking: boolean;
  bowCharge: number;
  isMuted: boolean;
  dockCollapsed: boolean;
  showTouchControls: boolean;
  mapPoints: Array<{
    id: string;
    x: number;
    z: number;
    type: 'village' | 'lake' | 'waterfall' | 'tower' | 'caravanserai' | 'pass' | 'enemy' | 'ally' | 'horse' | 'quest';
    label: string;
  }>;
}
