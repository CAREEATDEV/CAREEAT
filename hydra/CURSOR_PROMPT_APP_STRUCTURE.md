# Prompt Cursor — restructurer l'app autour des widgets

Copie-colle le bloc ci-dessous à l'agent Cursor. (Aperçu Expo Go / web
uniquement, pas de build — cf. `CURSOR_INSTRUCTIONS.md`.)

---

Lis d'abord `hydra/HANDOFF.md` et `hydra/README.md`. Tu vas **restructurer l'app
HYDRA** (Expo / React Native, dossier `hydra/`). Garde le moteur
`src/engine/hydrationEngine.ts` comme **source de vérité** (ne le modifie pas
sans répliquer dans `targets/widget/HydrationEngine.swift`). Respecte le design
system de `src/theme/colors.ts` (fond noir, vert #3EE07A, ambre #FFB020, rouge
#FF3B4A, poison #B44CFF ; polices Chakra Petch + IBM Plex Mono).

## Vision
Le **produit, c'est le widget** (barre de vie sur l'écran verrouillé / d'accueil).
L'app est le **poste de pilotage du widget** : le prévisualiser, apprendre à
l'ajouter, le régler, et consulter ses données. Structure l'app en **3 onglets** :

### Onglet 1 — BARRE (accueil, existe déjà, à garder/peaufiner)
- La grande barre de vie + %, statut, countdown, mL (composant `HydrationBar`).
- Log rapide en 1 tap : **EAU / BOUTEILLE**, groupe **ALCOOL** (Léger 2–8° /
  Moyen 9–22° / Fort 30–45°), **SPORT** (modéré / intense), **UNDO**.
- Feedback : haptique, toast « +X mL », état **SATURÉ** si plafond d'absorption
  atteint. (Tout ça existe déjà dans `src/screens/HomeScreen.tsx`.)

### Onglet 2 — DONNÉES (historique + stats)
- Liste des événements du jour avec suppression (existe : `HistoryScreen.tsx`).
- Ajoute des **stats simples et lisibles** au-dessus de la liste :
  - Total bu aujourd'hui (mL) et nombre de verres.
  - % de temps passé dans le vert aujourd'hui (approx.).
  - Un mini **graphe 7 jours** (barres) du niveau moyen / verres par jour.
  - Streak de jours « finis dans le vert ».
- Le graphe : composant maison en View/flex (pas de lib externe), style barres
  fines vertes, labels jours. Garde ça sobre.

### Onglet 3 — WIDGETS (⭐ l'écran principal)
C'est le cœur de l'app. Trois blocs :

**a) Aperçu des widgets (rendus dans l'app)**
- Montre les **3 formats** tels qu'ils apparaîtront, en réutilisant les
  composants RN existants (réutilise / adapte `HydrationBar`) pour reproduire :
  - **Petit (systemSmall)** — couleur : %, barre, statut, countdown.
  - **Bandeau (systemMedium)** — couleur : stats + barre + boutons EAU / ALCOOL.
  - **Verrouillage (accessoryRectangular)** — **monochrome** (segments blancs).
- Un sélecteur Petit / Bandeau / Verrouillage pour basculer l'aperçu (comme le
  mockup de la landing `hydra-landing/index.html`, section démo — tu peux t'en
  inspirer pour le rendu).

**b) « Ajouter le widget » (guide, PAS un bouton magique)**
- ⚠️ iOS **n'a aucune API** pour ajouter un widget programmatiquement. Ne fais
  donc PAS un faux bouton qui prétend l'ajouter.
- Fais un bouton **« Ajouter à l'écran verrouillé »** et **« Ajouter à l'écran
  d'accueil »** qui ouvrent un **guide pas-à-pas illustré** (3–4 étapes, avec des
  schémas simples dessinés en View, style : « Appuie longuement sur l'écran → +
  → cherche HYDRA → ajoute »). Anime légèrement (respecte prefers-reduced-motion).
- Bouton **« Rafraîchir le widget maintenant »** : lui, il marche → appelle
  `reloadWidgetTimelines()` (déjà dans `src/native/appGroupBridge.ts`).

**c) Réglages (profil = ce qui alimente le widget)**
- Reprends les réglages de `SettingsScreen.tsx` : poids, sexe, heures d'éveil,
  température, objectif quotidien (auto), notifications on/off, disclaimer non
  médical.
- Ajoute des réglages **spécifiques widget** :
  - Format préféré (Petit / Bandeau / Verrouillage) — mémorisé.
  - Sur le bandeau : afficher les boutons Alcool ? (toggle).
  - Contenant EAU par défaut (250 / 500 mL).
- Tout changement écrit dans l'App Group et rafraîchit le widget (déjà câblé via
  le store `useHydration._sync`).

## Navigation
- Barre d'onglets en bas, 3 onglets : **BARRE / DONNÉES / WIDGETS**.
- Icônes cohérentes (SVG/vector simples), libellés en majuscules letterspacés.
- Onglet WIDGETS mis en avant (c'est le principal).

## Contraintes
- **N'implémente PAS** un widget Android maintenant (le widget natif est
  iOS-only ; l'app RN reste cross-platform pour l'aperçu Android).
- **Ne recode pas** le widget iOS Swift : il existe déjà dans
  `targets/widget/HydraWidget.swift` (3 familles). L'onglet WIDGETS est un
  aperçu + guide + réglages **en React Native**.
- Garde le store `zustand` (`src/store/useHydration.ts`) comme état unique ;
  ajoute les nouveaux réglages widget dedans (persistés + miroir App Group).
- Aperçu en **Expo Go / web** seulement (Windows, pas de Mac) ; ne lance aucun
  `eas build` / `expo run:*`.
- Tests : garde `npm test` vert (21 cas moteur). Si tu ajoutes des stats,
  ajoute 1–2 tests unitaires purs pour les fonctions de calcul.

## Critères d'acceptation
- 3 onglets clairs ; l'onglet WIDGETS montre les 3 formats et un guide d'ajout
  honnête (pas de faux bouton d'activation).
- Les réglages profil + widget modifient l'aperçu en direct et déclenchent
  `reloadWidgetTimelines()`.
- L'app se prévisualise dans Expo Go (Android) sans build ; `npx expo start`
  fonctionne ; `npm test` reste vert.

---
