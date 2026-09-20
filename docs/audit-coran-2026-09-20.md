# Audit de l’application Coran — 20 septembre 2026

Audit fonctionnel et corrections sur la plateforme professeur/élève/école et sa présentation. Les essais ont utilisé uniquement des données fictives. Aucun compte réel, message privé ou jardin existant n’a été modifié.

## Problèmes corrigés

1. **Mauvais espace à l’ouverture d’un lien.** Le lien de présentation de Maryam pouvait ouvrir l’espace d’une session professeur mémorisée. Les personnages de présentation utilisent désormais leur démonstration locale. Les liens partagés contenant un identifiant élève sont résolus dans la bonne classe et ouverts avec le seul accès de cet élève. Un élève introuvable affiche un message explicite au lieu de retomber sur le professeur. Les liens de l’école gardent la classe et l’élève sélectionnés.
2. **École bloquée par une invitation expirée ou une connexion indisponible.** Chaque professeur est chargé séparément. Les autres restent consultables ; le suivi incomplet est signalé. Les anciennes données d’un accès expiré ne sont pas présentées comme actuelles, et son lien n’est pas renouvelé silencieusement.
3. **Historique d’appel mal suivi lors d’un transfert local.** Le changement de professeur dans l’essai local transfère aussi les présences. Le partage d’un professeur de démonstration copie les appels complets précédents sans écraser ceux déjà modifiés en ligne. Les appels historiques incomplets ne sont pas importés automatiquement ; ils restent dans le stockage local.
4. **Totaux de présences trompeurs.** Les anciennes classes et les élèves retirés ne sont plus comptés dans le résumé courant. Après une nouvelle inscription, un ancien appel devient « Appel à compléter » : le nouvel élève reste « Non renseigné », jamais absent par défaut.
5. **Ancienne erreur d’envoi encore visible après une réussite.** Reproduit avec une véritable coupure réseau du navigateur : la récitation était reçue, mais « L’envoi n’a pas été sauvegardé » restait affiché. Une nouvelle tentative efface maintenant l’erreur précédente et l’avertissement de navigation devenu inutile. La confirmation de réussite attend toujours la réponse du serveur.

## Essais effectués pendant cet audit

- 70 tests Node réussis : progression, validations professeur, commentaires, messages privés, synchronisation et conflits, audio, répétitions, 114 sourates et 6 236 références de versets, couverture des 30 Juz’, placement et notifications. Deux vérifications concernent le lecteur Moushaf local non publié ; ce résultat ne certifie pas sa source religieuse.
- Navigateur, version publique avant correction : reproduction du lien Maryam ouvrant le professeur ; lecture, sélection des versets 2 à 3, répétitions, pause, traduction et phonétique indépendantes.
- Navigateur, version de correction isolée : classe et élève fictifs créés ; activation de la messagerie ; ouverture du Juz’ 30 ; choix déjà ouverts désactivés ; envoi des versets 5 à 6 ; validation de 3/6 versets et arbre à 50 % ; appréciation globale et commentaire sous le verset 5 ; réception du message écrit côté professeur ; consultation des trois onglets de suivi du directeur.
- Mise en page dans des cadres de navigateur à 390 et 820 pixels : pas de débordement horizontal observé pour jardin/détail, Coran, récitation, messagerie et direction. Captures inspectées. Il s’agit de contrôles responsive, pas d’une certification Safari/iPhone.
- Notification d’arbre : après ouverture, « nouveau message » disparaît. Position d’arbre modifiée au clavier de 78 % à 80 %, puis retrouvée après rechargement.
- Serveur réel : transaction de test annulée après réussite des assertions. Professeur : classe et appel enregistrés, conflit d’édition refusé. Directeur : classe et présences visibles. Élève : uniquement ses données, position d’arbre sauvegardée, fausse validation rejetée, aucun accès aux présences ou à l’école. Compte extérieur refusé. Administration inaccessible au professeur. Licence expirée bloquante. Audio d’un autre élève inaccessible.
- Serveur de démonstration : transaction de test annulée après réussite. Lien élève de 48 h stable lors d’une recopie ; classe isolée ; tentative de validation élève rejetée ; message reçu par le professeur sans usurpation de rôle ; accès aux messages/audio d’un autre élève refusé ; octets audio de test récupérables par le professeur ; messagerie désactivée bloquante ; accès expiré refusé.

