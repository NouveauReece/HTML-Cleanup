import {visit} from 'https://esm.sh/unist-util-visit@5?bundle';

/**
 * rehype plugin: remove inline style rules that affect text/typography
 * (color & font-related), but keep all other rules (e.g., background-color, float).
 *
 * Removed properties (case-insensitive):
 *  - color
 *  - font (shorthand)
 *  - font-size, font-weight, font-style, font-family
 *  - font-variant, font-stretch, font-kerning
 *  - font-feature-settings, font-variation-settings, font-synthesis, font-optical-sizing
 *  - line-height
 *  - letter-spacing, word-spacing
 *  - text-decoration (+ all subproperties), text-emphasis (+ subprops), text-shadow
 *  - text-transform
 *
 * Not removed (examples):
 *  - background-color, background, float, margin, padding, display, position, etc.
 *
 * Notes:
 *  - We intentionally do NOT remove `background-color`.
 *  - If you also want to strip SVG paint (e.g., `fill`, `stroke`), you can add them
 *    to BLOCKED_PROPS below.
 */
export function removeTextStyles() {
  return function transformer(tree) {
    visit(tree, 'element', (node) => {
      if (!node.properties || typeof node.properties.style !== 'string') return;

      const raw = node.properties.style;
      const decls = splitCssDeclarations(raw); // [{prop, value, rawProp, rawValue}]
      if (decls.length === 0) return;

      const kept = decls.filter(d => !isTypographyProp(d.prop));

      if (kept.length === 0) {
        // No styles left; remove the style attribute entirely.
        delete node.properties.style;
      } else {
        // Reconstruct the style string, preserving original raw casing/spacing of each declaration's parts.
        node.properties.style = kept
          .map(d => `${d.rawProp}: ${d.rawValue}`)
          .join('; ');
      }
    });
  };
}

/**
 * Decide if a property should be removed (typography/text/color related).
 * Matching is case-insensitive on the property name.
 */
function isTypographyProp(propName) {
  const p = propName.toLowerCase().trim();

  // Exact-name removals
  const BLOCKED_PROPS = new Set([
    'color',
    'font',                 // shorthand
    'font-size',
    'font-weight',
    'font-style',
    'font-family',
    'font-variant',
    'font-stretch',
    'font-kerning',
    'font-feature-settings',
    'font-variation-settings',
    'font-synthesis',
    'font-optical-sizing',
    'line-height',
    'letter-spacing',
    'word-spacing',
    'text-transform',
    'text-shadow',
    'text-decoration',
    'text-decoration-line',
    'text-decoration-style',
    'text-decoration-color',
    'text-decoration-thickness',
    'text-emphasis',
    'text-emphasis-color',
    'text-emphasis-style',
    'text-emphasis-position'
    // If you also want to remove SVG color rules, uncomment the following:
    // 'fill', 'stroke'
  ]);

  if (BLOCKED_PROPS.has(p)) return true;

  // Prefix-based removals (cover subproperties consistently)
  const BLOCKED_PREFIXES = [
    'font-variant-',
    'text-decoration-',
    'text-emphasis-'
  ];
  return BLOCKED_PREFIXES.some(prefix => p.startsWith(prefix));
}

/**
 * Robustly split a CSS inline style string into declarations, avoiding splitting
 * inside quotes or parentheses. Also splits prop/value on the first ":" outside
 * quotes/parentheses.
 *
 * Returns an array of:
 *   { prop: 'font-size', value: '14px', rawProp: 'font-size', rawValue: '14px' }
 *
 * The `raw*` fields preserve original casing/spacing to minimize diffs on output;
 * `prop` is normalized to lowercase (trimmed) for matching.
 */
function splitCssDeclarations(styleText) {
  const text = stripCssComments(String(styleText));
  const parts = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let parenDepth = 0;

  const flush = () => {
    const chunk = current.trim();
    current = '';
    if (!chunk) return;

    const {rawProp, rawValue, prop, value} = splitPropValue(chunk);
    if (!rawProp) return; // malformed or empty
    parts.push({ rawProp, rawValue, prop, value });
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      current += ch;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      current += ch;
      continue;
    }
    if (!inSingle && !inDouble) {
      if (ch === '(') {
        parenDepth++;
        current += ch;
        continue;
      }
      if (ch === ')') {
        if (parenDepth > 0) parenDepth--;
        current += ch;
        continue;
      }
      if (ch === ';' && parenDepth === 0) {
        flush();
        continue;
      }
    }
    current += ch;
  }
  flush();

  return parts;
}

function splitPropValue(decl) {
  // Find the first ":" that is not inside quotes/parentheses
  let inSingle = false;
  let inDouble = false;
  let parenDepth = 0;
  let idx = -1;

  for (let i = 0; i < decl.length; i++) {
    const ch = decl[i];

    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }
    if (!inSingle && !inDouble) {
      if (ch === '(') { parenDepth++; continue; }
      if (ch === ')') { if (parenDepth > 0) parenDepth--; continue; }
      if (ch === ':' && parenDepth === 0) { idx = i; break; }
    }
  }

  if (idx === -1) {
    return { rawProp: '', rawValue: '', prop: '', value: '' };
  }

  const rawProp = decl.slice(0, idx).trim();
  const rawValue = decl.slice(idx + 1).trim();
  const prop = rawProp.toLowerCase().trim();
  const value = rawValue.trim();

  return { rawProp, rawValue, prop, value };
}

function stripCssComments(s) {
  // Remove /* ... */ comments
  return s.replace(/\/\*[\s\S]*?\*\//g, '');
}