# Abonnements Apple — déploiement

## Produits
Groupe App Store Connect `22462508` (KMW Accès famille), abonnements mensuels :
- 1 enfant : `com.kawaiimuslimworld.family1.monthly` / `6821398029` / France 4,99 €.
- 2 enfants : `com.kawaiimuslimworld.family2.monthly` / `6821398544` / France 5,99 €.
- 3 enfants : `com.kawaiimuslimworld.family3.monthly` / `6821398911` / France 6,99 €.
Niveaux du groupe : 3 enfants > 2 enfants > 1 enfant. Le prix affiché est fourni par StoreKit, dans la devise du client. Aucune promesse d’offre d’introduction tant qu’elle n’est pas configurée chez Apple.

## Ordre requis
1. Accepter le contrat Applications payantes avec l’accord précis du titulaire et compléter les coordonnées fiscales/bancaires si Apple les demande.
2. Compléter les trois produits (prix, disponibilité, nom/description français, capture réelle du paywall). Ne pas soumettre de capture fictive.
3. Créer une clé Achat intégré Apple uniquement avec l’accord du titulaire ; conserver la clé privée dans les secrets Supabase, jamais dans Git ou le client.
4. Secrets serveur : `APPLE_IAP_PRIVATE_KEY`, `APPLE_IAP_KEY_ID`, `APPLE_IAP_ISSUER_ID`. Vérifier l’identifiant émetteur affiché par Apple. `APPLE_SANDBOX_USER_IDS` contient uniquement les UUID de comptes de test autorisés, dont le compte de vérification Apple ; un achat Sandbox ne doit pas débloquer un client de production quelconque.
5. Appliquer `migrations/20261010170000_apple_subscriptions.sql`, puis déployer `apple-purchase` et `apple-notifications`.
6. Configurer notifications App Store Server V2 production et sandbox vers `https://pasgxojzybmvbjhuokkk.supabase.co/functions/v1/apple-notifications`. Envoyer/vérifier une notification TEST Apple.
7. Déployer les pages et `km-auth.js`/`km-access-gate.js` **après** la migration. Les abonnements Stripe existants restent indépendants.
8. Compiler/signature/TestFlight nouvelle build. Vérifier sur appareil réel : achat initial, annulation, demande en attente, restauration avec le même parent, autre parent refusé, perte réseau puis restauration, renouvellement, expiration et remboursement.
9. Joindre les trois abonnements à la nouvelle soumission Apple après tests réussis.

## Sécurité
StoreKit valide les transactions sur l’appareil ; le serveur valide également la chaîne de certificats et le JWS avec la bibliothèque officielle Apple et OCSP, puis interroge l’état **actuel** auprès d’Apple. Le `appAccountToken` doit correspondre au parent connecté ou à une réservation déjà rattachée à ce parent et à cette transaction originale. Seul le serveur peut enregistrer les droits. Les anciennes transactions ne peuvent pas transférer l’achat à un autre parent ou rétablir une transaction remboursée.

## Paiement avant création du compte (build 13)
Déployer `20261013150000_apple_purchase_before_account.sql`, puis apple-onboarding (JWT legacy OFF), apple-purchase et apple-notifications avant la nouvelle build. L’API publique réserve uniquement un UUID et un hash de secret ; aucune identité ni aucun droit n’est créé. Les actions claim/tokens vérifient explicitement le JWT utilisateur. Une réservation est limitée à cinq créations par source par heure ; une répétition avec le même secret est idempotente.
L’iPhone conserve UUID, secret et transaction signée dans le trousseau local. StoreKit n’achève la transaction qu’après validation serveur et rattachement atomique au parent. Une confirmation d’e-mail reste requise ; le retour dans KMW rattache l’achat, sans ouvrir Stripe. Les renouvellements et remboursements utilisent la correspondance enregistrée. Avant finalisation du compte, reprendre sur le même appareil ; après finalisation, restaurer depuis le compte sur un autre appareil. Ne jamais effacer une réservation liée à un achat.
Le frontend active ce parcours uniquement lorsque le pont natif annonce `payBeforeAccount`; les anciennes builds restent compatibles. Vérifier en TestFlight avant soumission : achat confirmé, annulation, fermeture après achat, création/confirmation/connexion, restauration et remboursement.
La fenêtre de gestion Apple permet aussi le changement de formule. Le paywall n’autorise pas un second abonnement lorsqu’un accès est déjà actif (prévention du double paiement Apple/Stripe). Le partage familial Apple n’est pas activé : les profils KMW partagent déjà un même compte parent.
Le mode de grâce n’est pas activé dans Apple ; le serveur n’accorde pas de délai gratuit après l’expiration signée.

## Vérifications locales
`node --test scripts/apple-purchase.test.mjs` : permissions SQL, limites enfants, accès aux livres, appartenance, expiration/remboursement, annulation/attente/échec côté client, maintien du paiement web Stripe.
`deno test --node-modules-dir=none scripts/apple-server.test.ts` : rejet d’un JWS fabriqué par le vérificateur officiel, statut Apple courant, corps HTTP limité.
Compilation Release simulateur iOS : réussie. **Ces contrôles locaux ne prouvent pas qu’un paiement Sandbox ou de production a réussi.**

État au 10 octobre 2026 : code préparé et compilation Release réussie ; prix France, disponibilité dans 175 pays, descriptions françaises et niveaux du groupe configurés. Les captures réelles du paywall restent à fournir. Contrat Apple, clé serveur, déploiement et tests réels restent à finaliser avant publication. Aucun abonnement réel débité par Codex.
