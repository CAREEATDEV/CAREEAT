# HYDRA — Posts "hook" Instagram / TikTok

Mécanique : l'**image** pose une question ouverte ou une intrigue (façon
mèche), la **légende** apporte l'explication scientifique complète. Ça
maximise le temps passé sur le post (l'algorithme le détecte et pousse le
post davantage) et construit la crédibilité "on maîtrise le sujet".

Rendu 100% cohérent à chaque fois : **même template HTML**, mêmes couleurs et
polices exactes du projet (`src/theme/colors.ts`, `assets/fonts/`) — pas un
générateur d'image IA qui réinterprète différemment à chaque fois.

## 🎛️ Le studio (le plus simple — aucune ligne de commande)

**`post-studio.html`** — un petit logiciel autonome. **Double-clique dessus**,
il s'ouvre dans ton navigateur (100 % hors ligne, la police HYDRA est intégrée
dedans). Tu tapes ton accroche, tu choisis la couleur d'accent, le format
(Instagram 4:5 / TikTok 9:16) et le nombre de segments, tu vois l'aperçu en
direct, puis **« Télécharger l'image PNG »**. Rendu strictement identique à
chaque fois (c'est le même code qui dessine, pas une IA qui réinterprète).

- Mets les mots à colorer entre `*astérisques*` dans l'accroche.
- Il y a aussi un bloc-notes « Légende » pour garder le texte du post à portée.
- Pour écrire la légende scientifique (la partie créative/sourcée), passe-moi
  le thème ici — le studio gère le visuel, moi j'écris le texte.

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
