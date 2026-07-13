# HYDRA — Document de passation (pour continuer dans Cursor)

Ce fichier résume TOUT le projet pour reprendre le travail sans contexte
préalable (dans Cursor, avec un autre agent, ou toi-même). Lis-le en entier.

---

## 1. C'est quoi HYDRA

App iOS/Android de suivi d'hydratation. **Produit phare : un widget "barre de
vie"** (comme dans un jeu vidéo) qui se vide en continu ; tu bois de l'eau → elle
remonte ; l'alcool agit comme un **debuff "poison"** qui accélère le drain.
Positionnement : **jeu vidéo brutal / minimaliste**, PAS wellness mignon, aucun bleu.

**Différenciateur** : le moteur est **physiologique** (vraies données), pas des
malus arbitraires. Besoin quotidien = `poids × 32 mL`. L'alcool est calculé en
grammes d'éthanol réels (une bière est ~neutre en eau mais empoisonne). Plafond
d'absorption ~1 L/h (on ne peut pas se réhydrater plus vite que le corps
n'absorbe).

Projet **indépendant** (aucun lien avec CAREEAT / CHIPLI côté app).

---

## 2. Où est quoi (le repo)

Repo Git : `careeatdev/careeat` (branche de travail : `claude/new-session-5eaaki`,
tout est aussi sur `main` pour la partie landing). Deux dossiers HYDRA :

```
hydra/                      ← l'APP (Expo / React Native + widget Swift)
  App.tsx                   navigation 3 onglets (BAR / LOG / RÉGLAGES)
  app.config.js             config dynamique (Team ID + widget on/off) ← IMPORTANT
  app.json                  config statique
  eas.json                  profils de build cloud (iOS + Android)
  index.ts                  entrée
  RUN_SIMULATOR.md          (pour Mac — inutile sans Mac, voir §6)
  README.md                 specs moteur + widget
  src/
    engine/hydrationEngine.ts       ← SOURCE DE VÉRITÉ (moteur physio, event sourcing)
    engine/hydrationEngine.test.ts  ← 21 tests Jest (tous verts)
    store/useHydration.ts           zustand + persist + sync App Group + notifs
    notifications/scheduler.ts
    native/appGroupBridge.ts        pont JS ↔ module natif (no-op si absent)
    screens/{Home,History,Settings}Screen.tsx
    components/{HydrationBar,LogButton}.tsx
    theme/colors.ts                 design tokens
    util/time.ts
  targets/widget/           ← le WIDGET iOS natif (Swift/WidgetKit)
    HydrationEngine.swift           port EXACT du moteur TS (mêmes tests)
    HydrationEngineTests.swift
    HydraWidget.swift               accessoryRectangular (lock) + systemSmall (home)
    HydraControl.swift              Control iOS 18 "+ Eau" (lock screen bottom)
    HydraIntents.swift              App Intent LogWaterIntent (bouton sans ouvrir l'app)
    HydraAppGroup.m / HydraAppGroupModule.swift   module RN pour écrire l'App Group
    expo-target.config.js
  assets/                   icon.png, splash.png, fonts/*.ttf (déjà présents)

hydra-landing/              ← la LANDING PAGE (déployée sur Vercel)
  index.html                landing + mockup iPhone interactif + questionnaire waitlist
  app-demo.html             PROTOTYPE cliquable de l'app (pour filmer, marche dans un navigateur)
  admin.html                tableau de bord privé des réponses (mot de passe)
  logo.svg                  logo goutte segmentée
  supabase/migration.sql    schéma waitlist (déjà appliqué en prod)
  supabase/analytics.sql    8 requêtes d'analyse commentées
```

---

## 3. Identifiants & accès (⚠️ contient des secrets — repo privé)