## Limites restant à vérifier

- Le compte administrateur réel puis trois connexions distinctes directeur/professeur/élève ont été testés dans le navigateur avec le serveur de production (voir les compléments ci-dessous). Les comptes fictifs étaient préconfirmés : la réception des e-mails d’inscription et de récupération de mot de passe reste à vérifier dans une boîte e-mail réelle.
- La qualité du microphone physique et une récitation humaine restent à essayer. Après autorisation de poursuivre les tests, les vrais enregistrements MediaRecorder, permissions du navigateur et échanges réseau ont été testés avec le périphérique audio simulé de Chrome. Cela ne certifie pas le matériel personnel ni Safari/iPhone.
- La direction de la démonstration garde sa liste de professeurs sur le navigateur utilisé. Le transfert d’une classe déjà partagée entre professeurs reste réservé aux vrais comptes École. Ces limites de la démonstration ne sont pas présentées comme une synchronisation complète équivalente au produit réel.
- Une erreur MutationObserver sans origine a été relevée uniquement au rechargement du banc d’essai à cadres. Les parcours continuaient à fonctionner et le test direct de l’application ne présentait pas cette erreur. Son origine n’est pas établie : elle n’est pas classée comme un bug produit corrigé.
- Le Moushaf reste exclu de la publication, conformément à la demande du propriétaire.

## Vérifications reproductibles

`node --test scripts/classroom*.test.mjs scripts/coran*.test.mjs`

Régressions ajoutées dans `scripts/classroom-audit.test.mjs` : navigation des présentations, lien élève invalide, session professeur indisponible, conservation d’appel, transfert local et calcul des présences après changement d’effectif.

## Complément : enregistrement et accès

- **Serveur de démo réel, aucune réponse réseau simulée :** professeur et élève fictifs dans des navigateurs séparés ; invitation école, création de classe, ouverture du Juz’ 30 et consigne An-Naas 5–6. Enregistrement, réécoute, nouvel essai, brouillon protégé, coupure réseau, reprise et réception d’un seul enregistrement côté professeur. Le fichier renvoyé par le serveur a effectivement été décodé et joué (temps de lecture observé), pas seulement affiché.
- **Retour professeur :** récitation marquée écoutée sans validation automatique ; commentaire vocal enregistré sous le verset 5 puis reçu et joué par l’élève. Message vocal privé envoyé par l’élève et joué côté professeur. Classe retrouvée dans le suivi du directeur. Les comptes fictifs utilisent les durées d’expiration ordinaires de la démo ; aucun compte client n’est utilisé.
- **Permissions réelles de Chrome, périphérique simulé :** refus du microphone avec message explicite, nouvelle autorisation sans recharger, annulation, nouvel enregistrement, fin et suppression du brouillon. Chaque piste microphone est fermée après annulation et après fin.
- **Interface du portail réel avec connexion/serveur doublés pour le test :** consigne groupée, rôle élève, envoi échoué après téléversement, brouillon conservé, actualisation, confirmation retardée, nouvel envoi sans doublon, lecture professeur et réponse audio. Ces essais ne sont pas présentés comme une véritable connexion Supabase.
- **Site réel, navigateur anonyme :** interface, administration et sécurité redirigent vers la connexion. Une invitation mal formée ne peut pas être acceptée.
- **Responsive :** contrôles supplémentaires à 360, 390 et 820 pixels, captures inspectées, sans débordement horizontal global. Aucune erreur JavaScript non interceptée sur le parcours terminé.

Scripts : `classroom-live.browser-check.cjs`, `classroom-recording-online.browser-check.cjs`, `classroom-microphone.browser-check.cjs`, `classroom-anonymous.browser-check.cjs`. Les essais en ligne ciblent uniquement les tables isolées de démonstration. Le rapport JSON détaillé du parcours réussi est conservé dans `../audit-recording-online-fixed/results.json`.

**État à cette étape de l’audit :** vérification Authenticator encore attendue (effectuée depuis, voir le dernier complément) et cycle complet d’invitations de production non vérifié. La connexion personnelle a révélé le problème serveur décrit ci-dessous. Après correction, elle atteint la vérification de sécurité.

