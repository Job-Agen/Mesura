# Publier Mesura sur le Google Play Store

Ce dossier contient tout ce qu'il faut pour la première publication : textes de la fiche, visuels,
réponses aux questionnaires de la Play Console et procédure de signature.

> **Important : Mesura est encore une sandbox.** Aucun argent réel ne circule et aucune vraie carte n'est
> émise. Publiez d'abord sur une **piste de test (interne ou fermée)**, pas en production publique.
> Une app qui ressemble à un service financier sans en être un risque d'être refusée par Google
> (règles « Services financiers » et « Comportement trompeur »).

## 1. Ce qui est déjà prêt dans le code

| Élément | Où |
|---|---|
| Variante Play Store (`africa.mesura.app`, https uniquement, sans sélecteur de serveur, autorisations inutiles retirées) | `apps/mobile/app.config.js` |
| Signature avec la clé d'envoi (upload key) | `apps/mobile/plugins/with-release-signing.js` |
| Construction de l'AAB signé | workflow GitHub **Release Android (Play Store AAB)** |
| Suppression de compte dans l'app | Profil → Supprimer mon compte |
| Politique de confidentialité | `https://mesura-38r8.vercel.app/legal/privacy` |
| Page de suppression de compte | `https://mesura-38r8.vercel.app/legal/delete-account` |
| Conditions d'utilisation (acceptées à l'inscription) | `https://mesura-38r8.vercel.app/legal/terms` |
| Mot de passe oublié (code à 6 chiffres par e-mail) | écran de connexion → *Mot de passe oublié ?* |
| Nous contacter | Profil (affiché dès que `SUPPORT_EMAIL` est renseigné) |
| Visuels | `docs/play-store/assets/` |

Version actuelle : **0.6.0** (versionCode **7**). Chaque nouvel envoi sur Play doit augmenter
`android.versionCode` dans `apps/mobile/app.json`.

## 2. Avant le premier envoi

1. **Compte développeur Google Play** (frais uniques de 25 $) : <https://play.google.com/console>.
   Un compte **personnel** récent doit faire tester l'app en **test fermé par au moins 12 testeurs pendant
   14 jours** avant de pouvoir publier en production.
2. **Éditeur et e-mail de contact** : dans Vercel (projet `mesura-38r8`, variables *Production*), renseignez
   `LEGAL_PUBLISHER` (votre nom ou celui de votre société) et `SUPPORT_EMAIL`, puis redéployez.
   Ils apparaissent sur les pages légales, qui sont exigées par Google, et dans *Profil → Nous contacter*.
   **E-mails de réinitialisation** : créez une clé API sur <https://resend.com>, vérifiez votre domaine, puis
   renseignez `RESEND_API_KEY` et `EMAIL_FROM` (ex. `Mesura <no-reply@votre-domaine>`). Sans clé, aucun e-mail
   n'est envoyé et « Mot de passe oublié » ne peut pas aboutir.
3. **Clé d'envoi (upload key)** : créez un keystore, puis ajoutez ces 4 secrets dans GitHub
   (*Settings → Secrets and variables → Actions*) :
   - `ANDROID_UPLOAD_KEYSTORE_BASE64` : le fichier `.jks` encodé en base64
   - `ANDROID_UPLOAD_STORE_PASSWORD`
   - `ANDROID_UPLOAD_KEY_ALIAS`
   - `ANDROID_UPLOAD_KEY_PASSWORD`

   Commande pour créer la clé (sur un ordinateur avec Java) :
   ```bash
   keytool -genkeypair -v -keystore mesura-upload.jks -alias mesura-upload \
     -keyalg RSA -keysize 2048 -validity 10000
   base64 -w0 mesura-upload.jks   # valeur de ANDROID_UPLOAD_KEYSTORE_BASE64
   ```
   Gardez le fichier et les mots de passe en lieu sûr. Avec la signature d'app Google Play (activée par
   défaut), Google conserve la vraie clé de signature ; une clé d'envoi perdue peut être réinitialisée
   auprès du support Google.
4. **Construire l'AAB** : onglet *Actions* → **Release Android (Play Store AAB)** → *Run workflow*.
   Téléchargez l'artefact `mesura-play-store-aab` (fichier `app-release.aab`).

