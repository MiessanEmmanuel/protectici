<?php

namespace Database\Seeders;

use App\Models\NewsletterSubscriber;
use App\Models\Page;
use App\Models\Partner;
use App\Models\Post;
use App\Models\PostCategory;
use App\Models\PostComment;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Contenu éditorial factice en français (contrat §9.4) : articles, commentaires, pages légales, partenaires, clients,
 * paramètres et abonnés. Aucune donnée réelle : numéros RCCM/agrément fictifs, adresses en `.test`. Idempotent.
 * Appelé par DemoSeeder (jamais en production).
 */
class ContentSeeder extends Seeder
{
    public function run(): void
    {
        $editor = User::where('email', 'editeur@demo.protectici.test')->first();
        $reader = User::where('email', 'utilisateur@demo.protectici.test')->first();

        $posts = $this->posts($editor);
        $this->comments($posts, $reader, $editor);
        $this->pages();
        $this->partners();
        $this->settings();
        $this->subscribers();
    }

    /** @return array<string, Post> */
    private function posts(?User $editor): array
    {
        $categories = PostCategory::pluck('id', 'slug');
        $out = [];

        // [titre, catégorie, résumé, paragraphes, état (p = publié, b = brouillon, s = planifié, a = archivé), à la une, flash, vues]
        $articles = [
            ['Comment choisir une société de gardiennage à Abidjan', 'actualites', 'Agrément, assurance, formation des agents : les points à vérifier avant de signer un contrat.', ['Avant de confier la sécurité de vos locaux à une société de gardiennage, vérifiez qu\'elle dispose d\'un agrément en cours de validité et d\'une assurance responsabilité civile professionnelle. Ces deux documents doivent pouvoir vous être présentés sans difficulté.', 'Demandez également comment les agents sont recrutés, formés et encadrés. Une bonne société fournit des consignes écrites, un registre de main courante et un interlocuteur joignable à toute heure en cas d\'incident.', 'Enfin, comparez les devis à périmètre identique : un tarif très bas cache souvent des horaires réduits, des agents peu formés ou des prestations facturées en supplément.'], 'p', true, false, 640],
            ['Vidéosurveillance à domicile : les erreurs à éviter', 'anti-intrusion', 'Emplacement des caméras, stockage des images, accès à distance : l\'essentiel pour bien s\'équiper.', ['Une caméra mal placée est une caméra inutile. Privilégiez les points d\'entrée (portail, porte principale, garage) et évitez les contre-jours qui rendent les images inexploitables la nuit comme en plein soleil.', 'Pensez au stockage : un enregistreur local protégé par un mot de passe fort reste plus sûr qu\'un compte partagé. Changez systématiquement les identifiants fournis par défaut à l\'installation.', 'Informez enfin vos voisins et vos employés lorsque le champ de vision dépasse les limites de votre propriété.'], 'p', false, false, 410],
            ['Alarmes anti-intrusion : comprendre les différents capteurs', 'anti-intrusion', 'Détecteurs d\'ouverture, volumétriques, sirènes : comment composer un système fiable.', ['Un système d\'alarme repose sur plusieurs types de capteurs complémentaires : détecteurs d\'ouverture pour les portes et fenêtres, détecteurs de mouvement pour les pièces, détecteurs de bris de vitre pour les grandes baies.', 'La centrale doit disposer d\'une batterie de secours afin de continuer à fonctionner lors des coupures d\'électricité, fréquentes dans certains quartiers.', 'Faites réaliser un test complet après l\'installation et planifiez une vérification annuelle auprès de votre installateur.'], 'p', false, false, 355],
            ['Cybercriminalité : protéger ses comptes en ligne', 'cybercriminalite', 'Mots de passe solides, double authentification et bons réflexes face à l\'hameçonnage.', ['L\'hameçonnage reste la première porte d\'entrée des escrocs : un message urgent, un lien à cliquer, une demande de code reçu par SMS. Ne communiquez jamais un code de vérification, même à une personne qui se présente comme votre banque.', 'Utilisez un mot de passe différent pour chaque service et activez la double authentification dès qu\'elle est proposée. Un gestionnaire de mots de passe vous évite de les retenir tous.', 'En cas de doute, contactez directement l\'organisme concerné par un canal que vous connaissez, jamais par les coordonnées indiquées dans le message suspect.'], 'p', false, true, 520],
            ['Arnaques par mobile money : les signes qui doivent alerter', 'cybercriminalite', 'Faux gains, faux agents, faux dépannages : reconnaître les scénarios les plus courants.', ['Les escrocs exploitent la confiance et l\'urgence : un prétendu gain à retirer après un petit paiement, un faux agent d\'opérateur qui demande votre code secret, un proche qui réclame un dépannage immédiat.', 'Aucun opérateur sérieux ne vous demandera votre code secret. Vérifiez toujours l\'identité de votre interlocuteur en le rappelant sur un numéro que vous connaissez.', 'Si vous avez été victime, conservez les messages, contactez rapidement votre opérateur et signalez les faits aux autorités compétentes.'], 'p', false, true, 298],
            ['Prévention incendie dans les commerces : les gestes essentiels', 'securite-incendie', 'Extincteurs, issues de secours, formation du personnel : les bases de la prévention.', ['Dans un commerce, la majorité des départs de feu ont une cause électrique ou liée à la cuisson. Un contrôle régulier des installations et le débranchement des appareils en fin de journée réduisent fortement le risque.', 'Les extincteurs doivent être adaptés aux risques, accessibles, signalés et vérifiés chaque année. Les issues de secours restent dégagées en permanence, y compris pendant les livraisons.', 'Formez votre personnel à l\'utilisation d\'un extincteur et organisez au moins un exercice d\'évacuation par an.'], 'p', true, false, 470],
            ['Quel extincteur pour quel type de feu ?', 'securite-incendie', 'Eau, poudre, CO2 : savoir choisir l\'appareil adapté avant qu\'il ne soit trop tard.', ['Tous les extincteurs ne conviennent pas à tous les feux. L\'eau pulvérisée est adaptée aux feux de matériaux solides comme le bois ou le papier, mais dangereuse sur une installation électrique sous tension.', 'L\'extincteur à poudre polyvalent traite la plupart des situations, tandis que le CO2 est privilégié pour les équipements électriques et informatiques car il ne laisse pas de résidu.', 'Lisez l\'étiquette de chaque appareil et placez-le près de la zone qu\'il protège.'], 'p', false, false, 233],
            ['Domotique et sécurité : ce que les objets connectés changent', 'domotique', 'Serrures, capteurs et caméras connectés : avantages, limites et précautions à prendre.', ['La domotique permet de surveiller son domicile à distance, d\'être alerté en cas d\'ouverture inattendue et de simuler une présence pendant une absence. Ces fonctions séduisent de plus en plus de foyers.', 'Un objet connecté est cependant une porte d\'entrée numérique : mettez à jour régulièrement les appareils, séparez-les de votre réseau principal et choisissez des fabricants qui publient des correctifs.', 'N\'oubliez pas que le système doit rester utilisable en cas de coupure internet ou électrique.'], 'p', false, false, 188],
            ['Métiers de la sécurité privée : se former en Côte d\'Ivoire', 'formation', 'Panorama des formations, des certifications et des débouchés du secteur.', ['Le secteur de la sécurité privée recrute des agents de gardiennage, des télé-opérateurs, des techniciens en alarme et vidéosurveillance, des maîtres-chiens et des responsables de site.', 'Plusieurs établissements proposent des formations initiales et continues : secourisme, sécurité incendie, techniques d\'intervention, conduite à tenir face à une agression.', 'Vérifiez que l\'organisme est reconnu et que la formation débouche sur une attestation valorisée par les employeurs.'], 'p', true, false, 560],
            ['Secourisme au travail : pourquoi former ses équipes', 'formation', 'Un salarié formé peut sauver une vie en attendant les secours : les formations existantes.', ['Les premières minutes après un accident sont décisives. Un salarié formé aux gestes de premiers secours sait alerter, protéger la victime et pratiquer les gestes qui stabilisent son état.', 'Une session d\'une journée suffit pour acquérir les bases : arrêt d\'une hémorragie, position latérale de sécurité, massage cardiaque.', 'Pensez à recycler régulièrement les connaissances, car les gestes s\'oublient vite sans pratique.'], 'p', false, false, 142],
            ['Recrutement d\'agents de sécurité : le profil recherché', 'emploi', 'Qualités attendues, pièces à fournir et pièges à éviter lors d\'une candidature.', ['Les employeurs recherchent avant tout des candidats ponctuels, calmes, sérieux et capables de rédiger un rapport clair. Une bonne condition physique et le sens du contact sont également appréciés.', 'Préparez un dossier complet : pièce d\'identité, extrait de casier judiciaire, justificatifs de formation et références.', 'Méfiez-vous des offres qui demandent de l\'argent pour constituer un dossier : un recrutement sérieux est toujours gratuit pour le candidat.'], 'p', false, false, 377],
            ['Travailler de nuit comme agent de sécurité : bien s\'organiser', 'emploi', 'Rythme de sommeil, vigilance, rondes : les conseils des professionnels pour tenir dans la durée.', ['Le travail de nuit exige une hygiène de vie rigoureuse : un sommeil suffisant en journée, des repas légers pendant le service et une hydratation régulière.', 'Alternez les rondes et les moments de poste fixe pour garder votre vigilance, et signalez immédiatement toute anomalie à votre responsable.', 'Un équipement adapté, lampe, radio et téléphone chargé, fait partie des conditions minimales de sécurité de l\'agent.'], 'p', false, false, 121],
            ['Sécuriser un chantier : surveillance et contrôle d\'accès', 'actualites', 'Vols de matériaux, intrusions, accidents : les mesures de base pour protéger un chantier.', ['Un chantier concentre des matériaux de valeur et des équipements coûteux. Une clôture continue, un point d\'entrée unique et un registre des entrées et sorties limitent déjà beaucoup les vols.', 'La présence d\'un agent la nuit et le week-end reste la mesure la plus dissuasive, complétée par un éclairage et, si possible, une caméra aux accès.', 'Rappelez enfin aux équipes les consignes de sécurité pour éviter les accidents.'], 'p', false, false, 264],
            ['Brigades canines : un renfort apprécié pour la surveillance de sites', 'actualites', 'Missions, qualités du binôme maître-chien et cadre d\'intervention des brigades canines.', ['Le chien de garde dissuade les intrusions et détecte des présences que l\'œil ne voit pas. Il intervient toujours avec son maître-chien, formé à le conduire et à le contrôler.', 'Les sites concernés vont des entrepôts aux résidences en passant par les zones industrielles. Le binôme est évalué régulièrement pour garantir la sécurité de tous.', 'Renseignez-vous sur les conditions de dressage et de suivi vétérinaire avant de choisir un prestataire.'], 'p', false, false, 199],
            ['Sécurité d\'un événement : préparer l\'accueil du public', 'actualites', 'Mariage, concert, conférence : les points de vigilance pour un événement sans incident.', ['La sécurité d\'un événement se prépare plusieurs semaines à l\'avance : estimation de l\'affluence, plan des accès, définition des zones et des cheminements d\'évacuation.', 'Prévoyez des agents formés au filtrage et à la gestion de foule, un poste de secours et un point de contact pour les urgences.', 'Informez les participants des consignes dès l\'invitation pour faciliter le déroulement.'], 'p', false, false, 87],
            ['Guide de la rédaction : bien utiliser le formulaire « Dis-moi tout »', 'actualites', 'Brouillon de l\'équipe éditoriale en cours de rédaction.', ['Cet article est en cours de rédaction par l\'équipe de ProtectIci.'], 'b', false, false, 0],
            ['Check-list de sécurité avant les congés', 'anti-intrusion', 'Brouillon : les gestes simples à réaliser avant de quitter son domicile.', ['Cet article est en cours de rédaction par l\'équipe de ProtectIci.'], 'b', false, false, 0],
            ['Bilan de l\'année en sécurité privée', 'actualites', 'Article programmé pour une publication prochaine.', ['Retour sur les principaux faits marquants du secteur de la sécurité privée au cours de l\'année écoulée.', 'Cet article sera enrichi avant sa publication.'], 's', false, false, 0],
            ['Nouvelle réglementation des agréments : ce qu\'il faut savoir', 'actualites', 'Article programmé : les évolutions à anticiper pour les sociétés de sécurité privée.', ['Les sociétés de sécurité privée doivent suivre les évolutions des conditions d\'agrément et préparer leurs dossiers de renouvellement.', 'Cet article sera complété avant sa publication.'], 's', false, false, 0],
            ['Ancien guide des alarmes (remplacé)', 'anti-intrusion', 'Article archivé, remplacé par une version plus récente.', ['Ce guide est remplacé par l\'article consacré aux différents capteurs d\'alarme.'], 'a', false, false, 64],
        ];

        foreach ($articles as $i => [$title, $category, $excerpt, $paragraphs, $state, $featured, $flash, $views]) {
            $post = Post::withTrashed()->firstOrNew(['slug' => Str::slug($title)]);
            $statuses = ['p' => 'published', 'b' => 'draft', 's' => 'scheduled', 'a' => 'archived'];
            $dates = ['p' => now()->subDays(40 - $i * 2), 'a' => now()->subDays(40 - $i * 2), 's' => now()->addDays($i - 14), 'b' => null];
            $post->forceFill([
                'author_id' => $editor?->id,
                'category_id' => $categories[$category],
                'title' => $title,
                'excerpt' => $excerpt,
                'body' => '<p>'.implode('</p><p>', $paragraphs).'</p>',
                'status' => $statuses[$state],
                'published_at' => $dates[$state],
                'is_featured' => $featured,
                'is_flash' => $flash,
                'is_visible' => $state === 'p',
                'views_count' => $views,
                'reading_minutes' => max(1, (int) ceil(str_word_count(implode(' ', $paragraphs)) / 200)),
                'seo_title' => null,
                'seo_description' => in_array($state, ['p', 'a'], true) ? Str::limit($excerpt, 160, '') : null,
            ])->save();
            $out[$title] = $post;
        }

        return $out;
    }