| Élément | Valeur |
|---|---|
| Nom app | HYDRA |
| Bundle iOS | `com.shipply.hydraapp` |
| Package Android | `com.shipply.hydraapp` (dérivé du bundle) |
| App Group iOS | `group.com.shipply.hydraapp` |
| Apple Team ID | `QN65J7X695` (déjà câblé dans `app.config.js`) |
| URL scheme | `hydra://` |
| Supabase — projet | « SHIPPLY CARS », ref `rusdjbgpghbistjeeboo` |
| Supabase — URL | `https://rusdjbgpghbistjeeboo.supabase.co` |
| Supabase — clé publishable (anon, OK côté client) | `sb_publishable_owiaBzFlcc2x6uOeiQIBUg_dMSXEUOk` |
| Landing en prod | `https://hydra-landing-sooty.vercel.app` (Vercel, auto-deploy depuis `main`) |
| Prototype app (web) | `https://hydra-landing-sooty.vercel.app/app-demo.html` |
| Dashboard waitlist | `https://hydra-landing-sooty.vercel.app/admin.html` |
| Dashboard — mot de passe | `KMuPs4lHstJNroVbkzoZENDi` (⚠️ secret ; modifiable dans la fonction SQL `hydra_admin_dashboard`) |

Table waitlist : `public.hydra_waitlist_v2` (RLS fermée ; lecture/écriture via
fonctions SECURITY DEFINER `hydra_waitlist_signup` / `_update` / `_position` /
`_resume` / `hydra_admin_dashboard`). Le questionnaire du formulaire écrit dedans.

---

## 4. État d'avancement

**FAIT & vérifié (côté logique)**
- Moteur physio TS : complet, **21/21 tests Jest verts** (`cd hydra && npm test`).
- Moteur Swift : port 1:1 avec les mêmes cas de test (non exécuté — besoin de macOS/Xcode).
- 3 écrans app + store + notifications + widget + App Intents.
- TypeScript compile sans erreur (`npx tsc --noEmit`).
- Landing en ligne + questionnaire waitlist fonctionnel (testé end-to-end vers Supabase).
- Dashboard admin + analytics.
- Prototype web de l'app (`app-demo.html`) fonctionnel.

**PAS FAIT / NON VÉRIFIÉ**
- ⚠️ **L'app native n'a JAMAIS été compilée/lancée** (l'assistant tournait sous
  Linux sans Xcode). "Fonctionnel" = conçu pour marcher, à confirmer au 1er build.
- Aucune install sur un téléphone réel.
- Prévoir 1–2 petits accrocs de 1er build (signature, versions de deps).

---

## 5. Prérequis Apple (à faire une fois, sur developer.apple.com)

1. **Accepter le contrat** Apple Developer Program mis à jour (bandeau jaune sur
   App Store Connect — le titulaire du compte doit accepter, sinon builds bloqués).
2. **Enregistrer l'App Group** : Identifiers → App Groups → `+` →
   `group.com.shipply.hydraapp`.
3. **Enregistrer l'App ID** : Identifiers → App IDs → `com.shipply.hydraapp`,
   cocher la capability **App Groups** → sélectionner `group.com.shipply.hydraapp`.
   (Si le bundle est déjà pris mondialement, choisir un autre, ex.
   `com.hydraapp.lifebar`, et le remplacer partout — voir §8.)

---

## 6. Builder SANS Mac (PC Windows / HP) → via EAS Build (cloud)

Il n'y a PAS de simulateur iOS sur Windows. La solution : **EAS Build** compile
sur les serveurs macOS d'Expo. Tu installes ensuite sur un vrai téléphone.

### Prérequis machine (Windows)
- Node 18+ (https://nodejs.org)
- `npm i -g eas-cli`
- Compte Expo (gratuit) : `eas login`

```bash
cd hydra
npm install
eas init          # crée le projectId Expo (ou eas build:configure)
```

### iOS → sur ton iPhone (via TestFlight, le plus simple sans Mac)
```bash
eas build -p ios --profile production
#   EAS te demande de te connecter à Apple et gère les certificats tout seul.
eas submit -p ios
#   → envoie le build à App Store Connect.
```
Puis dans **App Store Connect → TestFlight** : ajoute-toi comme **testeur
interne** (instantané, pas de review), installe l'app **TestFlight** sur ton
iPhone et récupère HYDRA. Le widget s'y trouve (long-press écran verrouillé →
Personnaliser → HYDRA).

