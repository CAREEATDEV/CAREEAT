# Fiche App Store Connect — à copier/coller

Tout ce qu'il faut pour remplir l'onglet **App Store** de la fiche HYDRA dans
App Store Connect. Copie-colle tel quel, ajuste seulement si un champ est
refusé (trop long, déjà pris, etc.).

---

## 1. Nom de l'app

```
HYDRA.IO
```

Champ **Nom** (30 caractères max). Si « HYDRA » seul seul est disponible tel
quel au moment où tu remplis la fiche, tu peux le garder simple — mais on est
partis sur `HYDRA.IO` car un nom aussi court/générique que « HYDRA » a de
bonnes chances d'être déjà pris par une autre app. Vérifie en tapant le nom
dans le champ : App Store Connect te dit immédiatement s'il est disponible.

## 2. Sous-titre (subtitle)

```
Ta barre de vie s'hydrate
```

(24 caractères — limite 30). Apparaît sous le nom dans les résultats de
recherche et sur la fiche. C'est ce qui donne envie de cliquer après le nom.

## 3. Catégorie

- **Catégorie principale** : `Santé et remise en forme` (Health & Fitness)
- **Catégorie secondaire** : `Style de vie` (Lifestyle)

## 4. Description

```
Ta vie n'est pas une jauge d'énergie infinie. HYDRA la transforme en barre
de vie, comme dans un jeu — et chaque verre d'eau, chaque café, chaque verre
d'alcool la fait monter ou descendre en direct.

COMMENT ÇA MARCHE
• Une barre de vie sur ton écran d'accueil et ton écran verrouillé (widget
  natif iOS), qui se vide toute seule selon ta physiologie réelle.
• Bois de l'eau, un café, un verre : la barre remonte instantanément.
• L'alcool — le "poison" — la fait chuter plus vite qu'elle ne remonte.
• Le calcul prend en compte ton poids, ton sommeil et ton environnement
  (température, humidité, altitude) pour un besoin d'hydratation qui te
  correspond vraiment, pas une règle générique "2 litres par jour".

POURQUOI C'EST DIFFÉRENT
La plupart des apps d'hydratation te demandent de cocher des cases. HYDRA
transforme l'hydratation en un jeu simple à lire d'un coup d'œil : ta barre
de vie. Pas de graphiques à interpréter, pas de calculs à faire — juste une
couleur (vert, ambre, rouge) qui te dit où tu en es, là, maintenant.

RAPPELS INTELLIGENTS
Reçois une alerte avant que ta barre passe en zone ambre ou rouge, et des
rappels étalés dans la journée pour le nombre de verres qu'il te reste à
boire avant ton coucher — jamais après, jamais du bruit inutile.

CONFIDENTIALITÉ
Tes données (poids, journal de boissons) ne servent qu'à faire fonctionner
l'app. Aucune publicité, aucune revente de données, aucun tracker tiers.
Suppression de compte en un geste, directement dans l'app.

HYDRA fait référence à la consommation d'alcool à des fins de suivi
personnel et n'encourage pas sa consommation.
```

(≈ 1350 caractères — largement sous la limite de 4000.)

## 5. Mots-clés (keywords)

Champ unique, 100 caractères max, séparés par des virgules **sans espace**
(les espaces comptent dans la limite) :

```
hydratation,eau,widget,barre de vie,alcool,sommeil,rappel,santé,gourde,boisson
```

(99 caractères.) Ne répète pas des mots déjà dans le nom/sous-titre (« HYDRA »,
« vie ») — Apple les indexe déjà automatiquement depuis ces champs, inutile
de gâcher de la place ici.

## 6. Promotional Text (texte promotionnel, optionnel)

Modifiable à tout moment sans repasser par une review Apple — utile pour
annoncer une nouveauté ponctuelle :

```
Nouveau : rappels par verre, étalés jusqu'à ton coucher. Plus jamais un
verre oublié.
```

## 7. URLs

- **Privacy Policy URL** :
  `https://hydra-landing-sooty.vercel.app/privacy.html`
- **Support URL** (marketing URL optionnel, mais mets la même si demandé) :
  `https://hydra-landing-sooty.vercel.app/support.html`