## Publication
Correctifs publiés sur main : 26504f6568bdf853cce6f15a29644cb9353101d1. Déploiement Vercel réussi. Le lien public ?student=Maryam a été rouvert après déploiement avec la session professeur précédemment présente : il ouvre bien le jardin de Maryam, et la navigation garde le contexte de présentation. Capture finale du jardin inspectée : arbres entiers, légendes lisibles, oiseaux visibles. Aucun changement de schéma serveur pendant cet audit.

Complément publié : 725cc9d218bd913300314ff02af98a3cb7f017d2. Déploiement Vercel réussi. Les dix étapes du parcours audio ont ensuite été rejouées avec succès sur https://presentation.coran.kawaiimuslimworld.com, serveur réel de démonstration et microphone Chrome simulé. Résultat : ../audit-recording-published/results.json. Le vrai compte reste déconnecté et le microphone physique n’a pas été testé.

## Connexion personnelle : erreur serveur corrigée

La connexion réelle a ensuite été effectuée. L’espace affichait `column reference "o.id" is ambiguous` : les alias SQL des tables dans `context` et `admin_snapshot` partageaient les noms des variables de ligne PL/pgSQL. Les essais avec connexion simulée ne couvraient pas cette requête serveur.

Correction ciblée appliquée en production via `supabase/quran-context-aliases.sql`. Elle remplace uniquement les alias de ces deux lectures et conserve le reste de la fonction, les permissions et les contrôles MFA. Les sources des migrations initiales ont également été corrigées pour les futures installations.

Test transactionnel réussi puis annulé : contexte professeur limité à son organisation, contexte élève limité à son compte, licence active, interdiction d’administration pour le professeur, MFA obligatoire pour l’administrateur, lecture correcte des organisations/licences/classes/élèves après MFA. Les identités temporaires n’avaient aucun mot de passe et aucune donnée d’essai n’a été conservée. Régression : `scripts/classroom-context-security.sql`.

Après application, rechargement du vrai compte : l’erreur a disparu, l’écran « Votre accès administrateur » demande correctement le code Authenticator. L’administration réelle reste en attente de cette action personnelle ; aucune double vérification n’a été contournée.

## Compte administrateur réel après double vérification

Le propriétaire a terminé personnellement la vérification Authenticator. L’administration s’est chargée sans erreur. Les structures, professeurs, classes, élèves et licences étaient initialement à zéro ; les exemples de démonstration ne sont pas importés dans cet espace.

Parcours effectué dans le navigateur connecté, avec les vrais services en ligne :

- Création d’une structure explicitement fictive, initialement suspendue.
- Activation d’une licence d’essai de deux places, du 20 au 22 septembre ; valeurs retrouvées après navigation.
- Préparation d’une invitation responsable sur une adresse example.invalid, puis révocation visible dans Accès. Aucun e-mail envoyé.
- Création d’une classe et d’un élève fictifs. Retour à l’administration : une structure, une classe, un élève et une licence active, conformément aux données enregistrées.
- Appel du 20 septembre enregistré avec une absence fictive. Passage de la licence en formule École : classe et élève retrouvés ; vue Présences indiquant 1/1 appel complet et l’absence attendue.
- Invitation nominative d’un professeur depuis l’interface école : lien affiché et invitation en attente. Aucune invitation acceptée, aucun compte supplémentaire connecté.
- Historique consulté : création, licence, invitation, révocation, classe et appel correctement remontés.

Deux retouches de lisibilité : le lien de présentation ne mentionne plus de tableau de bord administrateur et ne contient plus view=admin ; les événements d’appel, d’attribution de professeur et de messagerie ont des libellés français dans l’historique. Les contrôles d’accès serveur restent inchangés.

La structure fictive, ses invitations, sa licence, sa classe, son élève, son appel et ses lignes d’historique ont été retirés après vérification de leur identifiant exact, du nom de test et de l’absence de compte lié. Aucun profil utilisateur ni donnée de démonstration n’a été supprimé. Les tests du navigateur ont été menés avec le rôle administrateur : ils ne remplacent pas le cycle de connexion distinct de chaque rôle ni un essai avec le microphone physique.

## Comptes directeur, professeur et élève distincts

