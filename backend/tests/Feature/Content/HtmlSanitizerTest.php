<?php

use App\Models\Media;
use App\Services\Content\HtmlSanitizer;

function clean(string $html): string
{
    return app(HtmlSanitizer::class)->clean($html);
}

it('conserve la mise en forme autorisée', function () {
    $out = clean('<h2>Titre</h2><p>Un <strong>mot</strong> et <em>un autre</em>.</p><ul><li>Un</li><li>Deux</li></ul><ol><li>A</li></ol><blockquote>Citation</blockquote><h3>Sous</h3><h4>Sous-sous</h4>');

    expect($out)->toBe('<h2>Titre</h2><p>Un <strong>mot</strong> et <em>un autre</em>.</p><ul><li>Un</li><li>Deux</li></ul><ol><li>A</li></ol><blockquote><p>Citation</p></blockquote><h3>Sous</h3><h4>Sous-sous</h4>');
});

it('supprime script, style, iframe, svg et leur contenu', function (string $html) {
    $out = clean('<p>Avant</p>'.$html.'<p>Après</p>');

    expect($out)->toBe('<p>Avant</p><p>Après</p>');
})->with([
    'script' => '<script>alert(1)</script>',
    'style' => '<style>body{display:none}</style>',
    'iframe' => '<iframe src="https://evil.test"></iframe>',
    'svg' => '<svg onload="alert(1)"><circle/></svg>',
    'object' => '<object data="x"></object>',
    'form' => '<form action="https://evil.test"><input name="a"></form>',
    'math' => '<math><mi xlink:href="javascript:alert(1)">x</mi></math>',
]);

it('retire tous les attributs on*, style, class et id', function () {
    $out = clean('<p onclick="alert(1)" style="color:red" class="x" id="y" onmouseover="alert(2)">Texte</p><strong onfocus="x()">Gras</strong>');

    expect($out)->toBe('<p>Texte</p><p><strong>Gras</strong></p>')
        ->and($out)->not->toContain('onclick')->not->toContain('onfocus')->not->toContain('style');
});

it('refuse les liens javascript, data et vbscript, y compris obfusqués', function (string $href) {
    $out = clean('<p><a href="'.$href.'">Lien</a></p>');

    expect($out)->toBe('<p>Lien</p>')->and($out)->not->toContain('href');
})->with([
    'javascript' => 'javascript:alert(1)',
    'majuscules' => 'JaVaScRiPt:alert(1)',
    'tabulation' => "java\tscript:alert(1)",
    'entités' => 'jav&#x09;ascript:alert(1)',
    'espace initial' => '  javascript:alert(1)',
    'data' => 'data:text/html;base64,PHNjcmlwdD4=',
    'vbscript' => 'vbscript:msgbox(1)',
    'relatif' => '/admin',
    'sans schéma' => '//evil.test/x',
    'file' => 'file:///etc/passwd',
]);

it('force rel sur les liens http, https et mailto autorisés', function () {
    $out = clean('<p><a href="https://exemple.test/page?a=1&b=2" target="_blank" rel="opener">Site</a> <a href="mailto:info@exemple.test">Écrire</a> <a href="http://exemple.test">Http</a></p>');

    expect($out)
        ->toContain('<a href="https://exemple.test/page?a=1&amp;b=2" rel="noopener nofollow ugc">Site</a>')
        ->toContain('<a href="mailto:info@exemple.test" rel="noopener nofollow ugc">Écrire</a>')
        ->toContain('<a href="http://exemple.test" rel="noopener nofollow ugc">Http</a>')
        ->not->toContain('target')->not->toContain('opener"');
});

it('n\'accepte que les images issues de la table media', function () {
    $media = (new Media)->forceFill([
        'mediable_type' => 'user', 'mediable_id' => 1, 'collection' => 'content', 'disk' => 'public',
        'path' => 'content/1/01k8abcdefghjkmnpqrstvwxyz.webp', 'original_name' => 'a.webp', 'mime_type' => 'image/webp',
        'size_bytes' => 10, 'width' => 10, 'height' => 10, 'alt_text' => 'Agent à l\'entrée', 'sort_order' => 0,
    ]);
    $media->save();

    $ok = clean('<p><img src="'.$media->url().'" alt="Texte" onerror="alert(1)" width="9999"></p>');
    expect($ok)->toBe('<p><img src="'.htmlspecialchars($media->url()).'" alt="Texte"></p>');

    foreach (['https://evil.test/x.png', 'data:image/svg+xml;base64,PHN2Zz4=', 'javascript:alert(1)', '/storage/content/1/inconnu00000000000000000000.webp', ''] as $src) {
        expect(clean('<p>Avant<img src="'.$src.'">Après</p>'))->toBe('<p>AvantAprès</p>');
    }
});

it('déballe les balises inconnues en gardant le texte, et ramène b, i, h1, h5', function () {
    $out = clean('<div><span class="a">Un</span> <b>gras</b> <i>italique</i></div><h1>Grand</h1><h5>Petit</h5><font color="red">Texte</font><marquee>Défile</marquee>');

    expect($out)->toContain('<strong>gras</strong>')->toContain('<em>italique</em>')
        ->toContain('<h2>Grand</h2>')->toContain('<h4>Petit</h4>')
        ->not->toContain('<span')->not->toContain('<font')->not->toContain('<marquee')->not->toContain('<div')
        ->toContain('Texte')->toContain('Défile');
});

it('ré-échappe le texte et neutralise les balises mal formées et les commentaires', function () {
    $out = clean('<p>1 < 2 &amp; "x" <!-- <script>alert(1)</script> --> <scr<script>ipt>alert(1)</scr</script>ipt></p><img src=x onerror=alert(1)//>');

    expect($out)->not->toContain('<script')->not->toContain('onerror')->not->toContain('<!--')->not->toContain('<img');
    expect($out)->toContain('&amp;')->toContain('&lt;');
});

it('est idempotent et tolère une entrée vide ou très imbriquée', function () {
    expect(clean(''))->toBe('')->and(clean('   '))->toBe('');
    $nested = str_repeat('<div>', 500).'Fond'.str_repeat('</div>', 500);
    expect(strlen(clean($nested)))->toBeLessThan(200);

    $once = clean('<p>Un <a href="https://exemple.test">lien</a> <b>gras</b></p><script>x</script>');
    expect(clean($once))->toBe($once);
});

it('calcule le texte brut d\'un HTML nettoyé', function () {
    expect(app(HtmlSanitizer::class)->plainText('<p>Un &amp; deux</p><ul><li>trois</li></ul>'))->toBe('Un & deux trois');
});