- **Marketing URL** (optionnel) :
  `https://hydra-landing-sooty.vercel.app`

## 8. Classification d'âge (Age Rating)

Le questionnaire d'App Store Connect pose une série de questions. Réponses :

- **Usage/références à l'alcool, au tabac ou aux drogues** :
  `Utilisation/référence occasionnelle/légère` (pas « intense/fréquente » —
  HYDRA ne fait que suivre une consommation déclarée par l'utilisateur, elle
  ne la met pas en scène ni ne l'encourage).
- Tout le reste (violence, contenu choquant, jeux d'argent, contenu pour
  adultes, etc.) : **Aucun**.

Le résultat calculé automatiquement par Apple à partir de ces réponses sera
probablement **17+**. C'est normal et attendu à cause de la référence à
l'alcool — laisse le système calculer, ne force pas une valeur toi-même.

## 9. Étiquettes de confidentialité (App Privacy / Privacy Nutrition Labels)

C'est le questionnaire le plus long. Voici exactement quoi cocher, catégorie
par catégorie (App Store Connect → App Privacy → Get Started) :

### Santé et forme physique (Health & Fitness)
- Type de données : **Santé** (le poids) et **Forme physique** si tu logges
  du sport.
- Utilisé pour : `Fonctionnalité de l'app`.
- **Lié à l'identité** : Oui (le poids est associé à ton compte).
- **Utilisé pour le suivi (tracking)** : Non.

### Contenu utilisateur (User Content)
- Type de données : `Autres données utilisateur` (le journal de boissons —
  eau, alcool, café — n'a pas de catégorie Apple dédiée à l'hydratation,
  celle-ci est la plus proche).
- Utilisé pour : `Fonctionnalité de l'app`.
- **Lié à l'identité** : Oui.
- **Utilisé pour le suivi** : Non.

### Identifiants (Identifiers)
- Type de données : `ID utilisateur` (ton compte Supabase / Sign in with
  Apple).
- Utilisé pour : `Fonctionnalité de l'app`.
- **Lié à l'identité** : Oui.
- **Utilisé pour le suivi** : Non.

### Coordonnées (Contact Info)
- Type de données : `Adresse e-mail` (si connexion par email plutôt que
  Sign in with Apple).
- Utilisé pour : `Fonctionnalité de l'app`.
- **Lié à l'identité** : Oui.
- **Utilisé pour le suivi** : Non.

### Achats (Purchases)
- Type de données : `Historique d'achats` (géré par RevenueCat/Apple pour
  l'abonnement).
- Utilisé pour : `Fonctionnalité de l'app`.
- **Lié à l'identité** : Oui.
- **Utilisé pour le suivi** : Non.

Pour **tout le reste** proposé par le questionnaire (localisation, contacts,
navigation, données financières, diagnostics, etc.) : ne rien cocher — tu ne
collectes rien de tout ça.

À la question globale « Est-ce que vous ou vos partenaires utilisez des
données pour le tracking publicitaire (pistage inter-app/site) ? » →
**Non**, sur toute la ligne.

## 10. Copyright

```
© 2026 [ton nom ou raison sociale]
```

Le nom exact doit correspondre à celui enregistré sur ton compte Apple
Developer (le même que pour CAREEAT).

## 11. Coordonnées de contact (App Review Information)

- **Email** : `clemtrialktm@gmail.com`
- **Téléphone** : le tien.
- **Notes pour le reviewer** (optionnel mais utile, colle ceci) :

```
HYDRA est une app d'hydratation. Le compte de test peut être créé
directement dans l'app (Sign in with Apple ou email). Aucune fonctionnalité
n'est cachée derrière un paywall additionnel non listé : l'abonnement
donne accès à l'ensemble de l'app après l'essai de 7 jours.
```

---

## Ce qu'il reste à faire, dans l'ordre, une fois cette fiche remplie

1. Coller les URLs de confidentialité/support (section 7 ci-dessus) —
   **déjà en ligne**, tu peux les coller dès maintenant.
2. Icône 1024×1024 définitive + captures d'écran (Phase C du roadmap).
3. Build de production (`eas build --profile production --platform ios`)
   puis soumission — ce sera fait après les modifs dans l'app dont tu as
   parlé, pas avant.
