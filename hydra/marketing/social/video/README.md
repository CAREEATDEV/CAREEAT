# HYDRA — Générateur de vidéos verticales (TikTok / Instagram)

Clone **vidéo** du générateur d'images : même charte (police, couleurs,
disposition), même format **1080×1350** (4:5, Instagram — utilisé aussi pour
TikTok). Sort un **fichier .mp4 prêt à uploader (~60 s, format "réel
explicatif")**, plus les légendes — assez de temps pour une explication
scientifique aussi détaillée qu'une légende Instagram complète (plusieurs
mécanismes, études citées).

Structure de chaque vidéo :

1. **0-3 s** — l'accroche, écrite selon la **méthode Kallaway en 3 temps**
   (voir ci-dessous) pour stopper le scroll et ouvrir une boucle de curiosité.
2. **Milieu (~45 s)** — l'explication complète révélée **une ligne à la fois
   à l'écran** (chaque ligne remplace la précédente, comme un sous-titre,
   7 à 10 lignes) ; au milieu, la **démo produit** : la barre de vie draine
   (« TU SÈCHES. », vire au rouge) puis **remonte franchement** en vert
   (« TU REBOIS. ») — le rappel visuel de l'app, ~3 s.
3. **Fin (~8,5 s)** — la **réponse/synthèse** en gros (couleur d'accent),
   puis CTA **waitlist** + marque HYDRA.

## 🪝 L'accroche en 3 temps (méthode Kallaway)

Claude n'écrit plus une simple question : l'accroche suit une structure en
3 temps très courts (chacun 3-8 mots), reprise du framework de Kane Kallaway
(analyse de milliers de vidéos virales) :

- **`hook_context`** — pose le sujet net (ex. *« La gueule de bois. »*).
- **`hook_stop`** — une interjection de **contraste** qui stoppe le pouce, souvent
  avec « mais »/« sauf que » (ex. *« Mais l'eau n'y change presque rien. »*).
- **`hook_snapback`** — le **retournement** qui inverse l'attente et ouvre la
  boucle de curiosité (ex. *« Le vrai coupable est bien pire. »*).

Les 3 temps sont **assemblés automatiquement** en une accroche unique à l'écran
(et lue d'un trait en voix off). Ils restent séparés dans le `…-contenu.json`
pour que tu puisses en retoucher un seul et re-rendre (`--json`).

Le reste du script applique aussi ses principes : **enjeu front-loadé** (on
comprend dès l'accroche pourquoi ça nous concerne), **boucles de curiosité
rouvertes** toutes les 2-3 lignes, **spécificité** (chiffres/études nommés),
et **zéro "slow build"** (pas d'intro molle, pas de « salut c'est HYDRA »).

## 🧩 Simplicité par la métaphore (méthode Kallaway — "context lean")

Règle **non négociable** du prompt : un terme technique (enzyme, molécule,
acétaldéhyde, ADH, cytokines…) ne peut **jamais apparaître seul** dans le
script — il doit être accroché à une image du quotidien que n'importe qui
comprend en 1 seconde, soit en remplacement, soit juste à côté (le mot savant
reste pour la crédibilité, l'image porte la compréhension). Deux réservoirs
d'images, dans l'ordre :

1. **L'univers de jeu HYDRA** (déjà familier) : barre de vie, dégâts, poison,
   recharge, cooldown — ex. *« Ton foie, c'est ton unique usine de nettoyage
   de l'alcool »* plutôt que *« l'enzyme ADH métabolise l'éthanol »*.
2. Sinon, un objet/une scène du quotidien : usine, batterie, filtre, éponge,
   alarme incendie, videur de boîte de nuit…

Test appliqué à chaque ligne : **un ado de 12 ans doit tout comprendre et
pouvoir le raconter à quelqu'un d'autre**, à la première écoute, sans pause.
La spécificité (chiffres, études) reste utilisée comme **preuve**, mais
toujours emballée dans l'image, jamais à sa place.

## 🎙️ Voix off calée sur la recharge (optionnel, ElevenLabs) — le mode gratuit

Dans le studio, ouvre **« 🎙️ Voix off — ElevenLabs (optionnel) »**, colle ta
**clé API ElevenLabs** et un **Voice ID** (sur elevenlabs.io : *Voix* → choisis
une voix française → copie le Voice ID). Si ces deux champs sont remplis, c'est
ce pipeline qui tourne :

1. Claude écrit le script **et** une `recharge_line` — une phrase courte qui
   fait référence à l'hydratation « au moment où la barre se recharge ».
2. ElevenLabs lit toute la narration **à voix haute** et renvoie le timing
   exact de chaque mot (alignement caractère par caractère).
3. On insère juste ce qu'il faut de **silence avant la `recharge_line`** pour
   que son début tombe **pile à t = 30 s** — l'instant précis où la barre de vie
   se recharge à l'écran (drain → refill, ~3,5 s). Voix et image parlent alors
   du même moment.
4. **Aucun sous-titre n'est incrusté.** La vidéo sort avec la voix off + la
   démo calée, c'est tout.

### Comment poster (important)

- Poste d'abord la vidéo sur **TikTok**, active ses **sous-titres automatiques**
  et **recentre-les à la main**.
- **Télécharge la vidéo depuis TikTok** (elle contient alors les sous-titres
  gravés), puis **repost-la telle quelle sur Instagram**.
- C'est gratuit : on ne paie que les appels API Claude + ElevenLabs, jamais un
  rendu de sous-titres de notre côté.

Si les deux champs sont vides, rien ne change : **vidéo muette avec sous-titres
incrustés** (minutage fixe), comme avant. Clé et Voice ID sont stockés
**uniquement dans ce navigateur**, jamais dans le repo. Modèle utilisé :
`eleven_multilingual_v2` (voix neutre et cohérente, adaptée au ton HYDRA).

> Les 4 morceaux de fond du mode voix off (`backgrounds/still-<accent>.png`,
> `backgrounds/demo-<accent>.mp4`, `backgrounds/still-post-<accent>.png`) sont
> rendus une seule fois par couleur puis mis en cache — les vidéos suivantes de
> la même couleur ne relancent aucun Chromium.

## ⚡ Pourquoi c'est rapide (architecture)

Le premier post d'une couleur d'accent donnée prend ~2 min (rendu du fond de
marque, plus long maintenant que les vidéos font 60 s). **Tous les posts
suivants de la même couleur prennent quelques secondes** : le fond (barre de
vie qui draine/remonte + habillage HYDRA) est une **vidéo déjà prête** — les
4 couleurs (`vert`/`rouge`/`ambre`/`poison`) sont déjà fournies dans
`backgrounds/`, tu n'as même pas ce premier temps d'attente. Seul le texte
(hook/lignes/réponse/CTA écrits par Claude) est **incrusté en sous-titres**
sur ce fond — pas de nouveau rendu Chromium à chaque post.

C'est ce qui permet aussi la durée plus longue (~60 s au lieu de ~13-18 s) :
allonger le fond ne coûte rien puisqu'il n'est fait qu'une fois.

⚠️ Ça ne change rien au coût de l'appel à l'API Claude (recherche web +
rédaction) — ce coût-là vient uniquement de cet appel, pas du rendu vidéo.

### 💸 Réduire le coût par vidéo (modèle Claude)

Le prix vient à ~90 % de l'appel Claude. Deux leviers, tous deux intégrés :

- **Choix du modèle** (menu déroulant dans le studio, ou `--modele` en CLI) :

  | Modèle | Prix (entrée / sortie /Mtok) | Pour ce workflow |
  |---|---|---|
  | **Sonnet 4.6** (défaut) | $3 / $15 | **Recommandé** — qualité quasi Opus, ~40 % moins cher |
  | **Haiku 4.5** | $1 / $5 | Le moins cher ; ok mais moins fiable sur la nuance scientifique / le JSON strict |
  | **Opus 4.8** | $5 / $25 | Le plus puissant, mais overkill ici |

  La recherche web fournit les faits ; le modèle ne fait que **synthétiser +
  rédiger en français**, donc Sonnet suffit largement.

- **Recherches web plafonnées à 4 par vidéo** (`WEB_SEARCH_MAX_USES` dans
  `render-video.js`) : chaque recherche est facturée **et** renvoie tout le
  contexte accumulé au modèle → les plafonner coupe les deux coûts d'un coup.

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

# modèle moins cher (défaut = sonnet) : --modele sonnet|haiku|opus
node render-video.js --sujet "…" --modele haiku
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

Champs du JSON : l'accroche en 3 temps `hook_context` / `hook_stop` /
`hook_snapback` (assemblés en un `hook` unique — un ancien JSON n'ayant que
`hook` reste accepté), `accent` (`green|amber|red|poison`), `lines` (7-10
lignes), `answer`, `recharge_line` (phrase dite pile quand la barre se recharge,
mode voix off), `cta_video`, `caption_instagram`,
`caption_tiktok`. Les `*astérisques*` colorent un mot en accent. (Le champ
`seg` est encore accepté mais n'a plus d'effet visuel : la démo de la barre
de vie est désormais la même pour tous les posts d'une couleur donnée,
puisqu'elle fait partie du fond pré-enregistré.)

## Options

- `--out <dossier>` — où écrire les fichiers (défaut : dossier courant).
  Mets ton dossier Google Drive pour retrouver la vidéo sur ton téléphone.
- `--key sk-ant-…` — alternative à la variable d'environnement.
- `--elevenlabs-key …` / `--voice-id …` (ou `ELEVENLABS_API_KEY` /
  `ELEVENLABS_VOICE_ID`) — active la voix off (voir plus haut).

## Régénérer les fonds (si tu changes la charte)

Les 4 fonds (`backgrounds/bg-<accent>.mp4`) sont déjà fournis dans le repo.
Si tu modifies `template-background.html` (couleurs, police, disposition),
supprime le(s) fichier(s) concerné(s) dans `backgrounds/` — ils seront
automatiquement régénérés (~2 min) au prochain post de cette couleur.

## Comment ça marche (technique)

- `template-background.html` : l'habillage de marque seul (barre de vie +
  démo drain/remonte, eyebrow, ligne CTA, brand) — **pas de texte
  dynamique**. Rendu une fois par couleur (Chromium, capture frame par
  frame déterministe — `currentTime` forcé sur toutes les animations, comme
  avant) puis encodé en H.264 et mis en cache dans `backgrounds/`.
- `timeline.js` : le minutage **fixe** (~60 s), seule source de vérité,
  partagé entre le fond et les sous-titres — c'est lui qui calibre
  automatiquement la vitesse de défilement des lignes sur la durée du fond,
  quel que soit leur nombre (7 à 10).
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
