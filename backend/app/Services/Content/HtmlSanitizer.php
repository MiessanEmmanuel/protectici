<?php

namespace App\Services\Content;

use App\Models\Media;
use Dom\Element;
use Dom\HTMLDocument;
use Dom\Node;

/**
 * Assainissement du HTML éditorial par LISTE BLANCHE (contrat §9, security.md §14) : le HTML est analysé par un
 * analyseur HTML5 conforme, puis REconstruit élément par élément. Rien n'est « filtré » dans la chaîne d'origine.
 *  - balises autorisées : p, h2–h4, ul, ol, li, strong, em, a, blockquote, br, img ; b/i/div/h1/h5/h6 sont ramenées
 *    à strong/em/p/h2/h4 ; toute autre balise est « déballée » (texte conservé) ;
 *  - script, style, iframe, svg, math, object, formulaires, etc. sont supprimés AVEC leur contenu ;
 *  - aucun attribut hors liste : `a` ne garde que `href` (http/https/mailto) et `rel` forcé à « noopener nofollow ugc » ;
 *    `img` ne garde que `src` (uniquement une image de la table `media`) et `alt` ; jamais d'on*, style, class, id ;
 *  - tout texte est ré-échappé à la sortie.
 */
class HtmlSanitizer
{
    private const REMOVE_WITH_CONTENT = [
        'script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'svg', 'math', 'template',
        'noscript', 'noembed', 'noframes', 'head', 'title', 'form', 'textarea', 'select', 'option', 'button', 'input',
        'video', 'audio', 'source', 'track', 'canvas', 'link', 'meta', 'base', 'xmp', 'plaintext', 'dialog', 'portal',
    ];

    private const INLINE = ['strong', 'em', 'a', 'br', 'img'];

