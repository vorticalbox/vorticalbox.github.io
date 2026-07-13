import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { SeededRandom } from './random';
import type { Segment, Settlement } from './types';

const skies = { countryside: 0xa9c9dd, coast: 0x9ed8e8, woodland: 0xa9c7b0, suburbs: 0xb8cedb, city: 0xb8c1ca };

export class RailwayScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly composer: EffectComposer;
  private readonly scene = new THREE.Scene();
  private readonly sky = new Sky();
  private readonly camera = new THREE.PerspectiveCamera(68, 1, .1, 500);
  private readonly world = new THREE.Group();
  private readonly routeGeometry = new THREE.Group();
  private readonly extensionGeometry = new THREE.Group();
  private readonly railMaterial = this.material(0x59666b, .35);
  private readonly sleeperMaterial = this.material(0x4a3629);
  private readonly gravelMaterial = this.material(0x747c75);
  private readonly chairMaterial = this.material(0x343d42, .3);
  private activeObjects: THREE.Object3D[] = [];
  private readonly riverChannels: THREE.Vector4[] = Array.from({ length: 32 }, () => new THREE.Vector4(0, 0, 0, 0));
  private riverDistances: number[] = [];
  private readonly groundMaterial: THREE.MeshStandardMaterial;
  private segment!: Segment;
  private lastEnd = new THREE.Vector3();
  private routeCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]);

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.1;
    this.scene.fog = new THREE.Fog(0xa9c9dd, 24, 170); this.camera.position.set(0, 2.6, 0); this.camera.lookAt(0, 2.2, -20);
    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // A low threshold keeps the sky and terrain natural while giving sunlit rails and water a gentle lift.
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .12, .35, .82));
    this.composer.addPass(new OutputPass());
    this.sky.scale.setScalar(450000);
    const skyUniforms = this.sky.material.uniforms;
    skyUniforms.turbidity.value = 7; skyUniforms.rayleigh.value = 1.4; skyUniforms.mieCoefficient.value = .006; skyUniforms.mieDirectionalG.value = .78;
    skyUniforms.sunPosition.value.set(-45, 70, 20).normalize().multiplyScalar(450000);
    this.scene.add(this.sky);
    this.scene.add(new THREE.HemisphereLight(0xe3f4ff, 0x38532d, 2.5));
    const sun = new THREE.DirectionalLight(0xfff2ce, 2.2); sun.position.set(-45, 70, 20); sun.castShadow = true; this.scene.add(sun, this.world);
    this.groundMaterial = this.material(0x4e7f42);
    this.groundMaterial.onBeforeCompile = shader => {
      shader.uniforms.riverChannels = { value: this.riverChannels };
      shader.vertexShader = shader.vertexShader.replace('void main() {', 'varying vec2 riverWorldPosition;\n\nvoid main() {').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n  riverWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xz;');
      shader.fragmentShader = `uniform vec4 riverChannels[32];\nvarying vec2 riverWorldPosition;\nfloat grassNoise(vec2 point) { return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123); }\n${shader.fragmentShader}`.replace('#include <color_fragment>', `
        #include <color_fragment>
        vec2 grassCell = floor(riverWorldPosition * .75);
        float grassTone = grassNoise(grassCell) * .16 + grassNoise(floor(riverWorldPosition * .12)) * .13;
        diffuseColor.rgb *= .86 + grassTone;`).replace('#include <dithering_fragment>', `
        for (int index = 0; index < 32; index++) {
          vec4 channel = riverChannels[index];
          vec2 offset = riverWorldPosition - channel.xy;
          float localX = offset.x * cos(channel.z) - offset.y * sin(channel.z);
          float localZ = offset.x * sin(channel.z) + offset.y * cos(channel.z);
          if (abs(localX) < 44.0 && abs(localZ) < 15.5) discard;
        }
        #include <dithering_fragment>`);
    };
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(14000, 14000), this.groundMaterial); ground.rotation.x = -Math.PI / 2; ground.position.set(0, -.04, -4800); ground.receiveShadow = true; this.world.add(ground, this.routeGeometry, this.extensionGeometry);
  }

  resize() { this.renderer.setSize(innerWidth, innerHeight); this.composer.setSize(innerWidth, innerHeight); this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); }
  render() { this.composer.render(); }

  follow(distance: number) {
    const alongTrack = (value: number) => value <= this.segment.routeLength ? this.pointAt(value) : this.pointAt(this.segment.routeLength).addScaledVector(this.trackDirection(this.segment.routeLength), value - this.segment.routeLength);
    const position = alongTrack(distance), ahead = alongTrack(distance + 35);
    this.camera.position.set(position.x, 2.6, position.z); this.camera.lookAt(ahead.x, 2.2, ahead.z);
  }

  build(segment: Segment, append = false) {
    const start = append ? this.lastEnd.clone() : new THREE.Vector3();
    this.segment = segment; const random = new SeededRandom(segment.seed); if (!append) { this.clearScenery(); this.riverChannels.forEach(channel => channel.set(0, 0, 0, 0)); this.riverDistances = []; this.extensionGeometry.clear(); this.routeGeometry.clear(); }
    const sky = skies[segment.biome]; this.scene.background = new THREE.Color(sky); this.scene.fog!.color.setHex(sky);
    const points: THREE.Vector3[] = [];
    for (let distance = 0; distance < segment.routeLength; distance += 30) points.push(new THREE.Vector3(start.x + this.xAt(distance), 0, start.z - distance));
    points.push(new THREE.Vector3(start.x + this.xAt(segment.routeLength), 0, start.z - segment.routeLength));
    this.routeCurve = new THREE.CatmullRomCurve3(points); this.routeGeometry.clear();
    const ballast = new THREE.Mesh(new THREE.TubeGeometry(this.routeCurve, 300, 1.9, 8, false), this.gravelMaterial); ballast.scale.y = .008; ballast.position.y = 0; this.routeGeometry.add(ballast);
    for (const offset of [-.72, .72]) { const railPoints = points.map((point, index) => { const normal = this.trackNormal(Math.min(index * 30, segment.routeLength)); return new THREE.Vector3(point.x + normal.x * offset, .08, point.z + normal.y * offset); }); this.routeGeometry.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPoints), 300, .07, 6, false), this.railMaterial)); }
    this.addSleepers();
    this.addTrackExtension();
    for (const zone of segment.zones) this.addSpeedSign(zone.limit, Math.max(18, zone.start + 18));
    this.addHighlandBackdrop(random);
    this.addWaterFeatures(random);
    this.addScottishLandscape(random);
    for (let distance = 40; distance < segment.routeLength - 90; distance += 35 + random.next() * 55) if (!this.isInSettlement(distance)) this.addScenery(distance, random);
    this.addRoadsideTowns(random);
    this.addDepartureStation();
    this.addArrivalStation();
    this.addCityStations(random);
    this.addStationSettlements(random);
    this.lastEnd = points.at(-1)!.clone();
  }

  private material(color: number, roughness = .8) { return new THREE.MeshStandardMaterial({ color, roughness }); }
  private isInSettlement(distance: number) { return distance < this.segment.fromSettlementSpan * 950 || distance > this.segment.routeLength - this.segment.toSettlementSpan * 950; }
  private xAt(distance: number) { return this.segment.zones.reduce((x, zone) => { const bend = Math.sin(THREE.MathUtils.clamp((distance - zone.start) / zone.length, 0, 1) * Math.PI); return x + zone.curve * bend * bend; }, 0); }
  private pointAt(distance: number) { return this.routeCurve.getPointAt(THREE.MathUtils.clamp(distance / this.segment.routeLength, 0, 1)); }
  private trackDirection(distance: number) { const before = this.pointAt(Math.max(0, distance - 4)), after = this.pointAt(Math.min(this.segment.routeLength, distance + 4)); return new THREE.Vector3(after.x - before.x, 0, after.z - before.z).normalize(); }
  private trackNormal(distance: number) { const direction = this.trackDirection(distance); return new THREE.Vector2(-direction.z, direction.x); }
  private add(object: THREE.Object3D) { this.activeObjects.push(object); this.world.add(object); }
  private clearScenery() { this.activeObjects.forEach(object => this.world.remove(object)); this.activeObjects = []; }

  private addSleepers() {
    const count = Math.floor(this.segment.routeLength / 2), sleepers = new THREE.InstancedMesh(new THREE.BoxGeometry(2.3, .14, .28), this.sleeperMaterial, count), chairs = new THREE.InstancedMesh(new THREE.BoxGeometry(.24, .035, .18), this.chairMaterial, count * 2), matrix = new THREE.Matrix4();
    for (let index = 0; index < count; index++) {
      const distance = index * 2, point = this.pointAt(distance), future = this.pointAt(Math.min(distance + 4, this.segment.routeLength)), angle = Math.atan2(future.x - point.x, future.z - point.z);
      matrix.makeRotationY(angle); matrix.setPosition(point.x, 0, point.z); sleepers.setMatrixAt(index, matrix);
      const normal = this.trackNormal(distance);
      for (const [chairIndex, side] of [0, 1].entries()) { const offset = side ? .72 : -.72; matrix.makeRotationY(angle); matrix.setPosition(point.x + normal.x * offset, .085, point.z + normal.y * offset); chairs.setMatrixAt(index * 2 + chairIndex, matrix); }
    }
    sleepers.instanceMatrix.needsUpdate = true; chairs.instanceMatrix.needsUpdate = true; this.routeGeometry.add(sleepers, chairs);
  }

  private addTrackExtension() {
    const end = this.pointAt(this.segment.routeLength), before = this.pointAt(this.segment.routeLength - 12), direction = new THREE.Vector3(end.x - before.x, 0, end.z - before.z).normalize(), normal = new THREE.Vector3(-direction.z, 0, direction.x), length = 520, beyond = end.clone().addScaledVector(direction, length), curve = new THREE.LineCurve3(end, beyond);
    const ballast = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 1.9, 8, false), this.gravelMaterial); ballast.scale.y = .008; this.extensionGeometry.add(ballast);
    for (const offset of [-.72, .72]) { const railStart = end.clone().addScaledVector(normal, offset).add(new THREE.Vector3(0, .08, 0)), railEnd = beyond.clone().addScaledVector(normal, offset).add(new THREE.Vector3(0, .08, 0)); this.extensionGeometry.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(railStart, railEnd), 24, .07, 6, false), this.railMaterial)); }
    const count = Math.floor(length / 2), sleepers = new THREE.InstancedMesh(new THREE.BoxGeometry(2.3, .14, .28), this.sleeperMaterial, count), chairs = new THREE.InstancedMesh(new THREE.BoxGeometry(.24, .035, .18), this.chairMaterial, count * 2), matrix = new THREE.Matrix4(), angle = Math.atan2(direction.x, direction.z);
    for (let index = 0; index < count; index++) { const point = end.clone().addScaledVector(direction, index * 2); matrix.makeRotationY(angle); matrix.setPosition(point.x, 0, point.z); sleepers.setMatrixAt(index, matrix); for (const [chairIndex, side] of [0, 1].entries()) { matrix.makeRotationY(angle); matrix.setPosition(point.x + normal.x * (side ? .72 : -.72), .085, point.z + normal.z * (side ? .72 : -.72)); chairs.setMatrixAt(index * 2 + chairIndex, matrix); } }
    sleepers.instanceMatrix.needsUpdate = true; chairs.instanceMatrix.needsUpdate = true; this.extensionGeometry.add(sleepers, chairs);
  }

  private addSpeedSign(limit: number, distance: number) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128; const context = canvas.getContext('2d')!;
    context.fillStyle = '#fff'; context.beginPath(); context.arc(64, 64, 55, 0, Math.PI * 2); context.fill(); context.lineWidth = 10; context.strokeStyle = '#202020'; context.stroke(); context.fillStyle = '#202020'; context.font = 'bold 54px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(String(limit), 64, 67);
    const point = this.pointAt(distance), direction = this.trackDirection(distance), normal = this.trackNormal(distance), sign = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true })), post = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, 2.2, 6), this.material(0x60666a)), side = 4;
    sign.position.set(point.x + normal.x * side, 2.3, point.z + normal.y * side); sign.rotation.y = Math.atan2(-direction.x, -direction.z); post.position.set(point.x + normal.x * side + direction.x * .14, 1.05, point.z + normal.y * side + direction.z * .14); this.add(sign); this.add(post);
  }

  private addScenery(distance: number, random: SeededRandom) {
    const point = this.pointAt(distance), side = random.next() > .5 ? 1 : -1, x = point.x + side * (7 + random.next() * 30), z = point.z;
    if (this.segment.biome === 'woodland' || this.segment.biome === 'countryside') {
      const trees = this.segment.biome === 'woodland' ? 5 + random.integer(3) : 3 + random.integer(3);
      for (let index = 0; index < trees; index++) this.addPine(x + (random.next() - .5) * 8, z + (random.next() - .5) * 10, 1 + random.next() * .7, random);
      return;
    }
    if (this.segment.biome === 'coast') { const water = new THREE.Mesh(new THREE.BoxGeometry(80, .05, 70), this.material(0x4e9bb6, .25)); water.position.set(point.x + side * 35, -.12, z); this.add(water); if (random.next() < .65) this.addPine(point.x - side * (8 + random.next() * 18), z + (random.next() - .5) * 14, .8 + random.next() * .6, random); return; }
    const height = 2 + random.next() * (this.segment.biome === 'city' ? 8 : 3), building = new THREE.Mesh(new THREE.BoxGeometry(2 + random.next() * 3, height, 2 + random.next() * 2), this.material(random.next() > .5 ? 0x926f5c : 0x8c9baa)); building.position.set(x, height / 2, z); this.add(building);
  }

  private addPine(x: number, z: number, size: number, random: SeededRandom) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.2 * size, .3 * size, 2.2 * size, 6), this.material(0x5b3b25));
    const crown = new THREE.Mesh(new THREE.ConeGeometry(1.5 * size, 4.2 * size, 7), this.material(random.next() > .45 ? 0x1f5132 : 0x315f39));
    trunk.position.set(x, 1.1 * size, z); crown.position.set(x, 3.35 * size, z); trunk.castShadow = crown.castShadow = true; this.add(trunk); this.add(crown);
  }

  private addHighlandBackdrop(random: SeededRandom) {
    for (let distance = 250; distance < this.segment.routeLength; distance += 420 + random.next() * 360) {
      if (this.isInSettlement(distance)) continue;
      const point = this.pointAt(distance), side = random.next() > .5 ? 1 : -1, zone = this.segment.zones.find(candidate => distance >= candidate.start && distance < candidate.start + candidate.length), becomesTunnel = distance > 700 && distance < this.segment.routeLength - 850 && !zone?.curve && random.next() < .14;
      const width = 30 + random.next() * 42, height = 8 + random.next() * 16, depth = 38 + random.next() * 50;
      const hill = (color: number) => new THREE.Mesh(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), this.material(color));
      if (becomesTunnel) {
        // Two mountain shoulders deliberately leave a clear bore through the centre of the hill.
        const shoulderWidth = width * .7, color = random.next() > .5 ? 0x486e42 : 0x5e7450;
        const direction = this.trackDirection(distance), normal = this.trackNormal(distance), rotation = Math.atan2(direction.x, direction.z);
        for (const shoulderSide of [-1, 1]) { const shoulder = hill(color); shoulder.scale.set(shoulderWidth, height, depth); shoulder.position.copy(point).addScaledVector(direction, depth * .88).add(new THREE.Vector3(normal.x * shoulderSide * (shoulderWidth + 2.2), -.035, normal.y * shoulderSide * (shoulderWidth + 2.2))); shoulder.rotation.y = rotation; shoulder.castShadow = true; shoulder.receiveShadow = true; this.add(shoulder); }
        this.addTunnelPortal(distance, depth);
      } else {
        const regularHill = hill(random.next() > .5 ? 0x486e42 : 0x5e7450), direction = this.trackDirection(distance), normal = this.trackNormal(distance);
        // Offset from the local curve by the hill's full radius plus a clear ballast verge.
        // Using world X here let wide hills lean into curved sections of track.
        regularHill.scale.set(width, height, depth);
        regularHill.position.copy(point).addScaledVector(direction, (random.next() - .5) * 60).add(new THREE.Vector3(normal.x * side * (width + 5 + random.next() * 35), -.035, normal.y * side * (width + 5 + random.next() * 35)));
        regularHill.castShadow = true; regularHill.receiveShadow = true; this.add(regularHill);
      }
    }
  }

  private addWaterFeatures(random: SeededRandom) {
    const lochs = this.segment.biome === 'coast' ? 2 + random.integer(2) : 1 + random.integer(3);
    for (let index = 0; index < lochs; index++) {
      const distance = 500 + random.next() * (this.segment.routeLength - 1200), point = this.pointAt(distance), normal = this.trackNormal(distance), side = random.next() > .5 ? 1 : -1, radius = 20 + random.next() * 42;
      const loch = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * (0.72 + random.next() * .2), .035, 20), this.material(0x356f88, .25)); loch.position.set(point.x + normal.x * side * (radius + 12 + random.next() * 28), -.025, point.z + normal.y * side * (radius + 12 + random.next() * 28)); loch.receiveShadow = true; this.add(loch);
    }
    const rivers = 1 + random.integer(2);
    for (let index = 0; index < rivers; index++) { const distance = 1100 + random.next() * (this.segment.routeLength - 2200); this.riverDistances.push(distance); this.addRiverBridge(distance); }
  }

  private addScottishLandscape(random: SeededRandom) {
    const fieldMaterials = [this.material(0x5e8747), this.material(0x769c52), this.material(0x78924b), this.material(0x9b9b58)], hedge = this.material(0x315431);
    for (let distance = 170; distance < this.segment.routeLength - 160; distance += 180 + random.next() * 170) {
      if (this.isInSettlement(distance)) continue;
      const depth = 130 + random.next() * 150;
      if (this.riverDistances.some(river => Math.abs(river - distance) < depth / 2 + 35)) continue;
      const point = this.pointAt(distance), direction = this.trackDirection(distance), angle = Math.atan2(direction.x, direction.z);
      for (const side of [-1, 1]) {
        const width = 24 + random.next() * 42, verge = 7 + random.next() * 8, group = new THREE.Group();
        const field = new THREE.Mesh(new THREE.BoxGeometry(width, .018, depth), fieldMaterials[random.integer(fieldMaterials.length)]!);
        field.position.set(side * (verge + width / 2), -.027, 0); field.receiveShadow = true; group.add(field);
        // Low hedges divide the fields without ever crossing the railway verge.
        for (const z of [-depth / 2, depth / 2]) { const boundary = new THREE.Mesh(new THREE.BoxGeometry(width, .42, .35), hedge); boundary.position.set(side * (verge + width / 2), .16, z); boundary.castShadow = true; boundary.receiveShadow = true; group.add(boundary); }
        group.position.copy(point); group.rotation.y = angle; this.add(group);
      }
    }
    for (let distance = 320; distance < this.segment.routeLength - 240; distance += 420 + random.next() * 310) if (!this.isInSettlement(distance)) this.addForestPatch(distance, random);
  }

  private addForestPatch(distance: number, random: SeededRandom) {
    const point = this.pointAt(distance), direction = this.trackDirection(distance), normal = this.trackNormal(distance), side = random.next() > .5 ? 1 : -1, count = 14 + random.integer(16);
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.2, .3, 2.2, 6), this.material(0x593b25), count), crowns = new THREE.InstancedMesh(new THREE.ConeGeometry(1.5, 4.2, 7), this.material(random.next() > .45 ? 0x1f5132 : 0x315f39), count), matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion();
    for (let index = 0; index < count; index++) {
      const size = .75 + random.next() * 1.15, position = point.clone().addScaledVector(direction, (random.next() - .5) * 190).add(new THREE.Vector3(normal.x * side * (28 + random.next() * 85), 0, normal.y * side * (28 + random.next() * 85)));
      matrix.compose(position.clone().setY(1.1 * size), rotation, new THREE.Vector3(size, size, size)); trunks.setMatrixAt(index, matrix);
      matrix.compose(position.clone().setY(3.35 * size), rotation, new THREE.Vector3(size, size, size)); crowns.setMatrixAt(index, matrix);
    }
    trunks.instanceMatrix.needsUpdate = crowns.instanceMatrix.needsUpdate = true; trunks.castShadow = crowns.castShadow = true; this.add(trunks); this.add(crowns);
  }

  private addRiverBridge(distance: number) {
    const point = this.pointAt(distance), before = this.pointAt(Math.max(0, distance - 5)), after = this.pointAt(Math.min(this.segment.routeLength, distance + 5)), direction = new THREE.Vector3(after.x - before.x, 0, after.z - before.z).normalize(), angle = Math.atan2(direction.x, direction.z), group = new THREE.Group(), steel = this.material(0x45555a, .35), water = this.material(0x2e7da0, .2), bank = this.material(0x526847);
    const block = (width: number, height: number, depth: number, x: number, y: number, z: number, material: THREE.Material) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); };
    const channel = this.riverChannels.find(candidate => candidate.w === 0); channel?.set(point.x, point.z, angle, 1);
    // The global ground is cut away here; these two faces form a shallow, visible river bank down to the water.
    const bankFace = (nearZ: number, farZ: number) => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute([-44, -.04, farZ, 44, -.04, farZ, 44, -.48, nearZ, -44, -.48, nearZ], 3));
      geometry.setIndex([0, 1, 2, 0, 2, 3]); geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry, bank); mesh.receiveShadow = true; group.add(mesh);
    };
    bankFace(-11, -15.5); bankFace(11, 15.5);
    block(88, .05, 22, 0, -.5, 0, water);
    block(4.8, .12, 32, 0, -.02, 0, steel); block(.18, .55, 32, -2.35, .25, 0, steel); block(.18, .55, 32, 2.35, .25, 0, steel);
    for (const z of [-11, 0, 11]) { block(.35, .45, .45, -1.45, -.22, z, steel); block(.35, .45, .45, 1.45, -.22, z, steel); }
    group.position.set(point.x, 0, point.z); group.rotation.y = angle; this.add(group);
  }

  private addRoadsideTowns(random: SeededRandom) {
    const towns = 2 + random.integer(3);
    for (let index = 0; index < towns; index++) this.addRoadsideTown(900 + random.next() * (this.segment.routeLength - 2000), random);
  }

  private addRoadsideTown(centre: number, random: SeededRandom) {
    const wallColors = [0x9e816c, 0xb5ad9b, 0x795e50, 0x9a9b91];
    const buildings = 8 + random.integer(10);
    for (let index = 0; index < buildings; index++) {
      const distance = THREE.MathUtils.clamp(centre + (random.next() - .5) * 360, 80, this.segment.routeLength - 120), point = this.pointAt(distance), normal = this.trackNormal(distance), side = random.next() > .5 ? 1 : -1, offset = 10 + random.next() * 25, height = 2.5 + random.next() * 4.5, width = 3 + random.next() * 4, depth = 3 + random.next() * 4;
      const building = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), this.material(wallColors[random.integer(wallColors.length)]!)); building.position.set(point.x + normal.x * side * offset, height / 2, point.z + normal.y * side * offset); building.castShadow = true; building.receiveShadow = true; this.add(building);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(width * .88, 1.8, 4), this.material(0x3d4144)); roof.rotation.y = Math.PI / 4; roof.position.set(building.position.x, height + .9, building.position.z); roof.castShadow = true; this.add(roof);
    }
  }

  private addTunnelPortal(distance: number, hillDepth: number) {
    const point = this.pointAt(distance), direction = this.trackDirection(distance), group = new THREE.Group(), stone = this.material(0x5c5a54), dark = new THREE.MeshBasicMaterial({ color: 0x071012 });
    const block = (width: number, height: number, depth: number, x: number, y: number, z: number, material: THREE.Material = stone) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); };
    const portal = (z: number) => { block(1, 3.5, 1.5, -2.45, 1.75, z); block(1, 3.5, 1.5, 2.45, 1.75, z); block(5.9, 1.25, 1.5, 0, 4.1, z); };
    const tunnelLength = hillDepth * 2.25 + 20;
    // A generous opening keeps the line clear while the hill and masonry frame it.
    portal(0); portal(-tunnelLength);
    block(.25, 3.5, tunnelLength, -2.1, 1.75, -tunnelLength / 2, dark); block(.25, 3.5, tunnelLength, 2.1, 1.75, -tunnelLength / 2, dark); block(4.5, .25, tunnelLength, 0, 3.55, -tunnelLength / 2, dark);
    // Place the masonry just in front of the hill's leading face, facing the approaching train.
    group.position.copy(point).addScaledVector(direction, -.5); group.rotation.y = Math.atan2(-direction.x, -direction.z); this.add(group);
  }

  private addArrivalStation() {
    const point = this.pointAt(this.segment.routeLength), group = new THREE.Group(), block = (width: number, height: number, depth: number, color: number, x: number, y: number, z: number) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), this.material(color)); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); };
    const x = point.x, z = point.z; block(3.1, .32, 16, 0xc6bba6, x + 2.35, .1, z); block(.16, .16, 16, 0xf4d65e, x + .85, .3, z); block(2.6, .85, .12, 0x18384d, x + 3.25, 1.35, z - 2); block(.09, 1.5, .09, 0x33414b, x + 3.25, .55, z - 2); block(2.7, .16, .8, 0x8d293d, x + 3.55, .7, z + 3); this.add(group);
    const marker = new THREE.Mesh(new THREE.BoxGeometry(.16, 3, .16), this.material(0xf2d34d)); const markerPoint = this.pointAt(this.segment.routeLength - 12); marker.position.set(markerPoint.x - 2, 1.5, markerPoint.z); this.add(marker);
  }

  private addDepartureStation() {
    const point = this.pointAt(0), direction = this.trackDirection(0), angle = Math.atan2(direction.x, direction.z), group = new THREE.Group(), platform = this.material(0xc6bba6), edge = this.material(0xf4d65e), canopy = this.material(0x4c5960);
    const block = (width: number, height: number, depth: number, material: THREE.Material, x: number, y: number, z: number) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); };
    block(3.1, .32, 20, platform, 4.2, .1, -6); block(.16, .16, 20, edge, 2.65, .3, -6);
    for (const z of [-13, -5, 3]) block(.12, 3, .12, canopy, 5.25, 1.5, z);
    block(3.6, .18, 20, canopy, 5.25, 3, -5);
    group.position.copy(point); group.rotation.y = angle; this.add(group);
  }

  private addCityStations(random: SeededRandom) {
    if (this.segment.fromSettlement === 'city') this.addCityStops(0, 1, this.segment.fromSettlementSpan, random);
    if (this.segment.toSettlement === 'city') this.addCityStops(this.segment.routeLength, -1, this.segment.toSettlementSpan, random);
  }

  private addCityStops(terminalDistance: number, directionSign: number, span: number, random: SeededRandom) {
    // The terminal plus one or two local stops gives each city a believable 2–3 station network.
    const stops = 1 + random.integer(2), reach = span * 950;
    for (let index = 1; index <= stops; index++) this.addLocalCityStation(terminalDistance + directionSign * reach * index / (stops + 1), random);
  }

  private addLocalCityStation(distance: number, random: SeededRandom) {
    const point = this.pointAt(distance), direction = this.trackDirection(distance), angle = Math.atan2(direction.x, direction.z), side = random.next() > .5 ? 1 : -1, group = new THREE.Group(), platform = this.material(0xbdb7a5), edge = this.material(0xf4d65e), canopy = this.material(0x39474d);
    const block = (width: number, height: number, depth: number, material: THREE.Material, x: number, y: number, z: number) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); };
    block(3.1, .3, 26, platform, side * 2.35, .08, 0); block(.16, .12, 26, edge, side * .85, .27, 0);
    for (const z of [-8, 0, 8]) block(.12, 2.6, .12, canopy, side * 3.6, 1.3, z);
    block(3.9, .16, 19, canopy, side * 3.6, 2.65, 0); block(1.7, .75, .1, this.material(0x19394b), side * 2.5, 1.2, -5);
    group.position.copy(point); group.rotation.y = angle; this.add(group);
  }

  private addStationSettlements(random: SeededRandom) {
    this.addSettlement(0, 1, this.segment.fromSettlement, this.segment.fromSettlementSpan, random);
    this.addSettlement(this.segment.routeLength, -1, this.segment.toSettlement, this.segment.toSettlementSpan, random);
  }

  private addSettlement(stationDistance: number, directionSign: number, settlement: Settlement, span: number, random: SeededRandom) {
    const reach = span * 950, spacing = settlement === 'city' ? 76 : 96, buildingsPerBlock = settlement === 'city' ? 6 : 4, blocks = Math.ceil(reach / spacing), count = blocks * buildingsPerBlock;
    const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.material(0xffffff), count), roofs = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 4), this.material(0x3d4144), count), matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion(), scale = new THREE.Vector3(), position = new THREE.Vector3();
    const wallColors = [0x9e816c, 0xb5ad9b, 0x795e50, 0x9a9b91], cityColors = [0xa5a8a3, 0x857c70, 0xb0a18f, 0x697780];
    this.addSettlementRoads(stationDistance, directionSign, reach, blocks);
    for (let index = 0; index < count; index++) {
      const blockIndex = Math.floor(index / buildingsPerBlock), houseIndex = index % buildingsPerBlock, row = Math.floor(houseIndex / 2), streetSide = blockIndex % 2 ? 1 : -1, rowSide = houseIndex % 2 ? 1 : -1;
      const height = settlement === 'city' ? 4 + random.next() * 11 : 2.5 + random.next() * 5, width = 3.5 + random.next() * (settlement === 'city' ? 6 : 4), depth = 3.5 + random.next() * (settlement === 'city' ? 7 : 4);
      const streetStart = 38 + Math.min(reach - 25, blockIndex * reach / blocks), roadLateral = row === 0 ? 33 : row === 1 ? 49 : 66, roadForward = row === 0 ? 7 : row === 1 ? Math.sin(blockIndex * .7) * 15 : Math.sin(blockIndex * .7 + .8) * 20, along = streetStart + roadForward + rowSide * (depth / 2 + 3.5), distance = stationDistance + directionSign * along, point = this.pointAt(distance), normal = this.trackNormal(distance), offsetFromTrack = streetSide * roadLateral;
      position.copy(point).add(new THREE.Vector3(normal.x * (offsetFromTrack + streetSide * random.next() * 1.2), height / 2, normal.y * (offsetFromTrack + streetSide * random.next() * 1.2))); quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(normal.x, normal.y) + (random.next() - .5) * .1); scale.set(width, height, depth); matrix.compose(position, quaternion, scale); walls.setMatrixAt(index, matrix); walls.setColorAt(index, new THREE.Color((settlement === 'city' ? cityColors : wallColors)[random.integer(4)]!));
      position.y += height / 2 + .9; scale.set(width * .66, 1.8, depth * .66); quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4)); matrix.compose(position, quaternion, scale); roofs.setMatrixAt(index, matrix);
    }
    walls.instanceMatrix.needsUpdate = roofs.instanceMatrix.needsUpdate = true; if (walls.instanceColor) walls.instanceColor.needsUpdate = true;
    walls.castShadow = walls.receiveShadow = roofs.castShadow = true; this.add(walls); this.add(roofs);
    this.addSettlementTrees(stationDistance, directionSign, reach, Math.ceil(blocks / (settlement === 'city' ? 1.5 : 2.2)), random);
  }

  private addSettlementRoads(stationDistance: number, directionSign: number, reach: number, streets: number) {
    const asphalt = this.material(0x4c5551, .9);
    // Two continuous local roads connect the neighbourhoods instead of leaving every street as a dead end.
    for (const side of [-1, 1]) {
      const points: THREE.Vector3[] = [];
      for (let index = 0; index <= 18; index++) {
        const along = 12 + (reach - 24) * index / 18, distance = stationDistance + directionSign * along, point = this.pointAt(distance), normal = this.trackNormal(distance);
        points.push(point.add(new THREE.Vector3(normal.x * side * (23 + Math.sin(index * .7) * 4), .005, normal.y * side * (23 + Math.sin(index * .7) * 4))));
      }
      const mainRoad = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 48, 2.8, 4, false), asphalt); mainRoad.scale.y = .012; mainRoad.receiveShadow = true; this.add(mainRoad);
    }
    for (let index = 0; index < streets; index++) {
      const along = 38 + Math.min(reach - 25, index * reach / streets), distance = stationDistance + directionSign * along, point = this.pointAt(distance), direction = this.trackDirection(distance), normal = this.trackNormal(distance), side = index % 2 ? 1 : -1;
      const offset = (lateral: number, forward: number) => point.clone().addScaledVector(direction, forward * directionSign).add(new THREE.Vector3(normal.x * side * lateral, .005, normal.y * side * lateral));
      const road = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([offset(23, 0), offset(33, 7), offset(49, Math.sin(index * .7) * 15), offset(66, Math.sin(index * .7 + .8) * 20)]), 12, 2.4, 4, false), asphalt);
      road.scale.y = .012; road.receiveShadow = true; this.add(road);
    }
  }

  private addSettlementTrees(stationDistance: number, directionSign: number, reach: number, count: number, random: SeededRandom) {
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.14, .22, 1.8, 6), this.material(0x593b25), count), crowns = new THREE.InstancedMesh(new THREE.ConeGeometry(1.15, 3.4, 7), this.material(random.next() > .5 ? 0x285b35 : 0x3c6c3b), count), matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion();
    for (let index = 0; index < count; index++) {
      const distance = stationDistance + directionSign * (30 + index * (reach - 60) / Math.max(1, count - 1) + (random.next() - .5) * 32), point = this.pointAt(distance), normal = this.trackNormal(distance), side = index % 2 ? 1 : -1, size = .65 + random.next() * .65, position = point.clone().add(new THREE.Vector3(normal.x * side * (8 + random.next() * 16), 0, normal.y * side * (8 + random.next() * 16)));
      matrix.compose(position.clone().setY(.9 * size), rotation, new THREE.Vector3(size, size, size)); trunks.setMatrixAt(index, matrix);
      matrix.compose(position.clone().setY(2.55 * size), rotation, new THREE.Vector3(size, size, size)); crowns.setMatrixAt(index, matrix);
    }
    trunks.instanceMatrix.needsUpdate = crowns.instanceMatrix.needsUpdate = true; trunks.castShadow = crowns.castShadow = true; this.add(trunks); this.add(crowns);
  }
}
