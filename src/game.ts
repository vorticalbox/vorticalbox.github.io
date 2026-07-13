import * as THREE from 'three';
import { TrainAudio } from './audio';
import { persistSave, loadSave } from './persistence';
import { RouteGenerator } from './route';
import { RailwayScene } from './scene';
import type { RoutePlan, RouteSize, Segment } from './types';
import { GameUI } from './ui';

export class TrainGame {
  private readonly ui: GameUI;
  private readonly scene: RailwayScene;
  private readonly audio = new TrainAudio();
  private readonly routes = new RouteGenerator();
  private save = loadSave();
  private segment!: Segment;
  private route!: RoutePlan;
  private legIndex = 0;
  private travelled = 0;
  private speed = 0;
  private targetSpeed = 0;
  private completed = false;
  private lastFrame = performance.now();

  constructor(root: HTMLDivElement) {
    this.ui = new GameUI(root); this.scene = new RailwayScene(this.ui.canvas);
    this.ui.bind({ faster: (amount = 1) => this.changeTargetSpeed(amount === 10 ? Math.min(100, (Math.floor(this.targetSpeed / 10) + 1) * 10) - this.targetSpeed : amount), slower: (amount = 1) => this.changeTargetSpeed(amount === 10 ? Math.max(0, (Math.ceil(this.targetSpeed / 10) - 1) * 10) - this.targetSpeed : -amount), horn: () => this.horn(), mute: () => this.toggleMute() });
    addEventListener('resize', () => this.scene.resize()); this.scene.resize(); this.showRouteMenu(); requestAnimationFrame(now => this.frame(now));
  }

  private showRouteMenu() { this.ui.showRouteMenu(size => this.startRoute(size)); }
  private startRoute(size: RouteSize) { this.route = this.routes.createRoute(size); this.legIndex = 0; this.segment = this.route.segments[0]!; this.travelled = 0; this.speed = 0; this.targetSpeed = 0; this.completed = false; this.scene.build(this.segment); this.updateUi(); }

  private changeTargetSpeed(delta: number) { this.audio.resume(); this.targetSpeed = THREE.MathUtils.clamp(this.targetSpeed + delta, 0, 100); this.updateUi(); }
  private horn() { this.audio.resume(); this.audio.play('horn', this.save.muted); }
  private toggleMute() { this.save.muted = !this.save.muted; persistSave(this.save); this.updateUi(); }
  private updateUi() { if (this.route) this.ui.update({ speed: this.speed, targetSpeed: this.targetSpeed, segment: this.segment, travelled: this.travelled, muted: this.save.muted, route: this.route, legIndex: this.legIndex }); }

  private arrive() {
    if (this.completed) return;
    this.save.history.unshift(this.segment.to); this.save.history = this.save.history.slice(0, 20); persistSave(this.save); this.audio.play('chime', this.save.muted);
    if (this.legIndex === this.route.segments.length - 1) { this.completed = true; this.ui.showCompletion(this.route, () => this.showRouteMenu()); return; }
    this.legIndex++; this.segment = this.route.segments[this.legIndex]!; this.travelled = 0; this.scene.build(this.segment, true); this.updateUi();
  }

  private frame(now: number) {
    const dt = Math.min((now - this.lastFrame) / 1000, .05); this.lastFrame = now;
    if (this.route && !this.completed) {
      const speedError = this.targetSpeed - this.speed;
      if (Math.abs(speedError) < .15) {
        this.speed = this.targetSpeed;
      } else {
        const traction = this.speed < 8 ? .6 : this.speed < 25 ? 2.4 : 1.8;
        // Feed-forward drag compensation lets cruise control settle exactly at its set speed.
        const acceleration = (speedError > 0 ? Math.min(speedError * .6 + this.speed * .018, traction) : Math.max(speedError * .45, -3.2)) - this.speed * .018;
        this.speed = THREE.MathUtils.clamp(this.speed + acceleration * dt, 0, 100);
      }
      this.travelled += this.speed * dt * (1900 / 3600); this.scene.follow(this.travelled);
      const remaining = this.segment.routeLength - this.travelled;
      if (remaining >= -2 && remaining <= 4 && this.targetSpeed === 0 && this.speed < 1.2) this.arrive();
      if (this.travelled > this.segment.routeLength + 90) { this.speed = 0; this.targetSpeed = 0; this.arrive(); }
      this.updateUi();
    }
    this.scene.render(); requestAnimationFrame(next => this.frame(next));
  }
}
