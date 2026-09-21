# Cerise

Un journal personnel de calories et de protéines, en français, sur téléphone et ordinateur.

## Utilisation

- Quatre repas par jour : petit-déjeuner, déjeuner, collation et dîner.
- Chaque valeur est facultative. Une case vide reste absente ; un zéro saisi est conservé.
- Enregistrement automatique, modification des jours précédents et historique mensuel.
- Objectifs initiaux : 1 500 kcal et 115 g de protéines. Ils sont configurables, sans saisie du poids. Ce sont des repères personnels, pas des recommandations médicales.
- Les nouveaux objectifs prennent effet le jour de leur modification. Les objectifs antérieurs sont conservés.
- Tendances sur 7 ou 30 jours, moyennes séparées par indicateur, répartition par repas et tableau accessible.
- Les moyennes excluent les jours sans saisie pour l'indicateur concerné. Elles incluent les zéros saisis et les totaux partiels, explicitement signalés. « 4/4 repas » indique seulement la présence de quatre valeurs, pas une validation nutritionnelle.
- 64 messages bienveillants en rotation, un par journée locale, sans appel à un service d'IA.

## Données et sauvegardes

Sans connexion, le journal reste uniquement dans `localStorage`, sous `cerise.journal.v1`. Il ne quitte pas le navigateur et n'est jamais transféré automatiquement lors de la connexion.

Dans **Paramètres > Ton compte**, la connexion e-mail / mot de passe ouvre le journal privé du compte Supabase. Le même compte retrouve son journal sur téléphone et ordinateur. Les inscriptions publiques et anonymes sont désactivées ; les comptes sont créés par l'administrateur dans Supabase. GitHub Pages héberge le code public, pas les repas. Aucun service d'analyse n'est utilisé.

Les saisies sont d'abord enregistrées dans un brouillon propre au compte (`cerise.cloud.v1.<identifiant>`), puis synchronisées après une courte pause. Une vérification a aussi lieu au retour dans la page, au retour du réseau et toutes les 30 secondes lorsque la page est visible. Le statut **Synchronisé** confirme que le brouillon a été enregistré en ligne. Les modifications indépendantes sont fusionnées ; les valeurs concurrentes sont affichées côte à côte et nécessitent un choix. Les objectifs d'une même date sont comparés ensemble.

La session est mémorisée sous `cerise.auth.v1`. Se déconnecter masque le journal du compte dans les onglets ouverts de cette origine et revient au journal local séparé. Les brouillons du compte restent dans ce navigateur pour permettre leur récupération à la prochaine connexion. Les thèmes ne sont jamais synchronisés avec Supabase.

Lorsque le réseau est indisponible, une page déjà ouverte conserve les saisies sur cet appareil et propose de réessayer. Il n'y a pas de service worker : le démarrage complet du site sans réseau n'est pas garanti. La navigation privée ou l'effacement du stockage peuvent supprimer les brouillons non synchronisés. Les sites local et GitHub Pages ont des caches et des sessions distincts, mais accèdent au même journal en ligne après connexion au même compte.

Dans **Paramètres**, **Exporter** télécharge une sauvegarde JSON du journal ouvert, sans session ni préférence de thème. **Importer** vérifie le format et demande une confirmation avant de remplacer le journal et ses objectifs ; lorsque tu es connecté, cette modification est synchronisée avec le compte et reste soumise aux conflits éventuels avec un autre appareil. Exporte les données existantes avant un remplacement. Un fichier importé ne doit pas dépasser 5 Mo.

Les sauvegardes ne sont pas chiffrées : conserve-les dans un endroit sûr et ne les ajoute pas au dépôt. Les fichiers `cerise-*.json` sont ignorés par Git.
Le stockage local n'est pas un coffre-fort : une personne ayant accès au même profil de navigateur, ou un autre script de la même origine, peut y accéder.

Si le stockage échoue, un message persistant propose de réessayer. Les modifications restent en mémoire et exportables tant que la page reste ouverte. Un journal existant illisible n'est jamais remplacé automatiquement.

## Lancement local

