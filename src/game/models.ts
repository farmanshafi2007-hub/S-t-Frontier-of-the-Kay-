import * as THREE from 'three';
import { createKayiBannerTexture, createKayiTextileTexture, createMicroNormalTexture } from './terrain';
import { HorseArmorType, HorseSaddleType, WeaponType } from './types';

export interface HorseRig {
  group: THREE.Group;
  bodyGroup: THREE.Group;
  neckPivot: THREE.Group;
  tailPivot: THREE.Group;
  legs: [THREE.Group, THREE.Group, THREE.Group, THREE.Group];
  lowerLegs: [THREE.Group, THREE.Group, THREE.Group, THREE.Group];
  saddleMountPoint: THREE.Object3D;
  setEquineLoadout: (armor: HorseArmorType, saddle: HorseSaddleType) => void;
}

export interface WarriorRig {
  group: THREE.Group;
  hipsPivot: THREE.Group;
  torsoPivot: THREE.Group;
  headGroup: THREE.Group;
  rightArmPivot: THREE.Group;
  leftArmPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  capeMesh: THREE.Mesh;
  kilijGroup: THREE.Group;
  bowGroup: THREE.Group;
  lanceGroup: THREE.Group;
  shieldGroup: THREE.Group;
  slashArcMesh: THREE.Mesh;
  telegraphRing: THREE.Mesh;
  setWeapon: (w: WeaponType) => void;
}

/**
 * Builds a composite 12+ part articulated horse with customizable Barding Armor & Saddle meshes.
 */
