import React, { useEffect, useRef, useState } from 'react';
import {
  Compass,
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronUp,
  Sun,
  CloudRain,
  Snowflake,
  CloudFog,
  Pause,
  RotateCcw,
  Users,
  Gamepad2,
  MapPin,
  Shield,
  Sliders,
  Home,
  Heart,
  Sparkles,
  X,
} from 'lucide-react';
import { WorldEngine } from './game/WorldEngine';
import {
  CameraPreset,
  HorseArmorType,
  HorseSaddleType,
  HudState,
  WeaponType,
  WeatherType,
} from './game/types';

const INITIAL_HUD: HudState = {
  phase: 'title',
  playerHp: 100,
  playerMaxHp: 100,
  playerStamina: 100,
  playerMaxStamina: 100,
  horseStamina: 135,
  horseMaxStamina: 135,
  equineLoadout: {
    armor: 'kayi_leather',
    saddle: 'kayi_chieftain',
    armorLabel: 'Kayı Studded Leather',
    saddleLabel: 'Kayı Chieftain Brass Saddle',
    staminaRegenPerSec: 21,
    maxStamina: 135,
    gallopBonusKmh: 2,
    armorDefenseBonus: 12,
  },
  isMounted: true,
  canMountNearby: false,
  distanceToHorse: 0,
  speedKmh: 0,
  maxSpeedKmh: 50,
  gaitLabel: 'Idle',
  weapon: 'kilij',
  arrowsCount: 36,
  honorScore: 150,
  enemiesDefeated: 0,
  tribePopulation: 64,
  childrenCount: 14,
  nearbyBuilding: null,
  activeInterior: null,
  alpRetinueFollowing: true,
  activeAlpsCount: 3,
  timeOfDay: 9.5,
  timeScale: 1,
  weather: 'clear',
  cameraPreset: 'chase',
  regionName: 'Kayı Oba Encampment',
  territoryFaction: 'Kayı Tribe Territory',
  compassHeading: 135,
  playerPos: { x: -46, z: 22 },
  horsePos: { x: -46, z: 22 },
  activeQuest: {
    id: 'q1',
    title: 'Vanguard of the Sakarya',
    subtitle:
      'Cross the Sakarya timber bridge and defeat the Byzantine River Patrol guarding the eastern ford.',
    targetX: 48,
    targetZ: -8,
    progress: 0,
    goal: 3,
    completed: false,
    rewardHonor: 250,
  },
  questIndex: 0,
  totalQuests: 3,
  lockedEnemy: null,
  combatFeed: [],
  worldAlert: null,
  isBlocking: false,
  bowCharge: 0,
  isMuted: false,
  dockCollapsed: false,
  showTouchControls: false,
  mapPoints: [],
};

const ARMOR_OPTIONS: Array<{
  id: HorseArmorType;
  name: string;
  desc: string;
  regenText: string;
  defText: string;
}> = [
  {
    id: 'unarmored',
    name: 'Nomadic Steppe Unarmored',
    desc: 'Ultra-lightweight Oghuz bridle for maximum agility and rapid wind recovery.',
    regenText: '+4/s Regen',
    defText: '+3 km/h Speed',
  },
  {
    id: 'kayi_leather',
    name: 'Kayı Studded Leather Barding',
    desc: 'Traditional turquoise-trimmed boiled leather chest & flank plates.',
    regenText: '+1/s Regen',
    defText: '+12 Armor',
  },
  {
    id: 'seljuk_scale',
    name: 'Seljuk Bronze Scale Armor',
    desc: 'Burnished Anatolian bronze lamellar plates with high endurance.',
    regenText: '-2/s Regen',
    defText: '+28 Armor · +20 Stam',
  },
  {
    id: 'cataphract_steel',
    name: 'Imperial Cataphract Steel',
    desc: 'Full fluted Damascus steel war-barding and chanfron face plate.',
    regenText: '-4/s Regen',
    defText: '+45 Armor · +35 Stam',
  },
];

const SADDLE_OPTIONS: Array<{
  id: HorseSaddleType;
  name: string;
  desc: string;
  regenBadge: string;
}> = [
  {
    id: 'nomad_light',
    name: 'Steppe Nomad Light Saddle',
    desc: 'Breathable felt blanket & light stirrups maximizing stamina regeneration.',
    regenBadge: '24/s Base Regen',
  },
  {
    id: 'kayi_chieftain',
    name: 'Kayı Chieftain Brass Saddle',
    desc: 'Balanced Beylic war saddle with reinforced pommel for cavalry charges.',
    regenBadge: '20/s Base Regen · +15 Stam',
  },
  {
    id: 'royal_velvet',
    name: 'Seljuk Royal Velvet Saddle',
    desc: 'Deep quilted crimson velvet saddle granting massive reserve stamina.',
    regenBadge: '17/s Base Regen · +35 Stam',
  },
];

function KayiTamgaSvg({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="4.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M14 14 L14 50 M14 26 L26 14" />
      <path d="M32 12 L32 52 M22 24 L32 12 L42 24 M23 36 L41 36" />
      <path d="M50 14 L50 50 M50 26 L38 14" />
    </svg>
  );
}

function WeaponIconSvg({ type, className = 'w-4 h-4' }: { type: WeaponType; className?: string }) {
  if (type === 'kilij') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
        <path d="M14.5 17.5L3 6V3h3l11.5 11.5" />
        <path d="M13 19l6-6" />
        <path d="M16 16l4 4" />
        <path d="M19 21l2-2" />
      </svg>
    );
  }
  if (type === 'bow') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
        <path d="M4 20 C14 18 18 14 20 4" />
        <line x1="4" y1="20" x2="20" y2="4" />
        <line x1="8" y1="8" x2="19" y2="19" />
        <polyline points="15 19 19 19 19 15" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <line x1="3" y1="21" x2="21" y2="3" />
      <polygon points="21 3 15 5 19 9 21 3" />
    </svg>
  );
}

/**
 * Circular Speedometer Dial with Dashed Aesthetic matching the Kayı UI
 */
