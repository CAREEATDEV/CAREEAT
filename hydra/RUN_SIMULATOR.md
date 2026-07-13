# HYDRA — lancer l'app dans le simulateur iOS (pour filmer)

But : voir la **vraie app** (widget compris) tourner sur un iPhone simulé ou
réel, pour enregistrer des vidéos promo.

Team ID déjà câblé : **QN65J7X695**. Le widget est **activé par défaut**.

## Prérequis (sur ton Mac)
1. **Xcode** (App Store, gratuit) → l'ouvrir une fois pour installer les
   composants, puis : Xcode ▸ Settings ▸ Platforms ▸ installer un runtime iOS.
2. **Node 18+** (https://nodejs.org).
3. Côté Apple, une seule fois :
   - **Accepter** le contrat Apple Developer mis à jour (developer.apple.com).
   - **Enregistrer l'App Group** `group.com.hydraapp.hydra`
     (Identifiers ▸ App Groups ▸ +).

> Astuce : pour un test rapide **sans** widget (aucun App Group requis), préfixe
> les commandes par `HYDRA_NO_WIDGET=1`.

## Option A — la plus rapide : Expo Go (aucun build)
```bash
cd hydra
npm install
npm run go          # = expo start --ios
```
- Ça ouvre le simulateur, installe **Expo Go** dedans et charge HYDRA.
- Si le simulateur ne démarre pas seul : lance-le via
  `open -a Simulator`, puis dans le terminal Expo appuie sur **i**.
- Recharger après un changement : **r**. Menu dev : **shift+m**.

> Le widget n'apparaît pas dans Expo Go (normal) — mais les 3 écrans de l'app
> (BAR / LOG / RÉGLAGES), la barre de vie, les boutons EAU/ALCOOL/SPORT, les
> animations et l'historique fonctionnent : c'est ce que tu filmes.

## Option B — build natif complet (dev build)
Utile seulement si tu veux le rendu 100 % natif (toujours sans widget) :
```bash
cd hydra
npm install
npx expo prebuild --clean --platform ios   # pas de Team ID demandé
npx expo run:ios                            # build + lance le simulateur
```

## Filmer la vidéo
- **Enregistrement écran du simulateur** (le plus simple) :
  ```bash
  xcrun simctl io booted recordVideo hydra.mp4
  ```
  (Ctrl+C pour arrêter.) Le fichier `hydra.mp4` est prêt pour le montage.
- Ou QuickTime ▸ Fichier ▸ Nouvel enregistrement de l'écran → cadre le simulateur.
- Choisir le modèle d'iPhone : dans Simulator ▸ File ▸ Open Simulator ▸ iOS ▸
  iPhone 15 Pro (par ex.).

## Astuce contenu
Dans **RÉGLAGES**, change le poids → le besoin quotidien et le drain changent en
direct. Logge une **bière** → la barre devient violette (poison). Spamme **EAU**
→ tu déclenches le garde-fou (le corps sature). Ça fait de bons plans vidéo.

## Voir le widget
Une fois l'app lancée (build avec widget) :
1. Ouvre l'app une fois (elle écrit son état dans l'App Group).
2. Écran verrouillé → long-press → **Personnaliser** → zone sous l'heure →
   choisis **HYDRA** (`accessoryRectangular`).
3. Ou écran d'accueil → long-press → **+** → **HYDRA** (`systemSmall`).

Si Xcode râle sur la signature : ouvre `ios/hydra.xcworkspace`, pour **chaque**
target (app **et** HydraWidget) onglet *Signing & Capabilities* → Team =
`QN65J7X695`, App Group = `group.com.hydraapp.hydra`, puis relance.
