# Messagerie facultative — 19 septembre 2026

Le professeur coche « Activer la messagerie » à la création de la classe, ou change
ce choix dans la classe. Par défaut, les classes réelles existantes restent désactivées.
Le quatrième onglet de l’élève n’apparaît que si l’option est active. Tous les âges
sont concernés : aucune création de compte parent distinct n’est nécessaire.

Chaque élève dispose d’une conversation privée avec le professeur. Texte (3 000
caractères), vocal (3 minutes), réécoute avant envoi et compteur de messages non lus.
Le professeur ouvre la conversation depuis la fiche élève. Désactiver conserve
l’historique ; réactiver le rend à nouveau accessible. Les appréciations sur les
arbres, commentaires par verset, récitations et validations ne sont pas modifiés.

La présentation utilise le même composant. Seule la classe fictive Les oliviers est
préactivée, avec un exemple de message pour Maryam. Ces données et audios restent
dans le navigateur, séparés des comptes réels.

## Stockage et autorisations

`supabase/quran-messaging.sql` crée trois tables avec RLS et sans droits de lecture
ou d’écriture directs pour les clients. La fonction authentifiée `quran_messaging`
contrôle le compte actif, la classe, la licence et l’élève pour chaque opération.
Le serveur attribue l’auteur, le rôle et la date ; le client ne peut pas les imposer.
Les audios utilisent le compartiment privé existant et un préfixe distinct par rôle.
Les administrateurs/responsables déjà autorisés par `quran_teach` conservent leur
capacité de gérer la classe ; un professeur extérieur n’y accède pas.

Les échanges ne sont pas inclus dans les sauvegardes de progression : une sauvegarde
de jardin ne peut pas effacer une réponse reçue en parallèle. Les envois sont
idempotents, les curseurs de lecture bornés, les anciens messages paginés par 100.
Les mises à jour sont récupérées toutes les 8 secondes quand la page est visible.
Pas de notification e-mail ou système. Les brouillons écrits sont conservés lors
des changements d’onglet internes ; un brouillon vocal bloque la navigation avant
envoi ou suppression. Une panne d’envoi conserve le brouillon pour réessayer.

## Vérifications

- 21 tests Node : progression, messages sur les arbres, sauvegardes cloud, messagerie.
- Contrôles PostgreSQL dans une transaction annulée : isolation des élèves,
  activation réservée au professeur, rôle attribué par le serveur, absence de doublons,
  curseurs non lus, taille des textes, audios privés, désactivation, historique et licences.
- Ancienne suite `classroom-security.sql` exécutée avec la nouvelle migration : PASS.
- Migration seule appliquée sur Supabase après les tests, sans activer de classe réelle.
- Navigateur : création avec l’option, désactivation/réactivation, aller-retour écrit,
  conservation des échanges, compteur non lu, onglet absent quand désactivé.
- Enregistreur testé sur une page locale isolée avec un son synthétique : arrêt des
  pistes, panne simulée, réessai sans doublon et écoute professeur. Aucun vrai micro
  ou compte réel n’a été utilisé pour prétendre à un test vocal de bout en bout.
- Formats 390 px et 820 px : pas de débordement, quatre onglets lisibles, zone de réponse
  et boutons accessibles. Contrôle visuel et absence d’erreurs JavaScript.
