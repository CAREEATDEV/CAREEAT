# HYDRA — Posts "hook" Instagram / TikTok

> 🎬 **Version vidéo** : le dossier [`video/`](video/) génère des vidéos
> verticales 1080×1920 (hook → révélation ligne par ligne → démo barre de
> vie → réponse + CTA waitlist) à partir d'un simple sujet, avec la même
> charte. Voir `video/README.md`.

Mécanique : l'**image** pose une question ouverte ou une intrigue (façon
mèche), la **légende** apporte l'explication scientifique complète. Ça
maximise le temps passé sur le post (l'algorithme le détecte et pousse le
post davantage) et construit la crédibilité "on maîtrise le sujet".

Rendu 100% cohérent à chaque fois : **même template HTML**, mêmes couleurs et
polices exactes du projet (`src/theme/colors.ts`, `assets/fonts/`) — pas un
générateur d'image IA qui réinterprète différemment à chaque fois.

## 🎛️ Le studio (le plus simple — aucune ligne de commande)

**`post-studio.html`** — un petit logiciel autonome. **Double-clique dessus**,
il s'ouvre dans ton navigateur. **Une seule chose à écrire : le sujet du post.**

1. Colle ta clé API Anthropic (une fois — mémorisée dans le navigateur).
2. Tape le **sujet** (ex. : *Et si les « 8 verres par jour » n'avaient aucune
   base scientifique ?*).
3. **« ✦ Générer le post »** → Claude fait la recherche scientifique (web
   search), trie les sources, puis produit **tout** automatiquement :
   - l'accroche de l'image (mot choc déjà coloré),
   - la couleur d'accent et la barre de vie (selon l'humeur du sujet),
   - l'appel à l'action,
   - **l'image Instagram (4:5) et l'image TikTok (9:16)**, côte à côte,
   - **la légende Instagram et la légende TikTok** (rythmes différents),
     chacune finissant par le CTA vers la landing
     (`hydra-landing-sooty.vercel.app`) + hashtags.
4. Tu télécharges les **2 images PNG** et tu **copies** (ou télécharges en
   `.txt`) les **2 légendes**. C'est tout.

Un petit panneau **« Ajustements (optionnel) »** permet de retoucher
l'accroche ou le CTA à la main si besoin — mais par défaut il n'y a aucun
choix à faire.

- La clé est stockée **uniquement dans ton navigateur** (localStorage). Elle
  n'est **jamais** écrite dans le fichier ni poussée sur GitHub — elle part
  seulement vers Anthropic au moment de l'appel.
- Modèle utilisé : `claude-opus-4-8` avec l'outil de recherche web.
- Le studio reste un **fichier HTML autonome** (aucun serveur, aucune install).
- Vérifie toujours les chiffres précis avant de publier.

Si tu préfères passer par moi pour écrire la légende (sans clé API), le prompt
générique ci-dessous marche toujours.

## Le prompt générique à réutiliser (si tu préfères passer par moi)

Colle ceci (dans Claude Code, ce projet) en remplaçant juste `[THÈME]` :

> Génère un post HYDRA sur le thème : **[THÈME]**.
> Suis la mécanique hook : une question ouverte ou une intrigue scientifique
> sur l'image, la réponse complète et sourcée en légende. Utilise le template
> `marketing/social/render-post.js`, génère les deux formats (ig + tiktok),
> et écris la légende (mécanique hook + explication + source + CTA doux vers
> l'app) dans le ton HYDRA (brutal, minimaliste, direct, aucune émotion
> "wellness cucul").

Je choisis alors : le texte du hook, la couleur d'accent selon l'humeur du
sujet (voir plus bas), le nombre de segments allumés (juste esthétique), je
rends les deux images, et j'écris la légende complète.

## Couleurs d'accent (quel sujet → quelle couleur)

| Couleur | Usage |
|---|---|
| `green` (vert) | Fait positif, conseil actionnable, "bonne nouvelle" scientifique |
| `red` (rouge) | Mythe à casser, alerte, chiffre choc |
| `amber` (ambre) | Nuance, "ça dépend", zone grise |
| `poison` (violet) | Tout sujet lié à l'alcool |

## Utilisation manuelle du script (si besoin sans passer par moi)

```bash
cd hydra/marketing/social
node render-post.js \
  --format ig \
  --hook 'Et si le chiffre <span class="accent">« 8 verres par jour »</span> n’avait aucune base scientifique ?' \
  --cta 'LA VRAIE FORMULE EN LÉGENDE' \
  --accent red \
  --seg 3 \
  --out post-01-ig.png
```

- `--format` : `ig` (1080×1350, 4:5 feed) ou `tiktok` (1080×1920, 9:16 reel/story).
- `--hook` : le texte, en HTML basique — entoure le mot/chiffre choc de
  `<span class="accent">...</span>` pour le colorer.
- `--seg` : 0 à 8, nombre de segments "pleins" dans la mini barre de vie
  (juste un rappel visuel de marque, esthétique).
- Nécessite Playwright (déjà présent sur cette machine ; en local, `npm i
  playwright` si besoin).

## Sujets déjà identifiés (liste de départ)

1. Le mythe des "8 verres d'eau par jour" *(exemple ci-dessus)*
2. Le plafond d'absorption (~1L/h) : boire d'un coup ne sert à rien
3. -1% d'eau corporelle = -X% de concentration/perf
4. Le classement des boissons qui hydratent vraiment (Beverage Hydration Index)
5. Pourquoi tu es déjà déshydraté au réveil
6. La couleur de l'urine, le meilleur indicateur gratuit (échelle d'Armstrong)
7. Pourquoi la chaleur te fait perdre bien plus d'eau
8. Le vrai mécanisme d'une gueule de bois
9. Bière vs vin vs spiritueux : pourquoi le corps réagit différemment
10. L'hyponatrémie : le risque rare mais réel de trop boire

⚠️ Avant de publier un post citant un chiffre précis (ex. #3, #10), je
vérifie la source exacte au moment de rédiger — pas de statistique
approximative avancée comme un fait établi.
