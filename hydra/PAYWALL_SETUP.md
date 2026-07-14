# HYDRA — Abonnement / Paywall (RevenueCat)

Le code est **déjà branché** (SDK, écran paywall, verrouillage total de l'app).
Tant que la clé RevenueCat n'est pas configurée, **le paywall reste en pause**
(l'app est utilisable pour tes tests). Dès que tu ajoutes la clé + configures
RevenueCat, il s'active.

Modèle : **100 % payant**, **essai 7 jours** puis **3,99 €/mois**.

---

## Ce qui est fait (code)
- `src/store/useSubscription.ts` — état d'abonnement (RevenueCat), entitlement `pro`.
- `src/screens/PaywallScreen.tsx` — écran d'offre (essai 7 j + mentions légales Apple).
- `App.tsx` — gate : connexion → **abonnement actif ?** → sinon paywall → app.
- `app.config.js` — clés lues depuis `extra.revenueCatIosKey` / `...AndroidKey`.
- Dépendance : `react-native-purchases`.

## Ce que TOI tu dois configurer (une fois)

### 1. App Store Connect — créer l'abonnement
1. **App Store Connect** → ton app HYDRA → **Abonnements** (In-App Purchases).
2. Crée un **groupe d'abonnement** (ex. `HYDRA Pro`).
3. Ajoute un **abonnement auto-renouvelable** :
   - **Product ID** : `com.shipply.hydraapp.monthly`
   - **Durée** : 1 mois · **Prix** : 3,99 € (choisis le palier).
4. Ajoute une **offre d'introduction** → **Essai gratuit** → **7 jours**.
5. Renseigne le nom localisé (FR) + une capture (obligatoire pour la review).
6. ⚠️ Accepte l'accord **« Paid Applications »** et remplis tes **coordonnées
   bancaires + fiscales** (App Store Connect → Business) — **sinon aucun achat ne
   fonctionne**, même en test.

### 2. RevenueCat — relier le tout
1. Crée un compte gratuit sur **revenuecat.com** → nouveau projet **HYDRA**.
2. **Ajoute une app iOS** : bundle `com.shipply.hydraapp`. Fournis la clé API
   App Store Connect (RevenueCat te guide) pour qu'il lise tes abonnements.
3. **Entitlements** → crée l'entitlement d'identifiant **`pro`**.
4. **Products** → ajoute `com.shipply.hydraapp.monthly` → attache-le à `pro`.
5. **Offerings** → crée l'offering **`default`** (celui par défaut) → ajoute le
   package mensuel pointant sur le produit.
6. **API Keys** → copie la **clé publique iOS** (format `appl_xxxxx`).

### 3. Mettre la clé dans le build
Dans `hydra/`, crée un fichier **`.env`** (ou passe la variable au build EAS) :
```
EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_xxxxxxxxxxxxxxxxxxx
```
Puis rebuild (`eas build -p ios --profile preview-nowidget` ou production).
Pour un build EAS, ajoute la variable dans le profil `env` de `eas.json` ou via
`eas env` — une clé publique, sans risque à committer si tu préfères.

### 4. Tester l'achat (sandbox)
1. App Store Connect → **Utilisateurs et accès → Sandbox** → crée un testeur.
2. Sur ton iPhone : Réglages → App Store → connecte-toi avec ce compte sandbox.
3. Lance l'app → le paywall apparaît → **Commencer l'essai gratuit** → l'achat se
   fait en sandbox (gratuit), l'app se déverrouille.

---

## Notes
- **Identifiants attendus par le code** : entitlement `pro`, offering `default`.
  Si tu changes ces noms dans RevenueCat, préviens-moi (2 constantes à ajuster).
- L'app lit le **prix dynamiquement** depuis RevenueCat — pas de prix codé en dur,
  tu peux le changer côté Apple sans rebuild.
- **Android** : même principe plus tard (clé `goog_xxx` dans
  `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`), quand tu passeras au Play Store.
- Le lien **Confidentialité** du paywall pointe vers une page à héberger
  (`privacy.html`) — c'est la Phase C de la roadmap.