    /** @param array<string, Post> $posts */
    private function comments(array $posts, ?User $reader, ?User $editor): void
    {
        if ($reader === null || PostComment::query()->exists()) {
            return;
        }
        $target = $posts['Comment choisir une société de gardiennage à Abidjan'];
        $second = $posts['Cybercriminalité : protéger ses comptes en ligne'];

        $approved = $this->comment($target, $reader, null, 'Très utile, merci. Je vais demander l\'attestation d\'agrément avant de signer.', 'approved');
        $this->comment($target, $editor, $approved, 'Merci pour votre retour ! N\'hésitez pas à nous écrire via le formulaire de contact pour toute question.', 'approved');
        $this->comment($second, $reader, null, 'Le conseil sur les codes de vérification est essentiel, je l\'ai partagé à ma famille.', 'approved');
        $this->comment($target, $reader, null, 'Pouvez-vous préciser les tarifs habituels pour un gardien de nuit ?', 'pending');
        $this->comment($second, $reader, null, 'Excellent article, j\'attends la suite sur la double authentification.', 'pending');
    }

    private function comment(Post $post, ?User $user, ?PostComment $parent, string $body, string $status): PostComment
    {
        $comment = new PostComment(['post_id' => $post->id, 'parent_id' => $parent?->id, 'body' => $body]);
        $comment->forceFill([
            'user_id' => $user?->id, 'status' => $status, 'is_visible' => $status === 'approved',
            'moderated_at' => $status === 'pending' ? null : now(),
        ])->save();

        return $comment;
    }

