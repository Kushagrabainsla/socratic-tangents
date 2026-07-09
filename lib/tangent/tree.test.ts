import { describe, expect, it } from 'vitest';
import type { Tangent } from './model';
import { buildTangentTree, childrenOf, descendantIds, pathTo, roots } from './tree';

function t(id: string, parentId?: string): Tangent {
  return {
    id,
    conversationId: 'c1',
    parentId,
    anchor: { messageId: '', quotedText: id, textHash: '' },
    messages: [],
    hiddenTurnIds: [],
    title: id,
    createdAt: 0,
    updatedAt: 0,
  };
}

// Forest: r1 → (a → (a1)), (b); r2 (root); orphan whose parent was deleted.
const forest = [t('r1'), t('a', 'r1'), t('a1', 'a'), t('b', 'r1'), t('r2'), t('orphan', 'gone')];

describe('roots', () => {
  it('returns tangents with no parent, and orphans whose parent is missing', () => {
    expect(roots(forest).map((n) => n.id)).toEqual(['r1', 'r2', 'orphan']);
  });
});

describe('childrenOf', () => {
  it('returns direct children in order', () => {
    expect(childrenOf(forest, 'r1').map((n) => n.id)).toEqual(['a', 'b']);
    expect(childrenOf(forest, 'a').map((n) => n.id)).toEqual(['a1']);
    expect(childrenOf(forest, 'a1')).toEqual([]);
  });
});

describe('descendantIds', () => {
  it('includes the node itself and every descendant depth-first', () => {
    expect(descendantIds(forest, 'r1')).toEqual(['r1', 'a', 'a1', 'b']);
    expect(descendantIds(forest, 'a')).toEqual(['a', 'a1']);
    expect(descendantIds(forest, 'r2')).toEqual(['r2']);
  });
});

describe('pathTo', () => {
  it('walks from the root down to the node', () => {
    expect(pathTo(forest, 'a1').map((n) => n.id)).toEqual(['r1', 'a', 'a1']);
    expect(pathTo(forest, 'r1').map((n) => n.id)).toEqual(['r1']);
  });

  it('treats an orphan as its own root', () => {
    expect(pathTo(forest, 'orphan').map((n) => n.id)).toEqual(['orphan']);
  });

  it('returns empty for an unknown id', () => {
    expect(pathTo(forest, 'nope')).toEqual([]);
  });
});

describe('buildTangentTree', () => {
  it('nests children under their parents and promotes orphans to roots', () => {
    const tree = buildTangentTree(forest);
    expect(tree.map((n) => n.tangent.id)).toEqual(['r1', 'r2', 'orphan']);
    const r1 = tree[0]!;
    expect(r1.children.map((n) => n.tangent.id)).toEqual(['a', 'b']);
    expect(r1.children[0]!.children.map((n) => n.tangent.id)).toEqual(['a1']);
  });
});
