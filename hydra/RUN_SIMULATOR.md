# HYDRA — lancer l'app dans le simulateur iOS (pour filmer)

But : voir la **vraie app** tourner sur un iPhone simulé, gratuitement, pour
enregistrer des vidéos promo. Aucun compte Apple payant nécessaire (le widget
lock screen est désactivé par défaut — il viendra plus tard, il exige les 99 $).

## Prérequis (sur ton Mac)
1. **Xcode** (App Store, gratuit) → l'ouvrir une fois pour installer les
   composants, puis : Xcode ▸ Settings ▸ Platforms ▸ installer un runtime iOS.
2. **Node 18+** (https://nodejs.org).
3. C'est tout. (Pas de compte développeur, pas de Team ID.)

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

## Plus tard : activer le widget (iOS, compte payant)
```bash
# App Group "group.com.chipli.hydra" créé sur developer.apple.com au préalable
HYDRA_TEAM_ID=TONTEAMID npx expo prebuild --clean --platform ios
npx expo run:ios
```
`app.config.js` n'ajoute le target widget + l'entitlement App Group que si
`HYDRA_TEAM_ID` est défini.
