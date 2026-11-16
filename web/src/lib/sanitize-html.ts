/**
 * Filtre CLIENT du HTML produit par l'éditeur riche (admin). Réplique la liste blanche du contrat
 * (§9) : p, h2–h4, ul, ol, li, strong, em, a[href http/https/mailto, rel forcé], blockquote, br,
 * img[src http/https ou chemin du site]. Ce filtre ne remplace PAS l'assainissement serveur
 * (seule autorité) : il évite d'envoyer du HTML hors liste et sert de base à l'aperçu.
 * Nécessite un DOM (navigateur ou jsdom).
 */

const ALLOWED = new Set([
  'P',
  'H2',
  'H3',
  'H4',
  'UL',
  'OL',
  'LI',
  'STRONG',
  'EM',
  'A',
  'BLOCKQUOTE',
  'IMG',
  'BR',
]);
const RENAME: Record<string, string> = {
  B: 'STRONG',
  I: 'EM',
  H1: 'H2',
  H5: 'H4',
  H6: 'H4',
  DIV: 'P',
};
const DROP = new Set([
  'SCRIPT',
  'STYLE',
  'IFRAME',
  'OBJECT',
  'EMBED',
  'NOSCRIPT',
  'TEMPLATE',
  'SVG',
  'MATH',
  'FORM',
  'INPUT',
  'BUTTON',
  'TEXTAREA',
  'SELECT',
  'LINK',
  'META',
  'TITLE',
  'HEAD',
  'AUDIO',
  'VIDEO',
  'CANVAS',
]);
const INLINE = new Set(['STRONG', 'EM', 'A', 'BR', 'IMG']);
const BLOCK = new Set(['P', 'H2', 'H3', 'H4', 'UL', 'OL', 'BLOCKQUOTE']);

export const LINK_REL = 'noopener nofollow ugc';

const CONTROL = /[\u0000-\u001f\u007f\s]/g;

export function isSafeLink(href: string | null | undefined): boolean {
  if (!href) return false;
  const v = href.replace(CONTROL, '');
  return /^(https?:\/\/|mailto:)[^\s]+$/i.test(v) && v.length <= 2048;
}

export function isSafeImageSrc(src: string | null | undefined): boolean {
  if (!src) return false;
  const v = src.replace(CONTROL, '');
  return (/^https?:\/\/[^\s]+$/i.test(v) || /^\/(?!\/)[^\s]*$/.test(v)) && v.length <= 2048;
}

function clean(node: Node, out: Node, doc: Document): void {
  node.childNodes.forEach((child) => {
    if (child.nodeType === 3) {
      out.appendChild(doc.createTextNode(child.textContent ?? ''));
      return;
    }
    if (child.nodeType !== 1) return;
    const el = child as Element;
    let tag = el.tagName.toUpperCase();
    if (DROP.has(tag)) return;
    tag = RENAME[tag] ?? tag;
    if (!ALLOWED.has(tag)) return clean(el, out, doc); // balise inconnue : on garde le texte
    if (tag === 'A') {
      const href = el.getAttribute('href');
      if (!isSafeLink(href)) return clean(el, out, doc);
      const a = doc.createElement('a');
      a.setAttribute('href', href!.trim());
      a.setAttribute('rel', LINK_REL);
      clean(el, a, doc);
      return void out.appendChild(a);
    }
    if (tag === 'IMG') {
      const src = el.getAttribute('src');
      if (!isSafeImageSrc(src)) return;
      const img = doc.createElement('img');
      img.setAttribute('src', src!.trim());
      img.setAttribute('alt', (el.getAttribute('alt') ?? '').slice(0, 200));
      return void out.appendChild(img);
    }
    const copy = doc.createElement(tag.toLowerCase());
    if (tag !== 'BR') clean(el, copy, doc);
    out.appendChild(copy);
  });
}

/** Regroupe en <p> les suites de texte/inline posées directement à la racine. */
function wrapInlineRuns(root: HTMLElement, doc: Document): void {
  const nodes = Array.from(root.childNodes);
  let run: HTMLElement | null = null;
  for (const n of nodes) {
    const isBlock =
      n.nodeType === 1 &&
      (BLOCK.has((n as Element).tagName.toUpperCase()) || (n as Element).tagName === 'LI');
    const isInline =
      n.nodeType === 3 || (n.nodeType === 1 && INLINE.has((n as Element).tagName.toUpperCase()));
    if (isBlock || !isInline) {
      run = null;
      continue;
    }
    if (!run) {
      run = doc.createElement('p');
      root.insertBefore(run, n);
    }
    run.appendChild(n);
  }
  // supprime les paragraphes vides (hors image)
  root.querySelectorAll('p').forEach((p) => {
    if (!p.textContent?.trim() && !p.querySelector('img')) p.remove();
  });
}

/** Renvoie un élément racine contenant uniquement le HTML autorisé. */
export function sanitizeToElement(html: string): HTMLElement {
  const parsed = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const doc = document;
  const root = doc.createElement('div');
  clean(parsed.body, root, doc);
  wrapInlineRuns(root, doc);
  return root;
}

export function sanitizeEditorHtml(html: string): string {
  return sanitizeToElement(html).innerHTML;
}

/** Texte brut (comptage de caractères, validation « contenu non vide »). */
export function htmlToPlainText(html: string): string {
  return sanitizeToElement(html).textContent?.replace(/\s+/g, ' ').trim() ?? '';
}
