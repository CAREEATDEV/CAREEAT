# HYDRA

Suivi d'hydratation avec widget lock screen "barre de vie". iOS, MVP.

**Positionnement :** jeu vidéo brutal/minimaliste. Pas de wellness mignon, aucun bleu.

## Stack

- Expo SDK 51 + TypeScript, workflow **dev build** (Expo Go ne compile pas le widget).
- Widget iOS natif Swift/WidgetKit ajouté via le config plugin `@bacons/apple-targets`.
- Partage app ↔ widget via **App Group** `group.com.chipli.hydra` (UserDefaults partagés).
- `zustand` + `@react-native-async-storage/async-storage` côté RN, miroir dans l'App Group pour le widget.
- Pas de backend, pas de compte, tout est local.

Bundle id : `com.chipli.hydra` — modifiable dans `app.json` et `targets/widget/expo-target.config.js`.

## Structure

```
hydra/
├── App.tsx                          # navigation tab
├── src/
│   ├── engine/hydrationEngine.ts    # 💥 source de vérité (event sourcing)
│   ├── engine/hydrationEngine.test.ts
│   ├── store/useHydration.ts        # zustand persist + sync App Group + reload widget
│   ├── notifications/scheduler.ts
│   ├── native/appGroupBridge.ts     # JS ↔ module natif
│   ├── screens/{Home,History,Settings}Screen.tsx
│   ├── components/{HydrationBar,LogButton}.tsx
│   └── theme/colors.ts
└── targets/widget/
    ├── expo-target.config.js        # déclare le target widget
    ├── HydrationEngine.swift        # ⚠️ port symétrique du TS
    ├── HydraWidget.swift            # WidgetKit accessoryRectangular + systemSmall
    ├── HydrationEngineTests.swift   # mêmes cas que le TS
    ├── HydraAppGroupModule.swift    # module RN pour écrire l'App Group
    └── HydraAppGroup.m              # bridge Obj-C
```

## Mécanique physiologique (v2 — le différenciateur)

La barre représente des **mL réels** relatifs au besoin quotidien.

- Besoin quotidien = `poids_kg × 32 mL` (défaut 70 kg → 2240 mL).
- Drain de base = `besoin / heures_éveil` (défaut 16 h → ~140 mL/h).
- Sommeil : drain × **0,4** (métabolisme réduit).
- Température : <18 °C ×0,9 · 18–24 ×1,0 · 25–30 ×1,2 · >30 ×1,4.
- Sport (sueur, mL/h) : léger 400 · modéré H 800 / F 500 · intense 1200 · intense+chaleur 1600.

**Alcool en 2 couches** :
- Couche A — perte nette réelle basée sur la diurèse (constante d'Eggleton) :
  `net = volume × (1-ABV) − ethanol_g × 10`. Bière 5%/500ml ≈ **neutre voire hydratante**,
  shot 40%/40ml ≈ **-100 mL**.
- Couche B — fenêtre poison ×1,3 à ×2 selon les grammes d'éthanol, pic à 2h,
  décroissance jusqu'à 0 à 4h. Cumul plafonné à ×3 / 4h.

Le niveau n'est **jamais** stocké. Il est **recalculé à chaque lecture** depuis
l'historique d'événements horodatés (event sourcing) + profil. C'est ce qui
garantit que le widget et l'app sont toujours cohérents, y compris après
force-quit ou changement de poids.

## Tests

**TypeScript** (déjà passants) :

```bash
cd hydra
npm test
# 18 tests dont les 8 cas d'acceptation v2 :
# #1 drain 2h ≈ 280 mL     #2 sommeil ×0.4         #3 bière ~neutre + poison
# #4 shot négatif + poison #5 cumul ×3 / 4h        #6 sport par sexe
# #7 chaleur ×1.4          #8 incrémental = one-shot
```

**Swift** : ouvrir le workspace après prebuild puis lancer les tests Xcode
(target `HydraWidget` → cmd+U), ou :

```bash
xcodebuild test -workspace ios/hydra.xcworkspace -scheme HydraWidget \
  -destination 'platform=iOS Simulator,name=iPhone 15 Pro'
```

Les deux suites couvrent exactement les mêmes cas.

## Setup

Prérequis : Node 20+, npm, macOS avec Xcode 15+, un simulateur iPhone iOS 16.4+,
compte Apple Developer (pour l'App Group et le widget).

```bash
# 1. installer les deps
cd hydra
npm install

# 2. renseigner ton Apple Team ID dans app.json (plugin @bacons/apple-targets)
#    et dans les entitlements du target widget si besoin.

# 3. générer le projet natif ios/
npx expo prebuild --clean --platform ios
```

## Dev build (simulateur)

```bash
# option A — EAS Build cloud
eas login
eas build --profile development --platform ios
# installer le .app dans le simu → puis :
npx expo start --dev-client

# option B — build local
npx expo run:ios --device
```

Pour **voir le widget** dans le simu :
1. Lance l'app une fois pour que le snapshot atterrisse dans l'App Group.
2. Ferme l'app.
3. `Home` → écran verrouillé → maintien appuyé → « Personnaliser » →
   choisis le widget **HYDRA** dans `accessoryRectangular`.
4. Reviens dans l'app, tape **BIÈRE** : dans les 15 minutes suivantes le
   widget passe en violet et le countdown se raccourcit (`WidgetCenter.reloadAllTimelines()` est appelé automatiquement après chaque log).

## Prod

```bash
eas build --profile production --platform ios
eas submit --platform ios
```

## Points d'extension (TODO)

- [ ] Live Activity pendant poison (hors scope MVP).
- [ ] HealthKit sync eau bue.
- [ ] Apple Watch complication.
- [ ] Streak stats + graph journalier.
- [ ] Météo → adjust drain rate.
- [ ] Android (WidgetKit-less, refonte widget).

## Design tokens

Voir `src/theme/colors.ts`. Fond `#000000/#101216`, seg vert `#3EE07A`,
ambre `#FFB020`, rouge `#FF3B4A`, poison `#B44CFF`, vides `#1C2026`,
texte `#EDEFF2` / dim `#7C828C`. Chakra Petch (titres/labels) + IBM Plex
Mono (données) via `expo-font`.

Place l'icône 1024 dans `hydra/assets/icon.png` et les .ttf des polices
dans `hydra/assets/fonts/` (voir `App.tsx`).