function DashedSpeedometerDial({
  speedKmh,
  maxSpeedKmh,
  gaitLabel,
  isMounted,
}: {
  speedKmh: number;
  maxSpeedKmh: number;
  gaitLabel: HudState['gaitLabel'];
  isMounted: boolean;
}) {
  const ratio = Math.min(1, Math.max(0, speedKmh / Math.max(1, maxSpeedKmh)));
  const radius = 28;
  const arcSpanDeg = 250;
  const currentAngleDeg = -125 + ratio * arcSpanDeg;
  const isGalloping = gaitLabel === 'Gallop' || gaitLabel === 'Sprint';

  return (
    <div
      className="relative flex flex-col items-center justify-center w-[76px] h-[76px] shrink-0 bg-[#120F0CE6] border border-[#D4AF374D] rounded-lg select-none"
      title="Current Gallop Velocity"
    >
      <svg viewBox="0 0 76 76" className="w-full h-full overflow-visible">
        <circle
          cx="38"
          cy="39"
          r={radius}
          fill="none"
          stroke="rgba(212, 175, 55, 0.24)"
          strokeWidth="3.5"
          strokeDasharray="4 3"
          transform="rotate(145 38 39)"
        />
        <circle
          cx="38"
          cy="39"
          r={radius}
          fill="none"
          stroke={isGalloping ? '#F59E0B' : '#0EA5E9'}
          strokeWidth="4"
          strokeDasharray="4 3"
          strokeDashoffset={176 * (1 - ratio * 0.72)}
          transform="rotate(145 38 39)"
          className="transition-all duration-100"
        />
        <circle
          cx="38"
          cy="39"
          r="21"
          fill="none"
          stroke="rgba(244, 239, 230, 0.14)"
          strokeWidth="1"
          strokeDasharray="2 3"
        />
        <g transform={`translate(38, 39) rotate(${currentAngleDeg})`}>
          <line
            x1="0"
            y1="3"
            x2="0"
            y2="-21"
            stroke={isGalloping ? '#FBBF24' : '#38BDF8'}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="0" cy="0" r="2.5" fill="#D4AF37" />
        </g>
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center pt-2 pointer-events-none">
        <span className="font-mono text-[14px] font-bold leading-none text-[#F4EFE6] tabular-nums">
          {speedKmh}
        </span>
        <span className="font-mono text-[8px] uppercase tracking-widest text-[#B8AA96] mt-0.5">
          km/h
        </span>
        <span
          className={`text-[8px] font-semibold uppercase tracking-wider mt-1 px-1 py-0.2 rounded ${
            isGalloping
              ? 'text-amber-300 bg-amber-950/80 border border-amber-500/40'
              : isMounted
              ? 'text-sky-300'
              : 'text-emerald-300'
          }`}
        >
          {gaitLabel}
        </span>
      </div>
    </div>
  );
}

/**
 * Mobile / Responsive Virtual Thumb Joystick
 */
