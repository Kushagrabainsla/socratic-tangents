import type { LLMAdapter } from '../adapters/types';
import { resolveAnchor } from './anchor';
import type { Tangent } from './model';

// A small badge on every message that has tangents. Click to reopen (or pick from a menu when a
// message has several). Markers are rebuilt whenever the tangent list changes.

const MARKER_CLASS = 'st-marker';
const MENU_CLASS = 'st-marker-menu';

export type OpenTangent = (id: string) => void;

export function clearMarkers(): void {
  document.querySelectorAll(`.${MARKER_CLASS}, .${MENU_CLASS}`).forEach((n) => n.remove());
}

/** Rebuild all markers from scratch (use when the tangent list changes). */
export function renderMarkers(adapter: LLMAdapter, tangents: Tangent[], onOpen: OpenTangent): void {
  clearMarkers();
  ensureMarkers(adapter, tangents, onOpen);
}

/** Add markers only where missing (use after the page re-renders messages on scroll). */
export function ensureMarkers(adapter: LLMAdapter, tangents: Tangent[], onOpen: OpenTangent): void {
  for (const [msgEl, group] of groupByMessage(adapter, tangents)) {
    const existing = msgEl.querySelector<HTMLElement>(`.${MARKER_CLASS}`);
    if (existing) existing.textContent = label(group.length);
    else addMarker(msgEl, group, onOpen);
  }
}

function label(count: number): string {
  return count > 1 ? `↳ ${count}` : '↳';
}

function groupByMessage(adapter: LLMAdapter, tangents: Tangent[]): Map<HTMLElement, Tangent[]> {
  const groups = new Map<HTMLElement, Tangent[]>();
  for (const tangent of tangents) {
    const msgEl = resolveAnchor(adapter, tangent.anchor);
    if (!msgEl) continue;
    const group = groups.get(msgEl) ?? [];
    group.push(tangent);
    groups.set(msgEl, group);
  }
  return groups;
}

function addMarker(msgEl: HTMLElement, tangents: Tangent[], onOpen: OpenTangent): void {
  if (getComputedStyle(msgEl).position === 'static') msgEl.style.position = 'relative';
  const marker = document.createElement('button');
  marker.className = MARKER_CLASS;
  marker.textContent = label(tangents.length);
  marker.title = tangents.length > 1 ? `${tangents.length} tangents` : 'Open tangent';
  marker.setAttribute('aria-label', marker.title);
  marker.addEventListener('click', (e) => {
    e.stopPropagation();
    if (tangents.length === 1) onOpen(tangents[0]!.id);
    else openMenu(marker, tangents, onOpen);
  });
  msgEl.appendChild(marker);
}

function openMenu(anchorEl: HTMLElement, tangents: Tangent[], onOpen: OpenTangent): void {
  document.querySelectorAll(`.${MENU_CLASS}`).forEach((n) => n.remove());
  const menu = document.createElement('div');
  menu.className = MENU_CLASS;
  for (const tangent of tangents) {
    const item = document.createElement('button');
    item.className = 'st-list-item';
    item.textContent = tangent.title || 'Untitled tangent';
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.remove();
      onOpen(tangent.id);
    });
    menu.appendChild(item);
  }
  anchorEl.appendChild(menu);
  setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 0);
}
