# Cartes réelles avec Fyatu (mode test)

Mesura sait émettre ses cartes virtuelles chez **Fyatu** (https://docs.fyatu.com, API v3.20) au lieu
de l'émetteur simulé. Le code est prêt ; il s'active uniquement quand les variables ci-dessous sont
renseignées, et reste en **mode test** tant que l'argent réel n'est pas explicitement autorisé.

## Comment ça marche

1. **Recharge** : le client paie en Mobile Money via FedaPay (inchangé).
2. **Émission** : à la recharge confirmée, Mesura crée (une seule fois par utilisateur) un
   *cardholder* Fyatu à partir de l'identité vérifiée, puis une carte virtuelle sur le produit
   `FYATU_PRODUCT_ID`. Produit *just-in-time* (recommandé) : la carte n'a pas de solde, chaque paiement
   est prélevé sur le solde du programme Mesura chez Fyatu. Sinon la carte est chargée de son plafond
   (converti en dollars).
3. **Chaque paiement** : Fyatu envoie `CARD_AUTHORIZATION_VERIFY` à `POST /webhooks/fyatu` ; Mesura
   applique les règles de la carte (marchand, plafond, nombre de paiements, durée), enregistre la
   transaction et répond `APPROVE` ou `DECLINE` en quelques dizaines de millisecondes (Fyatu laisse
   1,2 s). Montants Fyatu en USD, convertis en FCFA avec `FYATU_XOF_PER_USD` (arrondi en défaveur du
   client). Une même demande renvoyée reçoit la même réponse sans être décomptée deux fois.
4. **Gel, dégel, clôture, affichage du numéro** : appels Fyatu correspondants ; le numéro, la date et
   le CVV sont déchiffrés en mémoire pour un affichage, jamais stockés.

Les marchands sont reconnus sous leurs noms réseau (« NETFLIX.COM », « FACEBK *ADS », « GOOGLE
*YouTube », « AMZN Mktp »…) : voir `MERCHANT_DESCRIPTORS` dans `card-policy.engine.ts`.

## Mise en place (mode test)

1. Créer un compte développeur Fyatu, récupérer une **clé API de test**.
2. Créer un **programme** et un **produit** de cartes virtuelles (idéalement *JIT*) : noter l'id `prd_…`.
3. Créer un **webhook** vers `https://mesura-38r8.vercel.app/webhooks/fyatu` avec au moins les
   événements `CARD_AUTHORIZATION_VERIFY` et `CARD_ISSUED` ; noter le secret `whsec_…`.
4. Dans Vercel (Production, ou d'abord Preview) : `FYATU_API_KEY`, `FYATU_WEBHOOK_SECRET`,
   `FYATU_PRODUCT_ID`, `FYATU_JIT=true`, `FYATU_TEST_MODE=true`, `FYATU_XOF_PER_USD`, puis redéployer.

Le serveur refuse de démarrer si la clé est là sans secret ni produit, ou si le mode test est coupé
sans `FYATU_ALLOW_LIVE=true` **et** `SANDBOX_MODE=false`.

## Points à confirmer avec Fyatu avant l'argent réel

- **Togo** : acceptation d'une société togolaise et de cardholders togolais.
- **Vérification d'identité** : Fyatu vérifie chaque cardholder (pièce d'identité, selfie). Mesura
  n'envoie aujourd'hui que nom, date de naissance, pays, e-mail, téléphone et une adresse provisoire
  (« Lomé ») : il faudra collecter l'adresse et les pièces dans la vraie vérification d'identité.
- **Taux et frais** : taux USD/FCFA réel, frais par carte et par transaction, à comparer aux 5 %.
- **Réponse tardive = paiement accepté** : si Mesura ne répond pas en 1,2 s (serveur endormi, panne),
  Fyatu accepte le paiement. Avant l'argent réel : fixer aussi des plafonds côté produit Fyatu,
  garder le serveur « chaud » et fermer chez Fyatu les cartes expirées sans attendre.
- Format exact des événements `CARD_ISSUED` et des statuts de carte en mode test.