    private function pages(): void
    {
        $legal = '<p>Éditeur : FYG Technologies, société de droit ivoirien (RCCM fictif CI-ABJ-DEMO-0000-B-00000), siège social à Abidjan Plateau, immeuble Eden.</p><p>Contact : info@protectici.ci, +225 07 09 44 51 11.</p>';
        $pages = [
            'qui-sommes-nous' => ['Qui sommes-nous', '<h2>Notre mission</h2><p>ProtectIci est la première plateforme d\'information et de services en ligne dédiée à la sécurité et à la sûreté privées en Côte d\'Ivoire. Conçue en 2022, elle référence les entreprises de sécurité privée, les établissements de formation et les forces de l\'ordre, avec les démarches associées.</p><p>Nous contribuons à la protection des biens et des personnes, à la prévention et à la dissuasion, à la gestion de crise, au contrôle d\'accès et à la surveillance, à l\'enquête ainsi qu\'au conseil et à l\'audit.</p><h2>Nos valeurs</h2><ul><li>Intégrité</li><li>Fiabilité</li><li>Professionnalisme</li><li>Prévention</li></ul>'],
            'mentions-legales' => ['Mentions légales', '<h2>Éditeur du site</h2>'.$legal.'<h2>Hébergement</h2><p>Le site est hébergé sur une infrastructure dédiée protégée par Cloudflare. Les informations détaillées d\'hébergement seront précisées avant la mise en ligne définitive.</p><h2>Propriété intellectuelle</h2><p>Les textes, logos et images du site sont protégés. Toute reproduction sans autorisation écrite préalable est interdite.</p>'],
            'confidentialite' => ['Politique de confidentialité', '<h2>Données collectées</h2><p>ProtectIci collecte uniquement les données nécessaires à ses services : informations de compte, formulaires de contact, de devis et « Dis-moi tout », inscription à la lettre d\'information.</p><h2>Durées de conservation</h2><p>Les messages de contact sont supprimés au bout de douze mois. Les demandes de devis et les retours « Dis-moi tout » sont anonymisés après une durée limitée.</p><h2>Vos droits</h2><p>Vous pouvez demander l\'accès, la rectification ou la suppression de vos données en écrivant à info@protectici.ci. Vous pouvez vous désinscrire de la lettre d\'information à tout moment grâce au lien présent dans chaque message.</p><h2>Cookies</h2><p>Aucun traceur non essentiel n\'est déposé sans votre accord. Vous pouvez modifier votre choix à tout moment depuis le pied de page.</p>'],
            'cgu' => ['Conditions générales d\'utilisation', '<h2>Objet</h2><p>Les présentes conditions encadrent l\'utilisation de la plateforme ProtectIci, service d\'information et de mise en relation. ProtectIci n\'est pas partie aux contrats conclus entre les utilisateurs et les prestataires référencés.</p><h2>Comptes et avis</h2><p>La création d\'un compte est gratuite. Les avis et commentaires sont modérés : tout propos injurieux, diffamatoire ou publicitaire peut être refusé.</p><h2>Responsabilité</h2><p>Les informations des fiches sont fournies par les établissements et validées par l\'équipe avant publication. ProtectIci s\'efforce d\'en garantir l\'exactitude sans pouvoir l\'assurer en toutes circonstances.</p>'],
        ];

        Page::unguarded(function () use ($pages) {
            foreach ($pages as $slug => [$title, $body]) {
                $page = Page::withTrashed()->firstOrNew(['slug' => $slug]);
                $page->forceFill(['title' => $title, 'body' => $body, 'is_visible' => true, 'seo_description' => null])->save();
            }
        });
    }

