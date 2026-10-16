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

Version actuelle : **0.7.0** (versionCode **8**). Chaque nouvel envoi sur Play doit augmenter
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
> Besoin du numéro pour payer ? Affichez le numéro, la date d'expiration et le CVV pendant 30 secondes,
> après vérification par l'empreinte, le visage ou le code de votre téléphone.
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
| `01-bienvenue.png` … `08-infos-carte.png` | Captures téléphone (1080 × 2160), 2 à 8 requises : envoyez les 8, dans l'ordre |

## 4. Questionnaires de la Play Console

**Accès à l'application** — l'app exige une connexion. Fournissez le compte de démo :
`demo@mesura.test` / `demo1234` (identité déjà vérifiée, 4 cartes dont « Carte Meta Ads » active).
Ce compte se remet en état tout seul à chaque connexion : recréé s'il a été supprimé (l'examinateur peut tester
la suppression), cartes neuves dès qu'aucune ne reste active pendant au moins 24 h.
Notes pour l'examinateur, à coller telles quelles :
> Application de démonstration : aucun argent réel n'est débité. Les recharges passent par le mode test
> de FedaPay et sont approuvées automatiquement. Pour voir le numéro d'une carte : Cartes → Carte Meta Ads →
> « Voir les informations de la carte ». Pour créer une carte : Accueil → Créer une carte.

**Annonces** : non, l'app ne contient pas de publicité.

**Classification du contenu** : catégorie « Utilitaire, productivité, communication ou autre » ;
répondez *non* à toutes les questions (violence, contenu sexuel, jeux d'argent, etc.).
L'app n'achète ni ne vend de produits numériques.

**Public cible** : 18 ans et plus.

**Fonctionnalités financières** : déclarez la gestion de cartes / paiements, en précisant dans les
notes qu'il s'agit d'une **démonstration sans transaction réelle**.

**Sécurité des données** (*Contenu de l'application → Sécurité des données*)

*Vue d'ensemble*
| Question | Réponse |
|---|---|
| L'app collecte-t-elle ou partage-t-elle des données utilisateur des types requis ? | **Oui** |
| Toutes les données collectées sont-elles chiffrées en transit ? | **Oui** (HTTPS uniquement) |
| Proposez-vous un moyen de demander la suppression des données ? | **Oui** — *Profil → Supprimer mon compte*, et `https://mesura-38r8.vercel.app/legal/delete-account` |

*Types de données* — cochez uniquement ceux-ci. Pour chacun : **Collectées : oui · Partagées : non ·
Traitement éphémère : non · Obligatoire** (l'utilisateur ne peut pas refuser).

| Catégorie → type | Finalités à cocher |
|---|---|
| Infos personnelles → **Nom** | Fonctionnement de l'app, Gestion du compte, Prévention de la fraude, sécurité et conformité |
| Infos personnelles → **Adresse e-mail** | Fonctionnement de l'app, Gestion du compte, Communications du développeur (code « mot de passe oublié ») |
| Infos personnelles → **Numéro de téléphone** | Fonctionnement de l'app (recharge Mobile Money), Prévention de la fraude, sécurité et conformité |
| Infos personnelles → **Autres infos** (date de naissance, pays) | Gestion du compte, Prévention de la fraude, sécurité et conformité |
| Infos financières → **Historique des achats** (paiements par carte) | Fonctionnement de l'app |
| Infos financières → **Autres infos financières** (recharges, plafonds et règles des cartes) | Fonctionnement de l'app |

*Pourquoi « Partagées : non »* : FedaPay (paiement Mobile Money), Vercel (hébergement) et Neon (base de
données) traitent ces données **pour le compte de Mesura**. Google ne compte pas les prestataires comme un
partage. Ils sont nommés dans la politique de confidentialité.

*À ne pas cocher*
| Type | Pourquoi |
|---|---|
| Infos de paiement de l'utilisateur (numéro de carte bancaire) | L'utilisateur n'en saisit aucune : les numéros affichés sont ceux des cartes que Mesura émet, jamais enregistrés sur le téléphone |
| Position, contacts, photos et vidéos, fichiers, audio, messages, agenda, santé | Non collectés |
| Activité dans l'app, historique de navigation, diagnostics, identifiants de l'appareil ou publicitaires | Non collectés (aucun outil d'analyse, de publicité ni de rapport de plantage) |
| Empreinte digitale / visage | Vérifiés par Android sur le téléphone ; Mesura ne reçoit que « oui » ou « non » |

*Conservation après suppression* : seule une empreinte chiffrée irréversible de l'identité et du numéro est
gardée, pour empêcher la création répétée de comptes. C'est permis tant que la politique de
confidentialité le dit, ce qui est le cas.

## 5. Mises à jour suivantes

1. Augmentez `version` et `android.versionCode` dans `apps/mobile/app.json`.
2. Relancez le workflow **Release Android (Play Store AAB)**.
3. Envoyez le nouvel `app-release.aab` sur la piste voulue dans la Play Console.