export function createHorseModel(coatHex = 0xf0ece1, maneHex = 0x221f1d, isPlayerHorse = true): HorseRig {
  const group = new THREE.Group();
  const bodyGroup = new THREE.Group();
  bodyGroup.position.y = 1.32;
  group.add(bodyGroup);

  const coatMat = new THREE.MeshStandardMaterial({
    color: coatHex,
    roughness: 0.62,
    metalness: 0.06,
  });

  const maneMat = new THREE.MeshStandardMaterial({
    color: maneHex,
    roughness: 0.9,
    metalness: 0.02,
  });

  const saddleMat = new THREE.MeshStandardMaterial({
    color: isPlayerHorse ? 0x4a2816 : 0x2b1d16,
    roughness: 0.38,
    metalness: 0.16,
  });

  const trimMat = new THREE.MeshStandardMaterial({
    color: isPlayerHorse ? 0xd4a853 : 0x8c8f96,
    roughness: 0.18,
    metalness: 0.92,
  });

  const saddleBlanketMat = new THREE.MeshStandardMaterial({
    color: isPlayerHorse ? 0x124e66 : 0x7c1d1d,
    roughness: 0.8,
    metalness: 0.05,
  });

  const bardingArmorMat = new THREE.MeshStandardMaterial({
    color: 0xd4a853,
    roughness: 0.22,
    metalness: 0.88,
  });

  const hoofMat = new THREE.MeshStandardMaterial({
    color: 0x1a1817,
    roughness: 0.36,
    metalness: 0.28,
  });

  // 1. Barrel Torso
  const torsoGeo = new THREE.CapsuleGeometry(0.46, 1.15, 8, 16);
  torsoGeo.rotateX(Math.PI / 2);
  const torsoMesh = new THREE.Mesh(torsoGeo, coatMat);
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  bodyGroup.add(torsoMesh);

  // 2. Muscular Chest & Haunches
  const chestGeo = new THREE.SphereGeometry(0.49, 14, 12);
  chestGeo.scale(0.95, 1.05, 1.1);
  const chestMesh = new THREE.Mesh(chestGeo, coatMat);
  chestMesh.position.set(0, 0.04, 0.55);
  chestMesh.castShadow = true;
  bodyGroup.add(chestMesh);

  const haunchGeo = new THREE.SphereGeometry(0.48, 14, 12);
  haunchGeo.scale(0.96, 1.06, 1.12);
  const haunchMesh = new THREE.Mesh(haunchGeo, coatMat);
  haunchMesh.position.set(0, 0.06, -0.58);
  haunchMesh.castShadow = true;
  bodyGroup.add(haunchMesh);

  // 3. Saddle Blanket & Embossed Anatolian Saddle
  const blanketGeo = new THREE.BoxGeometry(1.04, 0.58, 0.96);
  const blanketMesh = new THREE.Mesh(blanketGeo, saddleBlanketMat);
  blanketMesh.position.set(0, 0.22, 0.02);
  blanketMesh.castShadow = true;
  bodyGroup.add(blanketMesh);

  const saddleSeatGeo = new THREE.BoxGeometry(0.92, 0.24, 0.68);
  const saddleMesh = new THREE.Mesh(saddleSeatGeo, saddleMat);
  saddleMesh.position.set(0, 0.42, 0.02);
  saddleMesh.castShadow = true;
  bodyGroup.add(saddleMesh);

  const pommelGeo = new THREE.CylinderGeometry(0.12, 0.22, 0.28, 10);
  const pommelMesh = new THREE.Mesh(pommelGeo, trimMat);
  pommelMesh.position.set(0, 0.56, 0.28);
  bodyGroup.add(pommelMesh);

  const cantleGeo = new THREE.CylinderGeometry(0.18, 0.24, 0.26, 10);
  const cantleMesh = new THREE.Mesh(cantleGeo, saddleMat);
  cantleMesh.position.set(0, 0.57, -0.26);
  bodyGroup.add(cantleMesh);

  // Horse Barding Armor Group (Toggled by Equine Loadout)
  const bardingGroup = new THREE.Group();
  bardingGroup.visible = false;
  bodyGroup.add(bardingGroup);

  // Chest Peytral Barding Plate
  const peytralGeo = new THREE.CylinderGeometry(0.52, 0.54, 0.52, 16, 1, true, -Math.PI * 0.45, Math.PI * 0.9);
  const peytralMesh = new THREE.Mesh(peytralGeo, bardingArmorMat);
  peytralMesh.position.set(0, 0.02, 0.58);
  peytralMesh.castShadow = true;
  bardingGroup.add(peytralMesh);

  // Flank & Crupper Side Barding Plates
  const crupperGeo = new THREE.BoxGeometry(1.08, 0.48, 0.85);
  const crupperMesh = new THREE.Mesh(crupperGeo, bardingArmorMat);
  crupperMesh.position.set(0, 0.08, -0.52);
  crupperMesh.castShadow = true;
  bardingGroup.add(crupperMesh);

  // Chest Strap & Brass Medallion
  const chestStrapGeo = new THREE.TorusGeometry(0.49, 0.035, 8, 20, Math.PI * 1.1);
  const chestStrap = new THREE.Mesh(chestStrapGeo, saddleMat);
  chestStrap.rotation.x = Math.PI / 2;
  chestStrap.rotation.z = -Math.PI * 0.05;
  chestStrap.position.set(0, 0.04, 0.62);
  bodyGroup.add(chestStrap);

  const medallion = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 12), trimMat);
  medallion.rotation.x = Math.PI / 2;
  medallion.position.set(0, 0.04, 1.1);
  bodyGroup.add(medallion);

  const saddleMountPoint = new THREE.Object3D();
  saddleMountPoint.position.set(0, 0.52, 0.0);
  bodyGroup.add(saddleMountPoint);

  // 4. Articulated Neck & Sculpted Head
  const neckPivot = new THREE.Group();
  neckPivot.position.set(0, 0.26, 0.72);
  bodyGroup.add(neckPivot);

  const neckGeo = new THREE.CylinderGeometry(0.21, 0.34, 0.92, 12);
  neckGeo.translate(0, 0.38, 0.18);
  neckGeo.rotateX(0.52);
  const neckMesh = new THREE.Mesh(neckGeo, coatMat);
  neckMesh.castShadow = true;
  neckPivot.add(neckMesh);

  // Neck Crinet Armor Plate (part of barding)
  const crinetGeo = new THREE.CylinderGeometry(0.23, 0.35, 0.75, 12, 1, true, -Math.PI * 0.4, Math.PI * 0.8);
  crinetGeo.translate(0, 0.38, 0.2);
  crinetGeo.rotateX(0.52);
  const crinetMesh = new THREE.Mesh(crinetGeo, bardingArmorMat);
  crinetMesh.visible = false;
  neckPivot.add(crinetMesh);

  const maneGeo = new THREE.BoxGeometry(0.09, 0.86, 0.22);
  maneGeo.translate(0, 0.42, 0.04);
  maneGeo.rotateX(0.52);
  const maneMesh = new THREE.Mesh(maneGeo, maneMat);
  neckPivot.add(maneMesh);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.78, 0.48);
  neckPivot.add(headGroup);

  const skullGeo = new THREE.BoxGeometry(0.28, 0.3, 0.42);
  const skullMesh = new THREE.Mesh(skullGeo, coatMat);
  skullMesh.castShadow = true;
  headGroup.add(skullMesh);

  const chamfron = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.3, 0.05), bardingArmorMat);
  chamfron.position.set(0, 0.02, 0.22);
  chamfron.rotation.x = -0.25;
  headGroup.add(chamfron);

  const muzzleGeo = new THREE.CylinderGeometry(0.11, 0.16, 0.42, 10);
  muzzleGeo.rotateX(Math.PI / 2 + 0.35);
  const muzzleMesh = new THREE.Mesh(muzzleGeo, coatMat);
  muzzleMesh.position.set(0, -0.1, 0.32);
  muzzleMesh.castShadow = true;
  headGroup.add(muzzleMesh);

  const bridleRing = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.34), saddleMat);
  bridleRing.position.set(0, -0.06, 0.25);
  headGroup.add(bridleRing);

  const earGeo = new THREE.ConeGeometry(0.055, 0.18, 6);
  const earL = new THREE.Mesh(earGeo, coatMat);
  earL.position.set(0.1, 0.22, -0.06);
  earL.rotation.z = -0.15;
  headGroup.add(earL);

  const earR = new THREE.Mesh(earGeo, coatMat);
  earR.position.set(-0.1, 0.22, -0.06);
  earR.rotation.z = 0.15;
  headGroup.add(earR);

  // 5. Flowing Tail
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0.2, -0.98);
  bodyGroup.add(tailPivot);

  const tailGeo = new THREE.CylinderGeometry(0.06, 0.15, 0.95, 8);
  tailGeo.translate(0, -0.44, -0.14);
  tailGeo.rotateX(-0.28);
  const tailMesh = new THREE.Mesh(tailGeo, maneMat);
  tailMesh.castShadow = true;
  tailPivot.add(tailMesh);

  // 6. Four 2-Segment Articulated Legs
  const legOffsets: Array<[number, number, number]> = [
    [0.28, -0.15, 0.62],
    [-0.28, -0.15, 0.62],
    [0.3, -0.15, -0.62],
    [-0.3, -0.15, -0.62],
  ];

  const legs: THREE.Group[] = [];
  const lowerLegs: THREE.Group[] = [];

  legOffsets.forEach(([lx, ly, lz]) => {
    const upperPivot = new THREE.Group();
    upperPivot.position.set(lx, ly, lz);
    bodyGroup.add(upperPivot);

    const upperGeo = new THREE.CylinderGeometry(0.13, 0.095, 0.62, 10);
    upperGeo.translate(0, -0.28, 0);
    const upperMesh = new THREE.Mesh(upperGeo, coatMat);
    upperMesh.castShadow = true;
    upperPivot.add(upperMesh);

    const lowerPivot = new THREE.Group();
    lowerPivot.position.set(0, -0.56, 0);
    upperPivot.add(lowerPivot);

    const lowerGeo = new THREE.CylinderGeometry(0.085, 0.068, 0.56, 10);
    lowerGeo.translate(0, -0.26, 0);
    const lowerMesh = new THREE.Mesh(lowerGeo, coatMat);
    lowerMesh.castShadow = true;
    lowerPivot.add(lowerMesh);

    const hoofGeo = new THREE.CylinderGeometry(0.075, 0.095, 0.12, 10);
    hoofGeo.translate(0, -0.55, 0.02);
    const hoofMesh = new THREE.Mesh(hoofGeo, hoofMat);
    hoofMesh.castShadow = true;
    lowerPivot.add(hoofMesh);

    legs.push(upperPivot);
    lowerLegs.push(lowerPivot);
  });

  const setEquineLoadout = (armor: HorseArmorType, saddle: HorseSaddleType) => {
    // Update Saddle & Blanket colors/materials
    if (saddle === 'nomad_light') {
      saddleBlanketMat.color.setHex(0x854d27);
      saddleMat.color.setHex(0x5c3419);
      trimMat.color.setHex(0xb4833e);
      blanketMesh.scale.set(0.95, 0.85, 0.9);
    } else if (saddle === 'kayi_chieftain') {
      saddleBlanketMat.color.setHex(0x124e66);
      saddleMat.color.setHex(0x3e2212);
      trimMat.color.setHex(0xd4a853);
      blanketMesh.scale.set(1.0, 1.0, 1.0);
    } else if (saddle === 'royal_velvet') {
      saddleBlanketMat.color.setHex(0x881313);
      saddleMat.color.setHex(0x2a1414);
      trimMat.color.setHex(0xfbbf24);
      blanketMesh.scale.set(1.06, 1.15, 1.12);
    }

    // Update Horse Armor Barding visibility & finish
    if (armor === 'unarmored') {
      bardingGroup.visible = false;
      crinetMesh.visible = false;
      chamfron.visible = false;
    } else if (armor === 'kayi_leather') {
      bardingGroup.visible = true;
      crinetMesh.visible = false;
      chamfron.visible = true;
      bardingArmorMat.color.setHex(0x4e2f1d);
      bardingArmorMat.roughness = 0.48;
      bardingArmorMat.metalness = 0.28;
    } else if (armor === 'seljuk_scale') {
      bardingGroup.visible = true;
      crinetMesh.visible = true;
      chamfron.visible = true;
      bardingArmorMat.color.setHex(0xd4a853);
      bardingArmorMat.roughness = 0.22;
      bardingArmorMat.metalness = 0.88;
    } else if (armor === 'cataphract_steel') {
      bardingGroup.visible = true;
      crinetMesh.visible = true;
      chamfron.visible = true;
      bardingArmorMat.color.setHex(0xcbd5e1);
      bardingArmorMat.roughness = 0.14;
      bardingArmorMat.metalness = 0.95;
    }
  };

  return {
    group,
    bodyGroup,
    neckPivot,
    tailPivot,
    legs: legs as [THREE.Group, THREE.Group, THREE.Group, THREE.Group],
    lowerLegs: lowerLegs as [THREE.Group, THREE.Group, THREE.Group, THREE.Group],
    saddleMountPoint,
    setEquineLoadout,
  };
}