## 3. Fiche du Play Store

**Nom de l'app** (30 caractères max.)
> Mesura – Cartes contrôlées

**Description courte** (80 caractères max.)
> Des cartes virtuelles avec vos règles : plafond, marchand, paiements et durée.

**Description complète**
> Payez en ligne sans exposer plus d'argent que nécessaire.
>
> Avec Mesura, chaque carte virtuelle suit les règles que vous choisissez :
>
> • COMBIEN — fixez le montant maximum que la carte peut dépenser.
> • OÙ — réservez-la à un seul marchand (Canva, Netflix, Amazon…) ou utilisez-la partout.
> • COMBIEN DE FOIS — un paiement, cinq, ou jusqu'à l'expiration.
> • COMBIEN DE TEMPS — 30 minutes, 24 heures, 7 jours… elle se désactive toute seule.
>
> Rechargez votre carte par Mobile Money (TMoney, Flooz, Moov Money). Si un paiement ne respecte pas vos
> règles, il est bloqué avant d'atteindre le marchand, et vous voyez pourquoi en clair.
>
> Gelez une carte en un geste, durcissez ses règles à tout moment ou clôturez-la quand vous voulez.
>
> Mesura ne vous demande jamais votre code PIN Mobile Money.
>
> ⚠️ Version de démonstration : aucun argent réel n'est débité, aucune vraie carte bancaire n'est émise
> et la vérification d'identité est simulée.

**Catégorie** : Finance · **Tags** : paiements, cartes virtuelles
**E-mail de contact** : la même adresse que `SUPPORT_EMAIL`
**Politique de confidentialité** : `https://mesura-38r8.vercel.app/legal/privacy`

**Visuels** (dans `assets/`)
| Fichier | Usage |
|---|---|
| `icon-512.png` | Icône de l'application (512 × 512) |
| `feature-graphic.png` | Image de présentation (1024 × 500) |
| `01-bienvenue.png` … `07-activite.png` | Captures téléphone (1080 × 2160), 2 à 8 requises |

## 4. Questionnaires de la Play Console

**Accès à l'application** — l'app exige une connexion. Fournissez le compte de démo :
`demo@mesura.test` / `demo1234` (identité déjà vérifiée, 4 cartes).

**Annonces** : non, l'app ne contient pas de publicité.

**Classification du contenu** : catégorie « Utilitaire, productivité, communication ou autre » ;
répondez *non* à toutes les questions (violence, contenu sexuel, jeux d'argent, etc.).
L'app n'achète ni ne vend de produits numériques.

**Public cible** : 18 ans et plus.

**Fonctionnalités financières** : déclarez la gestion de cartes / paiements, en précisant dans les
notes qu'il s'agit d'une **démonstration sans transaction réelle**.

**Sécurité des données**
| Question | Réponse |
|---|---|
| Collecte ou partage de données ? | Collecte : oui. Partage : **non** — FedaPay (paiement Mobile Money), Vercel et Neon traitent les données pour le compte de Mesura : Google ne compte pas ces prestataires comme un « partage » |
| Chiffrement en transit | Oui (HTTPS) |
| Suppression possible par l'utilisateur | Oui — dans l'app et via `/legal/delete-account`. Seule une empreinte chiffrée irréversible (identité, numéro) est gardée pour la prévention de la fraude, ce que Google autorise si c'est déclaré |
| Infos personnelles | Nom, adresse e-mail, numéro de téléphone, date de naissance — *fonctionnement de l'app, gestion du compte, prévention de la fraude* ; obligatoires |
| Infos financières | Historique d'achats (paiements simulés), autres infos financières (règles des cartes, recharges) — *fonctionnement de l'app* ; obligatoires |
| Position, contacts, photos, fichiers, audio, santé, identifiants publicitaires | Non collectés |
| Activité dans l'app / diagnostics / statistiques | Non collectés (pas d'outil d'analyse tiers) |

## 5. Mises à jour suivantes

1. Augmentez `version` et `android.versionCode` dans `apps/mobile/app.json`.
2. Relancez le workflow **Release Android (Play Store AAB)**.
3. Envoyez le nouvel `app-release.aab` sur la piste voulue dans la Play Console.