    private const BLOCKS = ['p', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote'];

    private const RENAME = ['b' => 'strong', 'i' => 'em', 'h1' => 'h2', 'h5' => 'h4', 'h6' => 'h4'];

    private const MAX_DEPTH = 40;

    public function clean(?string $html): string
    {
        $html = (string) $html;
        if (trim($html) === '') {
            return '';
        }

        $doc = HTMLDocument::createFromString('<!DOCTYPE html><html><body>'.$html.'</body></html>', LIBXML_NOERROR);
        $body = $doc->body;
        if ($body === null) {
            return '';
        }

        return trim($this->blocks($body->childNodes, 0, true));
    }

    /** Texte brut d'un HTML déjà nettoyé (durée de lecture, contrôle de contenu vide). */
    public function plainText(string $html): string
    {
        return trim(preg_replace('/\s+/u', ' ', html_entity_decode(strip_tags(str_replace(['</p>', '</li>', '<br>'], ' ', $html)), ENT_QUOTES | ENT_HTML5, 'UTF-8')) ?? '');
    }

    /**
     * Contexte « bloc » : les éléments blocs sont conservés, les suites de contenu en ligne sont regroupées en <p>
     * (si $wrap), les éléments inconnus sont déballés.
     *
     * @param  iterable<Node>  $nodes
     */
    private function blocks(iterable $nodes, int $depth, bool $wrap): string
    {
        if ($depth > self::MAX_DEPTH) {
            return '';
        }

        $out = '';
        $buffer = '';
        $flush = function () use (&$out, &$buffer, $wrap): void {
            if (trim($buffer) !== '') {
                $out .= $wrap ? '<p>'.trim($buffer).'</p>' : $buffer;
            }
            $buffer = '';
        };

        foreach ($nodes as $node) {
            if ($node->nodeType === XML_TEXT_NODE || $node->nodeType === XML_CDATA_SECTION_NODE) {
                $buffer .= $this->escape((string) $node->nodeValue);

                continue;
            }
            if ($node->nodeType !== XML_ELEMENT_NODE) {
                continue; // commentaires, instructions de traitement : supprimés
            }

            $tag = $this->tag($node);
            if ($tag === null) {
                continue;
            }

            if (in_array($tag, self::BLOCKS, true)) {
                $flush();
                $out .= $this->block($node, $tag, $depth);
            } elseif (in_array($tag, self::INLINE, true)) {
                $buffer .= $this->inline($node, $tag, $depth);
            } elseif ($tag === 'div') {
                $flush();
                $out .= $this->blocks($node->childNodes, $depth + 1, $wrap);
            } else {
                $buffer .= $this->blocks($node->childNodes, $depth + 1, false); // élément inconnu : déballé
            }
        }
        $flush();

        return $out;
    }

    private function block(Node $node, string $tag, int $depth): string
    {
        if (in_array($tag, ['p', 'h2', 'h3', 'h4'], true)) {
            $inner = trim($this->inlineChildren($node, $depth));

            return $inner === '' ? '' : "<{$tag}>{$inner}</{$tag}>";
        }

        // ul, ol, li, blockquote : contenus de bloc, sans <p> forcé autour du texte seul.
        $inner = trim($this->blocks($node->childNodes, $depth + 1, $tag === 'blockquote'));

        return $inner === '' ? '' : "<{$tag}>{$inner}</{$tag}>";
    }

    /** Contexte « ligne » : les blocs imbriqués sont aplatis (leur texte et leur contenu en ligne sont conservés). */
    private function inlineChildren(Node $node, int $depth): string
    {
        if ($depth > self::MAX_DEPTH) {
            return '';
        }

        $out = '';
        foreach ($node->childNodes as $child) {
            if ($child->nodeType === XML_TEXT_NODE || $child->nodeType === XML_CDATA_SECTION_NODE) {
                $out .= $this->escape((string) $child->nodeValue);
            } elseif ($child->nodeType === XML_ELEMENT_NODE) {
                $tag = $this->tag($child);
                if ($tag === null) {
                    continue;
                }
                $out .= in_array($tag, self::INLINE, true)
                    ? $this->inline($child, $tag, $depth + 1)
                    : $this->inlineChildren($child, $depth + 1);
            }
        }

        return $out;
    }

    private function inline(Node $node, string $tag, int $depth): string
    {
        return match ($tag) {
            'br' => '<br>',
            'strong', 'em' => ($inner = $this->inlineChildren($node, $depth)) === '' ? '' : "<{$tag}>{$inner}</{$tag}>",
            'a' => $this->link($node, $depth),
            'img' => $this->image($node),
            default => '',
        };
    }

    private function link(Node $node, int $depth): string
    {
        $inner = $this->inlineChildren($node, $depth);
        $href = $this->safeHref($this->attribute($node, 'href'));
        if ($href === null) {
            return $inner; // lien refusé : le texte reste, le lien disparaît
        }

        return '<a href="'.$this->escape($href).'" rel="noopener nofollow ugc">'.$inner.'</a>';
    }

    private function image(Node $node): string
    {
        $src = trim($this->attribute($node, 'src'));
        $media = $this->mediaFor($src);
        if ($media === null) {
            return '';
        }
        $alt = trim($this->attribute($node, 'alt'));
        if ($alt === '') {
            $alt = (string) $media->alt_text;
        }

        return '<img src="'.$this->escape($src).'" alt="'.$this->escape(mb_substr($alt, 0, 255)).'">';
    }

    /** Seules les images issues de `media` (URL exactement égale à celle du stockage) sont acceptées. */
    private function mediaFor(string $src): ?Media
    {
        $path = parse_url($src, PHP_URL_PATH);
        if (! is_string($path) || $src === '' || strlen($src) > 2000) {
            return null;
        }
        $file = basename($path);
        if (preg_match('/^[a-z0-9]{20,40}\.(webp|jpg|png)$/i', $file) !== 1) {
            return null;
        }

        $candidates = Media::query()->where('path', 'like', '%/'.$file)->limit(5)->get();
        foreach ($candidates as $media) {
            if ($media->url() === $src) {
                return $media;
            }
        }

        return null;
    }

    private function safeHref(string $href): ?string
    {
        // Les navigateurs ignorent espaces et caractères de contrôle dans un schéma (« java\tscript: ») : on les retire d'abord.
        $normalized = preg_replace('/[\x00-\x20\x7f-\x9f\x{200B}-\x{200F}\x{2028}\x{2029}\x{FEFF}]+/u', '', $href);
        if (! is_string($normalized) || $normalized === '' || strlen($normalized) > 2000) {
            return null;
        }
        if (preg_match('#^(https?://[^/?\#]+|mailto:[^?\#]+)#i', $normalized) !== 1) {
            return null;
        }

        return $normalized;
    }

    /** Nom de balise normalisé, ou null si l'élément (et son contenu) doit disparaître. */
    private function tag(Node $node): ?string
    {
        if (! $node instanceof Element) {
            return null;
        }
        if ($node->namespaceURI !== 'http://www.w3.org/1999/xhtml') {
            return null; // SVG / MathML : jamais
        }
        $tag = strtolower($node->localName);
        if (in_array($tag, self::REMOVE_WITH_CONTENT, true)) {
            return null;
        }

        return self::RENAME[$tag] ?? $tag;
    }

    private function attribute(Node $node, string $name): string
    {
        return $node instanceof Element ? (string) $node->getAttribute($name) : '';
    }

    private function escape(string $text): string
    {
        return htmlspecialchars($text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}