/**
 * Builds an elegant 13th-century Kayı Hatun (Turkmen noblewoman / villager)
 * with flowing silk dress, embroidered vest, braided hair, and jeweled headpiece.
 */
export function createHatunModel(dressColorHex = 0x155e75): {
  group: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
} {
  const group = new THREE.Group();

  const silkDressMat = new THREE.MeshStandardMaterial({
    color: dressColorHex,
    roughness: 0.65,
    metalness: 0.08,
  });

  const goldEmbroideryMat = new THREE.MeshStandardMaterial({
    color: 0xd4a853,
    roughness: 0.25,
    metalness: 0.85,
  });

  const veilMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.75,
    side: THREE.DoubleSide,
  });

  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xe6baa0,
    roughness: 0.55,
  });

  const hairMat = new THREE.MeshStandardMaterial({
    color: 0x261811,
    roughness: 0.85,
  });

  // 1. Flowing Floor-Length Kaftan Skirt
  const skirtGeo = new THREE.ConeGeometry(0.38, 1.05, 16);
  skirtGeo.translate(0, 0.52, 0);
  const skirtMesh = new THREE.Mesh(skirtGeo, silkDressMat);
  skirtMesh.castShadow = true;
  skirtMesh.receiveShadow = true;
  group.add(skirtMesh);

  // Gold Embroidered Belt Sash
  const sash = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.12, 14), goldEmbroideryMat);
  sash.position.y = 0.98;
  group.add(sash);

  // 2. Fitted Velvet Bodice & Gold Necklace
  const bodiceGeo = new THREE.CylinderGeometry(0.21, 0.18, 0.48, 14);
  bodiceGeo.translate(0, 1.24, 0);
  const bodiceMesh = new THREE.Mesh(bodiceGeo, silkDressMat);
  bodiceMesh.castShadow = true;
  group.add(bodiceMesh);

  const necklace = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.02, 8, 16), goldEmbroideryMat);
  necklace.rotation.x = Math.PI / 2 + 0.2;
  necklace.position.set(0, 1.44, 0.04);
  group.add(necklace);

  // 3. Head, Face, Braids & Jeweled Turkic Hotoz Crown with Silk Veil
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.145, 14, 12), skinMat);
  headMesh.position.y = 1.62;
  headMesh.castShadow = true;
  group.add(headMesh);

  // Twin Long Braids
  [-0.1, 0.1].forEach((bx) => {
    const braid = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.02, 0.52, 8), hairMat);
    braid.position.set(bx, 1.42, -0.06);
    group.add(braid);
  });

  // Ornate Hotoz / Crown Headpiece
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.14, 0.14, 14), goldEmbroideryMat);
  crown.position.y = 1.76;
  group.add(crown);

  const veil = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.58, 12, 1, true), veilMat);
  veil.position.set(0, 1.56, -0.06);
  group.add(veil);

  // 4. Articulated Arms with Wide Sleeves
  const leftArm = new THREE.Group();
  leftArm.position.set(0.24, 1.42, 0);
  const sleeveGeo = new THREE.ConeGeometry(0.1, 0.46, 10);
  sleeveGeo.rotateX(Math.PI);
  sleeveGeo.translate(0, -0.22, 0);
  leftArm.add(new THREE.Mesh(sleeveGeo, silkDressMat));
  group.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(-0.24, 1.42, 0);
  rightArm.add(new THREE.Mesh(sleeveGeo, silkDressMat));
  group.add(rightArm);

  return { group, leftArm, rightArm };
}

/**
 * Builds an articulated medieval warrior supporting distinct factions.
 */
