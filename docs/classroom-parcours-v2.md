# Parcours Coran professeur et élève — 18 septembre 2026

## Modifications

- Élève : prochaine consigne depuis le jardin, écoute du passage conseillé, transfert de ce passage vers l’enregistrement, sourates prioritaires en début de collection.
- Professeur : vue synthétique de la classe, récitations regroupées, accès au prochain élève, consignes envoyées à plusieurs élèves avec sélection partielle.
- Audios réels : stockage et lecture privés via l’adaptateur cloud pour les récitations et les commentaires du professeur. La démonstration conserve son stockage local séparé.
- Sauvegarde : confirmation attendue avant d’annoncer un envoi réussi, essai conservé en cas d’échec, réutilisation du même identifiant audio lors d’un nouvel essai. Les révisions du serveur empêchent d’écraser silencieusement une autre modification.
- Navigation protégée pendant un enregistrement ou l’envoi ; actualisation sans perdre l’essai. Les formulaires et le commentaire audio sont conservés lors d’une actualisation manuelle après erreur.
- Interface : palette crème/sauge, cartes de prochaine action, typographies cohérentes dans les pages réelles et de démonstration, en-tête téléphone corrigé. Les animations restent désactivables et respectent la réduction des mouvements.
- Démonstration publique : styles corrigés et liens vers chaque compte élève fonctionnels.
- Les 114 sourates, le texte, les références audio et les règles du jardin familial n’ont pas été modifiés.

## Vérifications réalisées

- 33 tests unitaires réussis : progression, corpus de 6 236 versets, audio, sauvegardes sérialisées, erreurs réseau, révisions et chemins audio privés.
- `classroom-motion.browser-check.cjs` : navigation persistante, micro synthétique, validation, envoi/écoute, réduction des mouvements et tailles 360/820/1280.
- `classroom-live.browser-check.cjs` : véritables pages du portail avec deux comptes isolés et un serveur RPC/stockage simulé ; consigne groupée → passage → micro → panne de sauvegarde → réessai → écoute professeur → commentaire audio reçu par l’élève. Démonstration publique et lien vers Maryam vérifiés. Ce test ne remplace pas une connexion réelle de bout en bout.
- `platform-admin.browser-check.cjs` sur l’aperçu administratif : navigation, licences, formulaires, recherche, rapports et tailles 320/390/820/1440.
- Vérification visuelle des captures, syntaxe des modules et `git diff --check`.

## Base de données et publication

`supabase/quran-classroom-reliability.sql` met à jour la fonction de sauvegarde et ferme les anciens accès directs aux tables Coran. Aucun compte ou contenu existant n’est supprimé. Les écritures passent par les contrôles de rôle et de licence du portail.

Le premier essai transactionnel a détecté les anciens droits de lecture directe. Après autorisation explicite de l’utilisateur, la migration complète et tous les contrôles de `scripts/classroom-security.sql` ont réussi dans une transaction annulée le 18 septembre 2026 : séparation des élèves, rôle professeur, invitations à usage unique, révisions concurrentes, accès aux audios, bornes des versets et capacité/expiration des licences.

La migration seule a ensuite été appliquée sur Supabase. La vérification finale confirme : lecture directe des données élèves fermée, portail toujours exécutable par les comptes connectés et bornes des sourates correctes. Les données fictives des tests ont été annulées par ROLLBACK.

La publication web utilise ce commit sur la branche principale. Les parcours navigateur ont été testés avec des comptes isolés et un service simulé ; les contrôles de rôle ont été testés séparément sur le vrai moteur de base de données. Aucun mot de passe utilisateur réel n’a été utilisé pour prétendre à une connexion réelle de bout en bout.
