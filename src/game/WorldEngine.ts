import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { SoundEngine } from './audio';
import {
  createArcheryTargetModel,
  createBridgeModel,
  createCampfireModel,
  createCaravanseraiModel,
  createHatunModel,
  createHorseModel,
  createWarriorModel,
  createWatchtowerModel,
  createWaterfallModel,
  createYurtModel,
  HorseRig,
  WarriorRig,
} from './models';
import {
  createTerrainMesh,
  getLakeFactor,
  getRiverDist,
  getRoadFactor,
  getTerritoryDetailsAt,
  groundHeightAt,
  isOnBridge,
  isWaterAt,
  walkableHeightAt,
  WATER_LEVEL,
  WORLD_SIZE,
} from './terrain';
import {
  CameraPreset,
  CombatFeedItem,
  EnemyInfo,
  EnterableBuildingInfo,
  EquineLoadoutStats,
  GamePhase,
  HorseArmorType,
  HorseSaddleType,
  HudState,
  QuestObjective,
  SoldierBrainTactic,
  WeaponType,
  WeatherType,
  WorldAlertBanner,
} from './types';

const _v1 = new THREE.Vector3();
const _camIdealPos = new THREE.Vector3();
const _camIdealLook = new THREE.Vector3();
const _dummyObj = new THREE.Object3D();
const _colorTmp = new THREE.Color();
const _skyTopDay = new THREE.Color('#2a5c8a');
const _skyHorizonDay = new THREE.Color('#9ec5db');
const _skyHorizonSunset = new THREE.Color('#d97742');
const _skyHorizonNight = new THREE.Color('#09111e');
const _sunColorDay = new THREE.Color('#fff4dc');
const _sunColorSunset = new THREE.Color('#ff8844');
const _sunColorNight = new THREE.Color('#4c6ef5');

const WEATHER_TRANSITION_MESSAGES: Record<WeatherType, { title: string; subtitle: string }> = {
  clear: {
    title: 'Golden sunlight breaks through the clouds over Söğüt',
    subtitle: 'Clear skies illuminate the emerald valley and Kayı standards',
  },
  mist: {
    title: 'A thick mist descends upon the river',
    subtitle: 'Dense Anatolian fog shrouds the Sakarya crossing and pine foothills',
  },
  rain: {
    title: 'A heavy rainstorm sweeps across the valley',
    subtitle: 'Driving rain slicks the frontier trails as distant thunder rumbles',
  },
  snow: {
    title: 'Fierce highland snow drifts down from Karadağ',
    subtitle: 'Biting mountain frost blankets the northern gorges and peaks',
  },
};

const HORSE_ARMOR_CATALOG: Record<
  HorseArmorType,
  { label: string; regenMod: number; maxStamMod: number; speedMod: number; defBonus: number }
> = {
  unarmored: {
    label: 'Unarmored Steppe Coat',
    regenMod: 4,
    maxStamMod: 0,
    speedMod: 2,
    defBonus: 0,
  },
  kayi_leather: {
    label: 'Kayı Embossed Leather Barding',
    regenMod: 2,
    maxStamMod: 15,
    speedMod: 1,
    defBonus: 15,
  },
  seljuk_scale: {
    label: 'Seljuk Gilded Scale Barding',
    regenMod: 0,
    maxStamMod: 30,
    speedMod: 0,
    defBonus: 30,
  },
  cataphract_steel: {
    label: 'Heavy Cataphract Steel Plate',
    regenMod: -2,
    maxStamMod: 45,
    speedMod: -1,
    defBonus: 45,
  },
};

const HORSE_SADDLE_CATALOG: Record<
  HorseSaddleType,
  { label: string; baseRegen: number; maxStamBonus: number; speedBonus: number }
> = {
  nomad_light: {
    label: 'Nomadic Steppe Feather Saddle',
    baseRegen: 22,
    maxStamBonus: 0,
    speedBonus: 3,
  },
  kayi_chieftain: {
    label: 'Kayı Bey Brass-Studded Saddle',
    baseRegen: 18,
    maxStamBonus: 20,
    speedBonus: 2,
  },
  royal_velvet: {
    label: 'Seljuk Royal Velvet Caparison',
    baseRegen: 16,
    maxStamBonus: 40,
    speedBonus: 1,
  },
};

interface EnemyActor {
  id: string;
  name: string;
  faction: 'Byzantine Garrison' | 'Noyan Steppe Horde';
  archetype: 'vanguard' | 'marksman' | 'captain' | 'raider';
  rig: WarriorRig;
  horseRig: HorseRig | null;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  homeX: number;
  homeZ: number;
  heading: number;
  hp: number;
  maxHp: number;
  state: 'patrol' | 'chase' | 'windup' | 'recover' | 'retreat' | 'charge_pass' | 'dead';
  tactic: SoldierBrainTactic;
  flankSign: number;
  isBlocking: boolean;
  stateTimer: number;
  windupDuration: number;
  patrolAngle: number;
  animPhase: number;
  hitFlashTimer: number;
}

interface AlliedAlp {
  id: string;
  name: string;
  rig: WarriorRig;
  x: number;
  y: number;
  z: number;
  homeX: number;
  homeZ: number;
  heading: number;
  attackCooldown: number;
  animPhase: number;
  formationOffsetAngle: number;
}

interface CrowdVillager {
  group: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  x: number;
  z: number;
  homeX: number;
  homeZ: number;
  radius: number;
  speed: number;
  phase: number;
}

interface FlyingArrow {
  mesh: THREE.Group;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  fromPlayer: boolean;
  life: number;
  active: boolean;
}

interface ParticleItem {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  scale: number;
  active: boolean;
}

export class WorldEngine {
  private container: HTMLElement;
  private onHudUpdate: (state: HudState) => void;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private sound = new SoundEngine();

  private animFrameId = 0;
  private isDisposed = false;

  // Lighting & Atmosphere
  private keyLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private rimLight!: THREE.DirectionalLight;
  private sunOrbMesh!: THREE.Mesh;
  private starPoints!: THREE.Points;
  private fog!: THREE.FogExp2;
  private campfires: Array<{ flameMesh: THREE.Mesh; light: THREE.PointLight }> = [];
  private weatherPoints!: THREE.Points;
  private weatherVelY = -18;
  private waterShaderUniforms: { uTime: { value: number } } = { uTime: { value: 0 } };
  private autoWeatherTimer = 75;

  // Player & Steed (Aktolgali)
  private playerRig!: WarriorRig;
  private horseRig!: HorseRig;

  private playerX = -46;
  private playerY = 2.6;
  private playerZ = 22;
  private playerVelY = 0;
  private playerHeading = 2.35;
  private playerSpeed = 0;
  private isGrounded = true;

  private horseX = -46;
  private horseY = 2.6;
  private horseZ = 22;
  private horseHeading = 2.35;
  private horseSpeed = 0;
  private horseSummoning = false;

  // Equine Loadout State
  private horseArmor: HorseArmorType = 'kayi_leather';
  private horseSaddle: HorseSaddleType = 'kayi_chieftain';

  // Enterable Buildings & Tribe Population State
  private buildings: EnterableBuildingInfo[] = [
    {
      id: 'b_otag',
      name: "Bey's Grand Otağ Pavilion",
      subtitle: 'Sovereign council yurt & family hearth of Ertuğrul Bey',
      x: -82,
      z: 48,
      residents: ['Halime Hatun', 'Hayme Ana', 'Gündüz Alp'],
    },
    {
      id: 'b_hatun_weaver',
      name: 'Kayı Silk & Carpet Weaver Yurt',
      subtitle: 'Traditional Anatolian carpet looms & dye vessels',
      x: -64,
      z: 62,
      residents: ['Selcan Hatun', 'Aykız Hatun', 'Gökçe Hatun'],
    },
    {
      id: 'b_healer',
      name: 'Oba Herbalist & Healing Tent',
      subtitle: 'Restores vitality and blesses growing Kayı families',
      x: -94,
      z: 64,
      residents: ['Akça Hatun', 'Banu Çiçek', 'Dervish İbn-i Arabi'],
    },
    {
      id: 'b_forge_tent',
      name: 'Deli Demir Blacksmith & Armory Yurt',
      subtitle: 'Damascus Kilij blades & horse barding workshop',
      x: -62,
      z: 28,
      residents: ['Deli Demir', 'Aslıhan Hatun'],
    },
    {
      id: 'b_caravanserai',
      name: 'Hanlı Pazar Seljuk Caravanserai Hall',
      subtitle: 'Silk Road merchant suite, spice traders, and Silk Pavilion',
      x: 104,
      z: 68,
      residents: ['Bala Hatun', 'Karaca Hatun', 'Master Silk Merchant'],
    },
  ];
  private activeInterior: EnterableBuildingInfo | null = null;
  private tribePopulation = 68;
  private childrenCount = 14;
  private villagers: CrowdVillager[] = [];

  // Gameplay State
  private phase: GamePhase = 'title';
  private isMounted = true;
  private weapon: WeaponType = 'kilij';
  private weather: WeatherType = 'clear';
  private cameraPreset: CameraPreset = 'chase';
  private timeOfDay = 9.5;
  private timeScale = 1.0;

  private playerHp = 100;
  private playerMaxHp = 100;
  private playerStamina = 100;
  private playerMaxStamina = 100;
  private horseStamina = 155;
  private horseMaxStamina = 155;
  private arrowsCount = 36;
  private honorScore = 150;
  private enemiesDefeated = 0;
  private alpRetinueFollowing = true;

  private lastRegionName = 'Kayı Oba Nomadic Encampment';
  private worldAlert: WorldAlertBanner | null = null;
  private worldAlertTimer = 0;
  private alertCounter = 1;

  // Combat & Animation timers
  private animCycle = 0;
  private hoofStepAccum = 0;
  private attackTimer = 0;
  private attackCombo = 0;
  private isBlocking = false;
  private bowCharge = 0;
  private isDrawingBow = false;
  private hitstopTimer = 0;
  private shakeIntensity = 0;

  // Camera Orbit Controls
  private camYawOffset = 0;
  private camPitch = 0.24;
  private isPointerDragging = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private currentCamPos = new THREE.Vector3(-56, 8, 32);
  private currentCamLook = new THREE.Vector3(-40, 4, 16);
  private titleOrbitAngle = 0;

  // Keyboard + Mobile Touch Joystick Input State
  private keysHeld = new Set<string>();
  private joyX = 0;
  private joyY = 0;
  private touchSprintHeld = false;
  private showTouchControls = false;

  private combatFeed: CombatFeedItem[] = [];
  private feedCounter = 1;
  private hudSyncAccum = 0;
  private dockCollapsed = false;

  // World Entities
  private enemies: EnemyActor[] = [];
  private alliedAlps: AlliedAlp[] = [];
  private archeryTargets: Array<{ x: number; z: number; mesh: THREE.Group }> = [];
  private arrowsPool: FlyingArrow[] = [];
  private particlesPool: ParticleItem[] = [];
  private questBeaconMesh!: THREE.Mesh;

  private quests: QuestObjective[] = [
    {
      id: 'q1_crossing',
      title: 'I. Patrol the Sakarya River Crossing',
      subtitle: 'Ride Aktolgali to the River Bridge & repel the Raider scouts',
      targetX: 14,
      targetZ: -20,
      progress: 0,
      goal: 3,
      completed: false,
      rewardHonor: 250,
    },
    {
      id: 'q2_waterfall',
      title: 'II. Secure Çağlayan Mountain Waterfall',
      subtitle: 'Ride north to the cascading waterfall gorge and vanquish the outriders',
      targetX: 24,
      targetZ: -92,
      progress: 0,
      goal: 2,
      completed: false,
      rewardHonor: 350,
    },
    {
      id: 'q3_watchtower',
      title: 'III. Storm Karacahisar Byzantine Citadel',
      subtitle: 'Ascend the eastern crag and defeat the Tekfur Commander & garrison',
      targetX: 115,
      targetZ: -65,
      progress: 0,
      goal: 4,
      completed: false,
      rewardHonor: 550,
    },
    {
      id: 'q4_mountain_pass',
      title: 'IV. Purge the Karadağ Snow Pass',
      subtitle: 'Charge into the northern snow canyon and crush the Noyan Steppe Horde',
      targetX: -35,
      targetZ: -165,
      progress: 0,
      goal: 4,
      completed: false,
      rewardHonor: 850,
    },
  ];
  private currentQuestIdx = 0;

  constructor(container: HTMLElement, onHudUpdate: (state: HudState) => void) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;

    this.showTouchControls =
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      window.innerWidth < 900;

    this.initRendererAndScene();
    this.initLightingAndSky();
    this.initWorldGeometry();
    this.initPlayerAndHorse();
    this.initPoolsAndParticles();
    this.spawnEnemiesAndNpcs();
    this.spawnBustlingVillageAndMarketCrowd();
    this.bindEvents();