export function createWarriorModel(
  faction: 'player' | 'kayi' | 'byzantine' | 'mongol' | 'merchant',
  maxAnisotropy: number
): WarriorRig {
  const group = new THREE.Group();

  const hipsPivot = new THREE.Group();
  hipsPivot.position.y = 0.92;
  group.add(hipsPivot);

  const torsoPivot = new THREE.Group();
  hipsPivot.add(torsoPivot);

  const isEnemy = faction === 'byzantine' || faction === 'mongol';
  const tunicColor =
    faction === 'player'
      ? 0x124e66
      : faction === 'kayi'
      ? 0x1a5f7a
      : faction === 'byzantine'
      ? 0x7a1c1c
      : faction === 'mongol'
      ? 0x2d2620
      : 0x92622a;

  const armorColor =
    faction === 'player'
      ? 0x3b2618
      : faction === 'kayi'
      ? 0x4a3222
      : faction === 'byzantine'
      ? 0x383c42
      : faction === 'mongol'
      ? 0x241d18
      : 0x6b4c30;

  const metalColor =
    faction === 'player' || faction === 'kayi'
      ? 0xd4a853
      : faction === 'mongol'
      ? 0x71717a
      : 0xa5aab2;

  const tunicMat = new THREE.MeshStandardMaterial({
    color: tunicColor,
    roughness: 0.8,
    metalness: 0.05,
  });

  const leatherArmorMat = new THREE.MeshStandardMaterial({
    color: armorColor,
    roughness: 0.44,
    metalness: isEnemy ? 0.62 : 0.26,
  });

  const metalMat = new THREE.MeshStandardMaterial({
    color: metalColor,
    roughness: 0.18,
    metalness: 0.92,
  });

  const steelBladeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.12,
    metalness: 0.96,
  });

  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xd8a886,
    roughness: 0.62,
    metalness: 0.02,
  });

  const furMat = new THREE.MeshStandardMaterial({
    color: faction === 'mongol' ? 0x1c1917 : isEnemy ? 0x2a2d34 : 0x2b1e16,
    roughness: 0.94,
    metalness: 0.02,
  });

  const chestGeo = new THREE.CylinderGeometry(0.25, 0.21, 0.66, 12);
  chestGeo.translate(0, 0.33, 0);
  const chestMesh = new THREE.Mesh(chestGeo, leatherArmorMat);
  chestMesh.castShadow = true;
  torsoPivot.add(chestMesh);

  const mirrorPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.04, 14), metalMat);
  mirrorPlate.rotation.x = Math.PI / 2;
  mirrorPlate.position.set(0, 0.4, 0.22);
  torsoPivot.add(mirrorPlate);

  const skirtGeo = new THREE.CylinderGeometry(0.22, 0.31, 0.42, 12);
  skirtGeo.translate(0, -0.12, 0);
  const skirtMesh = new THREE.Mesh(skirtGeo, tunicMat);
  skirtMesh.castShadow = true;
  hipsPivot.add(skirtMesh);

  const beltMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.09, 14), metalMat);
  beltMesh.position.set(0, 0.04, 0);
  torsoPivot.add(beltMesh);

  const pauldronGeo = new THREE.SphereGeometry(0.15, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const pauldronL = new THREE.Mesh(pauldronGeo, faction === 'mongol' ? furMat : leatherArmorMat);
  pauldronL.position.set(0.27, 0.58, 0);
  pauldronL.rotation.z = -0.35;
  torsoPivot.add(pauldronL);

  const pauldronR = new THREE.Mesh(pauldronGeo, faction === 'mongol' ? furMat : leatherArmorMat);
  pauldronR.position.set(-0.27, 0.58, 0);
  pauldronR.rotation.z = 0.35;
  torsoPivot.add(pauldronR);

  const capeGeo = new THREE.PlaneGeometry(0.56, 0.92, 4, 6);
  capeGeo.translate(0, -0.45, 0);
  const capeMat = new THREE.MeshStandardMaterial({
    color:
      faction === 'player'
        ? 0x1b242c
        : faction === 'byzantine'
        ? 0x5c1414
        : faction === 'mongol'
        ? 0x1c1917
        : 0x263238,
    roughness: 0.9,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  const capeMesh = new THREE.Mesh(capeGeo, capeMat);
  capeMesh.position.set(0, 0.62, -0.22);
  capeMesh.rotation.x = 0.16;
  capeMesh.castShadow = true;
  torsoPivot.add(capeMesh);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.72, 0);
  torsoPivot.add(headGroup);

  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 12), skinMat);
  headMesh.position.y = 0.14;
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  const beardMesh = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.18, 10), furMat);
  beardMesh.rotation.x = Math.PI;
  beardMesh.position.set(0, 0.05, 0.06);
  headGroup.add(beardMesh);

  if (faction === 'byzantine') {
    const helmDome = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.28, 12), steelBladeMat);
    helmDome.position.y = 0.28;
    headGroup.add(helmDome);

    const helmBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.04, 14), metalMat);
    helmBrim.position.y = 0.18;
    headGroup.add(helmBrim);
  } else if (faction === 'mongol') {
    const furFlap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.16, 12), furMat);
    furFlap.position.y = 0.22;
    headGroup.add(furFlap);

    const ironCrown = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), metalMat);
    ironCrown.position.y = 0.26;
    headGroup.add(ironCrown);

    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.16, 8), steelBladeMat);
    spike.position.y = 0.45;
    headGroup.add(spike);
  } else {
    const borkFurRim = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.175, 0.12, 14), furMat);
    borkFurRim.position.y = 0.22;
    headGroup.add(borkFurRim);

    const borkCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.17, 0.16, 12), tunicMat);
    borkCrown.position.y = 0.34;
    headGroup.add(borkCrown);

    const borkCrest = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.09, 8), metalMat);
    borkCrest.position.y = 0.45;
    headGroup.add(borkCrest);
  }

  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(0.31, 0.58, 0);
  torsoPivot.add(leftArmPivot);

  const leftArmMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.42, 6, 10), tunicMat);
  leftArmMesh.position.y = -0.22;
  leftArmMesh.castShadow = true;
  leftArmPivot.add(leftArmMesh);

  const shieldGroup = new THREE.Group();
  shieldGroup.position.set(0.12, -0.32, 0.14);
  shieldGroup.rotation.y = Math.PI / 2 - 0.3;
  leftArmPivot.add(shieldGroup);

  const shieldTex = isEnemy ? undefined : createKayiBannerTexture(maxAnisotropy);
  const shieldFaceMat = new THREE.MeshStandardMaterial({
    color: faction === 'byzantine' ? 0x7f1d1d : faction === 'mongol' ? 0x27272a : 0xffffff,
    map: shieldTex,
    roughness: 0.5,
    metalness: 0.25,
  });

  const shieldDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.04, 18), shieldFaceMat);
  shieldDisc.rotation.x = Math.PI / 2;
  shieldDisc.castShadow = true;
  shieldGroup.add(shieldDisc);

  const shieldRim = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.025, 8, 20), metalMat);
  shieldGroup.add(shieldRim);

  const shieldBoss = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), metalMat);
  shieldBoss.position.z = 0.03;
  shieldGroup.add(shieldBoss);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(-0.31, 0.58, 0);
  torsoPivot.add(rightArmPivot);

  const rightArmMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.42, 6, 10), tunicMat);
  rightArmMesh.position.y = -0.22;
  rightArmMesh.castShadow = true;
  rightArmPivot.add(rightArmMesh);

  const kilijGroup = new THREE.Group();
  kilijGroup.position.set(0, -0.44, 0.08);
  rightArmPivot.add(kilijGroup);

  const hiltMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.028, 0.22, 8), leatherArmorMat);
  hiltMesh.rotation.x = Math.PI / 2;
  kilijGroup.add(hiltMesh);

  const crossguard = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.035, 0.045), metalMat);
  crossguard.position.z = 0.1;
  kilijGroup.add(crossguard);

  const bladeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0.12),
    new THREE.Vector3(0, 0.02, 0.48),
    new THREE.Vector3(0, 0.08, 0.85),
    new THREE.Vector3(0, 0.17, 1.12),
  ]);
  const bladeGeo = new THREE.TubeGeometry(bladeCurve, 14, 0.026, 6, false);
  bladeGeo.scale(0.35, 1.4, 1);
  const bladeMesh = new THREE.Mesh(bladeGeo, steelBladeMat);
  bladeMesh.castShadow = true;
  kilijGroup.add(bladeMesh);

  const bowGroup = new THREE.Group();
  bowGroup.position.set(0, -0.42, 0.12);
  bowGroup.visible = false;
  rightArmPivot.add(bowGroup);

  const bowCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.52, -0.08),
    new THREE.Vector3(0, -0.32, 0.12),
    new THREE.Vector3(0, 0, 0.04),
    new THREE.Vector3(0, 0.32, 0.12),
    new THREE.Vector3(0, 0.52, -0.08),
  ]);
  const bowLimbGeo = new THREE.TubeGeometry(bowCurve, 20, 0.022, 8, false);
  const bowLimbMesh = new THREE.Mesh(bowLimbGeo, leatherArmorMat);
  bowGroup.add(bowLimbMesh);

  const bowStringGeo = new THREE.CylinderGeometry(0.004, 0.004, 1.02, 4);
  const bowStringMesh = new THREE.Mesh(
    bowStringGeo,
    new THREE.MeshBasicMaterial({ color: 0xe5e0d5 })
  );
  bowStringMesh.position.set(0, 0, -0.07);
  bowGroup.add(bowStringMesh);

  const lanceGroup = new THREE.Group();
  lanceGroup.position.set(0, -0.42, 0.15);
  lanceGroup.visible = false;
  rightArmPivot.add(lanceGroup);

  const shaftGeo = new THREE.CylinderGeometry(0.024, 0.028, 2.65, 8);
  shaftGeo.rotateX(Math.PI / 2);
  shaftGeo.translate(0, 0, 0.75);
  const shaftMesh = new THREE.Mesh(shaftGeo, leatherArmorMat);
  shaftMesh.castShadow = true;
  lanceGroup.add(shaftMesh);

  const spearTipGeo = new THREE.ConeGeometry(0.055, 0.36, 8);
  spearTipGeo.rotateX(Math.PI / 2);
  spearTipGeo.translate(0, 0, 2.22);
  const spearTipMesh = new THREE.Mesh(spearTipGeo, steelBladeMat);
  lanceGroup.add(spearTipMesh);

  const pennantGeo = new THREE.PlaneGeometry(0.36, 0.16);
  const pennantMesh = new THREE.Mesh(
    pennantGeo,
    new THREE.MeshStandardMaterial({
      color: isEnemy ? 0x991b1b : 0x0ea5e9,
      side: THREE.DoubleSide,
      roughness: 0.7,
    })
  );
  pennantMesh.position.set(0, -0.1, 1.85);
  pennantMesh.rotation.y = Math.PI / 2;
  lanceGroup.add(pennantMesh);

  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(0.14, 0, 0);
  hipsPivot.add(leftLegPivot);

  const legGeo = new THREE.CapsuleGeometry(0.085, 0.56, 6, 10);
  legGeo.translate(0, -0.36, 0);
  const leftLegMesh = new THREE.Mesh(legGeo, leatherArmorMat);
  leftLegMesh.castShadow = true;
  leftLegPivot.add(leftLegMesh);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(-0.14, 0, 0);
  hipsPivot.add(rightLegPivot);

  const rightLegMesh = new THREE.Mesh(legGeo, leatherArmorMat);
  rightLegMesh.castShadow = true;
  rightLegPivot.add(rightLegMesh);

  const slashArcGeo = new THREE.RingGeometry(0.9, 1.65, 24, 1, -Math.PI * 0.45, Math.PI * 0.9);
  slashArcGeo.rotateX(-Math.PI / 2);
  const slashArcMat = new THREE.MeshBasicMaterial({
    color: isEnemy ? 0xf87171 : 0x7dd3fc,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const slashArcMesh = new THREE.Mesh(slashArcGeo, slashArcMat);
  slashArcMesh.position.set(0, 1.15, 0.35);
  group.add(slashArcMesh);

  const telegraphGeo = new THREE.RingGeometry(0.65, 0.85, 24);
  telegraphGeo.rotateX(-Math.PI / 2);
  const telegraphMat = new THREE.MeshBasicMaterial({
    color: 0xef4444,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const telegraphRing = new THREE.Mesh(telegraphGeo, telegraphMat);
  telegraphRing.position.y = 0.08;
  group.add(telegraphRing);

  const setWeapon = (w: WeaponType) => {
    kilijGroup.visible = w === 'kilij';
    bowGroup.visible = w === 'bow';
    lanceGroup.visible = w === 'lance';
    shieldGroup.visible = w !== 'bow';
  };

  return {
    group,
    hipsPivot,
    torsoPivot,
    headGroup,
    rightArmPivot,
    leftArmPivot,
    rightLegPivot,
    leftLegPivot,
    capeMesh,
    kilijGroup,
    bowGroup,
    lanceGroup,
    shieldGroup,
    slashArcMesh,
    telegraphRing,
    setWeapon,
  };
}

export function createWaterfallModel(
  uTimeUniform: { value: number },
  maxAnisotropy: number
): { group: THREE.Group; foamRing: THREE.Mesh } {
  const group = new THREE.Group();
  const normalTex = createMicroNormalTexture(maxAnisotropy, 16);

  const cliffMat = new THREE.MeshStandardMaterial({
    color: 0x4b5056,
    normalMap: normalTex,
    roughness: 0.72,
    metalness: 0.08,
  });

  const cliffPlacements = [
    { x: -9.5, y: 11, z: -2, sx: 6.5, sy: 24, sz: 7.5 },
    { x: 9.5, y: 11, z: -2, sx: 6.5, sy: 24, sz: 7.5 },
    { x: -5.2, y: 6.5, z: 2.5, sx: 4.5, sy: 14, sz: 5.5 },
    { x: 5.2, y: 6.5, z: 2.5, sx: 4.5, sy: 14, sz: 5.5 },
    { x: 0, y: 12.5, z: -5.5, sx: 14, sy: 25, sz: 6 },
  ];

  cliffPlacements.forEach((cp) => {
    const rockGeo = new THREE.DodecahedronGeometry(1, 1);
    rockGeo.scale(cp.sx, cp.sy * 0.5, cp.sz);
    const mesh = new THREE.Mesh(rockGeo, cliffMat);
    mesh.position.set(cp.x, cp.y, cp.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  });

  const fallCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 23.5, -4.5),
    new THREE.Vector3(0, 18.0, -1.2),
    new THREE.Vector3(0, 9.5, 2.2),
    new THREE.Vector3(0, 0.0, 4.8),
  ]);
  const fallGeo = new THREE.TubeGeometry(fallCurve, 32, 4.4, 16, false);
  fallGeo.scale(1.65, 1.0, 0.32);

  const fallMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: uTimeUniform,
      uWaterColor: { value: new THREE.Color('#228be6') },
      uFoamColor: { value: new THREE.Color('#f1f5f9') },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      uniform float uTime;

      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec3 pos = position;
        float ripple = sin(pos.y * 2.5 - uTime * 9.0 + pos.x * 1.5) * 0.14;
        pos.z += ripple;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      uniform float uTime;
      uniform vec3 uWaterColor;
      uniform vec3 uFoamColor;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      void main() {
        vec2 flowUv = vec2(vUv.x * 6.0, vUv.y * 4.5 + uTime * 2.6);
        float n1 = noise(flowUv);
        float n2 = noise(flowUv * 2.3 + vec2(0.0, uTime * 1.8));
        float streak = smoothstep(0.38, 0.75, n1 * 0.65 + n2 * 0.45);
        float crestFoam = smoothstep(0.22, 0.0, vUv.x) + smoothstep(0.75, 1.0, vUv.x);
        float totalFoam = clamp(streak + crestFoam * 0.75, 0.0, 1.0);
        vec3 col = mix(uWaterColor, uFoamColor, totalFoam);
        gl_FragColor = vec4(col, 0.88);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const fallMesh = new THREE.Mesh(fallGeo, fallMat);
  group.add(fallMesh);

  const foamRingGeo = new THREE.RingGeometry(2.2, 10.5, 32);
  foamRingGeo.rotateX(-Math.PI / 2);
  const foamRingMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: uTimeUniform,
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      void main() {
        float dist = length(vUv - vec2(0.5)) * 2.0;
        float wave = sin(dist * 18.0 - uTime * 4.5) * 0.5 + 0.5;
        float alpha = (1.0 - smoothstep(0.3, 1.0, dist)) * wave * 0.75;
        gl_FragColor = vec4(0.92, 0.96, 1.0, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
  });

  const foamRing = new THREE.Mesh(foamRingGeo, foamRingMat);
  foamRing.position.set(0, 0.14, 5.5);
  group.add(foamRing);

  return { group, foamRing };
}

export function createCaravanseraiModel(maxAnisotropy: number): THREE.Group {
  const group = new THREE.Group();
  const normalTex = createMicroNormalTexture(maxAnisotropy, 12);
  const carpetTex = createKayiTextileTexture(maxAnisotropy);

  const sandstoneMat = new THREE.MeshStandardMaterial({
    color: 0xc2a882,
    normalMap: normalTex,
    roughness: 0.82,
    metalness: 0.04,
  });

  const seljukTileMat = new THREE.MeshStandardMaterial({
    color: 0x0e7490,
    roughness: 0.22,
    metalness: 0.38,
  });

  const awningMatCrimson = new THREE.MeshStandardMaterial({
    color: 0x991b1b,
    roughness: 0.85,
    side: THREE.DoubleSide,
  });

  const awningMatSaffron = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.85,
    side: THREE.DoubleSide,
  });

  const awningMatEmerald = new THREE.MeshStandardMaterial({
    color: 0x0f766e,
    roughness: 0.85,
    side: THREE.DoubleSide,
  });

  const timberMat = new THREE.MeshStandardMaterial({
    color: 0x5c3d24,
    roughness: 0.85,
  });

  // 1. Grand Seljuk Crown Portal (Taçkapı) Archway
  const portalLeft = new THREE.Mesh(new THREE.BoxGeometry(2.8, 7.5, 2.8), sandstoneMat);
  portalLeft.position.set(-3.2, 3.75, 0);
  portalLeft.castShadow = true;
  portalLeft.receiveShadow = true;
  group.add(portalLeft);

  const portalRight = new THREE.Mesh(new THREE.BoxGeometry(2.8, 7.5, 2.8), sandstoneMat);
  portalRight.position.set(3.2, 3.75, 0);
  portalRight.castShadow = true;
  portalRight.receiveShadow = true;
  group.add(portalRight);

  const portalHeader = new THREE.Mesh(new THREE.BoxGeometry(9.4, 2.2, 3.0), sandstoneMat);
  portalHeader.position.set(0, 8.2, 0);
  portalHeader.castShadow = true;
  group.add(portalHeader);

  [-2.8, 0, 2.8].forEach((mx) => {
    const medallion = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.16, 16), seljukTileMat);
    medallion.rotation.x = Math.PI / 2;
    medallion.position.set(mx, 8.2, 1.52);
    group.add(medallion);
  });

  // 2. Expanded Bustling Courtyard Bazaar Merchant Stalls (8 Stalls + Carpet Looms)
  const stalls = [
    { x: -10, z: 9, mat: awningMatCrimson, rot: 0.3 },
    { x: 10, z: 9, mat: awningMatSaffron, rot: -0.3 },
    { x: -11, z: -8, mat: awningMatSaffron, rot: -0.2 },
    { x: 11, z: -8, mat: awningMatCrimson, rot: 0.2 },
    { x: -17, z: 1, mat: awningMatEmerald, rot: 1.5 },
    { x: 17, z: 1, mat: awningMatEmerald, rot: -1.5 },
  ];

  stalls.forEach((st) => {
    const stallGrp = new THREE.Group();
    stallGrp.position.set(st.x, 0, st.z);
    stallGrp.rotation.y = st.rot;

    const canopy = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.12, 3.4), st.mat);
    canopy.position.y = 2.65;
    canopy.rotation.x = 0.15;
    canopy.castShadow = true;
    stallGrp.add(canopy);

    [
      [-1.9, -1.4],
      [1.9, -1.4],
      [-1.9, 1.4],
      [1.9, 1.4],
    ].forEach(([px, pz]) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.65, 6), timberMat);
      pole.position.set(px, 1.32, pz);
      stallGrp.add(pole);
    });

    const counter = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.9, 1.2), timberMat);
    counter.position.set(0, 0.45, 0);
    counter.castShadow = true;
    stallGrp.add(counter);

    // Hanging Woven Anatolian Carpet Backdrop
    const carpet = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 2.1),
      new THREE.MeshStandardMaterial({ map: carpetTex, side: THREE.DoubleSide })
    );
    carpet.position.set(0, 1.4, -1.35);
    stallGrp.add(carpet);

    group.add(stallGrp);
  });

  return group;
}

