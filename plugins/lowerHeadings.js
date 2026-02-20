import { visit } from 'https://esm.sh/unist-util-visit@5?bundle';

/**
 * rehype plugin: lower headings so the largest becomes <h3> when
 * any <h1> or <h2> is present.
 *
 * Rules:
 *  - If any <h1> exists: shift all headings by +2 (cap at h6).
 *  - Else if any <h2> exists: shift all headings by +1 (cap at h6).
 *  - Otherwise: do nothing.
 *
 * Idempotent: running it again won’t change anything further because
 * the largest heading will already be h3 (no h1/h2 left).
 */

export function lowerHeadings() {
  return (tree) => {
    let hasH1 = false;
    let hasH2 = false;

    visit(tree, 'element', (node) => {
      if (node.tagName === 'h1') hasH1 = true;
      else if (node.tagName === 'h2') hasH2 = true;
    });

    const shift = hasH1 ? 2 : hasH2 ? 1 : 0;
    if (!shift) return;

    visit(tree, 'element', (node) => {
      const m = /^h([1-6])$/.exec(node.tagName || '');
      if (!m) return;

      const level = Number(m[1]);
      const newLevel = Math.min(6, level + shift);
      node.tagName = /** @type {import('hast').Element['tagName']} */ (
        'h' + newLevel
      );
    });
  };
}