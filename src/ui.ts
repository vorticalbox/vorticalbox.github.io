import * as THREE from 'three';
import type { RoutePlan, RouteSize, Segment } from './types';

export type UiActions = {
  faster: (amount?: number) => void;
  slower: (amount?: number) => void;
  horn: () => void;
  mute: () => void;
};

export type TrainReadout = { speed: number; targetSpeed: number; segment: Segment; travelled: number; muted: boolean; route: RoutePlan; legIndex: number };

export class GameUI {
  readonly canvas: HTMLCanvasElement;
  private readonly from: HTMLElement;
  private readonly to: HTMLElement;
  private readonly distance: HTMLElement;
  private readonly speed: HTMLElement;
  private readonly target: HTMLElement;
  private readonly actualNeedle: HTMLElement;
  private readonly targetNeedle: HTMLElement;
  private readonly routeTrain: HTMLElement;
  private readonly routeStops: HTMLElement;
  private readonly mute: HTMLButtonElement;
  private readonly root: HTMLDivElement;

  constructor(root: HTMLDivElement) {
    this.root = root;
    root.innerHTML = `
      <canvas id="world"></canvas>
      <section class="hud" aria-label="Train controls">
        <header><button id="mute" aria-label="Toggle sound">♫</button></header>
        <div class="route"><div><small>PREVIOUS STOP</small><b id="from">Oakleigh</b></div><div class="route-line" aria-label="Journey progress"><i class="route-track"></i><span id="route-train" class="route-train"></span><div id="route-stops" class="route-stops"></div></div><div class="right"><small>NEXT STOP</small><b id="to">Ferncombe</b><em id="distance">0.0 mi</em></div></div>
        <div class="control-dock"><aside class="speedometer" aria-label="Speedometer: actual speed and requested speed"><div class="speedometer-face"><small class="control-label">SPEED</small><span class="tick t100">100</span><span class="tick t90">90</span><span class="tick t80">80</span><span class="tick t70">70</span><span class="tick t60">60</span><span class="tick t50">50</span><span class="tick t40">40</span><span class="tick t30">30</span><span class="tick t20">20</span><span class="tick t10">10</span><span class="tick t0">0</span><i id="target-needle" class="needle target-needle"></i><i id="actual-needle" class="needle actual-needle"></i><div class="speed-value"><strong id="speed">0</strong><small>MPH</small></div></div><div class="speed-key"><span><i></i> ACTUAL</span><span><i></i> SET <b id="target">0</b></span></div></aside>
        <div class="controls"><button class="drive throttle" id="faster" aria-label="Raise target speed by 1 mile per hour"><span>▲</span></button><button class="horn" id="horn" aria-label="Sound horn">♬</button><button class="drive brake" id="slower" aria-label="Lower target speed by 1 mile per hour"><span>▼</span></button></div></div>
        <p class="hint"><kbd>W</kbd>/<kbd>S</kbd> adjust 1 mph · <kbd>A</kbd>/<kbd>D</kbd> or <kbd>←</kbd>/<kbd>→</kbd> adjust 10 mph · Set 0 mph to stop</p>
      </section>`;
    const byId = <T extends HTMLElement>(id: string) => root.querySelector<T>(`#${id}`)!;
    this.canvas = byId('world'); this.from = byId('from'); this.to = byId('to'); this.distance = byId('distance'); this.speed = byId('speed'); this.target = byId('target'); this.actualNeedle = byId('actual-needle'); this.targetNeedle = byId('target-needle'); this.routeTrain = byId('route-train'); this.routeStops = byId('route-stops'); this.mute = byId('mute');
  }

  bind(actions: UiActions) {
    const bind = (id: string, action: () => void) => document.querySelector(`#${id}`)?.addEventListener('click', action);
    bind('faster', actions.faster); bind('slower', actions.slower); bind('horn', actions.horn); this.mute.addEventListener('click', actions.mute);
    addEventListener('keydown', event => { if (event.key === 'w' || event.key === 'ArrowUp') actions.faster(); if (event.key === 's' || event.key === 'ArrowDown') actions.slower(); if (event.key === 'd' || event.key === 'ArrowRight') actions.faster(10); if (event.key === 'a' || event.key === 'ArrowLeft') actions.slower(10); if (event.key === ' ') actions.horn(); });
  }

  showRouteMenu(select: (size: RouteSize) => void) {
    const menu = document.createElement('section'); menu.className = 'route-menu'; menu.innerHTML = `<div><p>SCOTTISH RAIL</p><h1>Choose a route</h1><button data-size="tiny"><b>Tiny</b><span>Start + 1 stop</span></button><button data-size="small"><b>Small</b><span>Start + 3 stops</span></button><button data-size="big"><b>Big</b><span>Start + 5 stops</span></button><button data-size="massive"><b>Massive</b><span>Start + 10 stops</span></button></div>`;
    menu.querySelectorAll<HTMLButtonElement>('button[data-size]').forEach(button => button.addEventListener('click', () => { menu.remove(); select(button.dataset.size as RouteSize); })); this.root.append(menu);
  }

  showCompletion(route: RoutePlan, restart: () => void) {
    const menu = document.createElement('section'); menu.className = 'route-menu'; menu.innerHTML = `<div><p>ROUTE COMPLETE</p><h1>${route.stations.at(-1)!.name}</h1><span>${route.stations.length - 1} stops · ${route.totalDistance.toFixed(1)} miles</span><button id="new-route"><b>New route</b><span>Return to route menu</span></button></div>`;
    menu.querySelector<HTMLButtonElement>('#new-route')!.addEventListener('click', () => { menu.remove(); restart(); }); this.root.append(menu);
  }

  update({ speed, targetSpeed, segment, travelled, muted, route, legIndex }: TrainReadout) {
    this.speed.textContent = String(Math.round(speed)); this.target.textContent = String(targetSpeed);
    this.actualNeedle.style.setProperty('--needle-position', `${12 + Math.min(speed, 100) / 100 * 76}%`);
    this.targetNeedle.style.setProperty('--needle-position', `${12 + targetSpeed / 100 * 76}%`);
    const completedDistance = route.segments.slice(0, legIndex).reduce((sum, item) => sum + item.routeLength, 0), routeDistance = completedDistance + travelled;
    this.routeTrain.style.setProperty('--journey-position', `${THREE.MathUtils.clamp(routeDistance / route.segments.reduce((sum, item) => sum + item.routeLength, 0), 0, 1) * 100}%`);
    this.routeStops.innerHTML = route.stations.map((station, index) => `<i class="${index < legIndex ? 'visited' : index === legIndex + 1 ? 'next' : ''}" title="${station.name}"></i>`).join('');
    this.distance.textContent = `${Math.max(0, segment.distance - travelled / 1900).toFixed(1)} mi`;
    this.from.textContent = segment.from; this.to.textContent = segment.to; this.mute.textContent = muted ? '♩' : '♫';
  }
}
