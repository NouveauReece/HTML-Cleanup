import { visit } from 'https://esm.sh/unist-util-visit@5?bundle';

const REMOVE_TAGS = new Set([
  'font',
  'center',
  'big',
  'blink',
  'marquee',
  'acronym',
  'applet',
  'basefont',
  'dir',
  'frame',
  'frameset',
  'noframes',
  'isindex',
  'listing',
  'xmp',
  'plaintext',
  'spacer',
]);

const REPLACE_TAGS = {
  b: 'strong',
  i: 'em',
  s: 'del',
  strike: 'del',
  tt: 'code',
};

export function newTags() {
  return function transformer(tree) {
    // Pass 1: Rename legacy tags (b→strong, i→em, etc).
    visit(tree, 'element', (node) => {
      const tag = String(node.tagName || '').toLowerCase();
      const replacement = REPLACE_TAGS[tag];
      if (replacement) {
        node.tagName = replacement;
      }
    });

    // Pass 2: Unwrap deprecated tags (font, center, etc).
    visit(tree, 'element', (node, index, parent) => {
      if (parent == null || index == null) return;
      const tag = String(node.tagName || '').toLowerCase();

      if (REMOVE_TAGS.has(tag)) {
        const kids = Array.isArray(node.children) ? node.children : [];
        parent.children.splice(index, 1, ...kids);
        return visit.SKIP;
      }
    });
  };
}