Node.js 22.12 ou plus récent.

```sh
npm ci
npm run dev -- --port 5212
```

Ouvrir http://127.0.0.1:5212/. Le serveur écoute seulement l'ordinateur local.

```sh
npm test
npm run test:e2e
npm run build
```

Les tests navigateur utilisent Microsoft Edge installé sous Windows. En CI, Playwright utilise Chromium, installé par le workflow. Les captures et traces locales sont dans `test-results/`, ignoré par Git.

La compilation génère `dist/index.html`, un fichier autonome avec JavaScript, CSS, icônes et photo incorporés. Pas de CDN ni de police distante. Les chemins relatifs permettent un hébergement dans un sous-répertoire GitHub Pages.

## Publication

Le workflow `.github/workflows/pages.yml` teste et publie la branche `main` sur GitHub Pages. Le dépôt doit utiliser **GitHub Actions** comme source Pages. Ne pas publier de sauvegardes personnelles.

## Thèmes et rotation quotidienne

Les six thèmes sont disponibles en haut de **Paramètres**, avant les objectifs : **Cerise Nocturne**, **Rouge Pétrole**, **Rouge Studio**, **Matcha Minuit**, **Cobalt Après-Minuit** et **Cerise Classique**. Les cinq premiers sont sombres ; Classique conserve la palette claire d'origine. La barre de comparaison et les exemples temporaires ont été retirés. Les anciens paramètres d'URL `themes` et `palette` n'activent plus de mode particulier.

**Un thème au hasard chaque jour** est activé par défaut. L'application mélange les six thèmes, puis les montre une fois chacun avant de recommencer. Deux cycles consécutifs ne peuvent pas afficher le même thème deux jours de suite. Le thème reste identique lors d'un rechargement dans la même journée locale. La rotation se fait à minuit si la page reste ouverte, ou lors de la prochaine ouverture/reprise ; les jours sans visite ne consomment pas de thèmes.

Choisir manuellement un thème l'applique immédiatement et redémarre le cycle : ce thème compte comme le premier, les cinq autres sont mélangés pour les jours suivants. Même sélectionner à nouveau le thème actif redémarre le cycle. Le mode aléatoire reste activé et reprend le lendemain. Pour garder un thème indéfiniment, désactiver le mode aléatoire. Le réactiver conserve le thème actuel jusqu'au lendemain.

La préférence, le thème courant, la date et les thèmes restants sont enregistrés dans `localStorage`, sous `cerise.themes.v1`, indépendamment de `cerise.journal.v1`. Ils sont partagés entre les onglets de la même origine et du même profil de navigateur, mais pas entre appareils ou navigateurs. Les exports/imports du journal ne modifient pas les couleurs. Si le stockage est bloqué, le thème reste utilisable pour la session et un avertissement apparaît dans Paramètres.

`src/theme-preferences.mjs` gère la rotation et sa persistance. `src/theme-review.js` et `src/theme-review.css` contiennent les palettes permanentes et leur sélecteur. Les couleurs restent explicitement autorisées à sortir de la palette Clawpilot. Les données de démonstration de `src/theme-preview.mjs` ne servent plus qu'aux tests.

`npm run test:e2e -- --project=themes` vérifie les six palettes, les contrastes, les états vides/remplis, les graphiques, la stabilité du layout et la rotation persistante. `--project=journal` conserve les tests du journal. Les serveurs de test utilisent les ports locaux 5213 (production) et 5214 (développement).

## Supabase

Projet dédié **Cerise**, référence `tmmsfazjravormkwnmji`, région Paris. Il est indépendant des autres applications et de leurs comptes Supabase.

`src/supabase.js` contient l'URL et la clé **publishable**, volontairement publiques. `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY` peuvent les remplacer au moment de la compilation. Aucune variable ou secret GitHub Actions n'est nécessaire pour ce projet. Ne jamais ajouter de clé `service_role`, de clé secrète, de jeton CLI ou de mot de passe au frontend ou au dépôt.

