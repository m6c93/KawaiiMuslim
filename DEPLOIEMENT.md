# Kawaii Muslim — Site web (guide de mise en ligne)

Ce dossier contient un site **entièrement fonctionnel en mode démo** : tu peux
l'ouvrir et cliquer partout (inscription, connexion, abonnement, profils,
lecture). Les comptes sont pour l'instant stockés **dans le navigateur**
(localStorage), donc c'est parfait pour montrer/tester, mais pas encore pour de
vrais clients qui paient.

## Les pages

| Fichier | Rôle |
|---|---|
| `Kawaii Muslim - Site Web.dc.html` | Page d'accueil publique (à servir comme `index`) |
| `Inscription.dc.html` | Création de compte + choix de formule |
| `Connexion.dc.html` | Connexion |
| `Compte.dc.html` | Abonnement / facturation + profils enfants |
| `Bibliotheque Kawaii Muslim.dc.html` | La bibliothèque (accès aux livres) |
| `books/tawakkul.html` | Le livre feuilletable |
| `km-auth.js` | Le "moteur" de comptes (démo → à brancher) |
| `brand/` | Le logo, la mascotte, les visuels |
| `support.js` | Runtime nécessaire aux pages (ne pas supprimer) |

## Mettre en ligne (version démo, tout de suite)

1. Crée un compte gratuit sur **Vercel**, **Netlify** ou **Cloudflare Pages**.
2. Glisse-dépose tout ce dossier.
3. Branche ton domaine `kawaiimuslim.com`.
   → Le site est en ligne. (Les comptes restent locaux à chaque navigateur.)

## Passer en VRAI (comptes + paiement réels)

Tout se passe dans **`km-auth.js`** : les fonctions à compléter sont marquées
`=== BRANCHEMENT ... ===`. Il faut deux services (tiers gratuits suffisants
pour 100 clients) :

1. **Supabase** — comptes + base de données.
   - Créer un projet, activer l'authentification e-mail.
   - Remplacer `signup` / `login` / `logout` par les appels
     `supabase.auth.*`, et stocker les profils/enfants dans une table.
2. **Stripe** — abonnements.
   - Créer 2 prix : mensuel 6,99€ et annuel 59€, avec 7 jours d'essai.
   - Dans `signup`, rediriger vers **Stripe Checkout** ; gérer la résiliation
     dans `cancel` / `resume`.
3. **Protéger les livres** : héberger les fichiers des livres dans Supabase
   Storage avec accès réservé aux abonnés (pas en accès public).

Un développeur peut faire ce branchement en quelques jours sans toucher au
design : toute l'interface est déjà prête.
