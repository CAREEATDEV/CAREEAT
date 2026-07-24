# HYDRA — Roadmap vers l'App Store

Ce qui reste avant que l'app soit **visible et téléchargeable sur l'App Store**.
Coche au fur et à mesure. Ordonné par chemin critique.

Contexte : **Windows, pas de Mac** → build iOS via **EAS Build (cloud)**. Compte
Apple Developer payant (Team ID `QN65J7X695`). Bundle `com.shipply.hydraapp`.

**Décisions verrouillées :** app **100 % payante** · abonnement **3,99 €/mois +
essai 7 jours** · comptes **Sign in with Apple + email** (Supabase) · backend sur
tier gratuit Supabase.

---

## ✅ DÉJÀ FAIT (le plus dur est derrière)

- [x] **Moteur physiologique** complet + testé (59 tests verts, port Swift synchro).
- [x] App 3 onglets (BARRE / DONNÉES / WIDGETS), onboarding, métrique poison.
- [x] **App Group** `group.com.shipply.hydraapp` enregistré + associé à l'App ID.
- [x] **1er build EAS iOS réussi** → installé sur iPhone 14, puis sur un 2e iPhone. 🎉
- [x] **⭐ Le widget FONCTIONNE sur l'iPhone** — écran d'accueil ET écran de
      verrouillage. *(C'était LE grand risque du projet. Il est levé.)*
- [x] **Auth branchée** : Sign in with Apple + email (Supabase), configurée côté
      Apple (App ID, Services ID, clé .p8, secret) et dans le dashboard.
- [x] **Comptes** : écran de connexion, gate de l'app, **suppression de compte
      in-app** (edge function déployée), **sync offline-first** codée.
- [x] Backend Supabase : tables + RLS + analytics (audit sécurité : 0 problème).
- [x] **Paywall RevenueCat intégré** : SDK + écran d'abonnement (7 jours d'essai
      + 3,99 €/mois) + **verrouillage total** (rien d'accessible sans abonnement
      actif) + entitlement correctement câblé (`HYDRA Pro`).
- [x] Compte **RevenueCat** créé, produit + offre + entitlement configurés.
- [x] Abonnement auto-renouvelable créé dans **App Store Connect**.
- [x] **Testé en sandbox** sur 2 iPhones différents (testeur bac à sable).
- [x] Rappels de notification (zone ambre/rouge + rappels par verre, en plus).
- [x] **Politique de confidentialité HYDRA** déployée :
      `https://hydra-landing-sooty.vercel.app/privacy.html`
- [x] **Page support** déployée :
      `https://hydra-landing-sooty.vercel.app/support.html`
- [x] **Compte bancaire/fiscal Apple** — déjà en règle via le même compte
      Apple Developer/App Store Connect qu'utilisé pour CAREEAT (déjà
      accepté). Rien à refaire ici.

---

## 🔜 CE QUI RESTE — dans l'ordre

### ✅ Texte de la fiche App Store Connect — prêt
- [x] **Nom, sous-titre, description, mots-clés, catégorie, classification
      d'âge, étiquettes de confidentialité** — tout rédigé, prêt à coller :
      voir **`hydra/APPSTORE_LISTING.md`**.
- [ ] Toi : colle ce contenu dans App Store Connect → onglet App Store.

### Phase C — Assets restants
- [ ] **Icône 1024×1024 définitive** — l'actuelle (`assets/icon.png`) est-elle
      la version finale ou toujours un placeholder ? *(à confirmer)*
- [ ] **Captures d'écran** iPhone 6,7" pour la fiche App Store — *toi, sur le
      device* (on en a déjà fait une pour l'écran d'abonnement ; il en faut
      pour les écrans principaux aussi).
- [ ] Incrémenter `version` **0.1.0 → 1.0.0** dans `app.json` + `buildNumber`
      — *Claude, dès que tu confirmes qu'on est prêt à soumettre*.

### Phase D — Fiche App Store Connect (📱 toi seul, non délégable)
- [ ] Créer la **fiche app** (bundle `com.shipply.hydraapp`) si pas déjà fait.
- [ ] Coller le contenu de `hydra/APPSTORE_LISTING.md` (nom, sous-titre,
      description, mots-clés, catégorie, âge, confidentialité, URLs).

### Phase E — Build prod & soumission
- [ ] **Build de production AVEC widget** : `eas build --profile production
      --platform ios` — *jamais fait à ce stade, uniquement des builds `preview`*.
- [ ] `eas submit -p ios` → **TestFlight** (bêta) → **Soumettre pour review**.
- [ ] Review Apple ~1-3 j (prévoir 1 rejet possible → on corrige, on resoumet).
- [ ] ✅ **EN LIGNE SUR L'APP STORE.**

---

## 🤖 Android (secondaire — selon ton plan)
- [x] Build APK de test perso.
- [ ] Play Store plus tard : Play Console (25 $ une fois), fiche, abonnement,
      confidentialité. ⚠️ Widget iOS-only ; un widget Android = chantier séparé.

---

## ⏱️ Où on en est

Tout le **code** est prêt : moteur, widget, auth, comptes, paywall, notifications.
Les deux blocages légaux/administratifs sont levés (pages légales en ligne,
compte Apple déjà en règle). Il reste :

1. **Icône finale + captures d'écran** (toi, sur le device).
2. **Remplir la fiche App Store Connect** — texte déjà rédigé dans
   `hydra/APPSTORE_LISTING.md`, tu n'as qu'à coller.
3. **Modifs dans l'app** avant le build de prod (prévues par toi, pas encore
   commencées).
4. **Build production + soumission**.

**Estimation : quelques jours**, principalement limitée par la vitesse à
laquelle tu remplis les étapes App Store Connect côté Apple + le délai de
review (1-3 jours).