export function createYurtModel(
  radius: number,
  isBeyTent: boolean,
  maxAnisotropy: number
): THREE.Group {
  const group = new THREE.Group();
  const textileTex = createKayiTextileTexture(maxAnisotropy);
  const bannerTex = createKayiBannerTexture(maxAnisotropy);

  const wallHeight = isBeyTent ? 2.85 : 2.25;
  const roofHeight = isBeyTent ? 2.1 : 1.55;

  const deckGeo = new THREE.CylinderGeometry(radius * 1.06, radius * 1.09, 0.26, 28);
  deckGeo.translate(0, 0.13, 0);
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x5c3d24,
    roughness: 0.78,
    metalness: 0.05,
  });
  const deckMesh = new THREE.Mesh(deckGeo, woodMat);
  deckMesh.receiveShadow = true;
  deckMesh.castShadow = true;
  group.add(deckMesh);

  const wallGeo = new THREE.CylinderGeometry(radius, radius, wallHeight, 28);
  wallGeo.translate(0, 0.26 + wallHeight / 2, 0);
  const wallMat = new THREE.MeshStandardMaterial({
    map: textileTex,
    roughness: 0.88,
    metalness: 0.02,
  });
  const wallMesh = new THREE.Mesh(wallGeo, wallMat);
  wallMesh.castShadow = true;
  wallMesh.receiveShadow = true;
  group.add(wallMesh);

  const roofGeo = new THREE.ConeGeometry(radius * 1.05, roofHeight, 28);
  roofGeo.translate(0, 0.26 + wallHeight + roofHeight / 2, 0);
  const roofMat = new THREE.MeshStandardMaterial({
    color: isBeyTent ? 0x124e66 : 0xdfd5c3,
    roughness: 0.84,
    metalness: 0.04,
  });
  const roofMesh = new THREE.Mesh(roofGeo, roofMat);
  roofMesh.castShadow = true;
  roofMesh.receiveShadow = true;
  group.add(roofMesh);

  const crownRingGeo = new THREE.TorusGeometry(radius * 0.22, 0.09, 10, 24);
  crownRingGeo.rotateX(Math.PI / 2);
  const goldWoodMat = new THREE.MeshStandardMaterial({
    color: 0xc28f38,
    roughness: 0.35,
    metalness: 0.55,
  });
  const crownRing = new THREE.Mesh(crownRingGeo, goldWoodMat);
  crownRing.position.y = 0.26 + wallHeight + roofHeight - 0.15;
  group.add(crownRing);

  const doorFrameGeo = new THREE.BoxGeometry(1.45, wallHeight * 0.86, 0.42);
  const doorFrame = new THREE.Mesh(doorFrameGeo, woodMat);
  doorFrame.position.set(0, 0.26 + (wallHeight * 0.86) / 2, radius);
  doorFrame.castShadow = true;
  group.add(doorFrame);

  const doorCurtainGeo = new THREE.BoxGeometry(1.12, wallHeight * 0.78, 0.46);
  const curtainMat = new THREE.MeshStandardMaterial({
    color: 0x7c1d1d,
    map: bannerTex,
    roughness: 0.85,
  });
  const doorCurtain = new THREE.Mesh(doorCurtainGeo, curtainMat);
  doorCurtain.position.set(0, 0.26 + (wallHeight * 0.78) / 2, radius + 0.02);
  group.add(doorCurtain);

  const poleOffsets = [-1.45, 1.45];
  poleOffsets.forEach((px) => {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.07, wallHeight + 2.2, 8),
      woodMat
    );
    pole.position.set(px, (wallHeight + 2.2) / 2, radius + 0.85);
    pole.castShadow = true;
    group.add(pole);

    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.78, 1.45),
      new THREE.MeshStandardMaterial({
        map: bannerTex,
        side: THREE.DoubleSide,
        roughness: 0.75,
      })
    );
    flag.position.set(px + (px > 0 ? 0.42 : -0.42), wallHeight + 1.15, radius + 0.85);
    flag.castShadow = true;
    group.add(flag);
  });

  return group;
}

