# HYDRA — Générateur de vidéos verticales (TikTok / Instagram)

Clone **vidéo** du générateur d'images : même charte (polices, couleurs,
disposition), mais la carte s'anime et sort un **fichier vidéo 1080×1920
(8-14 s) prêt à uploader**, plus les légendes.

Structure de chaque vidéo :

1. **0-2 s** — la carte hook (identique au post image) pour stopper le scroll.
2. **Milieu** — l'explication révélée **ligne par ligne à l'écran** ; au
   milieu, la **démo produit** : la barre de vie draine (« TU SÈCHES. », elle
   vire au rouge segment par segment) puis **remonte franchement** en vert
   (« TU REBOIS. ») — le rappel visuel de l'app, ~3 s.
3. **Fin** — la **réponse** en gros, puis CTA **waitlist** + marque HYDRA.

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
3. La vidéo s'affiche en aperçu → **Télécharger**, et **copie** les 2 légendes.
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
npm install                       # playwright + ffmpeg-static (→ MP4 H.264)
npx playwright install chromium   # le navigateur de rendu
```

### Utilisation one-click (juste le sujet)

```bash
# ta clé API en variable d'environnement (JAMAIS dans un fichier du repo)
# PowerShell (Windows) :  $env:ANTHROPIC_API_KEY="sk-ant-…"
# bash/zsh (Mac/Linux) :  export ANTHROPIC_API_KEY="sk-ant-…"

node render-video.js --sujet "Le mythe des 8 verres d'eau par jour"
```

Claude fait la recherche scientifique (web search), écrit hook + lignes +
réponse + CTA + les 2 légendes, puis le script rend la vidéo. Sortie :

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

Champs du JSON : `hook`, `accent` (`green|amber|red|poison`), `seg` (2-7),
`lines` (3-5 lignes courtes), `answer`, `cta_video`, `caption_instagram`,
`caption_tiktok`. Les `*astérisques*` colorent un mot en accent.

## Options

- `--out <dossier>` — où écrire les fichiers (défaut : dossier courant).
  Mets ton dossier Google Drive pour retrouver la vidéo sur ton téléphone.
- `--fps 30` — cadence (défaut 30).
- `--keep-frames` — garde les PNG intermédiaires (debug).
- `--key sk-ant-…` — alternative à la variable d'environnement.

## Comment ça marche (technique)

`template-video.html` contient toute l'animation en **CSS keyframes** ; le
moteur `render-video.js` (fonction `generateVideo`, utilisée à la fois par la
CLI et par l'interface `studio-server.js`) cale les délais calculés (durée
adaptée au nombre de lignes, bornée 8-14 s) puis capture **frame par frame** en
forçant `currentTime` de toutes les animations — rendu déterministe, aucune
frame perdue — et assemble avec ffmpeg (`ffmpeg-static`/système → MP4 H.264 ;
à défaut, le ffmpeg minimal de Playwright → WebM).

L'interface est un petit serveur **local** (`studio-server.js`, `localhost`
uniquement) : rien ne sort de ta machine sauf l'appel à l'API Claude, fait avec
ta propre clé (jamais écrite dans un fichier du repo).

⚠️ Ne modifie pas `template-hook-post.html` ni `post-studio.html` (les
générateurs d'images) : la version vidéo vit entièrement dans ce dossier.
