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

- [x] **Moteur physiologique** complet + testé (57 tests verts, port Swift synchro).
- [x] App 3 onglets (BARRE / DONNÉES / WIDGETS), onboarding, métrique poison.
- [x] **App Group** `group.com.shipply.hydraapp` enregistré + associé à l'App ID.
- [x] **1er build EAS iOS réussi** → installé sur iPhone 14. 🎉
- [x] **⭐ Le widget FONCTIONNE sur l'iPhone** — écran d'accueil ET écran de
      verrouillage. *(C'était LE grand risque du projet : le Swift jamais compilé.
      Il est levé.)*
- [x] **Auth branchée** : Sign in with Apple + email (Supabase), configurée côté
      Apple (App ID, Services ID, clé .p8, secret) et dans le dashboard.
- [x] **Comptes** : écran de connexion, gate de l'app, **suppression de compte
      in-app** (edge function déployée), **sync offline-first** codée.
- [x] Backend Supabase : tables + RLS + analytics (audit sécurité : 0 problème).

---

## 🔜 CE QUI RESTE

### Phase A — Abonnement / paywall (💻 Claude code — pas encore fait)
- [ ] Intégrer **RevenueCat** (SDK + écran paywall + **verrouillage total** : rien
      d'accessible sans abonnement/essai actif).
- [ ] Compte **RevenueCat** (gratuit) — *toi*, revenuecat.com.
- [ ] Créer l'**abonnement auto-renouvelable 3,99 € + essai 7 j** dans App Store
      Connect — *toi seul*.
- [ ] Accord **« Paid Applications »** + coordonnées **bancaires** + **fiscales** —
      *toi seul, obligatoire avant tout paiement*.
- [ ] Tester l'achat en **sandbox** sur ton iPhone — *toi*.

### Phase B — Vérifs réelles sur ton iPhone (📱 toi, maintenant que tu as le build)
- [ ] Tester la **connexion Apple** en vrai (bouton Apple, natif).
- [ ] Créer un compte, logguer des verres → vérifier que ça **remonte dans
      Supabase** (`public.events` / `analytics.overview` dans le SQL editor).
- [ ] Tester **suppression de compte** + déconnexion.
- [ ] Vérifier notifications + boutons ＋EAU du widget (App Intents).

### Phase C — Assets & légal (💻 Claude + 📱 toi)
- [ ] **Icône 1024 définitive** (l'actuelle est un placeholder) — *Claude*.
- [ ] **Politique de confidentialité HYDRA** + **page support**, hébergées (URL
      **obligatoire**) — *Claude écrit + déploie sur la landing*.
- [ ] **Captures d'écran** iPhone 6,7" (tu as le device → capture direct) — *toi*.
- [ ] Incrémenter `version` 0.1.0 → **1.0.0** + `buildNumber` — *Claude*.

### Phase D — App Store Connect (📱 toi seul, non délégable)
- [ ] Créer la **fiche app** (bundle `com.shipply.hydraapp`).
- [ ] **Nom, sous-titre, description, mots-clés** (Claude rédige, tu colles).
- [ ] Catégorie **Santé & Forme** · classification **17+** (alcool).
- [ ] **Labels de confidentialité** : données santé/alcool + identifiant de compte
      (Claude te donne exactement quoi cocher).

### Phase E — Build prod & soumission
- [ ] **Build de production AVEC widget** : `eas build -p ios --profile production`.
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

Le chemin critique le plus risqué (**build iOS + widget natif**) est **terminé et
validé sur device**. Il reste surtout : le **paywall abonnement** (le vrai gros
morceau de code restant), les **assets + pages légales**, et la **config +
soumission App Store Connect** (beaucoup d'étapes « toi seul » côté Apple, mais
sans inconnue technique).

**Estimation : ~1 à 2 semaines** selon la vitesse de config App Store Connect et
la review Apple. Prochaine étape logique : **Phase A — le paywall**.