export function createBridgeModel(): THREE.Group {
  const group = new THREE.Group();
  const darkTimberMat = new THREE.MeshStandardMaterial({
    color: 0x4a331f,
    roughness: 0.86,
    metalness: 0.04,
  });
  const plankMat = new THREE.MeshStandardMaterial({
    color: 0x694b2e,
    roughness: 0.82,
    metalness: 0.05,
  });

  const numPlanks = 28;
  for (let i = 0; i <= numPlanks; i++) {
    const t = i / numPlanks;
    const x = -5 + t * 32;
    const archY = Math.sin(t * Math.PI) * 1.55 + 0.78;

    const plank = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.18, 7.6), plankMat);
    plank.position.set(x, archY, -20);
    plank.receiveShadow = true;
    plank.castShadow = true;
    group.add(plank);

    if (i % 4 === 0) {
      [-3.5, 3.5].forEach((zOff) => {
        const postHeight = archY + 3.8;
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.18, 0.22, postHeight, 8),
          darkTimberMat
        );
        post.position.set(x, archY - postHeight / 2 + 1.15, -20 + zOff);
        post.castShadow = true;
        group.add(post);

        if (i < numPlanks) {
          const nextT = Math.min(1, (i + 4) / numPlanks);
          const nextX = -5 + nextT * 32;
          const nextY = Math.sin(nextT * Math.PI) * 1.55 + 0.78;
          const railLen = Math.hypot(nextX - x, nextY - archY);
          const rail = new THREE.Mesh(
            new THREE.BoxGeometry(railLen, 0.12, 0.12),
            darkTimberMat
          );
          rail.position.set((x + nextX) / 2, (archY + nextY) / 2 + 1.0, -20 + zOff);
          rail.rotation.z = Math.atan2(nextY - archY, nextX - x);
          group.add(rail);
        }
      });
    }
  }

  return group;
}