> Alternative sans TestFlight (install directe par QR) :
> `eas device:create` (enregistre l'UDID de ton iPhone) puis
> `eas build -p ios --profile preview` → scanne le QR sur l'iPhone pour installer.

### Android → sur ton téléphone Android (APK, gratuit, aucun compte payant)
```bash
eas build -p android --profile preview-android
#   → produit un .apk. Télécharge-le, envoie-le sur ton Android,
#     autorise "installer des apps inconnues", installe.
```
(Le widget lock screen est iOS-only ; l'app tourne, sans le widget.)

### Pour filmer les vidéos
- iPhone/Android : enregistrement d'écran natif du téléphone.
- Ou branche le téléphone et capture via OBS/scrcpy (Android) / QuickTime n'existe
  pas sur Windows — utilise l'enregistrement d'écran du téléphone directement.

---

## 7. Le moteur (résumé — détails dans `src/engine/hydrationEngine.ts`)

- Niveau en **mL réels**, jamais stocké : recalculé depuis l'historique
  d'événements horodatés (event sourcing) + profil. C'est ce qui garde app et
  widget cohérents.
- Besoin quotidien = `poids × 32 mL` (défaut 70 kg → 2240 mL).
- Drain de base = `besoin / heures_éveil` (~140 mL/h). Sommeil ×0,4. Température
  ×0,9→×1,4. Sport (sueur) selon sexe/intensité.
- **Alcool 2 couches** : (A) perte nette réelle = `vol×(1-ABV) − ethanol_g×10`
  (bière ≈ neutre, shot négatif) ; (B) fenêtre **poison** ×1,3→×2 (pic à 2h,
  décroît jusqu'à 0 à 4h), cumul plafonné ×3.
- 3 paliers alcool (bouton 1 tap) : **LÉGER 2–8°** (400/5), **MOYEN 9–22°**
  (150/14), **FORT 30–45°** (40/40).
- **Plafond d'absorption** : eau créditée max ~1000 mL / heure glissante ;
  au-delà = "SATURÉ" (garde-fou hyponatrémie). L'app bloque le log d'eau si saturé.
- Zones : vert >55 %, ambre 25–55, rouge <25, poison = violet prioritaire.

⚠️ **Règle d'or** : si tu modifies `hydrationEngine.ts`, réplique EXACTEMENT dans
`targets/widget/HydrationEngine.swift` (mêmes coefficients, mêmes tests).

Design tokens (`src/theme/colors.ts`) : fond #000/#101216, vert #3EE07A,
ambre #FFB020, rouge #FF3B4A, poison #B44CFF, vides #1C2026, texte #EDEFF2,
dim #7C828C. Polices Chakra Petch (titres) + IBM Plex Mono (données).

---

## 8. Gotchas connus

- **ControlWidget** (`HydraControl.swift`) exige le SDK iOS 18 (Xcode 16). EAS
  utilise un Xcode récent → OK. Si un jour ça bloque, retire ce fichier + son
  entrée dans `HydraWidgetBundle` (dans `HydraWidget.swift`).
- `app.config.js` inclut le widget par défaut (Team ID `QN65J7X695`). Pour un
  build sans widget : préfixer par `HYDRA_NO_WIDGET=1`.
- Changer le bundle id : remplacer `com.shipply.hydraapp` partout
  (`grep -rl com.shipply.hydraapp hydra/`) ET l'App Group `group.com.shipply.hydraapp`.
  Un simple `sed` global suffit (les deux ont le même radical).
- Widget interactif (boutons "+Eau") = iOS 17+ ; fallback ouvre l'app avant.

---

## 9. Prochaines étapes suggérées (marketing)

1. **Builder** (EAS, §6) → installer sur iPhone + Android → filmer les 1res vidéos.
2. Peaufiner l'app pour les vidéos : animation de remplissage plus "satisfaisante"
   sur la barre, mini-onboarding 1 écran, son de goutte optionnel.
3. Envoyer du trafic vers la landing (`app-demo.html` fait une bonne démo TikTok
   directement dans le navigateur) et suivre les réponses dans `admin.html`.
4. Décider le prix à partir de l'histogramme du dashboard, brancher un paywall
   (RevenueCat conseillé) — hors scope actuel.

---

## 10. Commandes utiles (récap)

```bash
cd hydra
npm install
npm test                                   # 21 tests moteur (verts)
npx tsc --noEmit                           # typecheck

# Build cloud (Windows OK) :
npm i -g eas-cli && eas login && eas init
eas build -p ios --profile production      # puis eas submit -p ios → TestFlight
eas build -p android --profile preview-android   # → APK à installer sur Android
```

Landing : éditer `hydra-landing/*.html`, commit + push sur `main` → Vercel
redéploie tout seul.
