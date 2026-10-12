> Historique : audit initial avant la demande de correction. L’état corrigé est
> décrit dans `account-deletion-corrections-2026-10-12.md` : parcours manuel
> restauré, automatisation bloquée côté serveur, protection Storage et
> notifications corrigées. Les limites initiales ci-dessous ne sont pas toutes
> résolues dans le moteur automatique et n’autorisent pas son activation.

# Audit de la suppression des comptes — 12 octobre 2026

Décision : conserver la PR #15 en brouillon. Le correctif joint résout les avertissements Apple et plusieurs régressions d’intégration, mais ne valide pas l’activation de la suppression immédiate.

## Références réellement comparées

- `main` récupérée pendant cet audit : `267275ac1aa0bb536b95686b80c309fc31e7490f`.
- PR #15 ouverte, brouillon : `c99d7b4dd17cdb990f32501acf02ef9b27fdbdca`, branche `fix/automatic-family-account-deletion`.
- Ancêtre commun : PR #14, commit `5fcd6f74a6441e2950710212efb7d6dacebfb545`.
- PR #16 : intégration Apple `2b4689aa5d66ad86cecf427045ccc281e3e79587` ; main contient aussi les PR #17–19 et l’évolution des invocations. Ces modifications sont conservées dans la proposition.
- Sources : [PR #14](https://github.com/m6c93/KawaiiMuslim/pull/14), [PR #15](https://github.com/m6c93/KawaiiMuslim/pull/15), [PR #16](https://github.com/m6c93/KawaiiMuslim/pull/16).

La description de #15 affirme un déploiement Supabase et une réponse 401 à un appel sans session. Ce sont des informations déclarées dans la PR, pas une inspection du déploiement actuel : aucun endpoint de production n’a été appelé ici. Aucun compte, abonnement ou donnée réelle n’a été supprimé. Aucun push, commentaire GitHub, déploiement ou fusion de PR n’a été effectué. La simulation d’intégration locale a été arrêtée après préparation du diff ; aucun commit de fusion n’a été créé.

## Incompatibilités et corrections

| Priorité | Constat vérifiable | Correction proposée / état |
|---|---|---|
| P1 | #15 retire intégralement l’avertissement et le lien Apple de `Compte.dc.html`, alors que le backend ne traite que Stripe. | Avertissement explicite et lien Apple toujours visibles, indépendamment du fournisseur d’accès sélectionné. Case de compréhension requise, transmise au backend sous `appleSubscriptionAcknowledged`, qui exige strictement `true`. Inclus dans le patch. |
| P1 | Le succès de #15 masque tous les paragraphes du dialogue. Ajouter seulement un avertissement avant confirmation le ferait disparaître après la suppression. | `deleteAccountAppleNotice` est exclu du masquage. Le lien demeure utilisable après la déconnexion. Le bouton de réouverture est désactivé après succès. Inclus. |
| P1 | Sur main, `KMAuth.openBillingPortal()` choisit Apple uniquement en présence du pont natif. Un parent Apple sur le web est envoyé à `create-portal-session` (Stripe). | Lire le fournisseur avant de tester le pont : Apple natif → `KMApple.manage()`, Apple web → URL Apple ; Stripe web → portail existant. Le parcours Stripe natif conserve son indication de gestion sur le site. Le texte du récapitulatif Apple web ne dit plus « Paiement sécurisé par Stripe ». Inclus. |
| P1 | #15 retire `account-deletion.js` et son reçu, sans lire les demandes historiques. La table/admin existent toujours. | Afficher référence, date et échéance originales. Désactiver l’action immédiate si une demande existe ou si sa lecture échoue. Le backend refuse aussi `pending` et `processing` sans les modifier. Inclus ; ne remplace pas un verrou transactionnel. |
| P2 | L’intégration locale actuelle produit deux conflits : `Compte.dc.html` et `supabase/config.toml`. | Diff reconstruit sur main, conservant achats/restauration Apple, offres publiques, connexion et configurations Apple, avec ajout de `delete-account`. Inclus. Ne pas accepter simplement la version #15 de ces fichiers. |
| P2 | Les liens d’assistance/confidentialité pointent vers `#suppression-compte`, retiré par #15. Les textes promettent seulement une demande manuelle sous 30 jours. | Ancre conservée, textes distinguant suppression immédiate éligible et demandes historiques. Guide opérationnel annoté. Inclus dans la proposition, à publier uniquement avec le parcours validé. |

Le texte central est : **« Supprimer ton compte KMW ne résilie pas ton abonnement Apple. La facturation Apple continue tant que le renouvellement reste actif. »** La case confirme la compréhension, pas une résiliation fictive. La suppression n’est pas conditionnée à une preuve d’annulation Apple ni à l’expiration de l’abonnement.

[La documentation Apple](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion) demande d’expliquer la poursuite de la facturation et de fournir `showManageSubscriptions` ou le lien Apple ; un parcours manuel reste possible avec délai et confirmation. Achats Apple et « Sign in with Apple » sont différents : aucune révocation de jeton de connexion Apple n’est implémentée ni supposée ici.

## Garanties conservées et limites des données familiales

Dans #15, `deleteFamilyAccount` utilise exclusivement l’utilisateur authentifié, ignore un `userId` fourni par le client, revérifie le mot de passe, contrôle la MFA quand un facteur vérifié existe et exige le rôle parent. Les rôles d’administration/support et huit catégories de liens professionnels sont refusés. Les chemins de fichiers doivent commencer par l’UUID du parent suivi de `/`. Ces contrôles sont conservés et testés avec doubles locaux.

Les SQL du dépôt déclarent des cascades pour profils parents/enfants, planning, lecture, progression et validation du Coran, créations, étoiles/récompenses, abonnements Stripe, tickets et demandes de suppression. La nouvelle table `apple_subscriptions` référence aussi `profiles` avec `ON DELETE CASCADE`. **Effacer cette ligne Apple retire un droit local ; cela n’annule pas la facturation Apple.** Les cascades du dépôt ne prouvent pas le schéma effectivement déployé et n’effacent pas les objets Storage.

### Blocages restant avant activation

1. **Suppression partielle et opérations concurrentes.** Le code effectue successivement annulations Stripe → suppression Storage → suppression Auth, sans transaction distribuée, journal d’étapes ou verrou. Une erreur Storage peut survenir après annulation Stripe ; une erreur Auth après effacement des créations. Un second appareil peut écrire pendant l’inventaire. Une réponse perdue après `deleteUser` ne permet pas de retrouver un reçu durable. Correction nécessaire : état de traitement par parent avec acquisition atomique, étapes reprises de manière idempotente et preuve minimale de fin accessible de façon sécurisée ; bloquer les nouvelles écritures et les nouveaux achats pendant ce traitement. Coordonner aussi le traitement administratif. Ne pas présenter le correctif de lecture des demandes comme un verrou.
2. **Inventaire Storage et accès résiduel.** `index.ts` liste `child-artworks` par préfixe, mais ne compare pas cet inventaire aux `image_path`, ne vérifie pas que le préfixe est vide après suppression et n’inventorie pas les autres emplacements. Les policies Storage dans `child-art-studio.sql` vérifient seulement le préfixe `auth.uid()`, pas l’existence du profil parent : l’effet d’un JWT encore valide après suppression doit être testé. Correction nécessaire : vérifier les références et le catalogue réel, interdire les écritures via un état de suppression, renforcer les policies avec l’existence d’un parent autorisé, vérifier l’absence d’objets avant succès. Ne jamais élargir la suppression à un bucket entier.
3. **Données non rattachées par cascade.** Exemple précis : `quran_access_invitations.email` n’est pas une FK vers le parent ; le précontrôle recherche seulement `created_by`. Une invitation adressée au parent mais créée par quelqu’un d’autre peut subsister. Les JSON d’audit et données tierces nécessitent également un inventaire. Correction : recherche et traitement ciblés par identité vérifiée, sans supprimer organisations/classes/autres élèves ; conserver le circuit manuel tant que ce périmètre n’est pas couvert.
4. **Notifications et restauration Apple après suppression.** `apple-notifications/index.ts` exige un profil parent existant et retourne 422 si celui-ci a disparu. La suppression de la ligne Apple n’empêche donc pas les notifications suivantes de provoquer des erreurs/reprises. `entitlementFromApple` exige que `appAccountToken` corresponde à l’UUID parent : recréer un compte avec le même email ne rend pas automatiquement l’achat restaurable. Définir et tester une politique de traitement des notifications signées d’un compte effacé, sans recréer le profil ni transférer silencieusement les droits. Une notification invalide ou une panne DB doit rester distinguée d’un compte réellement effacé. Même problème à contrôler pour les webhooks Stripe tardifs : l’upsert vers un profil supprimé peut échouer sur la FK.
5. **Facturation Stripe à réconcilier.** La pagination de `subscriptions.list({customer, status:'all', limit:100})` via l’itérateur et l’annulation de tous les statuts sauf `canceled`/`incomplete_expired` sont conservées. Ne pas remplacer cette lecture par `get_family_subscription()`, qui ne renvoie qu’un droit effectif, ni par un seul `stripe_subscription_id`. Il reste à vérifier factures en attente, abonnements multiples, données de facturation absentes/incohérentes et achats concurrents. Aucune suppression du client Stripe ou des archives de facturation n’est simulée comme accomplie.
6. **Comptes liés à une classe.** Le refus de suppression automatique protège les autres élèves, mais #15 remplace le formulaire de demande par un message invitant à contacter l’assistance. Préserver un moyen de déposer la demande dans l’application pour ces comptes exclus (réutiliser la RPC manuelle et sa réauthentification), avant activation. Le patch ne prétend pas résoudre ce parcours complet.

Cas Apple + Stripe : `family_subscription_for` fait un `UNION ALL` puis `LIMIT 1`, ce n’est pas un inventaire de facturation. Le correctif affiche donc l’avertissement Apple même si le droit retenu est Stripe. Le backend conserve la recherche Stripe séparée. L’interface générale de gestion reste centrée sur un droit ; une vue listant séparément les deux fournisseurs est à prévoir pour les situations mixtes.

## Demandes antérieures

Les demandes `pending`/`processing` restent sous leur référence et leur date limite originales ; aucune migration destructive n’est proposée. Continuer le suivi quotidien dans Admin → Support client avec rôle admin actif et MFA. Ne pas exiger une nouvelle demande ni repousser l’échéance. Le reçu subsiste au rechargement via une lecture propriétaire RLS. Un échec de lecture ne signifie pas « aucune demande ».

L’ancien schéma supprime la demande uniquement avec la suppression réelle d’`auth.users`. Le correctif empêche une suppression immédiate pour une demande déjà observée et laisse l’opérateur suivre le guide manuel. Il ne faut pas laisser l’opérateur et un appel immédiat démarrer simultanément : l’exclusion transactionnelle reste à réaliser.

Aucune lecture des demandes réelles n’a été faite : leur nombre et leurs échéances actuelles restent inconnus. Vérification en lecture seule à effectuer par l’administrateur habilité via `admin_list_account_deletions()` ; contrôler `pending`, `processing` et dépassements d’échéance sans diffuser les emails dans un rapport général.

## Validation effectuée

Commande reproductible :

```sh
npm install --ignore-scripts --package-lock=false --no-audit --no-fund
npm run test:account-deletion-safety
```

**58 tests réussis**, aucun échoué : noyau de suppression, client, routage Apple/Stripe web/natif, maintien de l’avertissement après succès, refus de la confirmation Apple manquante, conservation des anciennes demandes, lecture indisponible, isolation et permissions/RLS sur PostgreSQL en mémoire, droits Apple, parcours de connexion/public.

JavaScript `km-auth.js` et scripts inline de `Compte.dc.html` parsés. Vérification du diff et de l’application du patch sur le main figé. Les tests PostgreSQL exécutent les migrations de demandes et d’Apple dans un schéma de test simplifié ; ils ne valident pas l’ensemble des cascades de production. Les tests du noyau remplacent Auth, Stripe et Storage par des doubles. Les tests de dialogue utilisent un DOM simulé. Le scénario « Apple seul » prouve la logique du noyau, pas le comportement du SDK Stripe en production.

L’ancien script `account-deletion.browser-check.cjs` cible le formulaire retiré par #15 et ne constitue plus un test de la nouvelle UI. Aucun rendu Playwright ou test iOS réel n’a été effectué (Chromium non installé). Pas de compilation Deno de la fonction Edge dans cette session.

## Matrice de validation restant à exécuter

| Vérification | Automatisable sans compte réel | Compte jetable / staging requis |
|---|---|---|
| Avertissement, lien, confirmation, succès/erreur, anciennes demandes | Exécuté avec doubles ; compléter le navigateur réel et mobile | iPhone/iPad : ouverture native et retour dans le dialogue |
| Auth/MFA/isolation familiale | Noyau et RLS de test exécutés | Auth Supabase réelle : session expirée/révoquée, MFA, autre famille témoin |
| Cascades complètes | Charger toutes les migrations dans une DB isolée et comparer le catalogue | Vérifier utilisateur, chaque enfant, progrès, créations, tickets et relations après effacement du compte jetable |
| Storage | Doubles + injection de panne, pagination et inventaire à compléter | >100 objets, sous-dossiers, upload simultané, URL signée/JWT restant ; famille témoin intacte |
| Stripe | Doubles, événements et pannes simulables | Stripe test mode : plusieurs abonnements/statuts, facture en attente, échec après annulation, notifications retardées |
| Apple | Droits/ownership/RLS testés localement | Sandbox/TestFlight autorisé : actif, résilié, expiré, remboursement, restauration, suppression avant résiliation ; aucun achat réel |
| Deux fournisseurs | Fixtures possibles sans réseau | Compte de test avec Apple Sandbox + Stripe test ; annulation Stripe vérifiée séparément d’Apple |
| Reprise/concurrence | Injecter timeout à chaque étape ; deux appels simultanés | Déconnexion réseau après succès serveur, reprise et synchronisation avec l’opérateur |

Déployer ensemble le contrat client/serveur seulement après ces corrections et validations : un ancien backend pourrait ignorer la nouvelle confirmation ou le contrôle des demandes. Le fait que #15 déclare le backend déjà déployé rend cette vérification particulièrement importante. Ne pas exposer l’action immédiate en production sur la seule base de ces 58 tests.

## Livrable

`pr15-account-deletion-safety.patch` est un diff complet contre `main@267275a`, intégrant les ajouts de #15 et les corrections décrites. **Ce n’est pas un patch incrémental à appliquer directement à la branche #15 ancienne.** Il préserve les autres changements de main. Les fichiers proposés sont aussi présents dans ce checkout local pour examen. Rien n’a été envoyé sur GitHub.
