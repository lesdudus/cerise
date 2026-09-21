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

## Évolution Supabase

La persistance est isolée dans `createRepository` dans `src/model.mjs`. L'interface travaille sur un document versionné contenant `days` et `targets`. Une future implémentation pourra conserver ce contrat derrière une API asynchrone.

La prochaine étape devra ajouter authentification, séparation par utilisateur et politiques RLS avant toute synchronisation. Prévoir une migration locale explicite avec prévisualisation, sauvegarde et règles de conflit, puis le mode hors connexion. Ne jamais intégrer une clé `service_role` ou un secret serveur au frontend. La clé publique Supabase ne dispense pas des règles RLS. Ne pas appliquer des politiques d'accès anonyme partagé à un journal personnel.

## Crédit visuel

Photographie de cerises : [Pexels, photo 109274](https://www.pexels.com/photo/red-cherries-109274/), distribuée sous la [licence Pexels](https://www.pexels.com/license/). Une copie optimisée est incluse dans les sources pour éviter les requêtes externes. Icônes : Lucide. Graphiques : Chart.js.