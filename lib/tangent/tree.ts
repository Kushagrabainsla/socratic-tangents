// The tangent forest. Tangents relate through `parentId`: a root branches off a host message, a child
// branches off another tangent's answer. These pure helpers turn the flat stored list into the tree
// the map renders and the drill-down navigation walks. All are defensive against broken links (an
// orphan whose parent was deleted is treated as a root) and cycles.

import type { Tangent } from './model';

export interface TangentNode {
  tangent: Tangent;
  children: TangentNode[];
}

/** Tangents with no surviving parent — the roots of each subtree in a conversation. */
export function roots(tangents: Tangent[]): Tangent[] {
  const ids = new Set(tangents.map((t) => t.id));
  return tangents.filter((t) => !t.parentId || !ids.has(t.parentId));
}

/** Direct children of `id`, in stored order. */
export function childrenOf(tangents: Tangent[], id: string): Tangent[] {
  return tangents.filter((t) => t.parentId === id);
}

/** `id` plus every descendant id (depth-first), for cascade delete. */
export function descendantIds(tangents: Tangent[], id: string): string[] {
  const byParent = groupByParent(tangents);
  const out: string[] = [];
  const seen = new Set<string>();
  const walk = (current: string): void => {
    if (seen.has(current)) return;
    seen.add(current);
    out.push(current);
    for (const child of byParent.get(current) ?? []) walk(child.id);
  };
  walk(id);
  return out;
}

/** The path from the root down to `id` (root first, `id` last); empty if `id` is unknown. */
export function pathTo(tangents: Tangent[], id: string): Tangent[] {
  const byId = new Map(tangents.map((t) => [t.id, t]));
  const path: Tangent[] = [];
  const seen = new Set<string>();
  let current = byId.get(id);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return path;
}

/** Build the forest for a conversation (roots with nested children), preserving order. */
export function buildTangentTree(tangents: Tangent[]): TangentNode[] {
  const byParent = groupByParent(tangents);
  const build = (tangent: Tangent): TangentNode => ({
    tangent,
    children: (byParent.get(tangent.id) ?? []).map(build),
  });
  return roots(tangents).map(build);
}

function groupByParent(tangents: Tangent[]): Map<string, Tangent[]> {
  const map = new Map<string, Tangent[]>();
  for (const tangent of tangents) {
    if (!tangent.parentId) continue;
    const list = map.get(tangent.parentId) ?? [];
    list.push(tangent);
    map.set(tangent.parentId, list);
  }
  return map;
}