    this.renderer.compile(this.scene, this.camera);
    this.emitHudState();
    this.animate();
  }

  public getEquineLoadoutStats(): EquineLoadoutStats {
    const a = HORSE_ARMOR_CATALOG[this.horseArmor];
    const s = HORSE_SADDLE_CATALOG[this.horseSaddle];
    const maxStamina = 120 + a.maxStamMod + s.maxStamBonus;
    const staminaRegenPerSec = Math.max(10, s.baseRegen + a.regenMod);
    const gallopBonusKmh = a.speedMod + s.speedBonus;
    return {
      armor: this.horseArmor,
      saddle: this.horseSaddle,
      armorLabel: a.label,
      saddleLabel: s.label,
      staminaRegenPerSec,
      maxStamina,
      gallopBonusKmh,
      armorDefenseBonus: a.defBonus,
    };
  }

  public setEquineArmor(armor: HorseArmorType): void {
    this.horseArmor = armor;
    this.horseRig.setEquineLoadout(this.horseArmor, this.horseSaddle);
    const stats = this.getEquineLoadoutStats();
    this.horseMaxStamina = stats.maxStamina;
    this.horseStamina = Math.min(this.horseMaxStamina, this.horseStamina);
    this.pushFeed(
      `Equipped ${stats.armorLabel} (Regen ${stats.staminaRegenPerSec}/s · Max ${stats.maxStamina})`,
      'mount'
    );
    this.emitHudState();
  }

  public setEquineSaddle(saddle: HorseSaddleType): void {
    this.horseSaddle = saddle;
    this.horseRig.setEquineLoadout(this.horseArmor, this.horseSaddle);
    const stats = this.getEquineLoadoutStats();
    this.horseMaxStamina = stats.maxStamina;
    this.horseStamina = Math.min(this.horseMaxStamina, this.horseStamina);
    this.pushFeed(
      `Fitted ${stats.saddleLabel} (Stamina Regen ${stats.staminaRegenPerSec}/s)`,
      'mount'
    );
    this.emitHudState();
  }

  public enterNearbyBuilding(): void {
    const b = this.findNearbyBuilding();
    if (!b) return;
    this.activeInterior = b;
    this.keysHeld.clear();
    this.playerHp = this.playerMaxHp;
    this.playerStamina = this.playerMaxStamina;
    this.horseStamina = this.horseMaxStamina;
    this.sound.playQuestHorn();
    this.emitHudState();
  }

  public exitInterior(): void {
    this.activeInterior = null;
    this.emitHudState();
  }

  /**
   * Welcomes a new child & family blessing in the Oba / Pavilion, visibly spawning
   * new Hatun & child villagers in the open world and growing the Kayı Tribe population!
   */
  public celebrateNewbornFamily(): void {
    this.childrenCount += 1;
    this.tribePopulation += 2;
    this.honorScore += 75;
    this.playerHp = this.playerMaxHp;
    this.sound.playQuestHorn();

    // Spawn a new Hatun mother & child in the Oba courtyard
    const dressPalette = [0x0e7490, 0x991b1b, 0x047857, 0xb45309, 0x6d28d9];
    const hatun = createHatunModel(dressPalette[this.tribePopulation % dressPalette.length]);
    const angle = Math.random() * Math.PI * 2;
    const hx = -75 + Math.cos(angle) * (8 + Math.random() * 14);
    const hz = 45 + Math.sin(angle) * (8 + Math.random() * 14);
    hatun.group.position.set(hx, walkableHeightAt(hx, hz), hz);
    this.scene.add(hatun.group);
    this.villagers.push({
      group: hatun.group,
      leftArm: hatun.leftArm,
      rightArm: hatun.rightArm,
      x: hx,
      z: hz,
      homeX: hx,
      homeZ: hz,
      radius: 4.5,
      speed: 1.4,
      phase: Math.random() * 6,
    });

    // Spawn child alongside
    const child = createHatunModel(0xd97706);
    child.group.scale.setScalar(0.62);
    child.group.position.set(hx + 0.9, walkableHeightAt(hx + 0.9, hz), hz);
    this.scene.add(child.group);
    this.villagers.push({
      group: child.group,
      leftArm: child.leftArm,
      rightArm: child.rightArm,
      x: hx + 0.9,
      z: hz,
      homeX: hx,
      homeZ: hz,
      radius: 5.2,
      speed: 2.1,
      phase: Math.random() * 6,
    });

    this.pushFeed(
      `A new child is born into the Kayı Tribe! Population grew to ${this.tribePopulation} (+75 Honor)`,
      'quest'
    );
    this.emitHudState();
  }

  private findNearbyBuilding(): EnterableBuildingInfo | null {
    for (const b of this.buildings) {
      if (Math.hypot(this.playerX - b.x, this.playerZ - b.z) < 9.5) {
        return b;
      }
    }
    return null;
  }

  private initRendererAndScene(): void {
    const isHeadless =
      navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !isHeadless,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setPixelRatio(
      isHeadless ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    this.renderer.setSize(
      this.container.clientWidth || window.innerWidth,
      this.container.clientHeight || window.innerHeight
    );
    this.renderer.shadowMap.enabled = !isHeadless;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#8bb8d6');
    this.fog = new THREE.FogExp2('#8bb8d6', 0.0024);
    this.scene.fog = this.fog;

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04
    ).texture;
    pmremGenerator.dispose();

    const aspect =
      (this.container.clientWidth || window.innerWidth) /
      (this.container.clientHeight || window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(58, aspect, 0.25, 680);
  }

  private initLightingAndSky(): void {
    this.keyLight = new THREE.DirectionalLight(0xfff4dc, 2.5);
    this.keyLight.position.set(80, 120, 60);
    this.keyLight.castShadow = this.renderer.shadowMap.enabled;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    const d = 90;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.camera.near = 10;
    this.keyLight.shadow.camera.far = 290;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);
    this.scene.add(this.keyLight.target);

    this.hemiLight = new THREE.HemisphereLight(0x9ec5db, 0x4b5335, 0.9);
    this.hemiLight.position.set(0, 120, 0);
    this.scene.add(this.hemiLight);

    this.rimLight = new THREE.DirectionalLight(0x90b8d8, 0.55);
    this.rimLight.position.set(-70, 50, -80);
    this.scene.add(this.rimLight);

    const orbGeo = new THREE.SphereGeometry(14, 20, 20);
    const orbMat = new THREE.MeshBasicMaterial({
      color: 0xfff5d6,
      fog: false,
    });
    this.sunOrbMesh = new THREE.Mesh(orbGeo, orbMat);
    this.scene.add(this.sunOrbMesh);

    const starCount = 950;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 0.85 + 0.15);
      const r = 470;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.cos(phi);
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xf8fafc,
      size: 1.8,
      transparent: true,
      opacity: 0,
      fog: false,
    });
    this.starPoints = new THREE.Points(starGeo, starMat);
    this.scene.add(this.starPoints);

    const precipCount = 1500;
    const precipPos = new Float32Array(precipCount * 3);
    for (let i = 0; i < precipCount; i++) {
      precipPos[i * 3] = (Math.random() - 0.5) * 70;
      precipPos[i * 3 + 1] = Math.random() * 36;
      precipPos[i * 3 + 2] = (Math.random() - 0.5) * 70;
    }
    const precipGeo = new THREE.BufferGeometry();
    precipGeo.setAttribute('position', new THREE.BufferAttribute(precipPos, 3));
    const precipMat = new THREE.PointsMaterial({
      color: 0xdbeafe,
      size: 0.22,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.weatherPoints = new THREE.Points(precipGeo, precipMat);
    this.weatherPoints.frustumCulled = false;
    this.scene.add(this.weatherPoints);
  }

  private initWorldGeometry(): void {
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();

    const terrainMesh = createTerrainMesh(maxAniso);
    this.scene.add(terrainMesh);

    const waterGeo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 120, 120);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshPhysicalMaterial({
      color: 0x165b75,
      roughness: 0.12,
      metalness: 0.1,
      transmission: 0.68,
      thickness: 2.0,
      ior: 1.333,
      attenuationColor: new THREE.Color(0x0d3b4c),
      attenuationDistance: 4.5,
      clearcoat: 0.95,
      clearcoatRoughness: 0.08,
      transparent: true,
      opacity: 0.88,
    });

    waterMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.waterShaderUniforms.uTime;
      shader.vertexShader =
        `uniform float uTime;\n` +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           float wave = sin(position.x * 0.28 + uTime * 2.4) * 0.065 + cos(position.z * 0.24 + uTime * 1.9) * 0.065;
           transformed.y += wave;`
        );
    };

    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.position.y = WATER_LEVEL;
    waterMesh.receiveShadow = true;
    this.scene.add(waterMesh);

    const waterfall = createWaterfallModel(this.waterShaderUniforms.uTime, maxAniso);
    waterfall.group.position.set(24, WATER_LEVEL, -108);
    this.scene.add(waterfall.group);

    this.buildKayiObaVillage(maxAniso);

    const caravanserai = createCaravanseraiModel(maxAniso);
    caravanserai.position.set(104, groundHeightAt(104, 68), 68);
    caravanserai.rotation.y = -0.65;
    this.scene.add(caravanserai);

    const bridge = createBridgeModel();
    this.scene.add(bridge);

    const watchtower = createWatchtowerModel();
    watchtower.position.set(115, groundHeightAt(115, -65) - 0.15, -65);
    this.scene.add(watchtower);

    this.buildInstancedForestAndRocks();

    const beaconGeo = new THREE.CylinderGeometry(1.1, 1.1, 38, 16, 1, true);
    beaconGeo.translate(0, 19, 0);
    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.questBeaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
    this.scene.add(this.questBeaconMesh);
  }

  private buildKayiObaVillage(maxAniso: number): void {
    const beyYurt = createYurtModel(5.6, true, maxAniso);
    beyYurt.position.set(-82, groundHeightAt(-82, 48), 48);
    beyYurt.rotation.y = Math.PI * 0.35;
    this.scene.add(beyYurt);

    const yurtPlacements: Array<{ x: number; z: number; r: number; rot: number }> = [
      { x: -64, z: 62, r: 3.9, rot: -0.4 },
      { x: -94, z: 64, r: 4.1, rot: 0.8 },
      { x: -98, z: 34, r: 3.8, rot: 1.4 },
      { x: -62, z: 28, r: 4.0, rot: 2.1 },
      { x: -78, z: 22, r: 3.7, rot: 1.8 },
      { x: -50, z: 42, r: 3.8, rot: -1.1 },
    ];

    yurtPlacements.forEach((p) => {
      const yurt = createYurtModel(p.r, false, maxAniso);
      yurt.position.set(p.x, groundHeightAt(p.x, p.z), p.z);
      yurt.rotation.y = p.rot;
      this.scene.add(yurt);
    });

    const fireCoords = [
      [-70, 46],
      [-58, 36],
      [110, -56],
      [98, 66],
    ];
    fireCoords.forEach(([fx, fz]) => {
      const cf = createCampfireModel();
      cf.group.position.set(fx, groundHeightAt(fx, fz), fz);
      this.scene.add(cf.group);
      this.campfires.push({ flameMesh: cf.flameMesh, light: cf.light });
    });

    const targetCoords = [
      { x: -48, z: 58, rot: -0.6 },
      { x: -42, z: 52, rot: -0.7 },
      { x: -36, z: 46, rot: -0.8 },
    ];
    targetCoords.forEach((tc) => {
      const tMesh = createArcheryTargetModel();
      tMesh.position.set(tc.x, groundHeightAt(tc.x, tc.z), tc.z);
      tMesh.rotation.y = tc.rot;
      this.scene.add(tMesh);
      this.archeryTargets.push({ x: tc.x, z: tc.z, mesh: tMesh });
    });
  }

  /**
   * Spawns a high-density, bustling crowd of Hatuns, Merchants, Artisans, and Children
   * across the Kayı Oba Village and the Hanlı Pazar Grand Bazaar!
   */
  private spawnBustlingVillageAndMarketCrowd(): void {
    const dressColors = [0x0e7490, 0x991b1b, 0x047857, 0xb45309, 0x1d4ed8, 0x7e22ce, 0xbe123c];

    // 18 Kayı Hatuns & Children in the Oba Encampment (-75, 45)
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2;
      const dist = 7 + (i % 4) * 5.2;
      const hx = -75 + Math.cos(angle) * dist;
      const hz = 45 + Math.sin(angle) * dist;
      const isChild = i % 4 === 3;
      const model = createHatunModel(dressColors[i % dressColors.length]);
      if (isChild) {
        model.group.scale.setScalar(0.64);
      }
      model.group.position.set(hx, walkableHeightAt(hx, hz), hz);
      this.scene.add(model.group);
      this.villagers.push({
        group: model.group,
        leftArm: model.leftArm,
        rightArm: model.rightArm,
        x: hx,
        z: hz,
        homeX: hx,
        homeZ: hz,
        radius: isChild ? 5.5 : 3.8,
        speed: isChild ? 2.1 : 1.25,
        phase: i * 0.9,
      });
    }

    // 14 Silk Road Hatuns, Shoppers & Traders in Hanlı Pazar Grand Bazaar (104, 68)
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2;
      const dist = 5 + (i % 3) * 4.5;
      const bx = 104 + Math.cos(angle) * dist;
      const bz = 68 + Math.sin(angle) * dist;
      const model = createHatunModel(dressColors[(i + 2) % dressColors.length]);
      model.group.position.set(bx, walkableHeightAt(bx, bz), bz);
      this.scene.add(model.group);
      this.villagers.push({
        group: model.group,
        leftArm: model.leftArm,
        rightArm: model.rightArm,
        x: bx,
        z: bz,
        homeX: bx,
        homeZ: bz,
        radius: 4.2,
        speed: 1.35,
        phase: i * 1.1,
      });
    }
  }

  private buildInstancedForestAndRocks(): void {
    const treeCount = 460;
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.32, 2.6, 7);
    trunkGeo.translate(0, 1.3, 0);
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x4a321f,
      roughness: 0.9,
    });

    const foliageLowGeo = new THREE.ConeGeometry(1.85, 3.8, 8);
    foliageLowGeo.translate(0, 3.7, 0);
    const foliageHighGeo = new THREE.ConeGeometry(1.35, 3.2, 8);
    foliageHighGeo.translate(0, 5.6, 0);
    const foliageMat = new THREE.MeshStandardMaterial({
      color: 0x2d4c22,
      roughness: 0.85,
    });

    const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
    const lowInst = new THREE.InstancedMesh(foliageLowGeo, foliageMat, treeCount);
    const highInst = new THREE.InstancedMesh(foliageHighGeo, foliageMat, treeCount);
    trunkInst.castShadow = true;
    lowInst.castShadow = true;
    highInst.castShadow = true;
    lowInst.receiveShadow = true;

    let placedTrees = 0;
    let attempts = 0;
    while (placedTrees < treeCount && attempts < 3200) {
      attempts++;
      const tx = (Math.random() - 0.5) * 540;
      const tz = (Math.random() - 0.5) * 540;

      if (isWaterAt(tx, tz)) continue;
      if (getRiverDist(tx, tz) < 18) continue;
      if (getLakeFactor(tx, tz) > 0.01) continue;
      if (getRoadFactor(tx, tz) > 0.1) continue;
      if (Math.hypot(tx - -75, tz - 45) < 46) continue;
      if (Math.hypot(tx - 115, tz - -65) < 26) continue;
      if (Math.hypot(tx - 104, tz - 68) < 28) continue;
      if (Math.hypot(tx - 24, tz - -100) < 32) continue;

      const ty = groundHeightAt(tx, tz);
      if (ty > 26) continue;

      const scale = 0.8 + Math.random() * 0.65;
      _dummyObj.position.set(tx, ty - 0.1, tz);
      _dummyObj.rotation.set(0, Math.random() * Math.PI * 2, 0);
      _dummyObj.scale.setScalar(scale);
      _dummyObj.updateMatrix();

      trunkInst.setMatrixAt(placedTrees, _dummyObj.matrix);
      lowInst.setMatrixAt(placedTrees, _dummyObj.matrix);
      highInst.setMatrixAt(placedTrees, _dummyObj.matrix);

      _colorTmp.setHSL(
        0.27 + (Math.random() - 0.5) * 0.05,
        0.42 + Math.random() * 0.15,
        0.22 + Math.random() * 0.1
      );
      lowInst.setColorAt(placedTrees, _colorTmp);
      highInst.setColorAt(placedTrees, _dummyObj.position.z < -115 ? new THREE.Color('#dce6f2') : _colorTmp);

      placedTrees++;
    }

    trunkInst.count = placedTrees;
    lowInst.count = placedTrees;
    highInst.count = placedTrees;
    trunkInst.instanceMatrix.needsUpdate = true;
    lowInst.instanceMatrix.needsUpdate = true;
    highInst.instanceMatrix.needsUpdate = true;
    if (lowInst.instanceColor) lowInst.instanceColor.needsUpdate = true;
    if (highInst.instanceColor) highInst.instanceColor.needsUpdate = true;
    trunkInst.computeBoundingSphere();
    lowInst.computeBoundingSphere();
    highInst.computeBoundingSphere();

    this.scene.add(trunkInst, lowInst, highInst);

    const rockCount = 220;
    const rockGeo = new THREE.DodecahedronGeometry(1.0, 1);
    rockGeo.scale(1.2, 0.75, 1.0);
    rockGeo.translate(0, 0.45, 0);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x6b7075,
      roughness: 0.86,
      metalness: 0.06,
    });
    const rockInst = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
    rockInst.castShadow = true;
    rockInst.receiveShadow = true;

    let placedRocks = 0;
    for (let i = 0; i < 900 && placedRocks < rockCount; i++) {
      const rx = (Math.random() - 0.5) * 540;
      const rz = (Math.random() - 0.5) * 540;
      if (getRoadFactor(rx, rz) > 0.15) continue;
      if (Math.hypot(rx - -75, rz - 45) < 40) continue;
      if (Math.hypot(rx - 104, rz - 68) < 26) continue;
      const ry = groundHeightAt(rx, rz);
      if (ry < WATER_LEVEL - 0.5) continue;

      const s = 0.5 + Math.random() * 1.85;
      _dummyObj.position.set(rx, ry - 0.15, rz);
      _dummyObj.rotation.set(
        (Math.random() - 0.5) * 0.3,
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * 0.3
      );
      _dummyObj.scale.set(s, s * (0.6 + Math.random() * 0.6), s);
      _dummyObj.updateMatrix();
      rockInst.setMatrixAt(placedRocks, _dummyObj.matrix);

      const shade = 0.38 + Math.random() * 0.22;
      _colorTmp.setRGB(shade, shade * 0.98, shade * 0.95);
      rockInst.setColorAt(placedRocks, _colorTmp);
      placedRocks++;
    }
    rockInst.count = placedRocks;
    rockInst.instanceMatrix.needsUpdate = true;
    if (rockInst.instanceColor) rockInst.instanceColor.needsUpdate = true;
    rockInst.computeBoundingSphere();
    this.scene.add(rockInst);
  }

  private initPlayerAndHorse(): void {
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();

    this.horseRig = createHorseModel(0xf3efe6, 0x24201d, true);
    this.horseRig.setEquineLoadout(this.horseArmor, this.horseSaddle);
    this.scene.add(this.horseRig.group);

    this.playerRig = createWarriorModel('player', maxAniso);
    this.scene.add(this.playerRig.group);

    const stats = this.getEquineLoadoutStats();
    this.horseMaxStamina = stats.maxStamina;
    this.horseStamina = stats.maxStamina;

    this.playerY = walkableHeightAt(this.playerX, this.playerZ);
    this.horseY = this.playerY;
    this.syncActorTransforms(0.016);
  }

  private initPoolsAndParticles(): void {
    const shaftGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.95, 6);
    shaftGeo.rotateX(Math.PI / 2);
    const tipGeo = new THREE.ConeGeometry(0.032, 0.12, 6);
    tipGeo.rotateX(Math.PI / 2);
    tipGeo.translate(0, 0, 0.5);
    const shaftMat = new THREE.MeshStandardMaterial({ color: 0x855834 });
    const tipMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.9, roughness: 0.2 });

    for (let i = 0; i < 20; i++) {
      const arrowGrp = new THREE.Group();
      arrowGrp.add(new THREE.Mesh(shaftGeo, shaftMat));
      arrowGrp.add(new THREE.Mesh(tipGeo, tipMat));
      arrowGrp.visible = false;
      this.scene.add(arrowGrp);
      this.arrowsPool.push({
        mesh: arrowGrp,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        fromPlayer: true,
        life: 0,
        active: false,
      });
    }

    const partGeo = new THREE.DodecahedronGeometry(0.14, 0);
    for (let i = 0; i < 75; i++) {
      const partMat = new THREE.MeshBasicMaterial({
        color: 0xd6c7b2,
        transparent: true,
        opacity: 0.85,
      });
      const mesh = new THREE.Mesh(partGeo, partMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.particlesPool.push({
        mesh,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 0.5,
        scale: 1,
        active: false,
      });
    }
  }

  public spawnEnemiesAndNpcs(): void {
    this.enemies.forEach((e) => {
      this.scene.remove(e.rig.group);
      if (e.horseRig) this.scene.remove(e.horseRig.group);
    });
    this.enemies = [];

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();

    if (this.alliedAlps.length === 0) {
      const alpRoster = [
        { id: 'alp_1', name: 'Turgut Alp', x: -52, z: 26, offsetAngle: 2.5 },
        { id: 'alp_2', name: 'Bamsı Beyrek', x: -56, z: 30, offsetAngle: -2.5 },
        { id: 'alp_3', name: 'Doğan Alp', x: -60, z: 36, offsetAngle: Math.PI },
      ];
      alpRoster.forEach((ac, idx) => {
        const rig = createWarriorModel('kayi', maxAniso);
        rig.setWeapon(idx === 2 ? 'lance' : 'kilij');
        const y = walkableHeightAt(ac.x, ac.z);
        rig.group.position.set(ac.x, y, ac.z);
        this.scene.add(rig.group);
        this.alliedAlps.push({
          id: ac.id,
          name: ac.name,
          rig,
          x: ac.x,
          y,
          z: ac.z,
          homeX: ac.x,
          homeZ: ac.z,
          heading: 2.3,
          attackCooldown: 0,
          animPhase: idx * 1.4,
          formationOffsetAngle: ac.offsetAngle,
        });
      });

      const merchantCoords = [
        { x: 96, z: 74, rot: 0.4 },
        { x: 110, z: 62, rot: -1.1 },
        { x: 100, z: 60, rot: 0.9 },
        { x: 108, z: 75, rot: -2.1 },
      ];
      merchantCoords.forEach((mc) => {
        const mRig = createWarriorModel('merchant', maxAniso);
        mRig.shieldGroup.visible = false;
        mRig.kilijGroup.visible = false;
        mRig.group.position.set(mc.x, walkableHeightAt(mc.x, mc.z), mc.z);
        mRig.group.rotation.y = mc.rot;
        this.scene.add(mRig.group);
      });
    }

    const spawns: Array<{
      id: string;
      name: string;
      faction: 'Byzantine Garrison' | 'Noyan Steppe Horde';
      archetype: 'vanguard' | 'marksman' | 'captain' | 'raider';
      modelType: 'byzantine' | 'mongol';
      x: number;
      z: number;
      hp: number;
      mounted: boolean;
      weapon: WeaponType;
    }> = [
      { id: 'e1', name: 'River Ford Shieldguard', faction: 'Byzantine Garrison', archetype: 'vanguard', modelType: 'byzantine', x: 16, z: -18, hp: 80, mounted: false, weapon: 'kilij' },
      { id: 'e2', name: 'Byzantine Crossbowman', faction: 'Byzantine Garrison', archetype: 'marksman', modelType: 'byzantine', x: 26, z: -24, hp: 75, mounted: false, weapon: 'bow' },
      { id: 'e3', name: 'Outrider Cataphract', faction: 'Byzantine Garrison', archetype: 'raider', modelType: 'byzantine', x: 32, z: -12, hp: 110, mounted: true, weapon: 'lance' },

      { id: 'e4', name: 'Waterfall Gorge Scout', faction: 'Noyan Steppe Horde', archetype: 'marksman', modelType: 'mongol', x: 14, z: -84, hp: 85, mounted: false, weapon: 'bow' },
      { id: 'e5', name: 'Steppe Gorge Lancer', faction: 'Noyan Steppe Horde', archetype: 'raider', modelType: 'mongol', x: 34, z: -86, hp: 115, mounted: true, weapon: 'lance' },

      { id: 'e6', name: 'Citadel Hoplite', faction: 'Byzantine Garrison', archetype: 'vanguard', modelType: 'byzantine', x: 96, z: -56, hp: 95, mounted: false, weapon: 'kilij' },
      { id: 'e7', name: 'Imperial Marksman', faction: 'Byzantine Garrison', archetype: 'marksman', modelType: 'byzantine', x: 106, z: -72, hp: 80, mounted: false, weapon: 'bow' },
      { id: 'e8', name: 'Garrison Cataphract', faction: 'Byzantine Garrison', archetype: 'raider', modelType: 'byzantine', x: 122, z: -54, hp: 125, mounted: true, weapon: 'lance' },
      { id: 'e9', name: 'Tekfur Ares Commander', faction: 'Byzantine Garrison', archetype: 'captain', modelType: 'byzantine', x: 112, z: -62, hp: 170, mounted: false, weapon: 'kilij' },

      { id: 'e10', name: 'Steppe Heavy Vanguard', faction: 'Noyan Steppe Horde', archetype: 'vanguard', modelType: 'mongol', x: -28, z: -145, hp: 105, mounted: false, weapon: 'kilij' },
      { id: 'e11', name: 'Mangudai Horse Archer', faction: 'Noyan Steppe Horde', archetype: 'marksman', modelType: 'mongol', x: -42, z: -158, hp: 110, mounted: true, weapon: 'bow' },
      { id: 'e12', name: 'Karakorum Shock Lancer', faction: 'Noyan Steppe Horde', archetype: 'raider', modelType: 'mongol', x: -24, z: -170, hp: 130, mounted: true, weapon: 'lance' },
      { id: 'e13', name: 'Noyan Steppe Warlord', faction: 'Noyan Steppe Horde', archetype: 'captain', modelType: 'mongol', x: -36, z: -178, hp: 195, mounted: true, weapon: 'kilij' },
    ];

    spawns.forEach((sp, i) => {
      const rig = createWarriorModel(sp.modelType, maxAniso);
      rig.setWeapon(sp.weapon);
      this.scene.add(rig.group);

      let horseRig: HorseRig | null = null;
      if (sp.mounted) {
        horseRig = createHorseModel(
          sp.modelType === 'mongol' ? 0x292524 : 0x452c1e,
          0x141210,
          false
        );
        this.scene.add(horseRig.group);
      }

      const y = walkableHeightAt(sp.x, sp.z);
      this.enemies.push({
        id: sp.id,
        name: sp.name,
        faction: sp.faction,
        archetype: sp.archetype,
        rig,
        horseRig,
        x: sp.x,
        y,
        z: sp.z,
        vx: 0,
        vz: 0,
        homeX: sp.x,
        homeZ: sp.z,
        heading: i * 0.9,
        hp: sp.hp,
        maxHp: sp.hp,
        state: 'patrol',
        tactic: 'Patrolling',
        flankSign: i % 2 === 0 ? 1 : -1,
        isBlocking: false,
        stateTimer: 0,
        windupDuration: sp.archetype === 'captain' ? 0.72 : 0.85,
        patrolAngle: i * 1.3,
        animPhase: i * 0.7,
        hitFlashTimer: 0,
      });
    });
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);

    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private handleResize = (): void => {
    if (!this.container || this.isDisposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private handleBlur = (): void => {
    this.keysHeld.clear();
    this.joyX = 0;
    this.joyY = 0;
    this.touchSprintHeld = false;
    this.isBlocking = false;
    this.isDrawingBow = false;
    this.bowCharge = 0;
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    const code = e.code;

    if (this.phase === 'title') {
      if (code === 'Enter' || code === 'Space') {
        e.preventDefault();
        this.startGame();
      }
      return;
    }

    if (code === 'Escape') {
      e.preventDefault();
      if (this.activeInterior) {
        this.exitInterior();
      } else {
        this.togglePause();
      }
      return;
    }

    if (this.phase !== 'playing') return;

    this.keysHeld.add(code);

    if (code === 'KeyE') {
      this.toggleMount();
    } else if (code === 'KeyR') {
      if (this.activeInterior) {
        this.exitInterior();
      } else {
        this.enterNearbyBuilding();
      }
    } else if (code === 'KeyF') {
      this.summonHorse();
    } else if (code === 'KeyG') {
      this.toggleAlpRetinue();
    } else if (code === 'Digit1') {
      this.setWeapon('kilij');
    } else if (code === 'Digit2') {
      this.setWeapon('bow');
    } else if (code === 'Digit3') {
      this.setWeapon('lance');
    } else if (code === 'KeyC') {
      this.cycleCameraPreset();
    } else if (code === 'KeyH') {
      this.dockCollapsed = !this.dockCollapsed;
      this.emitHudState();
    } else if (code === 'KeyM') {
      this.toggleMute();
    } else if (code === 'Space') {
      e.preventDefault();
      this.triggerJump();
    } else if (code === 'KeyJ') {
      this.triggerPrimaryAttack();
    } else if (code === 'KeyQ') {
      this.isBlocking = true;
      if (this.weapon === 'bow') {
        this.isDrawingBow = true;
      }
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keysHeld.delete(e.code);
    if (e.code === 'KeyQ') {
      if (this.weapon === 'bow' && this.isDrawingBow) {
        this.releaseBowArrow();
      }
      this.isBlocking = false;
      this.isDrawingBow = false;
      this.bowCharge = 0;
    }
  };

  private handlePointerDown = (e: PointerEvent): void => {
    if (this.phase !== 'playing' || this.activeInterior) return;

    if (e.button === 0) {
      this.isPointerDragging = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      if (!this.showTouchControls) {
        if (this.weapon === 'bow') {
          this.isDrawingBow = true;
        } else {
          this.triggerPrimaryAttack();
        }
      }
    } else if (e.button === 2) {
      this.isBlocking = true;
      if (this.weapon === 'bow') {
        this.isDrawingBow = true;
      }
    }
  };

  private handlePointerMove = (e: PointerEvent): void => {
    if (!this.isPointerDragging && !this.isBlocking) return;
    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;

    if (this.isPointerDragging) {
      this.camYawOffset -= dx * 0.0055;
      this.camPitch = THREE.MathUtils.clamp(this.camPitch + dy * 0.004, 0.06, 0.78);
    }
  };

  private handlePointerUp = (e: PointerEvent): void => {
    if (e.button === 0) {
      this.isPointerDragging = false;
      if (!this.showTouchControls && this.weapon === 'bow' && this.isDrawingBow) {
        this.releaseBowArrow();
      }
    } else if (e.button === 2) {
      if (this.weapon === 'bow' && this.isDrawingBow) {
        this.releaseBowArrow();
      }
      this.isBlocking = false;
    }
  };

  public setJoystickInput(x: number, y: number): void {
    this.joyX = THREE.MathUtils.clamp(x, -1, 1);
    this.joyY = THREE.MathUtils.clamp(y, -1, 1);
  }

  public setTouchSprint(active: boolean): void {
    this.touchSprintHeld = active;
  }

  public setTouchBlock(active: boolean): void {
    this.isBlocking = active;
    if (this.weapon === 'bow') {
      if (active) {
        this.isDrawingBow = true;
      } else if (this.isDrawingBow) {
        this.releaseBowArrow();
      }
    }
  }

  public toggleTouchControls(): void {
    this.showTouchControls = !this.showTouchControls;
    this.emitHudState();
  }

  public toggleAlpRetinue(): void {
    this.alpRetinueFollowing = !this.alpRetinueFollowing;
    this.sound.playQuestHorn();
    this.pushFeed(
      this.alpRetinueFollowing
        ? 'Kayı Alp Retinue rallied! Turgut, Bamsı & Doğan march with you.'
        : 'Kayı Alp Retinue ordered to guard current position.',
      'quest'
    );
    this.emitHudState();
  }

  private triggerWorldAlert(
    title: string,
    subtitle: string,
    category: WorldAlertBanner['category']
  ): void {
    this.worldAlert = {
      id: this.alertCounter++,
      title,
      subtitle,
      category,
    };
    this.worldAlertTimer = 4.5;
    this.emitHudState();
  }

  public startGame(): void {
    this.phase = 'playing';
    this.sound.playQuestHorn();
    this.triggerWorldAlert(
      'Kayı Oba Nomadic Encampment',
      'Ride forth with your Alp Retinue across the Söğüt Frontier',
      'territory'
    );
    this.emitHudState();
  }

  public togglePause(): void {
    if (this.phase === 'playing') {
      this.phase = 'paused';
      this.keysHeld.clear();
    } else if (this.phase === 'paused') {
      this.phase = 'playing';
    }
    this.emitHudState();
  }

  public resetGame(): void {
    this.playerHp = this.playerMaxHp;
    this.playerStamina = this.playerMaxStamina;
    this.horseStamina = this.horseMaxStamina;
    this.arrowsCount = 36;
    this.playerX = -46;
    this.playerZ = 22;
    this.playerY = walkableHeightAt(this.playerX, this.playerZ);
    this.horseX = this.playerX;
    this.horseZ = this.playerZ;
    this.horseY = this.playerY;
    this.isMounted = true;
    this.playerHeading = 2.35;
    this.horseHeading = 2.35;
    this.playerSpeed = 0;
    this.horseSpeed = 0;
    this.spawnEnemiesAndNpcs();
    this.phase = 'playing';
    this.emitHudState();
  }

  public setWeapon(w: WeaponType): void {
    this.weapon = w;
    this.playerRig.setWeapon(w);
    this.bowCharge = 0;
    this.isDrawingBow = false;
    const names: Record<WeaponType, string> = {
      kilij: 'Kilij Saber & Kayı Shield',
      bow: 'Kayı Composite Recurve Bow',
      lance: 'Sungu Cavalry Lance',
    };
    this.pushFeed(`Equipped ${names[w]}`, 'mount');
    this.emitHudState();
  }

  public setWeather(w: WeatherType): void {
    if (this.weather === w) return;
    this.weather = w;
    this.autoWeatherTimer = 95;
    const msg = WEATHER_TRANSITION_MESSAGES[w];
    this.triggerWorldAlert(msg.title, msg.subtitle, 'weather');
    this.emitHudState();
  }

  public setTimeOfDay(hour: number): void {
    this.timeOfDay = (hour + 24) % 24;
    this.emitHudState();
  }

  public setCameraPreset(preset: CameraPreset): void {
    this.cameraPreset = preset;
    this.emitHudState();
  }

  public cycleCameraPreset(): void {
    const order: CameraPreset[] = ['chase', 'close', 'far', 'cinematic'];
    const idx = (order.indexOf(this.cameraPreset) + 1) % order.length;
    this.setCameraPreset(order[idx]);
  }

  public toggleMute(): void {
    this.sound.setMuted(!this.sound.isMuted);
    this.emitHudState();
  }

  public toggleDockCollapsed(): void {
    this.dockCollapsed = !this.dockCollapsed;
    this.emitHudState();
  }

  public fastTravelTo(x: number, z: number, label: string): void {
    this.activeInterior = null;
    this.playerX = x;
    this.playerZ = z;
    this.playerY = walkableHeightAt(x, z);
    if (this.isMounted) {
      this.horseX = x;
      this.horseZ = z;
      this.horseY = this.playerY;
    } else {
      this.horseX = x - 3.2;
      this.horseZ = z - 2.0;
      this.horseY = walkableHeightAt(this.horseX, this.horseZ);
    }
    if (this.alpRetinueFollowing) {
      this.alliedAlps.forEach((alp, idx) => {
        alp.x = x - 3.5 + idx * 2.5;
        alp.z = z - 3.5;
        alp.y = walkableHeightAt(alp.x, alp.z);
      });
    }
    this.playerSpeed = 0;
    this.horseSpeed = 0;
    const terr = getTerritoryDetailsAt(x, z);
    this.lastRegionName = terr.regionName;
    this.triggerWorldAlert(terr.regionName, terr.bannerSubtitle, 'territory');
    this.pushFeed(`Traveled to ${label}`, 'quest');
    this.emitHudState();
  }

  public toggleMount(): void {
    if (this.isMounted) {
      this.isMounted = false;
      this.playerSpeed = 0;
      this.horseSpeed = 0;
      this.playerX = this.horseX + Math.cos(this.horseHeading) * 1.45;
      this.playerZ = this.horseZ - Math.sin(this.horseHeading) * 1.45;
      this.playerY = walkableHeightAt(this.playerX, this.playerZ);
      this.pushFeed('Dismounted Aktolgali — Exploring on foot', 'mount');
    } else {
      const dist = Math.hypot(this.playerX - this.horseX, this.playerZ - this.horseZ);
      if (dist <= 6.5) {
        this.isMounted = true;
        this.horseSummoning = false;
        this.playerX = this.horseX;
        this.playerZ = this.horseZ;
        this.playerHeading = this.horseHeading;
        this.sound.playWhistleSummon();
        this.pushFeed('Mounted Aktolgali — Ready to gallop', 'mount');
      } else {
        this.summonHorse();
      }
    }
    this.emitHudState();
  }

  public summonHorse(): void {
    if (this.isMounted) return;
    this.sound.playWhistleSummon();
    this.horseSummoning = true;
    this.pushFeed('Whistled for Aktolgali — Steed galloping to your side!', 'mount');
    this.emitHudState();
  }

  public triggerJump(): void {
    if (!this.isGrounded) return;
    this.isGrounded = false;
    this.playerVelY = this.isMounted ? 8.4 : 6.8;
    const inWater = isWaterAt(this.playerX, this.playerZ);
    this.sound.playHoofbeat(inWater ? 'water' : 'grass', 0.9);
    this.spawnParticles(this.playerX, this.playerY, this.playerZ, inWater ? 0xbae6fd : 0xc2b280, 8);
  }

  public triggerPrimaryAttack(): void {
    if (this.phase !== 'playing' || this.activeInterior) return;

    if (this.weapon === 'bow') {
      this.bowCharge = Math.max(0.7, this.bowCharge);
      this.releaseBowArrow();
      return;
    }

    if (this.attackTimer > 0.12) return;
    if (this.playerStamina < 6) return;

    this.playerStamina = Math.max(0, this.playerStamina - 8);
    this.attackTimer = 0.35;
    this.attackCombo = (this.attackCombo + 1) % 3;

    const isMountedGallop = this.isMounted && Math.abs(this.horseSpeed) > 12;
    this.sound.playSwordSwing(isMountedGallop || this.weapon === 'lance');

    const arcMat = this.playerRig.slashArcMesh.material as THREE.MeshBasicMaterial;
    arcMat.opacity = 0.82;
    this.playerRig.slashArcMesh.rotation.z =
      this.attackCombo === 0 ? 0.25 : this.attackCombo === 1 ? -0.35 : 0;

    const reach = this.weapon === 'lance' ? 4.9 : this.isMounted ? 4.0 : 3.3;
    const forwardX = Math.sin(this.playerHeading);
    const forwardZ = Math.cos(this.playerHeading);

    this.archeryTargets.forEach((t) => {
      const d = Math.hypot(t.x - this.playerX, t.z - this.playerZ);
      if (d < reach) {
        this.sound.playSteelImpact(false);
        this.spawnParticles(t.x, this.playerY + 1.2, t.z, 0xfbbf24, 8);
      }
    });

    let hitAny = false;
    this.enemies.forEach((enemy) => {
      if (enemy.state === 'dead') return;
      const dx = enemy.x - this.playerX;
      const dz = enemy.z - this.playerZ;
      const dist = Math.hypot(dx, dz);
      if (dist > reach) return;

      const dot = (dx * forwardX + dz * forwardZ) / Math.max(0.001, dist);
      if (dot < 0.12 && dist > 1.9) return;

      hitAny = true;
      let baseDmg = this.weapon === 'lance' ? 40 : 32;
      let isCrit = false;

      if (this.isMounted && Math.abs(this.horseSpeed) > 9) {
        const speedBonus = this.weapon === 'lance' ? 1.85 : 1.5;
        baseDmg = Math.round(baseDmg * speedBonus);
        isCrit = true;
      }

      this.damageEnemy(enemy, baseDmg, isCrit);
    });

    if (hitAny) {
      this.hitstopTimer = 0.045;
      this.shakeIntensity = Math.min(0.45, this.shakeIntensity + 0.22);
    }
  }

  private releaseBowArrow(): void {
    this.isDrawingBow = false;
    if (this.arrowsCount <= 0) {
      this.pushFeed('Saddle quiver replenished (+24 Arrows)', 'mount');
      this.arrowsCount = 24;
    }
    this.arrowsCount--;

    const chargeFactor = THREE.MathUtils.clamp(this.bowCharge, 0.5, 1.0);
    this.bowCharge = 0;
    this.sound.playBowRelease();

    const arrow = this.arrowsPool.find((a) => !a.active) || this.arrowsPool[0];
    arrow.active = true;
    arrow.fromPlayer = true;
    arrow.life = 2.8;
    arrow.mesh.visible = true;

    const launchHeight = this.isMounted ? this.playerY + 2.25 : this.playerY + 1.45;
    const dirAngle = this.playerHeading + this.camYawOffset * 0.35;
    const fx = Math.sin(dirAngle);
    const fz = Math.cos(dirAngle);

    let aimY = 0.06;
    const nearest = this.findNearestEnemy(50);
    if (nearest) {
      const dist = Math.hypot(nearest.x - this.playerX, nearest.z - this.playerZ);
      const targetH = nearest.y + (nearest.horseRig ? 2.1 : 1.35);
      aimY = (targetH - launchHeight) / Math.max(8, dist) + dist * 0.0032;
      const aimAngle = Math.atan2(nearest.x - this.playerX, nearest.z - this.playerZ);
      const angleDiff = Math.abs(
        THREE.MathUtils.euclideanModulo(aimAngle - dirAngle + Math.PI, Math.PI * 2) - Math.PI
      );
      if (angleDiff < 0.5) {
        const speed = 45 * chargeFactor + 18;
        arrow.pos.set(
          this.playerX + Math.sin(aimAngle) * 0.9,
          launchHeight,
          this.playerZ + Math.cos(aimAngle) * 0.9
        );
        arrow.vel.set(Math.sin(aimAngle) * speed, aimY * speed, Math.cos(aimAngle) * speed);
        return;
      }
    }

    const speed = 43 * chargeFactor + 18;
    arrow.pos.set(this.playerX + fx * 0.9, launchHeight, this.playerZ + fz * 0.9);
    arrow.vel.set(fx * speed, aimY * speed, fz * speed);
  }

  private damageEnemy(enemy: EnemyActor, amount: number, isCrit: boolean): void {
    let finalDmg = amount;
    if (enemy.isBlocking && !isCrit) {
      finalDmg = Math.max(5, Math.round(amount * 0.42));
      this.sound.playShieldBlock();
    } else {
      this.sound.playSteelImpact(isCrit);
    }

    enemy.hp = Math.max(0, enemy.hp - finalDmg);
    enemy.hitFlashTimer = 0.18;

    const kx = enemy.x - this.playerX;
    const kz = enemy.z - this.playerZ;
    const kLen = Math.max(0.01, Math.hypot(kx, kz));
    enemy.x += (kx / kLen) * (isCrit ? 1.6 : 0.75);
    enemy.z += (kz / kLen) * (isCrit ? 1.6 : 0.75);

    this.spawnParticles(
      enemy.x,
      enemy.y + (enemy.horseRig ? 1.9 : 1.3),
      enemy.z,
      isCrit ? 0xfbbf24 : enemy.isBlocking ? 0x93c5fd : 0xf87171,
      isCrit ? 14 : 8
    );

    if (enemy.hp <= 0) {
      enemy.state = 'dead';
      enemy.tactic = 'Patrolling';
      enemy.isBlocking = false;
      enemy.stateTimer = 0;
      const tMat = enemy.rig.telegraphRing.material as THREE.MeshBasicMaterial;
      tMat.opacity = 0;

      this.enemiesDefeated++;
      const honorGain = enemy.archetype === 'captain' ? 160 : 70;
      this.honorScore += honorGain;
      this.pushFeed(
        `Vanquished ${enemy.name}! (+${honorGain} Kayı Honor)`,
        isCrit ? 'crit' : 'hit'
      );

      this.advanceQuestProgress(enemy);
    } else {
      this.pushFeed(
        `${enemy.isBlocking && !isCrit ? 'Shield Glanced' : isCrit ? 'Cavalry Strike' : 'Hit'} ${enemy.name} (${finalDmg} DMG)`,
        isCrit ? 'crit' : 'hit'
      );
      if (enemy.state === 'patrol') {
        enemy.state = 'chase';
      }
    }
  }

  private advanceQuestProgress(defeatedEnemy?: EnemyActor): void {
    const q = this.quests[this.currentQuestIdx];
    if (!q || q.completed) return;

    if (defeatedEnemy) {
      q.progress = Math.min(q.goal, q.progress + 1);
    }

    if (q.progress >= q.goal && !q.completed) {
      q.completed = true;
      this.honorScore += q.rewardHonor;
      this.playerHp = Math.min(this.playerMaxHp, this.playerHp + 40);
      this.sound.playQuestHorn();
      this.triggerWorldAlert(
        `Chronicle Completed: ${q.title}`,
        `+${q.rewardHonor} Kayı Honor Earned`,
        'quest'
      );

      if (this.currentQuestIdx < this.quests.length - 1) {
        this.currentQuestIdx++;
      } else {
        this.phase = 'victory';
      }
    }
  }

  private spawnParticles(
    x: number,
    y: number,
    z: number,
    colorHex: number,
    count: number
  ): void {
    let spawned = 0;
    for (let i = 0; i < this.particlesPool.length && spawned < count; i++) {
      const p = this.particlesPool[i];
      if (p.active) continue;
      p.active = true;
      p.life = 0;
      p.maxLife = 0.35 + Math.random() * 0.3;
      p.scale = 0.6 + Math.random() * 0.8;
      p.pos.set(x + (Math.random() - 0.5) * 0.5, y, z + (Math.random() - 0.5) * 0.5);
      p.vel.set(
        (Math.random() - 0.5) * 6.5,
        2.2 + Math.random() * 4.5,
        (Math.random() - 0.5) * 6.5
      );
      (p.mesh.material as THREE.MeshBasicMaterial).color.setHex(colorHex);
      p.mesh.visible = true;
      spawned++;
    }
  }

  private pushFeed(text: string, type: CombatFeedItem['type']): void {
    this.combatFeed.unshift({
      id: this.feedCounter++,
      text,
      type,
      timestamp: performance.now(),
    });
    if (this.combatFeed.length > 3) {
      this.combatFeed.pop();
    }
  }

  private findNearestEnemy(maxRange: number): EnemyActor | null {
    let best: EnemyActor | null = null;
    let bestDist = maxRange;
    for (const e of this.enemies) {
      if (e.state === 'dead') continue;
      const d = Math.hypot(e.x - this.playerX, e.z - this.playerZ);
      if (d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    return best;
  }

  private animate = (): void => {
    if (this.isDisposed) return;
    this.animFrameId = requestAnimationFrame(this.animate);

    const rawDt = this.clock.getDelta();
    const dt = Math.min(rawDt, 0.05);

    this.waterShaderUniforms.uTime.value += dt;

    if (this.phase === 'playing' || this.phase === 'title') {
      this.timeOfDay = (this.timeOfDay + dt * 0.042 * this.timeScale) % 24;
    }

    if (this.phase === 'playing') {
      this.autoWeatherTimer -= dt;
      if (this.autoWeatherTimer <= 0) {
        const cycle: WeatherType[] = ['clear', 'mist', 'rain', 'clear', 'snow'];
        const nextW = cycle[(cycle.indexOf(this.weather) + 1) % cycle.length];
        this.setWeather(nextW);
      }

      if (this.worldAlertTimer > 0) {
        this.worldAlertTimer -= dt;
        if (this.worldAlertTimer <= 0) {
          this.worldAlert = null;
        }
      }
    }

    this.updateAtmosphereAndWeather(dt);
    this.updateCrowdVillagers(dt);

    if (this.phase === 'title') {
      this.updateTitleCamera(dt);
      this.syncActorTransforms(dt);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (this.phase !== 'playing') {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (!this.activeInterior) {
      this.updatePlayerAndHorse(dt);
      this.updateTacticalSoldiersAndAlps(dt);
      this.updateProjectilesAndParticles(dt);
    }
    this.updateGameplayCamera(dt);

    if (Math.hypot(this.playerX - 24, this.playerZ - -100) < 95 && Math.random() < 0.35) {
      this.spawnParticles(
        24 + (Math.random() - 0.5) * 9,
        WATER_LEVEL + 0.6,
        -102 + (Math.random() - 0.5) * 4,
        0xe0f2fe,
        1
      );
    }

    const activeQ = this.quests[this.currentQuestIdx];
    if (activeQ && !activeQ.completed) {
      this.questBeaconMesh.visible = true;
      const qy = walkableHeightAt(activeQ.targetX, activeQ.targetZ);
      this.questBeaconMesh.position.set(activeQ.targetX, qy, activeQ.targetZ);
    } else {
      this.questBeaconMesh.visible = false;
    }

    this.renderer.render(this.scene, this.camera);

    this.hudSyncAccum += dt;
    if (this.hudSyncAccum >= 0.08) {
      this.hudSyncAccum = 0;
      this.emitHudState();
    }
  };

  private updateCrowdVillagers(dt: number): void {
    this.villagers.forEach((v) => {
      v.phase += dt * v.speed;
      const nx = v.homeX + Math.sin(v.phase * 0.45) * v.radius;
      const nz = v.homeZ + Math.cos(v.phase * 0.45) * v.radius;
      const heading = Math.atan2(nx - v.x, nz - v.z);
      v.x = nx;
      v.z = nz;
      v.group.position.set(v.x, walkableHeightAt(v.x, v.z), v.z);
      v.group.rotation.y = heading;
      v.leftArm.rotation.x = Math.sin(v.phase * 2.2) * 0.25;
      v.rightArm.rotation.x = -Math.sin(v.phase * 2.2) * 0.25;
    });
  }

  private updateAtmosphereAndWeather(dt: number): void {
    const sunAngle = ((this.timeOfDay - 6) / 24) * Math.PI * 2;
    const sunElevation = Math.sin(sunAngle);
    const sunHoriz = Math.cos(sunAngle);

    const lightDist = 140;
    const elevationY = Math.max(18, Math.abs(sunElevation) * 125 + 15);
    this.keyLight.position.set(
      this.playerX + sunHoriz * lightDist,
      elevationY,
      this.playerZ + 45
    );
    this.keyLight.target.position.set(this.playerX, this.playerY, this.playerZ);

    this.sunOrbMesh.position.set(
      this.playerX + sunHoriz * 380,
      sunElevation * 260 + 25,
      this.playerZ - 180
    );

    const dayFactor = THREE.MathUtils.smoothstep(sunElevation, -0.1, 0.35);
    const sunsetFactor =
      1.0 - Math.min(1.0, Math.abs(sunElevation - 0.05) / 0.32);

    _colorTmp.copy(_skyHorizonNight).lerp(_skyHorizonDay, dayFactor);
    if (sunsetFactor > 0.01) {
      _colorTmp.lerp(_skyHorizonSunset, sunsetFactor * 0.72);
    }

    if (this.weather === 'mist') {
      _colorTmp.lerp(_skyTopDay, 0.25);
      this.fog.density = 0.0068;
    } else if (this.weather === 'rain') {
      _colorTmp.multiplyScalar(0.58);
      this.fog.density = 0.0055;
    } else if (this.weather === 'snow') {
      _colorTmp.lerp(new THREE.Color('#cbd5e1'), 0.45);
      this.fog.density = 0.0052;
    } else {
      this.fog.density = 0.0022;
    }

    (this.scene.background as THREE.Color).copy(_colorTmp);
    this.fog.color.copy(_colorTmp);

    this.keyLight.color
      .copy(_sunColorNight)
      .lerp(_sunColorDay, dayFactor)
      .lerp(_sunColorSunset, sunsetFactor * 0.65);

    const weatherDim = this.weather === 'rain' ? 0.55 : this.weather === 'mist' ? 0.75 : 1.0;
    this.keyLight.intensity = (0.45 + dayFactor * 2.15) * weatherDim;
    this.hemiLight.intensity = (0.35 + dayFactor * 0.65) * weatherDim;
    this.hemiLight.color.copy(_colorTmp);

    const starMat = this.starPoints.material as THREE.PointsMaterial;
    starMat.opacity = THREE.MathUtils.clamp(
      (1 - dayFactor * 1.4) * (this.weather === 'clear' ? 0.9 : 0.2),
      0,
      0.95
    );
    this.starPoints.position.set(this.playerX, 0, this.playerZ);

    const t = this.waterShaderUniforms.uTime.value;
    const nightBoost = 1.0 + (1.0 - dayFactor) * 1.6;
    this.campfires.forEach((cf, i) => {
      const flicker = 0.88 + Math.sin(t * 14 + i * 2.1) * 0.14;
      cf.light.intensity = 3.2 * nightBoost * flicker;
      cf.flameMesh.scale.set(
        flicker,
        0.9 + Math.cos(t * 18 + i) * 0.18,
        flicker
      );
    });

    const pMat = this.weatherPoints.material as THREE.PointsMaterial;
    if (this.weather === 'rain' || this.weather === 'snow') {
      pMat.opacity = this.weather === 'rain' ? 0.62 : 0.85;
      pMat.size = this.weather === 'rain' ? 0.18 : 0.34;
      pMat.color.setHex(this.weather === 'rain' ? 0xbae6fd : 0xf8fafc);
      this.weatherVelY = this.weather === 'rain' ? -26 : -5.5;

      const posAttr = this.weatherPoints.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < posAttr.count; i++) {
        let py = posAttr.getY(i) + this.weatherVelY * dt;
        let px = posAttr.getX(i);
        if (this.weather === 'snow') {
          px += Math.sin(t * 1.5 + i) * dt * 1.2;
        }
        if (py < 0) py = 35;
        posAttr.setXY(i, px, py);
      }
      posAttr.needsUpdate = true;
      this.weatherPoints.position.set(this.playerX, this.playerY, this.playerZ);
    } else {
      pMat.opacity = 0;
    }
  }

  private updateTitleCamera(dt: number): void {
    this.titleOrbitAngle += dt * 0.16;
    const radius = 14.5;
    const cx = this.playerX + Math.sin(this.titleOrbitAngle) * radius;
    const cz = this.playerZ + Math.cos(this.titleOrbitAngle) * radius;
    const cy = Math.max(walkableHeightAt(cx, cz) + 2.5, this.playerY + 4.2);

    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(this.playerX, this.playerY + 1.85, this.playerZ);
    this.animCycle += dt * 1.8;
  }

  private updatePlayerAndHorse(dt: number): void {
    const keyForward =
      (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp') ? 1 : 0) -
      (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown') ? 1 : 0);
    const keyTurn =
      (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft') ? 1 : 0) -
      (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight') ? 1 : 0);

    const moveForward = THREE.MathUtils.clamp(keyForward + this.joyY, -1, 1);
    const turnInput = THREE.MathUtils.clamp(keyTurn - this.joyX, -1, 1);
    const isSprinting =
      this.keysHeld.has('ShiftLeft') ||
      this.keysHeld.has('ShiftRight') ||
      this.touchSprintHeld ||
      this.joyY > 0.78;

    const eqStats = this.getEquineLoadoutStats();

    if (this.weapon === 'bow' && this.isDrawingBow) {
      this.bowCharge = Math.min(1.0, this.bowCharge + dt * 1.35);
    }

    if (this.attackTimer > 0) {
      this.attackTimer = Math.max(0, this.attackTimer - dt);
      const arcMat = this.playerRig.slashArcMesh.material as THREE.MeshBasicMaterial;
      arcMat.opacity = THREE.MathUtils.lerp(0, 0.82, this.attackTimer / 0.35);
    }

    if (this.isMounted) {
      const canGallop = isSprinting && this.horseStamina > 5;
      const maxSpeed = (canGallop ? 21.5 : 13.8) + eqStats.gallopBonusKmh * 0.45;
      const targetSpeed =
        moveForward > 0.05
          ? maxSpeed * moveForward
          : moveForward < -0.05
          ? -5.5 * Math.abs(moveForward)
          : 0;

      this.horseSpeed = THREE.MathUtils.damp(this.horseSpeed, targetSpeed, 4.4, dt);

      if (canGallop && Math.abs(this.horseSpeed) > 14.5) {
        this.horseStamina = Math.max(0, this.horseStamina - dt * 10.5);
      } else {
        // Apply Equine Loadout Stamina Regeneration Rate!
        this.horseStamina = Math.min(
          this.horseMaxStamina,
          this.horseStamina + dt * eqStats.staminaRegenPerSec
        );
      }
      this.playerStamina = Math.min(this.playerMaxStamina, this.playerStamina + dt * 16);

      const turnRate = 2.1 * (1 - Math.abs(this.horseSpeed) / 50);
      if (Math.abs(turnInput) > 0.02) {
        this.horseHeading += turnInput * turnRate * dt;
        this.camYawOffset = THREE.MathUtils.damp(this.camYawOffset, 0, 2.5, dt);
      }

      const inWater = isWaterAt(this.horseX, this.horseZ);
      const waterDrag = inWater ? 0.68 : 1.0;

      const vx = Math.sin(this.horseHeading) * this.horseSpeed * waterDrag;
      const vz = Math.cos(this.horseHeading) * this.horseSpeed * waterDrag;

      this.horseX = THREE.MathUtils.clamp(this.horseX + vx * dt, -285, 285);
      this.horseZ = THREE.MathUtils.clamp(this.horseZ + vz * dt, -285, 285);

      this.playerX = this.horseX;
      this.playerZ = this.horseZ;
      this.playerHeading = this.horseHeading;
      this.playerSpeed = this.horseSpeed;

      if (this.weapon === 'lance' && this.horseSpeed > 14.0) {
        const fx = Math.sin(this.horseHeading);
        const fz = Math.cos(this.horseHeading);
        const tipX = this.horseX + fx * 2.5;
        const tipZ = this.horseZ + fz * 2.5;
        this.enemies.forEach((e) => {
          if (e.state === 'dead' || e.hitFlashTimer > 0) return;
          if (Math.hypot(e.x - tipX, e.z - tipZ) < 1.95) {
            this.damageEnemy(e, 72, true);
            this.shakeIntensity = 0.35;
          }
        });
      }

      const absSpeed = Math.abs(this.horseSpeed);
      if (absSpeed > 0.8 && this.isGrounded) {
        this.hoofStepAccum += absSpeed * dt;
        const stepThreshold = absSpeed > 15 ? 3.4 : 2.6;
        if (this.hoofStepAccum >= stepThreshold) {
          this.hoofStepAccum = 0;
          const onBridge = isOnBridge(this.horseX, this.horseZ);
          const surface = onBridge ? 'wood' : inWater ? 'water' : 'grass';
          this.sound.playHoofbeat(surface, absSpeed / 22.0);
          if (absSpeed > 10 || inWater) {
            this.spawnParticles(
              this.horseX,
              this.horseY + 0.15,
              this.horseZ,
              inWater ? 0xbae6fd : 0xb5a288,
              inWater ? 5 : 3
            );
          }
        }
      }
    } else {
      this.horseStamina = Math.min(
        this.horseMaxStamina,
        this.horseStamina + dt * eqStats.staminaRegenPerSec
      );
      const canSprint = isSprinting && this.playerStamina > 5 && !this.isBlocking;
      const maxFootSpeed = this.isBlocking ? 4.2 : canSprint ? 10.4 : 6.8;

      if (Math.abs(turnInput) > 0.02) {
        this.playerHeading += turnInput * 2.65 * dt;
      }

      const targetFootSpeed =
        moveForward > 0.05
          ? maxFootSpeed * moveForward
          : moveForward < -0.05
          ? -4.0 * Math.abs(moveForward)
          : 0;
      this.playerSpeed = THREE.MathUtils.damp(this.playerSpeed, targetFootSpeed, 7.5, dt);

      if (canSprint && Math.abs(this.playerSpeed) > 7.5) {
        this.playerStamina = Math.max(0, this.playerStamina - dt * 12);
      } else {
        this.playerStamina = Math.min(this.playerMaxStamina, this.playerStamina + dt * 15);
      }

      const vx = Math.sin(this.playerHeading) * this.playerSpeed;
      const vz = Math.cos(this.playerHeading) * this.playerSpeed;
      this.playerX = THREE.MathUtils.clamp(this.playerX + vx * dt, -285, 285);
      this.playerZ = THREE.MathUtils.clamp(this.playerZ + vz * dt, -285, 285);

      const absFoot = Math.abs(this.playerSpeed);
      if (absFoot > 0.8 && this.isGrounded) {
        this.hoofStepAccum += absFoot * dt;
        if (this.hoofStepAccum >= 2.2) {
          this.hoofStepAccum = 0;
          this.sound.playFootstep(isWaterAt(this.playerX, this.playerZ));
        }
      }

      if (this.horseSummoning) {
        const dx = this.playerX - this.horseX;
        const dz = this.playerZ - this.horseZ;
        const dist = Math.hypot(dx, dz);
        if (dist > 3.2) {
          this.horseHeading = Math.atan2(dx, dz);
          this.horseSpeed = THREE.MathUtils.damp(this.horseSpeed, 18.0, 5, dt);
          this.horseX += Math.sin(this.horseHeading) * this.horseSpeed * dt;
          this.horseZ += Math.cos(this.horseHeading) * this.horseSpeed * dt;
          this.horseY = walkableHeightAt(this.horseX, this.horseZ);
        } else {
          this.horseSpeed = 0;
          this.horseSummoning = false;
        }
      } else {
        this.horseSpeed = THREE.MathUtils.damp(this.horseSpeed, 0, 5, dt);
      }
    }

    const groundY = walkableHeightAt(this.playerX, this.playerZ);
    if (!this.isGrounded) {
      this.playerY += this.playerVelY * dt;
      this.playerVelY -= 22.0 * dt;
      if (this.playerY <= groundY) {
        this.playerY = groundY;
        this.playerVelY = 0;
        this.isGrounded = true;
      }
    } else {
      this.playerY = groundY;
    }

    if (this.isMounted) {
      this.horseY = this.playerY;
    } else {
      this.horseY = walkableHeightAt(this.horseX, this.horseZ);
    }

    const terr = getTerritoryDetailsAt(this.playerX, this.playerZ);
    if (terr.regionName !== this.lastRegionName) {
      this.lastRegionName = terr.regionName;
      this.triggerWorldAlert(terr.regionName, terr.bannerSubtitle, 'territory');
    }

    if (
      Math.hypot(this.playerX - -75, this.playerZ - 45) < 48 ||
      Math.hypot(this.playerX - 104, this.playerZ - 68) < 35
    ) {
      this.playerHp = Math.min(this.playerMaxHp, this.playerHp + dt * 5.0);
    }

    this.syncActorTransforms(dt);
  }

  private syncActorTransforms(dt: number): void {
    const absHorseSpeed = Math.abs(this.horseSpeed);
    const absPlayerSpeed = Math.abs(this.playerSpeed);
    this.animCycle += dt * (2.2 + Math.max(absHorseSpeed, absPlayerSpeed) * 0.68);

    this.horseRig.group.position.set(this.horseX, this.horseY, this.horseZ);
    this.horseRig.group.rotation.y = this.horseHeading;

    const frontY = walkableHeightAt(
      this.horseX + Math.sin(this.horseHeading) * 1.1,
      this.horseZ + Math.cos(this.horseHeading) * 1.1
    );
    const backY = walkableHeightAt(
      this.horseX - Math.sin(this.horseHeading) * 1.1,
      this.horseZ - Math.cos(this.horseHeading) * 1.1
    );
    const slopePitch = THREE.MathUtils.clamp((backY - frontY) * 0.35, -0.38, 0.38);

    const gaitAmp = THREE.MathUtils.clamp(absHorseSpeed / 16.0, 0, 1.15);
    const jumpPitch = this.isGrounded && this.isMounted ? 0 : -this.playerVelY * 0.035;

    this.horseRig.bodyGroup.position.y =
      1.32 + Math.abs(Math.sin(this.animCycle * 2)) * 0.08 * gaitAmp;
    this.horseRig.bodyGroup.rotation.x =
      slopePitch + jumpPitch + Math.sin(this.animCycle * 2) * 0.055 * gaitAmp;

    this.horseRig.neckPivot.rotation.x =
      Math.sin(this.animCycle * 2 - 0.6) * 0.14 * gaitAmp +
      (gaitAmp < 0.05 ? Math.sin(this.waterShaderUniforms.uTime.value * 1.6) * 0.04 : 0);

    this.horseRig.tailPivot.rotation.x = 0.15 + gaitAmp * 0.38;
    this.horseRig.tailPivot.rotation.z = Math.sin(this.animCycle * 1.5) * (0.08 + gaitAmp * 0.16);

    const phases = [0, 0.95, 2.9, 3.85];
    this.horseRig.legs.forEach((leg, i) => {
      const p = this.animCycle * 2.1 + phases[i];
      const swing = Math.sin(p) * 0.68 * gaitAmp;
      leg.rotation.x = swing;
      const kneeFold = Math.max(0, -Math.cos(p)) * 0.72 * gaitAmp;
      this.horseRig.lowerLegs[i].rotation.x = i < 2 ? kneeFold : -kneeFold * 0.6;
    });

    if (this.isMounted) {
      this.horseRig.group.updateMatrixWorld(true);
      this.horseRig.saddleMountPoint.getWorldPosition(_v1);
      this.playerRig.group.position.copy(_v1);
      this.playerRig.group.position.y -= 0.78;
      this.playerRig.group.rotation.y = this.horseHeading;

      this.playerRig.leftLegPivot.rotation.set(-0.42, 0, 0.34);
      this.playerRig.rightLegPivot.rotation.set(-0.42, 0, -0.34);
      this.playerRig.torsoPivot.rotation.x = gaitAmp * 0.18;
    } else {
      this.playerRig.group.position.set(this.playerX, this.playerY, this.playerZ);
      this.playerRig.group.rotation.y = this.playerHeading;

      const walkAmp = THREE.MathUtils.clamp(absPlayerSpeed / 8.5, 0, 1);
      this.playerRig.hipsPivot.position.y =
        0.92 + Math.abs(Math.sin(this.animCycle * 2.2)) * 0.06 * walkAmp;
      this.playerRig.leftLegPivot.rotation.set(
        Math.sin(this.animCycle * 2.2) * 0.62 * walkAmp,
        0,
        0
      );
      this.playerRig.rightLegPivot.rotation.set(
        -Math.sin(this.animCycle * 2.2) * 0.62 * walkAmp,
        0,
        0
      );
      this.playerRig.torsoPivot.rotation.x = walkAmp * 0.1;
    }

    const activeSpeed = this.isMounted ? absHorseSpeed : absPlayerSpeed;
    this.playerRig.capeMesh.rotation.x =
      0.16 +
      THREE.MathUtils.clamp(activeSpeed / 18, 0, 0.95) +
      Math.sin(this.waterShaderUniforms.uTime.value * 9) * (0.04 + activeSpeed * 0.008);

    if (this.attackTimer > 0) {
      const prog = 1 - this.attackTimer / 0.35;
      const swingAngle = Math.sin(prog * Math.PI) * 1.85;
      this.playerRig.rightArmPivot.rotation.set(-0.85 + swingAngle * 0.5, -0.6 + swingAngle, 0);
      this.playerRig.torsoPivot.rotation.y = Math.sin(prog * Math.PI) * 0.38;
    } else if (this.weapon === 'bow' && this.isDrawingBow) {
      this.playerRig.rightArmPivot.rotation.set(-1.35, 0.15, 0);
      this.playerRig.leftArmPivot.rotation.set(-1.35, -0.35, 0);
      this.playerRig.torsoPivot.rotation.y = 0;
    } else if (this.weapon === 'lance' && this.isMounted && absHorseSpeed > 13) {
      this.playerRig.rightArmPivot.rotation.set(-1.42, 0, 0);
      this.playerRig.torsoPivot.rotation.y = 0;
    } else {
      const armSwing = this.isMounted
        ? Math.sin(this.animCycle * 2) * 0.12 * gaitAmp
        : -Math.sin(this.animCycle * 2.2) * 0.35 * THREE.MathUtils.clamp(absPlayerSpeed / 8, 0, 1);
      this.playerRig.rightArmPivot.rotation.set(-0.25 + armSwing, 0, -0.12);
      this.playerRig.torsoPivot.rotation.y = 0;

      if (this.isBlocking) {
        this.playerRig.leftArmPivot.rotation.set(-0.95, -0.65, 0);
      } else {
        this.playerRig.leftArmPivot.rotation.set(-0.2 - armSwing, 0, 0.12);
      }
    }
  }

  private updateTacticalSoldiersAndAlps(dt: number): void {
    this.alliedAlps.forEach((alp) => {
      if (alp.attackCooldown > 0) alp.attackCooldown -= dt;

      let targetEnemy: EnemyActor | null = null;
      let bestDist = 24;
      for (const e of this.enemies) {
        if (e.state === 'dead') continue;
        const d = Math.hypot(e.x - alp.x, e.z - alp.z);
        if (d < bestDist) {
          bestDist = d;
          targetEnemy = e;
        }
      }

      let moveSpeed = 0;
      if (targetEnemy) {
        const dx = targetEnemy.x - alp.x;
        const dz = targetEnemy.z - alp.z;
        alp.heading = Math.atan2(dx, dz);

        if (bestDist > 2.4) {
          moveSpeed = 8.2;
          alp.x += Math.sin(alp.heading) * moveSpeed * dt;
          alp.z += Math.cos(alp.heading) * moveSpeed * dt;
        } else if (alp.attackCooldown <= 0) {
          alp.attackCooldown = 1.15;
          alp.rig.rightArmPivot.rotation.x = -1.6;
          this.damageEnemy(targetEnemy, 22, false);
        }
      } else if (this.alpRetinueFollowing) {
        const formAngle = this.playerHeading + alp.formationOffsetAngle;
        const goalX = this.playerX + Math.sin(formAngle) * 4.6;
        const goalZ = this.playerZ + Math.cos(formAngle) * 4.6;
        const dx = goalX - alp.x;
        const dz = goalZ - alp.z;
        const dist = Math.hypot(dx, dz);

        if (dist > 1.8) {
          alp.heading = Math.atan2(dx, dz);
          moveSpeed = Math.min(16.5, 4.5 + dist * 1.4);
          alp.x += Math.sin(alp.heading) * moveSpeed * dt;
          alp.z += Math.cos(alp.heading) * moveSpeed * dt;
        } else {
          alp.heading = this.playerHeading;
        }
      } else {
        alp.animPhase += dt * 0.5;
      }

      alp.y = walkableHeightAt(alp.x, alp.z);
      alp.rig.group.position.set(alp.x, alp.y, alp.z);
      alp.rig.group.rotation.y = alp.heading;

      if (moveSpeed > 0.4) {
        alp.animPhase += dt * moveSpeed * 1.1;
        const legSwing = Math.sin(alp.animPhase) * 0.55;
        alp.rig.leftLegPivot.rotation.x = legSwing;
        alp.rig.rightLegPivot.rotation.x = -legSwing;
      } else {
        alp.rig.leftLegPivot.rotation.x = 0;
        alp.rig.rightLegPivot.rotation.x = 0;
      }
      alp.rig.rightArmPivot.rotation.x = THREE.MathUtils.damp(
        alp.rig.rightArmPivot.rotation.x,
        -0.25,
        6,
        dt
      );
    });

    const playerVx = Math.sin(this.playerHeading) * this.playerSpeed;
    const playerVz = Math.cos(this.playerHeading) * this.playerSpeed;

    this.enemies.forEach((e, idx) => {
      if (e.state === 'dead') {
        e.stateTimer += dt;
        e.rig.group.rotation.x = THREE.MathUtils.damp(e.rig.group.rotation.x, -Math.PI / 2, 6, dt);
        e.rig.group.position.y = e.y + 0.25;
        if (e.horseRig) {
          e.horseRig.group.visible = false;
        }
        return;
      }

      if (e.hitFlashTimer > 0) {
        e.hitFlashTimer -= dt;
      }

      const dx = this.playerX - e.x;
      const dz = this.playerZ - e.z;
      const distToPlayer = Math.hypot(dx, dz);
      const angleToPlayer = Math.atan2(dx, dz);

      let sepX = 0;
      let sepZ = 0;
      for (let j = 0; j < this.enemies.length; j++) {
        if (idx === j) continue;
        const other = this.enemies[j];
        if (other.state === 'dead') continue;
        const odx = e.x - other.x;
        const odz = e.z - other.z;
        const odist = Math.hypot(odx, odz);
        if (odist < 2.8 && odist > 0.01) {
          sepX += (odx / odist) * (2.8 - odist) * 3.2;
          sepZ += (odz / odist) * (2.8 - odist) * 3.2;
        }
      }

      const tMat = e.rig.telegraphRing.material as THREE.MeshBasicMaterial;
      const attackRange = e.archetype === 'marksman' ? 25 : e.horseRig ? 3.9 : 3.0;

      e.isBlocking = false;

      if (e.state === 'patrol') {
        tMat.opacity = 0;
        e.tactic = 'Patrolling';
        e.patrolAngle += dt * 0.45;
        const tx = e.homeX + Math.sin(e.patrolAngle) * 7.5;
        const tz = e.homeZ + Math.cos(e.patrolAngle) * 7.5;
        e.heading = Math.atan2(tx - e.x, tz - e.z);
        const pSpeed = e.horseRig ? 4.2 : 2.2;
        e.x += Math.sin(e.heading) * pSpeed * dt;
        e.z += Math.cos(e.heading) * pSpeed * dt;

        if (distToPlayer < 35) {
          e.state = 'chase';
          if (e.archetype === 'captain') {
            this.enemies.forEach((ally) => {
              if (ally.state === 'patrol' && Math.hypot(ally.x - e.x, ally.z - e.z) < 30) {
                ally.state = 'chase';
              }
            });
          }
        }
      } else if (e.state === 'chase') {
        tMat.opacity = 0;

        if (distToPlayer > 52) {
          e.state = 'patrol';
        } else if (e.archetype === 'marksman' && distToPlayer < 12.5) {
          e.tactic = 'Tactical Retreat';
          e.heading = angleToPlayer + Math.PI + e.flankSign * 0.4;
          const retreatSpeed = e.horseRig ? 10.5 : 5.6;
          e.x += (Math.sin(e.heading) * retreatSpeed + sepX) * dt;
          e.z += (Math.cos(e.heading) * retreatSpeed + sepZ) * dt;
        } else if (distToPlayer <= attackRange) {
          e.state = 'windup';
          e.stateTimer = 0;
        } else {
          if (e.archetype === 'raider' && e.horseRig) {
            e.tactic = 'Cavalry Charge';
            e.heading = angleToPlayer + e.flankSign * 0.18;
            const chargeSpeed = 11.2;
            e.x += (Math.sin(e.heading) * chargeSpeed + sepX) * dt;
            e.z += (Math.cos(e.heading) * chargeSpeed + sepZ) * dt;
          } else if (e.archetype === 'vanguard' || e.archetype === 'captain') {
            if (
              (this.weapon === 'bow' && this.isDrawingBow) ||
              (distToPlayer > 5.5 && distToPlayer < 15)
            ) {
              e.isBlocking = true;
              e.tactic = 'Shield Wall';
            } else {
              e.tactic = e.flankSign > 0 ? 'Flanking Right' : 'Flanking Left';
            }
            const flankOffset = distToPlayer > 4.5 ? e.flankSign * 0.42 : 0;
            e.heading = angleToPlayer + flankOffset;
            const walkSpeed = e.isBlocking ? 3.8 : 5.6;
            e.x += (Math.sin(e.heading) * walkSpeed + sepX) * dt;
            e.z += (Math.cos(e.heading) * walkSpeed + sepZ) * dt;
          } else {
            e.tactic = 'Kiting & Aiming';
            e.heading = angleToPlayer;
            e.x += (Math.sin(e.heading) * 4.8 + sepX) * dt;
            e.z += (Math.cos(e.heading) * 4.8 + sepZ) * dt;
          }
        }
      } else if (e.state === 'windup') {
        e.tactic = e.archetype === 'marksman' ? 'Kiting & Aiming' : 'Striking';
        e.heading = angleToPlayer;
        e.stateTimer += dt;
        const windupProgress = Math.min(1, e.stateTimer / e.windupDuration);

        if (e.archetype === 'marksman') {
          const strafeAngle = angleToPlayer + (Math.PI / 2) * e.flankSign;
          const strafeSpeed = e.horseRig ? 6.5 : 2.8;
          e.x += Math.sin(strafeAngle) * strafeSpeed * dt;
          e.z += Math.cos(strafeAngle) * strafeSpeed * dt;
        }

        tMat.opacity = 0.35 + windupProgress * 0.55;
        e.rig.telegraphRing.scale.setScalar(1.35 - windupProgress * 0.35);
        e.rig.rightArmPivot.rotation.x = -2.1 * windupProgress;

        if (e.stateTimer >= e.windupDuration) {
          tMat.opacity = 0;
          if (e.archetype === 'marksman') {
            this.firePredictiveEnemyArrow(e, playerVx, playerVz);
          } else if (distToPlayer <= attackRange + 1.2) {
            this.applyDamageToPlayer(e.archetype === 'captain' ? 18 : 11, e.name);
          }
          e.state = e.horseRig ? 'charge_pass' : 'recover';
          e.stateTimer = e.horseRig ? 1.35 : 0.9;
        }
      } else if (e.state === 'charge_pass') {
        tMat.opacity = 0;
        e.tactic = 'Cavalry Charge';
        e.stateTimer -= dt;
        e.heading += e.flankSign * 1.15 * dt;
        e.x += Math.sin(e.heading) * 10.5 * dt;
        e.z += Math.cos(e.heading) * 10.5 * dt;
        if (e.stateTimer <= 0) {
          e.state = 'chase';
        }
      } else if (e.state === 'recover') {
        tMat.opacity = 0;
        e.stateTimer -= dt;
        if (e.hp < e.maxHp * 0.35) {
          e.isBlocking = true;
          e.tactic = 'Shield Wall';
        }
        e.rig.rightArmPivot.rotation.x = THREE.MathUtils.damp(
          e.rig.rightArmPivot.rotation.x,
          -0.25,
          6,
          dt
        );
        if (e.stateTimer <= 0) {
          e.state = 'chase';
        }
      }

      if (e.isBlocking) {
        e.rig.leftArmPivot.rotation.set(-0.95, -0.65, 0);
      } else {
        e.rig.leftArmPivot.rotation.set(-0.2, 0, 0.12);
      }

      e.y = walkableHeightAt(e.x, e.z);
      e.animPhase += dt * (e.state === 'chase' || e.state === 'charge_pass' ? 8.5 : 4.2);

      if (e.horseRig) {
        e.horseRig.group.visible = true;
        e.horseRig.group.position.set(e.x, e.y, e.z);
        e.horseRig.group.rotation.y = e.heading;
        e.horseRig.legs.forEach((leg, lIdx) => {
          leg.rotation.x = Math.sin(e.animPhase + lIdx * 1.4) * 0.48;
        });
        e.rig.group.position.set(e.x, e.y + 1.05, e.z);
        e.rig.group.rotation.y = e.heading;
      } else {
        e.rig.group.position.set(e.x, e.y, e.z);
        e.rig.group.rotation.y = e.heading;
        const swing = e.state === 'windup' ? 0 : Math.sin(e.animPhase) * 0.45;
        e.rig.leftLegPivot.rotation.x = swing;
        e.rig.rightLegPivot.rotation.x = -swing;
      }
    });
  }

  private firePredictiveEnemyArrow(
    enemy: EnemyActor,
    playerVx: number,
    playerVz: number
  ): void {
    const arrow = this.arrowsPool.find((a) => !a.active);
    if (!arrow) return;
    arrow.active = true;
    arrow.fromPlayer = false;
    arrow.life = 2.5;
    arrow.mesh.visible = true;

    const sx = enemy.x;
    const sy = enemy.y + (enemy.horseRig ? 2.1 : 1.45);
    const sz = enemy.z;
    const speed = 29;

    const rawDist = Math.max(1, Math.hypot(this.playerX - sx, this.playerZ - sz));
    const flightTime = rawDist / speed;

    const leadX = this.playerX + playerVx * flightTime * 0.65;
    const leadZ = this.playerZ + playerVz * flightTime * 0.65;

    const dx = leadX - sx;
    const dz = leadZ - sz;
    const dist = Math.max(1, Math.hypot(dx, dz));

    arrow.pos.set(sx, sy, sz);
    arrow.vel.set(
      (dx / dist) * speed,
      ((this.playerY + 1.25 - sy) / dist) * speed + 2.2,
      (dz / dist) * speed
    );
  }

  private applyDamageToPlayer(dmg: number, sourceName: string): void {
    const eqStats = this.getEquineLoadoutStats();
    const bardingMitigation = this.isMounted ? 1 - eqStats.armorDefenseBonus * 0.008 : 1.0;

    if (this.isBlocking) {
      const blockedDmg = Math.max(1, Math.round(dmg * 0.18 * bardingMitigation));
      this.playerHp = Math.max(0, this.playerHp - blockedDmg);
      this.playerStamina = Math.max(0, this.playerStamina - 10);
      this.sound.playShieldBlock();
      this.pushFeed(`Blocked ${sourceName}'s strike!`, 'block');
      return;
    }

    const mitigatedDmg = Math.max(2, Math.round(dmg * bardingMitigation));
    this.playerHp = Math.max(0, this.playerHp - mitigatedDmg);
    this.shakeIntensity = Math.min(0.5, this.shakeIntensity + 0.28);
    this.sound.playSteelImpact(false);
    this.spawnParticles(this.playerX, this.playerY + 1.3, this.playerZ, 0xef4444, 7);

    if (this.playerHp <= 0) {
      this.phase = 'gameover';
      this.emitHudState();
    }
  }

  private updateProjectilesAndParticles(dt: number): void {
    this.arrowsPool.forEach((a) => {
      if (!a.active) return;
      a.life -= dt;
      if (a.life <= 0) {
        a.active = false;
        a.mesh.visible = false;
        return;
      }

      a.vel.y -= 13.5 * dt;
      a.pos.addScaledVector(a.vel, dt);
      a.mesh.position.copy(a.pos);

      _v1.copy(a.pos).add(a.vel);
      a.mesh.lookAt(_v1);

      const groundY = walkableHeightAt(a.pos.x, a.pos.z);
      if (a.pos.y <= groundY) {
        a.active = false;
        a.mesh.visible = false;
        this.spawnParticles(a.pos.x, groundY + 0.1, a.pos.z, 0xd6c7b2, 4);
        return;
      }

      if (a.fromPlayer) {
        for (const t of this.archeryTargets) {
          if (
            Math.hypot(a.pos.x - t.x, a.pos.z - t.z) < 1.0 &&
            Math.abs(a.pos.y - (groundHeightAt(t.x, t.z) + 1.35)) < 1.1
          ) {
            a.active = false;
            a.mesh.visible = false;
            this.sound.playSteelImpact(true);
            this.spawnParticles(a.pos.x, a.pos.y, a.pos.z, 0xfbbf24, 10);
            this.honorScore += 25;
            this.pushFeed('Bullseye on Kayı Archery Target! (+25 Honor)', 'crit');
            break;
          }
        }

        for (const e of this.enemies) {
          if (e.state === 'dead') continue;
          const targetCenterY = e.y + (e.horseRig ? 1.85 : 1.2);
          if (
            Math.hypot(a.pos.x - e.x, a.pos.z - e.z) < 1.15 &&
            Math.abs(a.pos.y - targetCenterY) < 1.35
          ) {
            a.active = false;
            a.mesh.visible = false;
            const isHeadshot = a.pos.y > targetCenterY + 0.35;
            this.damageEnemy(e, isHeadshot ? 62 : 38, isHeadshot);
            break;
          }
        }
      } else {
        const playerCenterY = this.playerY + (this.isMounted ? 1.85 : 1.15);
        if (
          Math.hypot(a.pos.x - this.playerX, a.pos.z - this.playerZ) < 1.05 &&
          Math.abs(a.pos.y - playerCenterY) < 1.25
        ) {
          a.active = false;
          a.mesh.visible = false;
          this.applyDamageToPlayer(12, 'Marksman Arrow');
        }
      }
    });

    this.particlesPool.forEach((p) => {
      if (!p.active) return;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        p.mesh.visible = false;
        return;
      }
      p.vel.y -= 12 * dt;
      p.pos.addScaledVector(p.vel, dt);
      p.mesh.position.copy(p.pos);
      const t = 1 - p.life / p.maxLife;
      p.mesh.scale.setScalar(p.scale * t);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = t * 0.85;
    });
  }

  private updateGameplayCamera(dt: number): void {
    let dist = 8.4;
    let height = 3.35;
    if (this.cameraPreset === 'close') {
      dist = 5.6;
      height = 2.55;
    } else if (this.cameraPreset === 'far') {
      dist = 13.0;
      height = 5.2;
    } else if (this.cameraPreset === 'cinematic') {
      dist = 10.5;
      height = 2.8;
    }

    const totalYaw =
      this.playerHeading +
      this.camYawOffset +
      (this.cameraPreset === 'cinematic' ? 0.42 : 0);

    const idealX =
      this.playerX - Math.sin(totalYaw) * dist * Math.cos(this.camPitch);
    const idealZ =
      this.playerZ - Math.cos(totalYaw) * dist * Math.cos(this.camPitch);
    const minTerrainY = walkableHeightAt(idealX, idealZ) + 0.95;
    const idealY = Math.max(
      minTerrainY,
      this.playerY + height + Math.sin(this.camPitch) * dist * 0.65
    );

    _camIdealPos.set(idealX, idealY, idealZ);
    _camIdealLook.set(
      this.playerX + Math.sin(this.playerHeading) * 2.2,
      this.playerY + (this.isMounted ? 2.15 : 1.45),
      this.playerZ + Math.cos(this.playerHeading) * 2.2
    );

    const lerpAlpha = 1 - Math.exp(-9.5 * dt);
    this.currentCamPos.lerp(_camIdealPos, lerpAlpha);
    this.currentCamLook.lerp(_camIdealLook, lerpAlpha);

    if (this.shakeIntensity > 0.005) {
      this.shakeIntensity = Math.max(0, this.shakeIntensity - dt * 1.8);
      this.camera.position.set(
        this.currentCamPos.x + (Math.random() - 0.5) * this.shakeIntensity,
        this.currentCamPos.y + (Math.random() - 0.5) * this.shakeIntensity,
        this.currentCamPos.z + (Math.random() - 0.5) * this.shakeIntensity
      );
    } else {
      this.camera.position.copy(this.currentCamPos);
    }

    this.camera.lookAt(this.currentCamLook);

    const speedRatio = Math.min(1, Math.abs(this.playerSpeed) / 22.0);
    const targetFov = this.isDrawingBow ? 46 : 58 + speedRatio * 11;
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 6, dt);
    this.camera.updateProjectionMatrix();
  }

  private emitHudState(): void {
    const absSpeed = Math.abs(this.playerSpeed);
    const speedKmh = Math.round(absSpeed * 2.2);
    const eqStats = this.getEquineLoadoutStats();
    const maxSpeedKmh = this.isMounted ? 48 + eqStats.gallopBonusKmh : 23;

    let gaitLabel: HudState['gaitLabel'] = 'Idle';
    if (this.isMounted) {
      if (absSpeed > 15.5) gaitLabel = 'Gallop';
      else if (absSpeed > 10.5) gaitLabel = 'Canter';
      else if (absSpeed > 5.0) gaitLabel = 'Trot';
      else if (absSpeed > 0.6) gaitLabel = 'Walk';
    } else {
      if (absSpeed > 7.5) gaitLabel = 'Sprint';
      else if (absSpeed > 0.6) gaitLabel = 'Walk';
    }

    const distToHorse = Math.hypot(
      this.playerX - this.horseX,
      this.playerZ - this.horseZ
    );

    const nearestEnemy = this.findNearestEnemy(36);
    let lockedEnemy: EnemyInfo | null = null;
    if (nearestEnemy) {
      lockedEnemy = {
        id: nearestEnemy.id,
        name: nearestEnemy.name,
        faction: nearestEnemy.faction,
        archetype: nearestEnemy.archetype,
        tactic: nearestEnemy.tactic,
        hp: nearestEnemy.hp,
        maxHp: nearestEnemy.maxHp,
        isMounted: Boolean(nearestEnemy.horseRig),
        isBlocking: nearestEnemy.isBlocking,
        windupProgress:
          nearestEnemy.state === 'windup'
            ? Math.min(1, nearestEnemy.stateTimer / nearestEnemy.windupDuration)
            : 0,
      };
    }

    const activeQuest = this.quests[this.currentQuestIdx] || this.quests[0];
    const headingDeg = Math.round(
      THREE.MathUtils.euclideanModulo(
        THREE.MathUtils.radToDeg(this.playerHeading),
        360
      )
    );

    const terr = getTerritoryDetailsAt(this.playerX, this.playerZ);

    const mapPoints: HudState['mapPoints'] = [
      { id: 'oba', x: -75, z: 45, type: 'village', label: 'Kayı Oba' },
      { id: 'waterfall', x: 24, z: -100, type: 'waterfall', label: 'Çağlayan Falls' },
      { id: 'lake', x: 52, z: 82, type: 'lake', label: 'Söğüt Lake' },
      { id: 'bazaar', x: 104, z: 68, type: 'caravanserai', label: 'Hanlı Pazar' },
      { id: 'tower', x: 115, z: -65, type: 'tower', label: 'Karacahisar' },
      { id: 'pass', x: -35, z: -165, type: 'pass', label: 'Karadağ Pass' },
      {
        id: 'quest',
        x: activeQuest.targetX,
        z: activeQuest.targetZ,
        type: 'quest',
        label: activeQuest.title,
      },
    ];

    if (!this.isMounted) {
      mapPoints.push({
        id: 'horse',
        x: this.horseX,
        z: this.horseZ,
        type: 'horse',
        label: 'Aktolgali',
      });
    }

    this.alliedAlps.forEach((alp) => {
      mapPoints.push({
        id: alp.id,
        x: alp.x,
        z: alp.z,
        type: 'ally',
        label: alp.name,
      });
    });

    this.enemies.forEach((e) => {
      if (e.state !== 'dead') {
        mapPoints.push({
          id: e.id,
          x: e.x,
          z: e.z,
          type: 'enemy',
          label: e.name,
        });
      }
    });

    this.onHudUpdate({
      phase: this.phase,
      playerHp: Math.round(this.playerHp),
      playerMaxHp: this.playerMaxHp,
      playerStamina: Math.round(this.playerStamina),
      playerMaxStamina: this.playerMaxStamina,
      horseStamina: Math.round(this.horseStamina),
      horseMaxStamina: this.horseMaxStamina,
      equineLoadout: eqStats,
      isMounted: this.isMounted,
      canMountNearby: !this.isMounted && distToHorse <= 6.5,
      distanceToHorse: Math.round(distToHorse),
      speedKmh,
      maxSpeedKmh,
      gaitLabel,
      weapon: this.weapon,
      arrowsCount: this.arrowsCount,
      honorScore: this.honorScore,
      enemiesDefeated: this.enemiesDefeated,
      tribePopulation: this.tribePopulation,
      childrenCount: this.childrenCount,
      nearbyBuilding: this.findNearbyBuilding(),
      activeInterior: this.activeInterior,
      alpRetinueFollowing: this.alpRetinueFollowing,
      activeAlpsCount: this.alliedAlps.length,
      timeOfDay: this.timeOfDay,
      timeScale: this.timeScale,
      weather: this.weather,
      cameraPreset: this.cameraPreset,
      regionName: terr.regionName,
      territoryFaction: terr.faction,
      compassHeading: headingDeg,
      playerPos: { x: Math.round(this.playerX), z: Math.round(this.playerZ) },
      horsePos: { x: Math.round(this.horseX), z: Math.round(this.horseZ) },
      activeQuest,
      questIndex: this.currentQuestIdx,
      totalQuests: this.quests.length,
      lockedEnemy,
      combatFeed: [...this.combatFeed],
      worldAlert: this.worldAlert,
      isBlocking: this.isBlocking,
      bowCharge: this.bowCharge,
      isMuted: this.sound.isMuted,
      dockCollapsed: this.dockCollapsed,
      showTouchControls: this.showTouchControls,
      mapPoints,
    });
  }

  public dispose(): void {
    this.isDisposed = true;
    cancelAnimationFrame(this.animFrameId);
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    this.renderer.dispose();
  }
}
