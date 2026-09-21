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

Cette première version utilise uniquement `localStorage`, avec la clé `cerise.journal.v1`.
Les repas ne sont pas envoyés au serveur, à GitHub ou à un service d'analyse.
GitHub Pages héberge une application publique, pas une base de données alimentaire.

Les données appartiennent au navigateur et à son origine web : elles ne sont pas synchronisées entre téléphone et ordinateur. Le site local et le site GitHub Pages ont donc des journaux distincts. La navigation privée, l'effacement du stockage ou un changement de navigateur peuvent supprimer ou masquer l'historique.

Dans **Paramètres**, **Exporter** télécharge une sauvegarde JSON. **Importer** vérifie le format et demande une confirmation avant de remplacer tout le journal et ses objectifs. Exporte les données existantes avant un remplacement. Un fichier importé ne doit pas dépasser 5 Mo.

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

## Évolution Supabase

La persistance est isolée dans `createRepository` dans `src/model.mjs`. L'interface travaille sur un document versionné contenant `days` et `targets`. Une future implémentation pourra conserver ce contrat derrière une API asynchrone.

La prochaine étape devra ajouter authentification, séparation par utilisateur et politiques RLS avant toute synchronisation. Prévoir une migration locale explicite avec prévisualisation, sauvegarde et règles de conflit, puis le mode hors connexion. Ne jamais intégrer une clé `service_role` ou un secret serveur au frontend. La clé publique Supabase ne dispense pas des règles RLS. Ne pas appliquer des politiques d'accès anonyme partagé à un journal personnel.

## Crédit visuel

Photographie de cerises : [Pexels, photo 109274](https://www.pexels.com/photo/red-cherries-109274/), distribuée sous la [licence Pexels](https://www.pexels.com/license/). Une copie optimisée est incluse dans les sources pour éviter les requêtes externes. Icônes : Lucide. Graphiques : Chart.js.