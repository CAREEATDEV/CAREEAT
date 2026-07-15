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

## Installation (une fois, sur ta machine)

```bash
cd hydra/marketing/social/video
npm install                       # playwright + ffmpeg-static (→ MP4 H.264)
npx playwright install chromium   # le navigateur de rendu
```

## Utilisation one-click (comme le studio image : juste le sujet)

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
script cale les délais calculés (durée adaptée au nombre de lignes, bornée
8-14 s) puis capture **frame par frame** en forçant `currentTime` de toutes
les animations — rendu déterministe, aucune frame perdue — et assemble avec
ffmpeg (`ffmpeg-static`/système → MP4 H.264 ; à défaut, le ffmpeg minimal de
Playwright → WebM).

⚠️ Ne modifie pas `template-hook-post.html` ni `post-studio.html` (les
générateurs d'images) : la version vidéo vit entièrement dans ce dossier.
