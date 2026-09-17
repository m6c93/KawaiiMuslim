# Classe Coran — essai administrateur

Entrée : `Admin.dc.html#classroom`, après les contrôles de compte administrateur
et MFA existants. Aucun lien depuis les applications publiques. Aucun déploiement.

Cette première version simule l’enseignant et ses élèves dans la même session
administrateur. Les classes, programmes, arbres, demandes et appréciations restent
dans localStorage, avec une clé propre au compte administrateur. Aucun vrai compte
élève n’est créé et aucun lien d’invitation n’est envoyé. La vue élève est une
prévisualisation, pas une séparation d’autorisations serveur.

Parcours : créer une classe (ou une démonstration), ajouter des élèves, débloquer
un Juz’ ou une sourate, ouvrir un jardin, valider des passages et écrire un message.
La bascule élève permet de placer les arbres, écouter les 114 sourates et demander
une récitation. Les écoutes ne valident rien. Chaque arbre représente une sourate ;
sa progression provient uniquement des versets validés par le professeur. La dernière
validation nécessaire complète l’arbre et conserve sa première date et heure.
Le professeur peut conseiller une plage précise de versets avec une consigne personnelle.
La fiche de l’arbre montre ce passage, les prochains versets non validés et un
historique daté des validations, consignes et appréciations. L’écoute de la consigne
s’ouvre directement au premier verset demandé. L’élève peut signaler une révision
faite ; cela ne valide ni verset ni sourate.
Le lecteur affiche chaque verset de la sourate, avec arabe et traduction. Deux touches
sur les versets définissent un passage inclusif (ex. 2 puis 3), lu dans l’ordre par
la vraie récitation existante. Un bouton lit toute la sourate ; pause, reprise et
arrêt restent sous le contrôle de l’élève. Ce lecteur n’invente pas de surlignage
mot à mot ni d’évaluation de récitation.
La personne choisit également combien de fois le passage entier est récité : choix
rapides ×1, ×3, ×5, ×10 ou nombre personnalisé de 1 à 50. Deux versets choisis avec
×3 suivent 2→3→2→3→2→3. Cela reste un entraînement et ne valide pas l’arbre.
Pour une sourate couvrant plusieurs Juz’, le même arbre et ses acquis sont visibles
dans les parcelles concernées ; l’avancement de la parcelle ne compte que ses versets.

Les illustrations de croissance sont réutilisées du Coran existant. Les comptes
familiaux et leur règle des dix répétitions restent indépendants.

Avant ouverture aux enseignants : persistance serveur, rôles enseignant/élève,
politiques d’accès par classe, invitations individuelles sécurisées, journal de
validation, gestion de l’année scolaire et tests multi-comptes. Ne pas traiter
localStorage ni le contrôle client de rôle comme une autorisation de production.

Tests : `node --test scripts/classroom.test.mjs scripts/coran-v2.test.mjs`.
