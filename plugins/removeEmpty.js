/**
 * rehype plugin: remove empty/whitespace-only elements AND aggressively unwrap <span>s.
 *
 * Span removal rules (aggressive):
 *  - Unwrap any <span> with NO attributes.
 *  - Unwrap any <span> with NO styles (i.e., no `style` attribute or empty style).
 *  - Unwrap any <span> whose style is exactly `white-space: pre` (ignoring spaces / !important).
 *
 * Also:
 *  - Remove elements that end up empty (only whitespace or nothing).
 *  - Keep <br> and void elements (img, hr, etc.).
 *  - Works bottom-up and flattens deeply nested redundant spans in one pass.
 */
export function removeEmpty() {
  return function (tree) {
    const VOID = new Set([
      'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
      'link', 'meta', 'param', 'source', 'track', 'wbr'
    ]);

    // ASCII whitespace + nbsp + zero-width/invisibles
    const WS_RE = /^[\s\u00A0\u2000-\u200D\u2060\uFEFF]*$/;

    function isWhitespaceText(node) {
      return node && node.type === 'text' && WS_RE.test(node.value || '');
    }

    /** Parse inline style to a lowercase map: { prop: value } */
    function parseStyleMap(style) {
      const map = Object.create(null);
      if (!style) return map;

      if (typeof style === 'string') {
        for (let decl of style.split(';')) {
          if (!decl) continue;
          const i = decl.indexOf(':');
          if (i === -1) continue;
          const prop = decl.slice(0, i).trim().toLowerCase();
          let val = decl.slice(i + 1).trim().toLowerCase();
          if (val.endsWith('!important')) {
            val = val.replace(/!important\s*$/, '').trim();
          }
          if (prop) map[prop] = val;
        }
        return map;
      }

      if (typeof style === 'object') {
        for (const k of Object.keys(style)) {
          const prop = k.trim().toLowerCase();
          let val = String(style[k] ?? '').trim().toLowerCase();
          if (val.endsWith('!important')) {
            val = val.replace(/!important\s*$/, '').trim();
          }
          map[prop] = val;
        }
        return map;
      }

      return map;
    }

    /** True if style is empty or has zero declarations. */
    function hasAnyStyles(styleProp) {
      if (!styleProp) return false;
      const map = parseStyleMap(styleProp);
      return Object.keys(map).length > 0;
    }

    /** True if style is *exactly* white-space: pre (no other props). */
    function isStyleExactlyWhiteSpacePre(styleProp) {
      const map = parseStyleMap(styleProp);
      const keys = Object.keys(map);
      return keys.length === 1 && keys[0] === 'white-space' && map['white-space'] === 'pre';
    }

    /** Span removal policy per your instruction. */
    function spanShouldUnwrap(el) {
      const props = el && el.properties ? el.properties : {};
      const hasAttrs = Object.keys(props).length > 0;
      const style = props.style;

      // 1) No attributes at all → unwrap
      if (!hasAttrs) return true;

      // 2) No styles (missing style OR empty style) → unwrap
      if (!hasAnyStyles(style)) return true;

      // 3) Exactly style="white-space: pre" → unwrap
      if (isStyleExactlyWhiteSpacePre(style)) return true;

      // Otherwise, keep the span (has non-empty style that is not exactly white-space: pre)
      return false;
    }

    /** Flatten chains of redundant <span>s in one shot. */
    function flattenRedundantSpanNodes(nodes) {
      const out = [];
      for (const n of nodes) {
        if (
          n &&
          n.type === 'element' &&
          (n.tagName || '').toLowerCase() === 'span' &&
          Array.isArray(n.children) &&
          n.children.length > 0 &&
          spanShouldUnwrap(n)
        ) {
          // Recurse: flatten this span's children (there may be nested redundant spans)
          out.push(...flattenRedundantSpanNodes(n.children));
        } else {
          out.push(n);
        }
      }
      return out;
    }

    function clean(node) {
      if (!node || !Array.isArray(node.children)) return;

      const out = [];

      for (const child of node.children) {
        // Drop comments entirely
        if (child.type === 'comment') continue;

        if (child.type === 'text') {
          if (!isWhitespaceText(child)) out.push(child);
          continue;
        }

        if (child.type === 'element') {
          // Recurse first
          clean(child);

          const tag = (child.tagName || '').toLowerCase();
          const isVoid = VOID.has(tag);
          const childrenArr = Array.isArray(child.children) ? child.children : [];
          const hasChildren = childrenArr.length > 0;

          // Remove elements that end up empty (not void, not <br>)
          if (!isVoid && tag !== 'br' && !hasChildren) {
            continue;
          }

          // Always keep <br> and void elements
          if (tag === 'br' || isVoid) {
            out.push(child);
            continue;
          }

          // Aggressively unwrap spans per policy
          if (tag === 'span') {
            if (hasChildren && spanShouldUnwrap(child)) {
              const flattened = flattenRedundantSpanNodes(childrenArr);
              out.push(...flattened);
              continue;
            }
            // If not unwrapped, we keep it as-is
            out.push(child);
            continue;
          }

          // Keep other elements
          out.push(child);
          continue;
        }

        // Keep any other node types
        out.push(child);
      }

      node.children = out;
    }

    clean(tree);
  };
}