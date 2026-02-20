import { visit } from 'https://esm.sh/unist-util-visit@5?bundle';

/**
 * Rehype plugin:
 *  - For headings (<h1>-<h6>), keep only text and <a> elements in their subtree.
 *  - Preserve <a> and its non-style attributes; remove 'style' and 'class' from it.
 *  - Remove 'style' and 'class' from the heading itself.
 */
export function cleanHeadings() {
  return function transformer(tree) {
    visit(tree, 'element', (node) => {
      if (!isHeading(node)) return;
      stripStyling(node);
      node.children = cleanChildren(node.children || []);
    });
  };
}

function isHeading(node) {
  return node && node.type === 'element' && /^h[1-6]$/.test(node.tagName);
}

/**
 * Remove presentational styling/classes from an element.
 * (Keeps other attributes such as id/href/rel/target/title/etc.)
 */
function stripStyling(el) {
  if (!el.properties) el.properties = {};
  delete el.properties.style;
  delete el.properties.className; // HAST canonical form
  delete el.properties.class;     // just in case raw 'class' is present
}

/**
 * Only keep:
 *  - text nodes
 *  - <a> elements, with their attributes preserved (except style/class),
 *    and with their children cleaned recursively.
 * All other elements are unwrapped (their cleaned children are lifted).
 */
function cleanChildren(children) {

  const out = [];

  for (const child of children) {
    if (!child) continue;

    if (child.type === 'text') {
      out.push(child);
      continue;
    }

    if (child.type === 'element') {
      if (child.tagName === 'a') {
        stripStyling(child);
        const cleanedA = {
          ...child,
          children: cleanChildren(child.children || []),
        };
        out.push(cleanedA);
      } else {
        const lifted = cleanChildren(child.children || []);
        if (lifted.length) out.push(...lifted);
      }
      continue;
    }
  }

  return out;
}