function VirtualThumbJoystick({
  onMove,
}: {
  onMove: (x: number, y: number) => void;
}) {
  const padRef = useRef<HTMLDivElement | null>(null);
  const [knob, setKnob] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const activePointerId = useRef<number | null>(null);

  const updateFromClientXY = (clientX: number, clientY: number) => {
    const el = padRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.38;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(maxR, dist);
    const angle = Math.atan2(dy, dx);
    const kx = Math.cos(angle) * clampedDist;
    const ky = Math.sin(angle) * clampedDist;
    setKnob({ x: kx, y: ky });
    onMove(kx / maxR, -ky / maxR);
  };

  return (
    <div
      ref={padRef}
      onPointerDown={(e) => {
        e.stopPropagation();
        activePointerId.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        updateFromClientXY(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (activePointerId.current !== e.pointerId) return;
        e.stopPropagation();
        updateFromClientXY(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        if (activePointerId.current !== e.pointerId) return;
        e.stopPropagation();
        activePointerId.current = null;
        setKnob({ x: 0, y: 0 });
        onMove(0, 0);
      }}
      onPointerCancel={() => {
        activePointerId.current = null;
        setKnob({ x: 0, y: 0 });
        onMove(0, 0);
      }}
      className="relative w-28 h-28 rounded-full bg-[#120F0CD9] border-2 border-dashed border-[#D4AF3766] flex items-center justify-center touch-none select-none shadow-lg"
    >
      <div className="w-16 h-16 rounded-full border border-dashed border-[#F4EFE626] pointer-events-none" />
      <div
        style={{
          transform: `translate3d(${knob.x}px, ${knob.y}px, 0)`,
        }}
        className="w-11 h-11 rounded-full bg-[#D4AF37E6] border-2 border-[#FFF3D1] shadow-md flex items-center justify-center pointer-events-none"
      >
        <div className="w-3 h-3 rounded-full bg-[#120F0C]" />
      </div>
    </div>
  );
}

export default function App() {
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<WorldEngine | null>(null);
  const [hud, setHud] = useState<HudState>(INITIAL_HUD);
  const [equineMenuOpen, setEquineMenuOpen] = useState(false);

  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const engine = new WorldEngine(container, (nextHud) => {
      setHud(nextHud);
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const formatClock = (hourFloat: number) => {
    const h = Math.floor(hourFloat) % 24;
    const m = Math.floor((hourFloat - Math.floor(hourFloat)) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const getCardinalLabel = (deg: number) => {
    const dirs = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE'];
    const idx = Math.round(((deg % 360) / 45)) % 8;
    return dirs[idx];
  };

  const activeStamina = hud.isMounted ? hud.horseStamina : hud.playerStamina;
  const activeMaxStamina = hud.isMounted ? hud.horseMaxStamina : hud.playerMaxStamina;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0E0C0A] select-none">
      {/* Isolated 3D WebGL Canvas Container */}
      <div
        ref={canvasContainerRef}
        className="absolute inset-0 w-full h-full cursor-crosshair"
      />

      {/* ==================== TITLE SCREEN OVERLAY ==================== */}
      {hud.phase === 'title' && (
        <div className="absolute inset-0 z-30 flex flex-col justify-between p-6 md:p-12 bg-gradient-to-t from-[#0D0A08F2] via-[#0D0A0859] to-[#0D0A08BF]">
          {/* Top Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 px-3.5 py-2 rounded-md bg-[#120F0CE6] border border-[#D4AF374D]">
              <KayiTamgaSvg className="w-6 h-6 text-[#0EA5E9]" />
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-[#D4AF37] font-semibold">
                  IYI · Kayı Boyu Frontier
                </div>
                <div className="text-xs text-[#B8AA96]">
                  Anatolian Highlands · 13th Century Open World
                </div>
              </div>
            </div>

            <button
              onClick={() => engineRef.current?.toggleMute()}
              className="flex items-center gap-2 px-3.5 py-2 rounded-md bg-[#120F0CE6] border border-[#D4AF374D] text-[#F4EFE6] hover:border-[#D4AF37] transition cursor-pointer"
            >
              {hud.isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-[#D4AF37]" />}
              <span className="text-xs font-medium">{hud.isMuted ? 'Muted' : 'Sound Active'}</span>
            </button>
          </div>

          {/* Center Hero Block */}
          <div className="max-w-2xl my-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 rounded bg-[#0EA5E926] border border-[#0EA5E966] text-[#38BDF8] text-xs font-semibold tracking-widest uppercase">
              Mounted Warfare · Enterable Yurts · High-Crowd Oba & Bazaar
            </div>
            <h1
              className="font-display text-4xl sm:text-6xl font-bold text-[#F4EFE6] tracking-wider uppercase leading-[1.08]"
              style={{ textShadow: '0 4px 24px rgba(0,0,0,0.85)' }}
            >
              Söğüt: Frontier of the Kayı
            </h1>
            <p className="mt-4 text-sm sm:text-base text-[#D6C9B8] max-w-xl leading-relaxed">
              Ride your white steed <span className="text-[#F4EFE6] font-semibold">Aktolgali</span> across the living Söğüt frontier. Customize horse barding &amp; saddles in the Equine Loadout, enter any Kayı Yurt to converse with the Hatuns and grow your tribe’s population, and lead your Alp retinue into battle.
            </p>

            {/* Primary CTA */}
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <button
                onClick={() => engineRef.current?.startGame()}
                className="px-7 py-3.5 rounded-md bg-[#D4AF37] hover:bg-[#E5C349] text-[#120F0C] font-display font-bold text-base tracking-wider uppercase shadow-lg transition transform active:scale-95 cursor-pointer"
              >
                Ride Into Söğüt
              </button>
              <div className="text-xs text-[#B8AA96] font-mono">
                Press <span className="text-[#F4EFE6] font-semibold">[ENTER]</span> or{' '}
                <span className="text-[#F4EFE6] font-semibold">[SPACE]</span> to begin
              </div>
            </div>
          </div>

          {/* Bottom Onboarding Controls Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 pt-4 border-t border-[#D4AF3733] bg-[#120F0CCC] p-3.5 rounded-lg">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#D4AF37] font-semibold">
                Ride / Walk
              </div>
              <div className="text-xs text-[#F4EFE6] font-mono mt-0.5">
                WASD / Stick + SHIFT
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#D4AF37] font-semibold">
                Mount / Summon
              </div>
              <div className="text-xs text-[#F4EFE6] font-mono mt-0.5">
                [E] Mount · [F] Whistle
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#D4AF37] font-semibold">
                Enter Yurt / Bazaar
              </div>
              <div className="text-xs text-[#F4EFE6] font-mono mt-0.5">
                [R] Enter Nearby Yurt
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#D4AF37] font-semibold">
                Equine Loadout
              </div>
              <div className="text-xs text-[#F4EFE6] font-mono mt-0.5">
                Armor &amp; Saddle Dock
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#D4AF37] font-semibold">
                Combat &amp; Shield
              </div>
              <div className="text-xs text-[#F4EFE6] font-mono mt-0.5">
                L-Click Strike · [Q] Guard
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#D4AF37] font-semibold">
                Alp Retinue
              </div>
              <div className="text-xs text-[#F4EFE6] font-mono mt-0.5">
                [G] Rally / Guard Alps
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== ACTIVE GAMEPLAY HUD ==================== */}
      {hud.phase !== 'title' && (
        <>
          {/* TOP-LEFT: Player & Horse Vital Cluster + Circular Dashed Speedometer Dial */}
          <div className="fixed top-3 left-3 z-20 flex flex-col gap-1.5 pointer-events-auto max-w-[360px]">
            <div className="bg-[#120F0CE6] border border-[#D4AF374D] rounded-lg p-2.5 shadow-md">
              {/* Header Identity + Tribe Population */}
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-[#0EA5E926] border border-[#0EA5E980] flex items-center justify-center text-[#38BDF8]">
                    <KayiTamgaSvg className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-display text-xs font-bold tracking-wider text-[#F4EFE6] uppercase leading-none">
                      Ertuğrul Bey
                    </div>
                    <div className="text-[10px] text-[#D4AF37] font-mono mt-0.5">
                      Honor: {hud.honorScore} · Pop: {hud.tribePopulation}
                    </div>
                  </div>
                </div>

                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider border ${
                    hud.isMounted
                      ? 'bg-[#D4AF3726] text-[#FBBF24] border-[#D4AF3766]'
                      : 'bg-[#0EA5E926] text-[#38BDF8] border-[#0EA5E966]'
                  }`}
                >
                  {hud.isMounted ? 'Mounted' : 'On Foot'}
                </span>
              </div>

              {/* Bars + Circular Speedometer Dial side-by-side */}
              <div className="flex items-center gap-2.5">
                <div className="flex-1 space-y-2 min-w-[175px]">
                  {/* Health Bar */}
                  <div>
                    <div className="flex justify-between text-[10px] font-mono text-[#B8AA96] mb-0.5">
                      <span>VITALITY</span>
                      <span className="text-[#F4EFE6]">
                        {hud.playerHp}/{hud.playerMaxHp}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-[#26201A] rounded-sm overflow-hidden border border-[#D4AF3733]">
                      <div
                        className="h-full bg-gradient-to-r from-[#991B1B] to-[#DC2626] transition-all duration-150"
                        style={{ width: `${(hud.playerHp / hud.playerMaxHp) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Stamina Bar with Live Regen Telemetry */}
                  <div>
                    <div className="flex justify-between text-[10px] font-mono text-[#B8AA96] mb-0.5">
                      <span>{hud.isMounted ? 'STEED STAMINA' : 'FOOT STAMINA'}</span>
                      <span className="text-[#38BDF8]">
                        {activeStamina}/{activeMaxStamina} (+{hud.equineLoadout.staminaRegenPerSec}/s)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-[#26201A] rounded-sm overflow-hidden border border-[#D4AF3733]">
                      <div
                        className={`h-full transition-all duration-150 ${
                          hud.isMounted
                            ? 'bg-gradient-to-r from-[#B45309] to-[#F59E0B]'
                            : 'bg-gradient-to-r from-[#0369A1] to-[#0EA5E9]'
                        }`}
                        style={{ width: `${(activeStamina / activeMaxStamina) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Equipped Barding & Saddle Summary Line */}
                  <div className="flex items-center justify-between text-[9px] font-mono text-[#B8AA96] pt-0.5">
                    <span className="truncate max-w-[125px] text-[#D4AF37]">
                      {hud.equineLoadout.armorLabel}
                    </span>
                    <span className="text-emerald-300">
                      +{hud.equineLoadout.armorDefenseBonus} Def
                    </span>
                  </div>
                </div>

                {/* Circular Dashed Speedometer Dial next to Stamina Bar */}
                <DashedSpeedometerDial
                  speedKmh={hud.speedKmh}
                  maxSpeedKmh={hud.maxSpeedKmh}
                  gaitLabel={hud.gaitLabel}
                  isMounted={hud.isMounted}
                />
              </div>

              {/* Bow Draw Charge Indicator */}
              {hud.weapon === 'bow' && hud.bowCharge > 0.05 && (
                <div className="mt-2 pt-1.5 border-t border-[#D4AF3726]">
                  <div className="flex justify-between text-[10px] font-mono text-[#38BDF8] mb-0.5">
                    <span>RECURVE DRAW TENSION</span>
                    <span>{Math.round(hud.bowCharge * 100)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#26201A] rounded-sm overflow-hidden">
                    <div
                      className="h-full bg-[#38BDF8]"
                      style={{ width: `${hud.bowCharge * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Contextual Enter Yurt / Building Prompt */}
            {hud.nearbyBuilding && !hud.activeInterior && (
              <button
                onClick={() => engineRef.current?.enterNearbyBuilding()}
                className="flex items-center justify-between gap-2 bg-[#120F0CF2] hover:bg-[#1C1611] border border-[#D4AF37] rounded-md px-3 py-2 text-left shadow-lg transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Home className="w-4 h-4 text-[#FBBF24] shrink-0" />
                  <div>
                    <div className="text-xs font-display font-bold text-[#F4EFE6]">
                      Enter {hud.nearbyBuilding.name}
                    </div>
                    <div className="text-[10px] text-[#B8AA96]">
                      Residents: {hud.nearbyBuilding.residents.join(', ')}
                    </div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-[#D4AF37] text-[#120F0C] font-mono font-bold text-[10px]">
                  [R] ENTER
                </span>
              </button>
            )}

            {/* Contextual Mount Prompt when on foot */}
            {!hud.isMounted && (
              <div className="bg-[#120F0CE6] border border-[#D4AF374D] rounded-md px-2.5 py-1.5 text-[11px] text-[#F4EFE6] flex items-center justify-between gap-2">
                <span>
                  Steed <strong className="text-[#D4AF37]">Aktolgali</strong> ({hud.distanceToHorse}m)
                </span>
                <button
                  onClick={() => engineRef.current?.toggleMount()}
                  className="px-2 py-0.5 rounded bg-[#D4AF3726] border border-[#D4AF3780] text-[#FBBF24] font-mono text-[10px] hover:bg-[#D4AF3740] cursor-pointer"
                >
                  {hud.canMountNearby ? '[E] Mount' : '[F] Whistle'}
                </button>
              </div>
            )}

            {/* Compact Combat Feed (max 2 recent items) */}
            {hud.combatFeed.length > 0 && (
              <div className="flex flex-col gap-1 pointer-events-none">
                {hud.combatFeed.slice(0, 2).map((item) => (
                  <div
                    key={item.id}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium border bg-[#120F0CD9] ${
                      item.type === 'crit'
                        ? 'border-amber-500/50 text-amber-300'
                        : item.type === 'quest'
                        ? 'border-sky-500/50 text-sky-300'
                        : item.type === 'block'
                        ? 'border-blue-400/50 text-blue-200'
                        : 'border-[#D4AF3733] text-[#F4EFE6]'
                    }`}
                  >
                    {item.text}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* TOP-CENTER: Compass Ribbon, Weather Alert Banner & Locked Soldier Brain Telemetry */}
          <div className="fixed top-3 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1.5 pointer-events-none">
            <div className="bg-[#120F0CE6] border border-[#D4AF374D] rounded-lg px-3.5 py-1.5 flex items-center gap-3 shadow-md">
              <div className="flex items-center gap-1.5 text-xs font-mono text-[#D4AF37]">
                <Compass className="w-3.5 h-3.5" />
                <span>
                  {hud.compassHeading}° {getCardinalLabel(hud.compassHeading)}
                </span>
              </div>
              <div className="h-3.5 w-[1px] bg-[#D4AF3733]" />
              <div className="text-xs font-display font-semibold tracking-wider text-[#F4EFE6] uppercase">
                {hud.regionName}
              </div>
              <div className="hidden sm:block h-3.5 w-[1px] bg-[#D4AF3733]" />
              <div className="hidden sm:block text-[11px] font-mono text-[#B8AA96]">
                {formatClock(hud.timeOfDay)}
              </div>
            </div>

            {/* Subtle On-Screen Notification Banner (Weather / Territory / Quest Transitions) */}
            {hud.worldAlert && (
              <div
                key={hud.worldAlert.id}
                className="bg-[#120F0CF2] border border-[#D4AF3780] rounded-lg px-4 py-2 text-center shadow-lg max-w-md animate-fade-in"
              >
                <div className="flex items-center justify-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]">
                  <span className="w-6 h-[1px] bg-[#D4AF3766]" />
                  <span>
                    {hud.worldAlert.category === 'weather'
                      ? 'Atmospheric Shift'
                      : hud.worldAlert.category === 'territory'
                      ? 'Frontier Territory'
                      : 'Kayı Chronicle'}
                  </span>
                  <span className="w-6 h-[1px] bg-[#D4AF3766]" />
                </div>
                <div className="font-display text-xs sm:text-sm font-bold text-[#F4EFE6] tracking-wide mt-0.5">
                  “{hud.worldAlert.title}”
                </div>
                <div className="text-[11px] text-[#B8AA96] mt-0.5">
                  {hud.worldAlert.subtitle}
                </div>
              </div>
            )}

            {/* Locked Enemy Health & Tactical Brain State */}
            {hud.lockedEnemy && (
              <div className="bg-[#120F0CE6] border border-red-500/50 rounded-md px-3 py-1.5 min-w-[235px] shadow-md">
                <div className="flex items-center justify-between text-[11px] mb-1 gap-2">
                  <span className="font-semibold text-[#F4EFE6] truncate">
                    {hud.lockedEnemy.name}
                  </span>
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-amber-950/90 border border-amber-500/40 text-amber-300 shrink-0">
                    AI: {hud.lockedEnemy.tactic}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-[#26201A] rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-red-500 transition-all duration-100"
                    style={{
                      width: `${(hud.lockedEnemy.hp / hud.lockedEnemy.maxHp) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* TOP-RIGHT: Frontier Radar Map & Active Chronicle Objective */}
          <div className="fixed top-3 right-3 z-20 flex flex-col items-end gap-1.5 pointer-events-auto">
            <div className="bg-[#120F0CE6] border border-[#D4AF374D] rounded-lg p-2.5 w-52 sm:w-56 shadow-md">
              {/* Mini Radar Map */}
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#D4AF37]">
                  Frontier Radar
                </span>
                <span className="text-[10px] font-mono text-[#38BDF8]">
                  Alps: {hud.alpRetinueFollowing ? 'Following' : 'Guarding'}
                </span>
              </div>

              <div className="relative w-full h-24 sm:h-28 bg-[#181E17] rounded border border-[#D4AF3733] overflow-hidden">
                <div
                  className="absolute inset-0 opacity-25"
                  style={{
                    backgroundImage:
                      'linear-gradient(to right, #D4AF37 1px, transparent 1px), linear-gradient(to bottom, #D4AF37 1px, transparent 1px)',
                    backgroundSize: '20px 20px',
                  }}
                />

                {hud.mapPoints.map((pt) => {
                  const relX = ((pt.x - hud.playerPos.x) / 230) * 50 + 50;
                  const relZ = ((pt.z - hud.playerPos.z) / 230) * 50 + 50;
                  if (relX < 4 || relX > 96 || relZ < 4 || relZ > 96) return null;

                  let dotClass = 'bg-[#D4AF37] w-2 h-2';
                  if (pt.type === 'enemy') dotClass = 'bg-red-500 w-1.5 h-1.5';
                  else if (pt.type === 'ally') dotClass = 'bg-emerald-400 w-1.5 h-1.5';
                  else if (pt.type === 'quest')
                    dotClass = 'bg-[#38BDF8] w-2.5 h-2.5 ring-2 ring-[#38BDF866]';
                  else if (pt.type === 'waterfall' || pt.type === 'lake')
                    dotClass = 'bg-cyan-300 w-2 h-2';
                  else if (pt.type === 'horse') dotClass = 'bg-white w-2 h-2';

                  return (
                    <div
                      key={pt.id}
                      style={{ left: `${relX}%`, top: `${relZ}%` }}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full ${dotClass}`}
                      title={pt.label}
                    />
                  );
                })}

                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#F4EFE6] border border-[#120F0C]" />
              </div>

              {/* Active Quest Objective */}
              <div className="mt-2 pt-2 border-t border-[#D4AF3733]">
                <div className="flex items-center justify-between text-[10px] font-mono text-[#38BDF8]">
                  <span>
                    CHRONICLE {hud.questIndex + 1}/{hud.totalQuests}
                  </span>
                  <span>
                    {hud.activeQuest.progress}/{hud.activeQuest.goal}
                  </span>
                </div>
                <div className="text-xs font-display font-bold text-[#F4EFE6] mt-0.5">
                  {hud.activeQuest.title}
                </div>
                <p className="text-[11px] text-[#B8AA96] leading-snug mt-0.5 line-clamp-2">
                  {hud.activeQuest.subtitle}
                </p>
              </div>

              {/* Fast Travel Landmarks */}
              <div className="mt-2 pt-1.5 border-t border-[#D4AF3733] grid grid-cols-3 gap-1">
                <button
                  onClick={() => engineRef.current?.fastTravelTo(-68, 38, 'Kayı Oba')}
                  className="px-1.5 py-1 rounded bg-[#1E1914] hover:bg-[#2C241D] text-[10px] text-[#D6C9B8] border border-[#D4AF3726] truncate cursor-pointer"
                  title="Fast Travel to Kayı Oba Encampment"
                >
                  Kayı Oba
                </button>
                <button
                  onClick={() => engineRef.current?.fastTravelTo(24, -84, 'Çağlayan Waterfall')}
                  className="px-1.5 py-1 rounded bg-[#1E1914] hover:bg-[#2C241D] text-[10px] text-cyan-300 border border-[#D4AF3726] truncate cursor-pointer"
                  title="Fast Travel to Çağlayan Waterfall"
                >
                  Waterfall
                </button>
                <button
                  onClick={() => engineRef.current?.fastTravelTo(92, 68, 'Hanlı Pazar Bazaar')}
                  className="px-1.5 py-1 rounded bg-[#1E1914] hover:bg-[#2C241D] text-[10px] text-amber-300 border border-[#D4AF3726] truncate cursor-pointer"
                  title="Fast Travel to Hanlı Pazar Silk Road Bazaar"
                >
                  Bazaar
                </button>
                <button
                  onClick={() => engineRef.current?.fastTravelTo(32, -8, 'Sakarya Bridge')}
                  className="px-1.5 py-1 rounded bg-[#1E1914] hover:bg-[#2C241D] text-[10px] text-[#D6C9B8] border border-[#D4AF3726] truncate cursor-pointer"
                >
                  Bridge
                </button>
                <button
                  onClick={() => engineRef.current?.fastTravelTo(95, -55, 'Karacahisar Outpost')}
                  className="px-1.5 py-1 rounded bg-[#1E1914] hover:bg-[#2C241D] text-[10px] text-red-300 border border-[#D4AF3726] truncate cursor-pointer"
                >
                  Fortress
                </button>
                <button
                  onClick={() => engineRef.current?.fastTravelTo(-35, -142, 'Karadağ Pass')}
                  className="px-1.5 py-1 rounded bg-[#1E1914] hover:bg-[#2C241D] text-[10px] text-[#D6C9B8] border border-[#D4AF3726] truncate cursor-pointer"
                >
                  Steppe
                </button>
              </div>
            </div>
          </div>

          {/* ==================== ENTERABLE YURT / BAZAAR INTERIOR MODAL ==================== */}
          {hud.activeInterior && (
            <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#0D0A08D9]">
              <div className="max-w-lg w-full bg-[#120F0C] border-2 border-[#D4AF37] rounded-xl p-6 shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-[#D4AF3733] pb-3">
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#38BDF8]">
                      Interior Sanctuary · Kayı Tribe
                    </div>
                    <h2 className="font-display text-2xl font-bold text-[#F4EFE6] mt-0.5">
                      {hud.activeInterior.name}
                    </h2>
                    <p className="text-xs text-[#B8AA96] mt-0.5">
                      {hud.activeInterior.subtitle}
                    </p>
                  </div>
                  <button
                    onClick={() => engineRef.current?.exitInterior()}
                    className="p-1.5 rounded-md bg-[#1C1611] border border-[#D4AF374D] text-[#B8AA96] hover:text-[#F4EFE6] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Present Hatuns & Residents inside */}
                <div className="mt-4">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-[#D4AF37] mb-2">
                    Present Inside the Tent
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {hud.activeInterior.residents.map((person) => (
                      <div
                        key={person}
                        className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[#1A1511] border border-[#D4AF3740]"
                      >
                        <div className="w-8 h-8 rounded-full bg-[#0EA5E926] border border-[#38BDF8] flex items-center justify-center text-[#38BDF8] font-display font-bold text-xs">
                          {person.charAt(0)}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-[#F4EFE6]">{person}</div>
                          <div className="text-[10px] text-emerald-300">
                            Welcomes you with warm hearth tea
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tribe Population & Family Blessing Action */}
                <div className="mt-4 p-3.5 rounded-lg bg-[#18130F] border border-[#D4AF374D]">
                  <div className="flex items-center justify-between text-xs font-mono mb-2">
                    <span className="text-[#D4AF37]">KAYI TRIBE POPULATION</span>
                    <span className="text-[#F4EFE6] font-bold">
                      {hud.tribePopulation} Souls ({hud.childrenCount} Children)
                    </span>
                  </div>
                  <p className="text-xs text-[#D6C9B8] leading-relaxed">
                    Celebrate family unity and welcome a newborn child into the Kayı Oba. Every cradle blessing permanently adds a new Hatun mother and child walking across your village courtyard!
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2.5">
                    <button
                      onClick={() => engineRef.current?.celebrateNewbornFamily()}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-[#D4AF37] hover:bg-[#E5C349] text-[#120F0C] font-display font-bold text-xs uppercase tracking-wider cursor-pointer transition"
                    >
                      <Heart className="w-4 h-4 fill-current" />
                      Welcome Newborn Child (+2 Population · +75 Honor)
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => engineRef.current?.exitInterior()}
                    className="px-5 py-2 rounded-md bg-[#241D17] hover:bg-[#332920] text-[#F4EFE6] border border-[#D4AF374D] text-xs font-mono uppercase cursor-pointer"
                  >
                    [R / ESC] Step Outside to Söğüt
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ==================== VIRTUAL TOUCH JOYSTICK & ACTION BUTTONS ==================== */}
          {hud.showTouchControls && hud.phase === 'playing' && !hud.activeInterior && (
            <>
              <div className="fixed bottom-20 left-4 z-20 pointer-events-auto">
                <VirtualThumbJoystick
                  onMove={(x, y) => engineRef.current?.setJoystickInput(x, y)}
                />
              </div>

              <div className="fixed bottom-20 right-4 z-20 grid grid-cols-2 gap-2 pointer-events-auto">
                <button
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    engineRef.current?.triggerPrimaryAttack();
                  }}
                  className="w-14 h-14 rounded-full bg-[#991B1BE6] active:bg-[#DC2626] border-2 border-[#FBBF24] text-[#F4EFE6] font-display font-bold text-[11px] uppercase shadow-lg flex items-center justify-center select-none"
                >
                  {hud.weapon === 'bow' ? 'Shoot' : 'Strike'}
                </button>
                <button
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    engineRef.current?.setTouchSprint(true);
                  }}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                    engineRef.current?.setTouchSprint(false);
                  }}
                  onPointerCancel={() => engineRef.current?.setTouchSprint(false)}
                  className="w-14 h-14 rounded-full bg-[#B45309E6] active:bg-[#F59E0B] border-2 border-[#FDE68A] text-[#F4EFE6] font-display font-bold text-[11px] uppercase shadow-lg flex items-center justify-center select-none"
                >
                  Gallop
                </button>
                <button
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    engineRef.current?.setTouchBlock(true);
                  }}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                    engineRef.current?.setTouchBlock(false);
                  }}
                  onPointerCancel={() => engineRef.current?.setTouchBlock(false)}
                  className="w-14 h-14 rounded-full bg-[#0369A1E6] active:bg-[#0EA5E9] border-2 border-[#BAE6FD] text-[#F4EFE6] font-display font-bold text-[11px] uppercase shadow-lg flex items-center justify-center select-none"
                >
                  {hud.weapon === 'bow' ? 'Draw' : 'Shield'}
                </button>
                <button
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    engineRef.current?.triggerJump();
                  }}
                  className="w-14 h-14 rounded-full bg-[#1E1914E6] active:bg-[#332920] border-2 border-[#D4AF37] text-[#F4EFE6] font-display font-bold text-[11px] uppercase shadow-lg flex items-center justify-center select-none"
                >
                  Leap
                </button>
              </div>
            </>
          )}

          {/* ==================== EQUINE LOADOUT SUB-MENU POPOVER ==================== */}
          {equineMenuOpen && (
            <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-30 w-[94vw] max-w-2xl bg-[#120F0CF5] border-2 border-[#D4AF37] rounded-xl p-4 shadow-2xl pointer-events-auto">
              <div className="flex items-center justify-between border-b border-[#D4AF3733] pb-2.5 mb-3">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#D4AF37]" />
                  <div>
                    <h3 className="font-display text-sm font-bold text-[#F4EFE6] uppercase tracking-wider">
                      Equine Loadout · Aktolgali Barding &amp; Saddle
                    </h3>
                    <p className="text-[11px] text-[#B8AA96]">
                      Toggle horse armor aesthetics and saddle types to customize stamina regeneration and protection.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right font-mono">
                    <div className="text-xs font-bold text-[#38BDF8]">
                      Regen: {hud.equineLoadout.staminaRegenPerSec}/sec
                    </div>
                    <div className="text-[10px] text-[#D4AF37]">
                      Max Stam: {hud.equineLoadout.maxStamina} · Def: +{hud.equineLoadout.armorDefenseBonus}
                    </div>
                  </div>
                  <button
                    onClick={() => setEquineMenuOpen(false)}
                    className="p-1 rounded bg-[#1E1914] text-[#B8AA96] hover:text-[#F4EFE6] border border-[#D4AF374D] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Horse Armor Aesthetics Column */}
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-[#D4AF37] mb-1.5">
                    1. Horse Armor Aesthetics (Barding)
                  </div>
                  <div className="space-y-1.5">
                    {ARMOR_OPTIONS.map((opt) => {
                      const active = hud.equineLoadout.armor === opt.id;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => engineRef.current?.setEquineArmor(opt.id)}
                          className={`w-full text-left p-2 rounded-lg border transition cursor-pointer ${
                            active
                              ? 'bg-[#D4AF3726] border-[#D4AF37] text-[#F4EFE6]'
                              : 'bg-[#1A1510] border-[#D4AF3726] text-[#B8AA96] hover:border-[#D4AF3766]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-[#F4EFE6]">
                              {opt.name}
                            </span>
                            <span className="font-mono text-[10px] text-[#38BDF8]">
                              {opt.regenText}
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-0.5">
                            <span className="text-[10px] text-[#B8AA96] line-clamp-1">
                              {opt.desc}
                            </span>
                            <span className="font-mono text-[10px] text-amber-300 shrink-0 ml-2">
                              {opt.defText}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Saddle Types Column */}
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-[#D4AF37] mb-1.5">
                    2. Saddle Type (Stamina Regeneration Rate)
                  </div>
                  <div className="space-y-1.5">
                    {SADDLE_OPTIONS.map((sad) => {
                      const active = hud.equineLoadout.saddle === sad.id;
                      return (
                        <button
                          key={sad.id}
                          onClick={() => engineRef.current?.setEquineSaddle(sad.id)}
                          className={`w-full text-left p-2.5 rounded-lg border transition cursor-pointer ${
                            active
                              ? 'bg-[#0EA5E926] border-[#38BDF8] text-[#F4EFE6]'
                              : 'bg-[#1A1510] border-[#D4AF3726] text-[#B8AA96] hover:border-[#D4AF3766]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-[#F4EFE6]">
                              {sad.name}
                            </span>
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#0EA5E933] text-[#38BDF8]">
                              {sad.regenBadge}
                            </span>
                          </div>
                          <p className="text-[10px] text-[#B8AA96] mt-1 leading-snug">
                            {sad.desc}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== UNIFIED COLLAPSIBLE BOTTOM CONTROL DOCK ==================== */}
          <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center pointer-events-auto max-w-[98vw]">
            <button
              onClick={() => engineRef.current?.toggleDockCollapsed()}
              className="mb-1 px-3 py-0.5 rounded-t bg-[#120F0CE6] border border-b-0 border-[#D4AF374D] text-[10px] font-mono text-[#B8AA96] hover:text-[#F4EFE6] flex items-center gap-1 cursor-pointer"
            >
              {hud.dockCollapsed ? (
                <>
                  <ChevronUp className="w-3 h-3" /> Show Controls [H]
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" /> Hide Dock [H]
                </>
              )}
            </button>

            {!hud.dockCollapsed && (
              <div className="bg-[#120F0CE6] border border-[#D4AF374D] rounded-lg px-2.5 py-2 shadow-xl flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
                {/* Weapons Selector */}
                <div className="flex items-center gap-1 pr-2 border-r border-[#D4AF3733]">
                  {(
                    [
                      { id: 'kilij', label: 'Kilij', key: '1' },
                      { id: 'bow', label: `Bow (${hud.arrowsCount})`, key: '2' },
                      { id: 'lance', label: 'Sungu', key: '3' },
                    ] as Array<{ id: WeaponType; label: string; key: string }>
                  ).map((w) => {
                    const active = hud.weapon === w.id;
                    return (
                      <button
                        key={w.id}
                        onClick={() => engineRef.current?.setWeapon(w.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition cursor-pointer ${
                          active
                            ? 'bg-[#D4AF37] text-[#120F0C] font-semibold'
                            : 'bg-[#1C1611] text-[#D6C9B8] hover:bg-[#2A221B] border border-[#D4AF3726]'
                        }`}
                      >
                        <WeaponIconSvg type={w.id} className="w-3.5 h-3.5" />
                        <span>{w.label}</span>
                        <span className="hidden md:inline text-[10px] opacity-75 font-mono">
                          [{w.key}]
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Equine Loadout Sub-Menu Button + Mount & Alp Retinue */}
                <div className="flex items-center gap-1 pr-2 border-r border-[#D4AF3733]">
                  <button
                    onClick={() => setEquineMenuOpen((prev) => !prev)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium border transition cursor-pointer ${
                      equineMenuOpen
                        ? 'bg-[#D4AF37] text-[#120F0C] border-[#FBBF24] font-semibold'
                        : 'bg-[#1C1611] hover:bg-[#2A221B] text-[#FBBF24] border-[#D4AF3766]'
                    }`}
                    title="Open Equine Loadout Sub-Menu (Horse Armor & Saddle Stamina Regen)"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Equine Loadout</span>
                  </button>

                  <button
                    onClick={() => engineRef.current?.toggleMount()}
                    className="px-2.5 py-1.5 rounded bg-[#1C1611] hover:bg-[#2A221B] text-xs text-[#F4EFE6] border border-[#D4AF3733] font-medium cursor-pointer"
                  >
                    {hud.isMounted ? 'Dismount [E]' : 'Mount [E]'}
                  </button>

                  <button
                    onClick={() => engineRef.current?.toggleAlpRetinue()}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs border font-medium cursor-pointer ${
                      hud.alpRetinueFollowing
                        ? 'bg-[#0EA5E926] border-[#0EA5E980] text-[#38BDF8]'
                        : 'bg-[#1C1611] border-[#D4AF3726] text-[#B8AA96]'
                    }`}
                    title="Command Turgut, Bamsı & Doğan Alp [G]"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Alps</span>
                  </button>
                </div>

                {/* Weather Switcher (Triggers Subtle Notification Banner) */}
                <div className="flex items-center gap-1 pr-2 border-r border-[#D4AF3733]">
                  {(
                    [
                      { id: 'clear', icon: Sun, label: 'Clear' },
                      { id: 'mist', icon: CloudFog, label: 'Mist' },
                      { id: 'rain', icon: CloudRain, label: 'Rain' },
                      { id: 'snow', icon: Snowflake, label: 'Snow' },
                    ] as Array<{ id: WeatherType; icon: React.FC<{ className?: string }>; label: string }>
                  ).map((wt) => {
                    const Icon = wt.icon;
                    const active = hud.weather === wt.id;
                    return (
                      <button
                        key={wt.id}
                        onClick={() => engineRef.current?.setWeather(wt.id)}
                        title={`Weather: ${wt.label}`}
                        className={`p-1.5 rounded transition cursor-pointer ${
                          active
                            ? 'bg-[#0EA5E933] text-[#38BDF8] border border-[#0EA5E980]'
                            : 'bg-[#1C1611] text-[#B8AA96] hover:text-[#F4EFE6]'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </button>
                    );
                  })}
                </div>

                {/* Camera, Touch Joystick Toggle, Audio & Pause */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => engineRef.current?.cycleCameraPreset()}
                    className="px-2 py-1.5 rounded bg-[#1C1611] hover:bg-[#2A221B] text-[11px] font-mono text-[#D6C9B8] border border-[#D4AF3726] uppercase cursor-pointer"
                    title="Cycle Camera Angle [C]"
                  >
                    Cam: {hud.cameraPreset}
                  </button>

                  <button
                    onClick={() => engineRef.current?.toggleTouchControls()}
                    className={`p-1.5 rounded border cursor-pointer ${
                      hud.showTouchControls
                        ? 'bg-[#D4AF3733] border-[#D4AF37] text-[#FBBF24]'
                        : 'bg-[#1C1611] border-[#D4AF3726] text-[#B8AA96] hover:text-[#F4EFE6]'
                    }`}
                    title="Toggle On-Screen Virtual Joystick & Touch Pad"
                  >
                    <Gamepad2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => engineRef.current?.toggleMute()}
                    className="p-1.5 rounded bg-[#1C1611] hover:bg-[#2A221B] text-[#D6C9B8] border border-[#D4AF3726] cursor-pointer"
                    title="Mute / Unmute Audio [M]"
                  >
                    {hud.isMuted ? (
                      <VolumeX className="w-3.5 h-3.5 text-red-400" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5 text-[#D4AF37]" />
                    )}
                  </button>

                  <button
                    onClick={() => engineRef.current?.togglePause()}
                    className="p-1.5 rounded bg-[#1C1611] hover:bg-[#2A221B] text-[#D6C9B8] border border-[#D4AF3726] cursor-pointer"
                    title="Pause Game [ESC]"
                  >
                    <Pause className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ==================== PAUSE / VICTORY / GAMEOVER MODAL ==================== */}
      {(hud.phase === 'paused' || hud.phase === 'victory' || hud.phase === 'gameover') && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#0D0A08D9]">
          <div className="max-w-md w-full bg-[#120F0C] border-2 border-[#D4AF37] rounded-xl p-6 text-center shadow-2xl">
            <div className="mx-auto w-12 h-12 rounded-full bg-[#0EA5E926] border border-[#0EA5E980] flex items-center justify-center text-[#38BDF8] mb-3">
              <KayiTamgaSvg className="w-7 h-7" />
            </div>

            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#F4EFE6] uppercase tracking-wider">
              {hud.phase === 'victory'
                ? 'Victory Across Söğüt!'
                : hud.phase === 'gameover'
                ? 'Fallen in Battle'
                : 'Chronicle Paused'}
            </h2>

            <p className="mt-2 text-sm text-[#B8AA96]">
              {hud.phase === 'victory'
                ? 'You have secured the Sakarya River, defended Söğüt Lake, and triumphed over every garrison on the frontier!'
                : hud.phase === 'gameover'
                ? 'Your wounds were too heavy, but the Kayı banner still flies over the Oba.'
                : 'Rest by the campfire, customize Aktolgali, or resume your ride across the Anatolian highlands.'}
            </p>

            <div className="my-5 grid grid-cols-3 gap-2 bg-[#1A1510] p-3 rounded-lg border border-[#D4AF3733]">
              <div>
                <div className="text-[10px] font-mono text-[#B8AA96] uppercase">Kayı Honor</div>
                <div className="text-lg font-bold font-mono text-[#D4AF37]">{hud.honorScore}</div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-[#B8AA96] uppercase">Tribe Pop</div>
                <div className="text-lg font-bold font-mono text-[#F4EFE6]">
                  {hud.tribePopulation}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-[#B8AA96] uppercase">Quest</div>
                <div className="text-lg font-bold font-mono text-[#38BDF8]">
                  {hud.questIndex + 1}/{hud.totalQuests}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {hud.phase === 'paused' && (
                <button
                  onClick={() => engineRef.current?.togglePause()}
                  className="flex-1 py-2.5 px-4 rounded-md bg-[#D4AF37] hover:bg-[#E5C349] text-[#120F0C] font-display font-bold text-sm uppercase tracking-wider cursor-pointer"
                >
                  Resume Ride
                </button>
              )}
              <button
                onClick={() => engineRef.current?.resetGame()}
                className="flex-1 py-2.5 px-4 rounded-md bg-[#241D17] hover:bg-[#332920] text-[#F4EFE6] border border-[#D4AF3766] font-display font-semibold text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                {hud.phase === 'paused' ? 'Reset World' : 'Ride Again'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
