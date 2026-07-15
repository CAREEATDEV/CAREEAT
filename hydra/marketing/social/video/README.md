# HYDRA — Générateur de vidéos verticales (TikTok / Instagram)

Clone **vidéo** du générateur d'images : même charte (police, couleurs,
disposition), même format **1080×1350** (4:5, Instagram — utilisé aussi pour
TikTok). Sort un **fichier .mp4 prêt à uploader (~18,5 s)**, plus les légendes.

Structure de chaque vidéo :

1. **0-2,5 s** — le hook (la question/intrigue) pour stopper le scroll.
2. **Milieu** — l'explication révélée **une ligne à la fois à l'écran**
   (chaque ligne remplace la précédente, comme un sous-titre) ; au milieu, la
   **démo produit** : la barre de vie draine (« TU SÈCHES. », vire au rouge)
   puis **remonte franchement** en vert (« TU REBOIS. ») — le rappel visuel
   de l'app, ~3 s.
3. **Fin** — la **réponse** en gros (couleur d'accent), puis CTA **waitlist**
   + marque HYDRA.

## ⚡ Pourquoi c'est rapide (architecture)

Le premier post d'une couleur d'accent donnée prend ~35-40 s (rendu du fond de
marque). **Tous les posts suivants de la même couleur prennent 2-3 s** : le
fond (barre de vie qui draine/remonte + habillage HYDRA) est une **vidéo déjà
prête** — les 4 couleurs (`vert`/`rouge`/`ambre`/`poison`) sont déjà fournies
dans `backgrounds/`, tu n'as même pas ce premier temps d'attente. Seul le
texte (hook/lignes/réponse/CTA écrits par Claude) est **incrusté en sous-titres**
sur ce fond — pas de nouveau rendu Chromium à chaque post.

C'est ce qui permet aussi la durée plus longue (~18,5 s au lieu de ~13 s) :
allonger le fond ne coûte rien puisqu'il n'est fait qu'une fois.

⚠️ Ça ne change rien au coût de l'appel à l'API Claude (recherche web +
rédaction) — ce coût-là vient uniquement de cet appel, pas du rendu vidéo. Si
tu veux réduire spécifiquement ce coût-là (moins de recherche web, modèle
moins cher…), dis-le-moi, c'est un réglage indépendant.

## ⭐ Le plus simple : l'interface (zéro terminal par vidéo)

Tu lances le studio **une fois** et tu fais ensuite autant de vidéos que tu veux
depuis une page web locale — comme le studio image, mais pour la vidéo.

1. **Double-clique** sur le lanceur (dans ce dossier) :
   - Windows : **`HYDRA-Studio-Video.bat`**
   - Mac : **`HYDRA-Studio-Video.command`**
   La toute première fois, il installe ce qu'il faut (quelques minutes), puis
   ouvre `http://localhost:4599` dans ton navigateur.
2. Colle ta **clé API Anthropic** (mémorisée dans le navigateur), tape le
   **sujet**, clique **« Générer la vidéo »**.
3. La vidéo s'affiche en aperçu (2-3 s si la couleur a déjà servi) →
   **Télécharger**, et **copie** les 2 légendes.
4. Laisse la petite fenêtre noire ouverte tant que tu crées des vidéos ; ferme-la
   pour arrêter. Aucun terminal à retaper entre deux vidéos.

> Prérequis unique : **Node.js** installé (https://nodejs.org, version LTS). Le
> lanceur gère le reste tout seul.

Les vidéos générées vont dans `video/out/`. Pour les récupérer sur ton téléphone,
copie-les dans ton dossier Google Drive (ou fais un lien vers ce dossier).

---

## Alternative : ligne de commande

### Installation (une fois)

```bash
cd hydra/marketing/social/video
npm install                       # playwright + ffmpeg-static (→ MP4 H.264 + libass)
npx playwright install chromium   # le navigateur (sert uniquement au 1er rendu de fond)
```

### Utilisation one-click (juste le sujet)

```bash
# ta clé API en variable d'environnement (JAMAIS dans un fichier du repo)
# PowerShell (Windows) :  $env:ANTHROPIC_API_KEY="sk-ant-…"
# bash/zsh (Mac/Linux) :  export ANTHROPIC_API_KEY="sk-ant-…"

node render-video.js --sujet "Le mythe des 8 verres d'eau par jour"
```

Claude fait la recherche scientifique (web search), écrit hook + lignes +
réponse + CTA + les 2 légendes, puis le script incruste ce texte sur le fond
de la couleur choisie. Sortie :

- `hydra-video-<sujet>.mp4` — la vidéo (H.264, `yuv420p`, faststart)
- `hydra-video-<sujet>-legende-instagram.txt` / `-legende-tiktok.txt`
- `hydra-video-<sujet>-contenu.json` — le contenu généré, **éditable**

Pas de son intégré (volontaire) : ajoute un son tendance dans TikTok/IG au
moment de poster, c'est meilleur pour le reach.

## Retoucher sans repayer un appel API

Édite le `…-contenu.json` (une ligne, la réponse, la couleur…) puis :

```bash
node render-video.js --json hydra-video-le-mythe-…-contenu.json
```

Champs du JSON : `hook`, `accent` (`green|amber|red|poison`), `lines` (3-5
lignes courtes), `answer`, `cta_video`, `caption_instagram`,
`caption_tiktok`. Les `*astérisques*` colorent un mot en accent. (Le champ
`seg` est encore accepté mais n'a plus d'effet visuel : la démo de la barre
de vie est désormais la même pour tous les posts d'une couleur donnée,
puisqu'elle fait partie du fond pré-enregistré.)

## Options

- `--out <dossier>` — où écrire les fichiers (défaut : dossier courant).
  Mets ton dossier Google Drive pour retrouver la vidéo sur ton téléphone.
- `--key sk-ant-…` — alternative à la variable d'environnement.

## Régénérer les fonds (si tu changes la charte)

Les 4 fonds (`backgrounds/bg-<accent>.mp4`) sont déjà fournis dans le repo.
Si tu modifies `template-background.html` (couleurs, police, disposition),
supprime le(s) fichier(s) concerné(s) dans `backgrounds/` — ils seront
automatiquement régénérés (~35-40 s) au prochain post de cette couleur.

## Comment ça marche (technique)

- `template-background.html` : l'habillage de marque seul (barre de vie +
  démo drain/remonte, eyebrow, ligne CTA, brand) — **pas de texte
  dynamique**. Rendu une fois par couleur (Chromium, capture frame par
  frame déterministe — `currentTime` forcé sur toutes les animations, comme
  avant) puis encodé en H.264 et mis en cache dans `backgrounds/`.
- `timeline.js` : le minutage **fixe** (~18,5 s), seule source de vérité,
  partagé entre le fond et les sous-titres — c'est lui qui calibre
  automatiquement la vitesse de défilement des lignes sur la durée du fond,
  quel que soit leur nombre (3 à 5).
- `ass.js` : construit le fichier de sous-titres (**ASS/libass**) — hook,
  lignes (une à la fois, à la façon d'un sous-titre), réponse, CTA — avec
  emphase colorée (`*mot*`), fondus et un léger effet "punch" sur la réponse.
- `render-video.js` (fonction `generateVideo`, utilisée par la CLI et par
  `studio-server.js`) : assure le fond de la bonne couleur (génère si
  absent), construit les sous-titres, puis un seul appel **ffmpeg**
  (`-vf ass=...`) incruste tout sur le fond → MP4 final. Aucun Chromium par
  post.

L'interface est un petit serveur **local** (`studio-server.js`, `localhost`
uniquement) : rien ne sort de ta machine sauf l'appel à l'API Claude, fait avec
ta propre clé (jamais écrite dans un fichier du repo).

⚠️ Ne modifie pas `template-hook-post.html` ni `post-studio.html` (les
générateurs d'images) : la version vidéo vit entièrement dans ce dossier.
