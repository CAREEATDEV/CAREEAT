# Instructions à coller dans Cursor (aperçu, PAS de compilation)

> Contexte machine : **Windows (pas de Mac)**. Objectif immédiat : **prévisualiser
> l'app dans un émulateur/aperçu, SANS lancer de build de compilation**
> (pas de `eas build`, pas de `eas submit`, pas de `expo run:ios`, pas de
> `expo run:android`).

Copie-colle le bloc ci-dessous à l'agent Cursor 👇

---

Lis `hydra/HANDOFF.md` et `hydra/README.md` pour le contexte complet du projet
HYDRA (Expo / React Native + widget iOS Swift).

Je suis sur **Windows, sans Mac**. Pour l'instant je veux seulement
**prévisualiser** l'app, sans build de compilation.

## 1. Installer
```
cd hydra
npm install
```

## 2. Prévisualiser l'app SANS compiler (choisis A ou B)

**A — Android via Expo Go (recommandé, aucune compilation native)**
- Ouvre un émulateur Android (Android Studio ▸ Device Manager) **ou** installe
  l'app **Expo Go** sur un téléphone Android.
- Lance : `npx expo start`
- Appuie sur `a` (émulateur) ou scanne le QR code avec Expo Go.
- L'app charge le JavaScript dans Expo Go → **pas de build**. Vérifie que les 3
  onglets **BAR / LOG / RÉGLAGES**, la barre de vie, les boutons
  **EAU / ALCOOL (Léger·Moyen·Fort) / SPORT**, l'undo et l'historique marchent.

**B — Aperçu web rapide (rendu approximatif)**
- `npx expo start --web` → s'ouvre dans le navigateur.

⚠️ **Le widget iOS n'apparaît PAS** dans Expo Go ni sur le web (c'est du code
natif Swift). Sa maquette visuelle de référence est le mockup de la landing et
`hydra-landing/app-demo.html`. On verra le vrai widget plus tard (build iOS).

## 3. iOS — à NE PAS faire maintenant
- Le simulateur iOS n'existe que sur macOS → impossible sur Windows.
- **Ne lance pas** `expo run:ios`, `eas build -p ios`, `eas submit`.
- L'aperçu iOS se fera plus tard via EAS Build → TestFlight (voir §6 du HANDOFF),
  quand je te le demanderai explicitement.

## 4. Android — coder / peaufiner
- L'app React Native est cross-platform : elle tourne déjà sur Android via le
  code `src/`. Corrige tout souci d'affichage Android que tu vois dans l'aperçu.
- Le **widget lock screen est iOS-only** (Swift/WidgetKit). Un widget Android
  équivalent = implémentation séparée (Glance / AppWidgetProvider) — **hors
  scope pour l'instant** ; l'app seule suffit pour les vidéos Android.
- Quand JE te le demanderai (plus tard), un APK réel installable se fait avec :
  `eas build -p android --profile preview-android` (ça, c'est un build).

## Règle
Tant que je n'ai pas dit « on build » : **aperçu uniquement** (Expo Go / web).
Ne déclenche aucun `eas build` / `eas submit` / `expo run:*`.

---