export function createWatchtowerModel(): THREE.Group {
  const group = new THREE.Group();

  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x686b70,
    roughness: 0.9,
    metalness: 0.05,
  });

  const timberMat = new THREE.MeshStandardMaterial({
    color: 0x4d3522,
    roughness: 0.82,
    metalness: 0.05,
  });

  const crimsonBannerMat = new THREE.MeshStandardMaterial({
    color: 0x881313,
    roughness: 0.75,
    side: THREE.DoubleSide,
  });

  const baseMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(3.8, 4.5, 6.5, 8),
    stoneMat
  );
  baseMesh.position.y = 3.25;
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  group.add(baseMesh);

  const wallLeft = new THREE.Mesh(new THREE.BoxGeometry(10, 4.2, 1.6), stoneMat);
  wallLeft.position.set(-7.5, 2.1, 1.5);
  wallLeft.rotation.y = 0.25;
  wallLeft.castShadow = true;
  group.add(wallLeft);

  const wallRight = new THREE.Mesh(new THREE.BoxGeometry(10, 4.2, 1.6), stoneMat);
  wallRight.position.set(7.5, 2.1, 1.5);
  wallRight.rotation.y = -0.25;
  wallRight.castShadow = true;
  group.add(wallRight);

  const deckMesh = new THREE.Mesh(
    new THREE.BoxGeometry(8.2, 0.6, 8.2),
    timberMat
  );
  deckMesh.position.y = 6.7;
  deckMesh.castShadow = true;
  group.add(deckMesh);

  const corners = [
    [-3.4, -3.4],
    [3.4, -3.4],
    [-3.4, 3.4],
    [3.4, 3.4],
  ];
  corners.forEach(([cx, cz]) => {
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.26, 4.2, 8),
      timberMat
    );
    pillar.position.set(cx, 9.0, cz);
    pillar.castShadow = true;
    group.add(pillar);
  });

  const roofMesh = new THREE.Mesh(
    new THREE.ConeGeometry(6.2, 3.8, 8),
    timberMat
  );
  roofMesh.position.y = 12.8;
  roofMesh.castShadow = true;
  group.add(roofMesh);

  const banner = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.8), crimsonBannerMat);
  banner.position.set(0, 5.2, 4.35);
  group.add(banner);

  return group;
}

