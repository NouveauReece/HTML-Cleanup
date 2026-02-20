import {visit} from 'https://esm.sh/unist-util-visit@5?bundle';

/**
 * rehype plugin: correct "mailto:" links by changing @indiana.edu -> @iu.edu.
 *
 * Examples:
 *   mailto:test@indiana.edu                -> mailto:test@iu.edu
 *   mailto:a@indiana.edu,b@indiana.edu     -> mailto:a@iu.edu,b@iu.edu
 *   mailto:user@indiana.edu?cc=cc@indiana.edu&subject=Hello
 *       -> mailto:user@iu.edu?cc=cc@iu.edu&subject=Hello
 *
 * Notes:
 *  - Only modifies elements that have a string `properties.href` starting with "mailto:".
 *  - Preserves original casing of the "mailto:" scheme and everything else except the domain swap.
 *  - Replaces in both the path (address list) and the query string (if present).
 */
export function correctMailTo() {
  return function transformer(tree) {
    visit(tree, 'element', (node) => {
      const props = node.properties;
      if (!props) return;

      const href = props.href;
      if (typeof href !== 'string') return;
      if (!/^mailto:/i.test(href)) return;

      // Split into scheme, address list, and optional query string.
      // e.g. "mailto:user@indiana.edu?cc=cc@indiana.edu" ->
      //   scheme = "mailto:", addr = "user@indiana.edu", rest = "?cc=cc@indiana.edu"
      const match = href.match(/^(mailto:)([^?]*)(\?.*)?$/i);
      if (!match) return;

      const scheme = match[1];       // preserve original casing of "mailto:"
      const addr = match[2] || '';
      const rest = match[3] || '';

      // Replace @indiana.edu (case-insensitive) with @iu.edu in the address list
      const updatedAddr = addr.replace(/@indiana\.edu\b/gi, '@iu.edu');
      // Also replace in the querystring (so cc/bcc/to params are corrected).
      const updatedRest = rest ? rest.replace(/@indiana\.edu\b/gi, '@iu.edu') : '';

      const updatedHref = scheme + updatedAddr + updatedRest;

      if (updatedHref !== href) {
        props.href = updatedHref;
      }
    });
  };
}
