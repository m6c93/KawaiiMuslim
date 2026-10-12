# Corrections de la PR #15 — 12 octobre 2026

## État corrigé

La suppression immédiate **n’est pas activée**. Les problèmes de reprise/concurrence du moteur initial ne sont pas considérés comme résolus : ils sont neutralisés dans le parcours exposé par une barrière serveur non configurable (`release.mjs` retourne `false`). Une requête POST, même authentifiée, retourne 409 avant lecture du mot de passe, création du client administratif ou appel à Stripe/Storage/Auth Admin. Un utilisateur anonyme reste refusé avec 401. Modifier un paramètre du navigateur ou une variable d’environnement ne permet pas de l’activer.

Le formulaire manuel de main est restauré dans Mon compte, avec confirmation parent, mot de passe, MFA et reçu persistant. Il reste disponible pour les comptes liés à une classe et lorsque le nouvel endpoint est absent/ancien/injoignable. Les demandes `pending` et `processing`, leurs dates et échéances ne sont pas modifiées ; aucune migration ne les purge. L’administration conserve sa file privée.

Ce choix corrige le parcours disponible sans prétendre qu’un moteur de suppression distribuée a été validé. L’automatisation restera un travail distinct avant ouverture : état durable, exclusion mutuelle, reprise après panne, inventaire complet, écritures/achats concurrents et essais jetables.

## Code corrigé

- **Apple** : avertissement explicite dans la confirmation manuelle et le reçu ; avertissement, lien permanent et case requise dans le dialogue immédiat conservé mais masqué. Le noyau exige aussi `appleSubscriptionAcknowledged === true`. Après succès simulé, le lien reste visible.
- **Gestion des abonnements** : Apple web mène à la page Apple ; Apple natif conserve `KMApple.manage()`. La gestion Stripe dispose d’une action séparée, affichée si le compte possède un identifiant client Stripe, même lorsque le droit d’accès sélectionné provient d’Apple. Stripe natif conserve le message de gestion depuis le site. Le backend de suppression lit toujours la facturation Stripe directement, pas seulement le droit effectif.
- **Notifications après effacement** : Apple et Stripe interrogent `billing_owner_state` après validation de la signature. Un propriétaire Auth absent est acquitté sans création ni réattribution de données. Une panne DB ou un utilisateur Auth présent sans profil provoque une erreur/reprise. Les achats/restaurations continuent d’exiger l’UUID propriétaire d’origine : aucune réattribution à un nouveau compte portant le même email.
- **Dessins et anciens jetons** : nouvelle policy Storage restrictive exigeant l’existence d’un profil actif pour `child-artworks`, en plus des policies existantes de préfixe propriétaire. Elle n’ouvre pas les fichiers d’une autre famille et ne supprime aucun objet. Les opérations administratives de nettoyage restent possibles avec le rôle service.
- **Ancres/documentation** : `#suppression-compte`, délai de 30 jours et confirmation manuelle conservés. Le guide décrit la barrière serveur, la migration et les essais requis.

## Validation locale

Node 24 ; `npm run test:account-deletion-safety` : **77 tests réussis**.

Les migrations sont exécutées dans PostgreSQL en mémoire avec familles fictives. Les tests vérifient notamment : protections RLS, parent absent/inactif, refus d’insertion et de lecture Storage avec ancien UUID, permissions de la RPC serveur, anciennes demandes/idempotence/MFA, barrière GET/POST réelle du handler avec dépendances simulées, routage Apple/Stripe et cas mixte, notifications signées simulées avec compte absent/actif et pannes, refus des signatures invalides.

Les scripts JavaScript et scripts inline sont parsés. Les handlers TypeScript sont exécutés avec types retirés et dépendances simulées : ce n’est pas une compilation Deno ni un appel aux SDK distants.

Le test navigateur n’a pas pu démarrer : téléchargement de Chromium tronqué. Les essais iPhone/iPad, Supabase isolé, Stripe test et Apple Sandbox ne sont pas effectués. Aucun compte ou abonnement réel n’a été modifié.

## Ordre futur de mise en service — non exécuté

1. Appliquer en staging la migration `20261012102000_account_deletion_safety.sql`, après les schémas existants, avant les nouvelles fonctions de notifications. Vérifier aussi la présence de la migration des demandes du 8 octobre.
2. Déployer en staging le frontend et les fonctions corrigées, en laissant la barrière immédiate fermée. Tester le circuit manuel, les notifications et Storage sur comptes jetables.
3. Ne pas rouvrir la suppression immédiate uniquement en changeant `false` en `true` : résoudre d’abord les blocages de l’audit, puis effectuer les essais de panne et de concurrence.
4. L’ancien backend déclaré déployé par la PR initiale n’a pas été inspecté/modifié ici. Le commit GitHub seul ne ferme pas ce backend : la nouvelle barrière ne prendra effet qu’après un déploiement explicitement autorisé.

Le rapport d’audit précédent reste une photographie de l’état initial. Ce document décrit les corrections actuelles et leurs limites.