export function createCampfireModel(): { group: THREE.Group; flameMesh: THREE.Mesh; light: THREE.PointLight } {
  const group = new THREE.Group();

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.92 });
  const logMat = new THREE.MeshStandardMaterial({ color: 0x3b2314, roughness: 0.9 });

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), stoneMat);
    stone.position.set(Math.cos(a) * 0.72, 0.12, Math.sin(a) * 0.72);
    group.add(stone);
  }

  for (let i = 0; i < 4; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.1, 6), logMat);
    log.position.y = 0.18;
    log.rotation.z = Math.PI / 2 - 0.25;
    log.rotation.y = (i / 4) * Math.PI;
    group.add(log);
  }

  const flameMat = new THREE.MeshBasicMaterial({
    color: 0xff7b1a,
    transparent: true,
    opacity: 0.88,
  });
  const flameMesh = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.05, 7), flameMat);
  flameMesh.position.y = 0.62;
  group.add(flameMesh);

  const light = new THREE.PointLight(0xff8c2b, 3.2, 22, 1.6);
  light.position.set(0, 1.4, 0);
  group.add(light);

  return { group, flameMesh, light };
}

export function createArcheryTargetModel(): THREE.Group {
  const group = new THREE.Group();

  const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c3d24, roughness: 0.85 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.6, 8), woodMat);
  post.position.y = 0.8;
  post.castShadow = true;
  group.add(post);

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#e7dcc6';
  ctx.fillRect(0, 0, 128, 128);
  const rings = [
    { r: 58, color: '#1d4ed8' },
    { r: 40, color: '#b91c1c' },
    { r: 20, color: '#eab308' },
  ];
  rings.forEach(({ r, color }) => {
    ctx.beginPath();
    ctx.arc(64, 64, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 0.7, 0.14, 18),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 })
  );
  disc.rotation.x = Math.PI / 2;
  disc.position.set(0, 1.35, 0.08);
  disc.castShadow = true;
  group.add(disc);

  return group;
}