`src/cloud-repository.mjs` gère le brouillon par compte, les révisions et les requêtes en cours. `src/cloud-state.mjs` fusionne les versions de base, locale et distante. Le contrat du modèle reste `{ version, days, targets }`. Chaque requête vérifie l'identité de la session et conserve son jeton, même si le compte change pendant la requête.

La migration `supabase/migrations/202609220001_cerise.sql` crée :

- `cerise_journals` : propriétaire, révision, dernière opération.
- `cerise_meals` : repas par propriétaire et date, calories et protéines facultatives.
- `cerise_targets` : historique des objectifs par propriétaire.
- `cerise_read_journal()` : lecture atomique du journal de l'utilisateur connecté.
- `cerise_save_journal(...)` : sauvegarde atomique, validation et contrôle de révision. Le propriétaire vient exclusivement de `auth.uid()`, jamais d'un paramètre client.

RLS est activé sur les trois tables. Les utilisateurs connectés ne peuvent lire que leurs lignes ; les écritures directes et tous les accès anonymes sont interdits. Seule la fonction de sauvegarde autorise les écritures validées. Un verrou par propriétaire et la révision attendue empêchent une sauvegarde concurrente d'écraser silencieusement une autre. Une opération déjà appliquée peut être rejouée sans nouvelle écriture.

`npm test` comprend les tests du modèle, de fusion/synchronisation et un PostgreSQL embarqué PGlite exécutant la vraie migration : droits anonymes, isolation de deux utilisateurs, validation, annulation et concurrence par révision. Les tests navigateur cloud utilisent uniquement des comptes et réponses simulés, jamais le journal réel. Une connexion réelle doit être vérifiée manuellement avec le mot de passe saisi directement dans le navigateur.

### Administration isolée

`scripts/supabase.mjs` utilise le CLI installé dans ce projet, un profil dédié dans `~/.supabase-cerise/profile.json` et un `SUPABASE_HOME` séparé. Il ignore les identifiants hérités d'autres projets et fixe la référence Cerise. Ne pas lancer de connexion/déconnexion CLI globale pour ce projet.

```sh
node scripts/supabase.mjs projects list --output json
node scripts/supabase.mjs db query "select tablename, rowsecurity from pg_tables where schemaname='public';" --output json
node scripts/supabase.mjs config push --yes
```

La migration initiale a été appliquée le 22 septembre 2026 via `db query --file` (API de gestion), pas via `db push`. Elle n'est donc pas enregistrée automatiquement dans l'historique des migrations CLI. Ne pas rejouer ce fichier de création sur le projet existant, ni utiliser `db push` avant d'avoir réconcilié cet historique. Les futures évolutions doivent être des migrations séparées et testées.

`supabase/config.toml` fixe les URL autorisées, désactive les inscriptions et conserve explicitement les réglages TOTP et e-mail. Avec le CLI 2.116.0, conserver **`auth.enable_signup = false` mais `auth.email.enable_signup = true`** : le réglage e-mail active aussi le fournisseur de connexion, tandis que le réglage global interdit toujours les nouvelles inscriptions. Mettre les deux à `false` bloque les connexions des comptes existants avec `email_provider_disabled`.

Après un changement de configuration, vérifier `/auth/v1/settings` avec la clé publique : `external.email` doit être `true`, `disable_signup` doit être `true` et `external.anonymous_users` doit être `false`. Les tests navigateur simulés ne vérifient pas cette configuration distante. Vérifier aussi les différences avant de pousser : les valeurs par défaut du CLI peuvent modifier les réglages omis. Les mots de passe nouvellement définis doivent avoir au moins 12 caractères. La connexion du compte déjà confirmé ne nécessite pas d'e-mail ; le SMTP personnalisé et le parcours de réinitialisation de mot de passe ne sont pas configurés ni validés dans cette version.

## Crédit visuel

Photographie de cerises : [Pexels, photo 109274](https://www.pexels.com/photo/red-cherries-109274/), distribuée sous la [licence Pexels](https://www.pexels.com/license/). Une copie optimisée est incluse dans les sources pour éviter les requêtes externes. Icônes : Lucide. Graphiques : Chart.js.