À la demande explicite du propriétaire, trois comptes d’authentification temporaires ont ensuite été créés via le gestionnaire d’utilisateurs, avec des adresses example.invalid, des mots de passe aléatoires et des e-mails préconfirmés. Aucun e-mail n’a été envoyé. Chaque rôle utilise un contexte Chrome indépendant, une vraie connexion par mot de passe et les services de production, sans imitation des réponses du serveur ni modification des jetons d’authentification.

Parcours vérifiés :

- Le directeur accepte son invitation personnelle et ouvre son école. Il invite le professeur, qui accepte avec sa propre adresse, crée sa classe, ouvre le Juz’ 30 et active la messagerie.
- Le professeur ajoute un élève et prépare son lien. L’élève se connecte avec son propre compte, accepte l’invitation et ne voit que son jardin. La classe apparaît dans l’espace directeur.
- La consigne An-Naas 5–6 est reçue par l’élève. Il enregistre, réécoute et envoie un audio avec le microphone simulé de Chrome. Le professeur reçoit un seul enregistrement et lit réellement le fichier privé. Le statut « écouté » ne valide pas la sourate.
- Le professeur enregistre un commentaire vocal et écrit sous le verset 5. L’élève les reçoit et joue l’audio. Les messages privés écrits circulent dans les deux sens.
- L’absence saisie par le professeur remonte au directeur. La validation professeur de 3/6 versets conserve un arbre incomplet ; la validation entière enregistre les six versets et la date de fin. Le jardin persiste au rechargement, sans débordement horizontal à 390 et 820 pixels.
- Administration et RPC administrateur interdits aux trois rôles. Direction interdite au professeur et à l’élève. Présences non accessibles à l’élève. Deux fiches élèves dans la classe, mais une seule dans la réponse serveur de l’élève connecté ; conversation de l’autre élève refusée.
- Une tentative directe de modification élève des versets validés, de la date de validation et des appréciations professeur est ignorée par le serveur : les valeurs autorisées sont conservées. La licence de deux places refuse un troisième élève. Déconnexion/reconnexion de l’élève : même jardin sauvegardé.

Le script d’essai a rencontré deux problèmes de sélection/attente : un formulaire utilisé avant l’installation de son gestionnaire et deux boutons portant la même action de boîte de réception. Après correction du banc d’essai, les parcours ont été repris sans créer de deuxième enregistrement. La vérification du formulaire avant initialisation a révélé le vrai problème de chargement ci-dessous.

### Correction de la connexion pendant le chargement

Lorsque account.js n’était pas encore chargé, les formulaires HTML pouvaient être soumis nativement en GET. Reproduction isolée avec de faux identifiants non secrets : la requête contenant les champs de connexion dans l’URL a été détectée et bloquée avant envoi. Les formulaires sont désormais désactivés par un fieldset tant que les gestionnaires JavaScript ne sont pas installés ; leur méthode HTML est POST en défense supplémentaire. Un message indique le chargement sécurisé.

Régression automatisée : script absent/retardé, champs et bouton inactifs, aucune soumission ; initialisation réussie, champs actifs avec gestionnaires ; pas de débordement téléphone/tablette. Les trois comptes temporaires ont aussi réussi une vraie connexion serveur avec les fichiers corrigés substitués dans leur navigateur isolé. Test reproductible : scripts/classroom-auth-loading.browser-check.cjs.

### Nettoyage des essais

Les fichiers audio de la classe fictive ont été supprimés par l’interface de stockage. La structure et ses dépendances ont été retirées dans une transaction limitée à son identifiant, avec vérification du nom de test, des deux élèves et des membres attendus. Les trois comptes ont été supprimés par le gestionnaire d’authentification, sélectionnés par leurs identifiants exacts.

Vérification serveur après nettoyage : zéro compte, profil, session, école, classe, élève, message ou fichier audio correspondant à cet essai. Les comptes et données préexistants restent inchangés. Les mots de passe, invitations et sessions du banc d’essai ne font pas partie du dépôt Git.

Les trois anciennes sessions de navigateur ont ensuite été réouvertes : retour imposé à la connexion. Une nouvelle tentative avec chacun des trois anciens mots de passe est refusée. Les fichiers locaux de mots de passe, invitations et sessions ont été retirés après cette vérification.

Limites : microphone physique, Safari/iPhone et réception/récupération par e-mail non certifiés. Les comptes ont été préconfirmés pour éviter tout envoi à une personne réelle. Le Moushaf reste exclu de la publication.
