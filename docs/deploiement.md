# Déploiement de ProtectIci (Dockploy + Cloudflare)

> Le domaine définitif n'est pas encore connu : ce document utilise **`exemple.ci`** (web : `exemple.ci`, API : `api.exemple.ci`, staging : `staging.exemple.ci` / `api-staging.exemple.ci`). À remplacer partout. Les fichiers Docker n'ont **pas** été construits ni testés (Docker absent du poste de développement) : la première recette sur staging fait office de vérification.

## 1. Architecture

```
Navigateur -> Cloudflare (DNS proxifié, WAF, TLS) -> VPS : Traefik (Dockploy)
                                                       |-- exemple.ci      -> web (Next.js :3000)
                                                       |-- api.exemple.ci  -> backend (FrankenPHP :8080)
                       réseau interne : backend, worker, scheduler -> db (PostGIS), non publié
                       web -> backend via http://backend:8080 (API_INTERNAL_URL, rendu serveur)
```

- Web et API partagent le domaine parent `exemple.ci` : indispensable aux cookies Sanctum (`SESSION_DOMAIN=.exemple.ci`, `SANCTUM_STATEFUL_DOMAINS`, `CORS_ALLOWED_ORIGINS`).
- Une seule image backend, trois services : `backend` (HTTP), `worker` (`queue:work`, e-mails), `scheduler` (`schedule:work`, purges, publication d'articles programmés). Le scheduler doit tourner en **une seule instance**.
- Choix FrankenPHP (plutôt que nginx + PHP-FPM) : un seul processus, pas de supervisord, exécution non-root simple, mode classique (pas d'Octane).
- Fichiers : `backend/Dockerfile`, `web/Dockerfile`, `docker-compose.yml` (dev/référence, ports 8100/3100 sur 127.0.0.1), `docker-compose.prod.yml` (Dockploy), `.env.example` (racine, variables Dockploy).

## 2. Variables : build-time vs runtime

| Où | Variables | Remarque |
|---|---|---|
| **Build-time web** (build args) | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_ALLOW_INDEXING`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_MEDIA_ORIGINS` | Figées dans le bundle et dans `next.config.ts` (`headers()`, noindex) : changer = **rebuild**. |
| Runtime web | `API_INTERNAL_URL`, `SESSION_COOKIE_NAME` | Fixées dans le compose. |
| Runtime backend / worker / scheduler | toutes les autres (voir `.env.example`) | Les caches Laravel (config, routes, vues) sont générés au démarrage du conteneur, donc avec les bonnes valeurs. |

Pièges : un `#` dans une valeur saisie sans guillemets dans Dockploy tronque la valeur silencieusement (mot de passe DB, clés) ; préférer des secrets alphanumériques ou des guillemets. Les commentaires en fin de ligne du `.env.example` ne doivent pas être recopiés tels quels.

## 3. Procédure Dockploy pas à pas

1. **Prérequis VPS** : Docker + Dockploy installés, durcissement fait (§8). Dépôt Git accessible depuis Dockploy (clé de déploiement en lecture).
2. **Cloudflare** : enregistrements DNS `exemple.ci` et `api.exemple.ci` vers l'IP du VPS, **proxifiés** (nuage orange) ; SSL/TLS en **Full (strict)**.
3. **Générer les secrets** (poste local, jamais commités) : `php artisan key:generate --show` pour `APP_KEY` ; `openssl rand -hex 32` pour `IP_HASH_SECRET` ; mot de passe DB fort sans `#`.
4. **Créer le projet** Dockploy `protectici`, un environnement par cible (`staging`, `production`), chacun avec sa propre base, ses secrets et ses buckets.
5. **Créer un service « Compose »** : source Git, branche (`develop` -> staging, `main` -> production), fichier `docker-compose.prod.yml`.
6. **Onglet Environment** : coller le contenu de `.env.example`, remplacer tous les `change_me` et `exemple.ci`. Staging : `APP_ENV=staging`, `NEXT_PUBLIC_ALLOW_INDEXING=0`, domaines `staging.*`.
7. **Onglet Domains** : `exemple.ci` -> service `web` port 3000 ; `api.exemple.ci` -> service `backend` port 8080 ; HTTPS activé (Let's Encrypt).
8. **Déployer.** Au démarrage, `backend` exécute `php artisan migrate --force` (`RUN_MIGRATIONS=true`) ; le web attend que l'API soit saine.
9. **Premier administrateur** : créer via une commande Artisan dédiée dans le conteneur (`docker exec -it <backend> php artisan app:create-admin`), jamais avec le seeder de démo (comptes factices interdits en production).
10. **Vérifier** : `https://api.exemple.ci/up` -> 200 ; page d'accueil ; connexion ; envoi d'un formulaire (e-mail reçu = worker + Resend OK).

Migrations : pour un contrôle strict, mettre `RUN_MIGRATIONS=false` et lancer `docker exec <backend> php artisan migrate --force` à la main avant chaque mise à jour ayant des migrations. Les migrations doivent rester compatibles avec la version précédente du code (expand/contract) pour permettre le retour arrière.

## 4. Sauvegardes PostgreSQL

Script à installer sur le VPS (`/usr/local/sbin/protectici-backup.sh`, `chmod 700`), lancé chaque nuit par cron (`/etc/cron.d/protectici-backup` : `15 2 * * * root /usr/local/sbin/protectici-backup.sh`). Ajuster `DB_CTN` (`docker ps --format '{{.Names}}' | grep db`).

```bash
#!/bin/sh
set -eu
DB_CTN="protectici-prod-db-1"; DB_NAME="protectici"; DB_USER="protectici"
DIR=/var/backups/protectici; KEEP_DAYS=14
mkdir -p "$DIR"; umask 077
F="$DIR/$DB_NAME-$(date +%Y%m%d-%H%M%S).dump"
docker exec "$DB_CTN" pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > "$F"
[ -s "$F" ] || { echo "dump vide" >&2; rm -f "$F"; exit 1; }
# Chiffrement (clé publique age/gpg) puis envoi HORS du VPS (R2 via rclone) :
# age -r "$AGE_PUBKEY" -o "$F.age" "$F" && rclone copy "$F.age" r2:protectici-backups/ && rm "$F"
find "$DIR" -name '*.dump*' -mtime +"$KEEP_DAYS" -delete
```

Rétention : 14 jours locaux, plus 12 mensuels hors VPS (règle de cycle de vie du bucket). Les sauvegardes locales seules ne protègent pas d'une perte du serveur : la copie chiffrée hors VPS est obligatoire en production.

**Restauration (à tester sur staging chaque trimestre)** :

```bash
docker exec -i <db_staging> createdb -U protectici protectici_restore
docker exec -i <db_staging> pg_restore -U protectici -d protectici_restore --no-owner < protectici-AAAAMMJJ.dump
docker exec <db_staging> psql -U protectici -d protectici_restore -c "SELECT postgis_version(); SELECT count(*) FROM providers;"
```

Le test est réussi si PostGIS répond et que les comptes de lignes sont cohérents. Les médias sont sur R2 (versioning du bucket activé), pas dans la sauvegarde SQL.

## 5. Checklist de mise en production

- [ ] `APP_ENV=production`, `APP_DEBUG=false` (forcé par le compose), aucune trace visible sur une page d'erreur.
- [ ] Cookies `Secure` (`SESSION_SECURE_COOKIE=true`), `SESSION_DOMAIN=.exemple.ci`, test de connexion/déconnexion et CSRF OK.
- [ ] HSTS : envoyé par Next (`Strict-Transport-Security`) ; vérifier aussi les en-têtes de l'API ; activer HSTS Cloudflare seulement après validation HTTPS partout.
- [ ] Cloudflare : Full (strict), WAF activé, règles de limitation de débit sur `/api/v1/auth/*` et les formulaires.
- [ ] Ports 80/443 limités aux IP Cloudflare (UFW + script du skill `harden-dockploy-vps`, cron hebdomadaire).
- [ ] Panneau Dockploy (port 3000 de l'hôte) **non exposé** : règle `DOCKER-USER` `DROP` sur l'interface publique, persistée (`netfilter-persistent save`) ; accès par tunnel SSH. UFW seul ne suffit pas pour les ports publiés par Docker.
- [ ] SSH : clés uniquement, `PasswordAuthentication no`, `PermitRootLogin no`, fail2ban, mises à jour automatiques.
- [ ] Base non publiée (aucun `ports:` sur `db`), vérifier `docker ps` : aucun `0.0.0.0:5432`.
- [ ] Turnstile actif (`TURNSTILE_ENABLED=true`, clés de production), Resend : domaine vérifié (SPF/DKIM/DMARC), `MAIL_MAILER=resend`.
- [ ] R2 : bucket médias en lecture publique, bucket documents **privé** ; `AWS_URL` et `NEXT_PUBLIC_MEDIA_ORIGINS` cohérents.
- [ ] Indexation : `NEXT_PUBLIC_ALLOW_INDEXING=1` en production uniquement ; staging derrière Cloudflare Access ou mot de passe.
- [ ] Worker et scheduler en bonne santé (`docker ps` : `healthy`) ; une seule instance du scheduler.
- [ ] Sauvegarde nocturne active, dernière restauration testée, secrets hors dépôt.

## 6. Staging vs production

| | Staging | Production |
|---|---|---|
| Domaines | `staging.exemple.ci`, `api-staging.exemple.ci` | `exemple.ci`, `api.exemple.ci` |
| Branche | `develop` | `main` (tag de version) |
| Données | factices | réelles |
| Indexation | `NEXT_PUBLIC_ALLOW_INDEXING=0`, accès restreint | `1` |
| Secrets, base, buckets | propres à staging | propres à la production, jamais partagés |
| E-mails | domaine ou destinataires de test | domaine vérifié |

Toute mise en production passe d'abord par staging (recette des parcours de CLAUDE.md §2.3).

## 7. Proxies de confiance (`TRUSTED_PROXIES`)

Laravel doit voir l'IP réelle du visiteur (rate limiting, `ip_hash`). La requête arrive via Cloudflare puis Traefik : renseigner les plages Cloudflare (<https://www.cloudflare.com/ips/>) plus le sous-réseau Docker de Traefik, ou `*` si l'origine n'est joignable que par ces proxys (garanti par la restriction 80/443 aux IP Cloudflare). Vérifier sur staging que l'IP journalisée (hachée) varie selon les visiteurs.

## 8. Durcissement du VPS

Suivre le skill `harden-dockploy-vps` dans l'ordre : UFW (SSH d'abord), 80/443 aux IP Cloudflare, SSH durci, Cloudflare Full (strict), mises à jour automatiques, fermeture du panneau Dockploy (règle `DOCKER-USER`, test `LOG` avant `DROP`, persistance), sauvegardes hors VPS. Toujours garder une seconde session SSH ouverte pendant les changements de pare-feu.

## 9. Rotation des secrets

| Secret | Procédure |
|---|---|
| `DB_PASSWORD` | `ALTER USER ... PASSWORD '...'` dans la base, puis mise à jour de l'env Dockploy et redéploiement (le volume garde l'ancien mot de passe sinon). |
| `APP_KEY` | Ancienne clé dans `APP_PREVIOUS_KEYS` le temps de la transition ; les sessions chiffrées sont invalidées. |
| `IP_HASH_SECRET` | Rotation possible ; les compteurs d'unicité repartent de zéro (acceptable). |
| `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`, clés R2 | Créer la nouvelle clé chez le fournisseur, mettre à jour l'env, redéployer, révoquer l'ancienne. |

Fréquence : tous les 6 mois, et immédiatement en cas de fuite ou de départ d'un accès.

## 10. Supervision

- Santé : `GET https://api.exemple.ci/up` (Laravel) à surveiller depuis un moniteur externe (UptimeRobot, Better Stack) avec alerte e-mail ; page d'accueil du web idem.
- Healthchecks Docker intégrés : backend (`/up`), web (`/`), db (`pg_isready`), worker/scheduler (`pgrep`). Dockploy affiche l'état ; activer les notifications de déploiement/échec.
- Journaux : `docker logs` (stderr) ; ne contiennent ni données personnelles ni secrets. Surveiller la table `failed_jobs` (`php artisan queue:failed`).
- Disque : alerte au-delà de 80 % (images Docker, sauvegardes) ; `docker system prune` planifié avec prudence (jamais `--volumes`).

## 11. Retour arrière (rollback)

1. **Code** : dans Dockploy, redéployer le commit/tag précédent (onglet Deployments, ou `git revert` puis push). Les images ne sont pas versionnées par un registre : le rollback reconstruit l'image.
2. **Migrations** : `docker exec <backend> php artisan migrate:rollback --step=1 --force` seulement si la migration est réversible et sans perte ; sinon restaurer la sauvegarde la plus récente (§4) en mode maintenance (`php artisan down`, puis `php artisan up`).
3. **Variables** : l'historique n'est pas versionné par Dockploy ; conserver la dernière configuration valide dans un gestionnaire de mots de passe.
4. **Vérification** : `/up`, connexion, un formulaire, e-mail reçu.
