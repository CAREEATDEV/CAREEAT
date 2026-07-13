# HYDRA — Roadmap vers l'App Store

Tout ce qui manque avant que l'app soit **visible et téléchargeable sur l'App
Store**. Coche au fur et à mesure. Ordonné par chemin critique.

Contexte machine : **Windows, pas de Mac** → tout le build iOS passe par **EAS
Build (cloud)**, jamais `expo run:ios`. Compte Apple Developer payant OK
(Team ID `QN65J7X695`).

---

## 🔀 2 décisions à trancher AVANT de builder (elles changent la suite)

- [ ] **Décision A — Comptes ou local-only pour la v1 ?**
  - On a choisi « Sign in with Apple + email » et le backend est prêt, MAIS il
    n'est **pas branché** dans l'app.
  - **Option rapide (recommandée pour sortir vite) :** v1 **100 % locale** (pas
    de compte, pas de sync). Review Apple plus simple, moins de risque de rejet,
    pas d'écran de connexion. Le backend attend, on branche la sync en **v1.1**.
  - **Option complète :** brancher comptes + sync maintenant → +1 à 2 semaines de
    dev (auth Apple/email, couche sync offline-first, suppression de compte
    in-app **obligatoire**, labels de confidentialité « données collectées »).
  - 👉 Recommandation : **sortir en local-only**, ajouter la sync juste après.

- [ ] **Décision B — Prix : gratuit, freemium, ou abonnement ?**
  - Le questionnaire devait décider. Tant que ce n'est pas tranché, on ne peut
    pas configurer la fiche.
  - **Gratuit** → aucune intégration, review la plus simple. **Freemium/abo** →
    StoreKit / RevenueCat + produits d'achat configurés + review plus lourde.
  - 👉 Recommandation : **lancer gratuit** (ou gratuit avec abo ajouté en v1.1)
    pour réduire le risque au premier passage en review.

---

## Phase 1 — 🚧 BLOQUANT : premier build iOS réel

Le widget Swift n'a **jamais été compilé** — c'est le plus gros risque. À faire
en premier, tout le reste en dépend.

- [ ] Enregistrer l'**App Group** `group.com.hydraapp.hydra` dans Apple Developer
      (Identifiers → App Groups) et l'associer à l'App ID `com.hydraapp.hydra`.
- [ ] `eas login` puis **build de développement** :
      `eas build --profile development --platform ios` (cloud, depuis Windows).
- [ ] Corriger les **erreurs de compilation Swift** qui sortiront (widget, App
      Intents iOS 17, ControlWidget iOS 18) — probables au 1er essai.
- [ ] Installer le build sur un **vrai iPhone** (TestFlight interne).
- [ ] Vérifier sur l'appareil : les 3 onglets, l'onboarding, le moteur, puis
      **le widget** (écran verrouillé + accueil), les boutons ＋EAU (App Intents),
      le partage App Group app ↔ widget.
- [ ] Corriger ce qui casse, re-builder jusqu'à ce que le widget marche.

## Phase 2 — Finaliser le produit

- [ ] **Icône 1024 définitive** (l'actuelle est un placeholder de 6 Ko) + vérifier
      le splash. Design cohérent avec le logo goutte segmentée.
- [ ] (Si Décision A = comptes) brancher **auth + sync** offline-first
      (`hydra/backend/README.md`) : client Supabase, écran connexion Apple/email,
      push/pull des events, **suppression de compte in-app**.
- [ ] (Optionnel) corriger le **bug latent `computeState`** (traite les events
      futurs — sans impact en usage normal).
- [ ] Passe finale : aucun texte placeholder, tous les écrans propres, gestion
      des permissions notifications.
- [ ] Incrémenter `version` (0.1.0 → 1.0.0) et `buildNumber` dans `app.json`.

## Phase 3 — Contenu & métadonnées App Store

- [ ] **Captures d'écran** aux tailles requises (obligatoire : iPhone 6.7").
      Depuis le build EAS / un simulateur Mac (ou un service de mockup).
- [ ] (Optionnel) **App preview** vidéo (tu as déjà `app-demo.html` pour t'en
      inspirer).
- [ ] Textes : **nom**, sous-titre, **description**, mots-clés, **catégorie
      Santé & Forme**, URL marketing (la landing).
- [ ] **Classification d'âge : 17+** (l'app référence l'alcool — obligatoire).
- [ ] **Labels de confidentialité** (App Privacy) : déclarer honnêtement les
      données. En local-only : « aucune donnée collectée ». Avec backend : santé/
      alcool + identifiant compte.

## Phase 4 — Légal & conformité

- [ ] **Politique de confidentialité HYDRA** hébergée (URL **obligatoire** pour la
      fiche). À créer — l'app n'en a pas (celles du repo sont CAREEAT). Peut être
      ajoutée à la landing (`hydra-landing/privacy.html`).
- [ ] **URL de support** (page ou email) — obligatoire.
- [ ] **Disclaimer non médical** bien visible (déjà présent dans l'app — bon
      point ; éviter toute allégation santé/médicale dans la description).
- [ ] **Alcool** : ne pas encourager la consommation excessive (le positionnement
      « alcool = poison, réduis-le » est OK) ; 17+.
- [ ] (Si comptes) **suppression de compte in-app** (exigence Apple) + export/
      suppression des données (RGPD, projet en eu-west-1 → OK côté hébergement).

## Phase 5 — App Store Connect & soumission

- [ ] Créer la **fiche app** dans App Store Connect (bundle `com.hydraapp.hydra`).
- [ ] **Build de production** : `eas build --profile production --platform ios`.
- [ ] Envoyer le build : `eas submit --platform ios` (ou Transporter).
- [ ] Remplir métadonnées + captures + **prix** (Décision B).
- [ ] **TestFlight** (bêta externe recommandée avant la vraie soumission).
- [ ] **Soumettre pour review**. Délai ~1–3 jours ; prévoir 1 rejet possible
      (confidentialité, métadonnées, allégations santé) → corriger, resoumettre.
- [ ] ✅ **En ligne sur l'App Store.**

---

## 🤖 Android (en parallèle, secondaire — selon ton plan)

- [x] Build APK de test perso (en cours).
- [ ] Play Store **plus tard** : compte Play Console (25 $ une fois), fiche,
      captures, politique de confidentialité, classification. ⚠️ Le **widget est
      iOS-only** — un widget Android équivalent (Glance) serait un chantier séparé.

---

## ⏱️ Chemin critique le plus court vers « en ligne »

En visant **local-only + gratuit** (le plus rapide) :

1. Enregistrer l'App Group + **1er build EAS iOS** → corriger les erreurs Swift.
2. Tester le widget sur iPhone → stabiliser.
3. Icône définitive + captures + **politique de confidentialité** + support URL.
4. Fiche App Store Connect (17+, Santé & Forme, gratuit) + labels « aucune donnée ».
5. Build prod → `eas submit` → TestFlight → **soumission**.

Estimation réaliste : **1 à 3 semaines** selon le nombre d'allers-retours sur le
build Swift (le grand inconnu, car jamais compilé) et la review Apple. Ajouter
comptes+sync ou un abonnement pousse plutôt vers **4–6 semaines**.