    private function partners(): void
    {
        $rows = [
            ['partner', 'Association des acteurs de la sécurité (fictive)', 'Réseau fictif de professionnels de la sécurité privée.'],
            ['partner', 'Centre de formation Vigilance (fictif)', 'Établissement fictif de formation aux métiers de la sécurité.'],
            ['partner', 'Fédération ivoirienne de prévention incendie (fictive)', 'Organisation fictive de sensibilisation à la prévention incendie.'],
            ['client', 'Groupe hôtelier Lagune (fictif)', 'Chaîne hôtelière fictive cliente de plusieurs prestataires.'],
            ['client', 'Centre commercial Les Palmiers (fictif)', 'Centre commercial fictif utilisant la plateforme pour choisir ses prestataires.'],
            ['client', 'Clinique Sainte-Aurore (fictive)', 'Établissement de santé fictif.'],
        ];
        foreach ($rows as $i => [$type, $name, $description]) {
            $partner = Partner::withTrashed()->firstOrNew(['name' => $name]);
            $partner->forceFill(['type' => $type, 'description' => $description, 'sort_order' => $i, 'is_visible' => true])->save();
        }
    }

    private function settings(): void
    {
        $values = [
            'site.tagline' => 'La sécurité privée en Côte d\'Ivoire, en toute confiance',
            'social.facebook' => 'https://www.facebook.com/protectici.demo',
            'social.linkedin' => 'https://www.linkedin.com/company/protectici-demo',
        ];
        Setting::unguarded(function () use ($values) {
            foreach ($values as $key => $value) {
                $setting = Setting::firstOrNew(['key' => $key]);
                if (! $setting->exists) {
                    $setting->forceFill(['value' => $value, 'is_public' => true])->save();
                }
            }
        });
    }

    private function subscribers(): void
    {
        foreach (['confirmed' => 6, 'pending' => 2, 'unsubscribed' => 1] as $status => $count) {
            for ($i = 1; $i <= $count; $i++) {
                $subscriber = NewsletterSubscriber::firstOrNew(['email' => "abonne-{$status}-{$i}@demo.protectici.test"]);
                if ($subscriber->exists) {
                    continue;
                }
                $subscriber->forceFill([
                    'status' => $status, 'source' => $status === 'unsubscribed' ? null : 'footer',
                    'consent_at' => now()->subDays(20 + $i),
                    'confirmed_at' => $status === 'confirmed' ? now()->subDays(19 + $i) : null,
                    'unsubscribed_at' => $status === 'unsubscribed' ? now()->subDays(3) : null,
                ])->save();
            }
        }
    }
}
