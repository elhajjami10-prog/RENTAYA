# Rentaya

Plateforme de location de voitures entre particuliers et professionnels au Maroc.
Les fonctionnalités reprennent celles de Getaround, sans les véhicules connectés : les clés se remettent en main propre et l'état des lieux se fait dans l'application.

| Dossier | Contenu | Technologies |
|---|---|---|
| `backend/` | API REST, règles métier, paiements, tâches planifiées | Node.js 22, Express, Prisma, PostgreSQL |
| `mobile/` | Application conducteur et propriétaire, pour **iOS, Android et Web** | Expo SDK 54, React Native, Expo Router |
| `admin/` | Back-office de l'équipe Rentaya | React, Vite |
| `brand/` | Logo d'origine | — |

## Démarrage rapide (développement)

```bash
# 1. Base de données
docker compose up -d            # ou un PostgreSQL 16 local

# 2. API (http://localhost:4000)
cd backend
cp .env.example .env
npm install
npx prisma db push              # crée les tables
npm run db:seed                 # 60 voitures de démonstration dans 12 villes
npm run dev

# 3. Application (web : http://localhost:8081 — mobile : scanner le QR code avec Expo Go)
cd ../mobile
cp .env.example .env
npm install
npx expo start

# 4. Back-office (http://localhost:5173)
cd ../admin
npm install
npm run dev
```

Comptes de démonstration :

| Rôle | E-mail | Mot de passe |
|---|---|---|
| Admin | admin@rentaya.ma | Admin2026! |
| Conductrice vérifiée | salma@rentaya.ma | Rentaya2026! |
| Propriétaire particulier | youssef@rentaya.ma | Rentaya2026! |
| Agence pro (Marrakech) | atlas@rentaya.ma | Rentaya2026! |

En développement, les codes SMS et e-mail s'affichent dans la console de l'API. Le paiement par carte ouvre un **simulateur CMI** tant que les identifiants CMI ne sont pas renseignés.

Tests : `cd backend && npm test`. Vérification des traductions : `cd mobile && npx tsx scripts/check-i18n.ts`.

## Fonctionnalités

### Conducteur
- Recherche par ville ou autour de moi, avec dates et heures, en liste ou sur carte.
- Filtres : catégorie, boîte, carburant, places, prix, réservation instantanée, livraison, kilométrage illimité, particulier ou pro, équipements. Tri par pertinence, prix, note ou nouveauté.
- Fiche voiture : photos, caractéristiques, équipements, conditions (km inclus, caution, âge minimum, carburant, annulation), zone approximative, avis, profil du propriétaire (taux et délai de réponse).
- Réservation instantanée ou demande au propriétaire, qui a 24 h pour répondre.
- Trois formules d'assurance avec franchise dégressive, livraison à une adresse ou à l'aéroport, code promo, crédit Rentaya.
- Paiement par carte via **CMI (3D Secure)**, ou par **Wafacash, Cash Plus ou virement** avec envoi du reçu, validé par l'admin.
- Vérification du profil : CIN ou passeport, permis recto/verso, selfie, téléphone par SMS. L'âge et l'ancienneté du permis sont contrôlés selon les exigences de chaque voiture.
- **État des lieux** de départ et de retour : au moins 4 photos, kilométrage, carburant, propreté, dommages par zone, double signature sur le téléphone.
- Prolongation (accord du propriétaire puis paiement), annulation selon la politique (flexible, modérée ou stricte), déclaration de sinistre, assistance 24h/24.
- Frais calculés au retour (km supplémentaires, carburant, retard, nettoyage) ou déclarés par le propriétaire (amendes, péages), que le conducteur accepte ou conteste.
- Contrat de location et facture imprimables en PDF, avis notés par critère, favoris, messagerie avec photos, notifications push et in-app, parrainage, historique des paiements, centre d'aide, support.

### Propriétaire (particulier ou pro)
- Annonce en 6 étapes, avec un prix conseillé (tarification intelligente), des réductions à la semaine et au mois, la caution, les km inclus, la livraison et les règles. Documents du véhicule : carte grise, assurance, visite technique.
- Calendrier : blocage de dates et prix personnalisés jour par jour.
- Acceptation ou refus des demandes, des prolongations et des annulations. L'annulation d'une location confirmée entraîne une pénalité.
- Tableau des revenus (par mois et par voiture), RIB, versements automatiques après chaque location, relevé imprimable.
- Compte pro : raison sociale et ICE, affichés sur le contrat.

### Back-office
Tableau de bord avec volume d'affaires, revenus et files d'attente. Il permet aussi de :
- vérifier les profils et les documents, suspendre un compte ou ajuster son crédit ;
- modérer les annonces ;
- suivre les réservations (détail complet, messages, états des lieux, annulation par Rentaya) ;
- valider les paiements manuels et suivre les remboursements ;
- gérer les versements aux propriétaires, les sinistres, l'arbitrage des frais contestés, le support et la modération des avis ;
- gérer les codes promo, les formules d'assurance et le centre d'aide en 3 langues ;
- régler tous les paramètres : commission, frais de service, délais, pénalités, bonus de parrainage, RIB Rentaya.

### Langues
Français, arabe (interface de droite à gauche) et anglais. La langue de l'appareil est détectée automatiquement et peut être changée dans les paramètres.

### Volontairement exclu
- **Getaround Connect** (ouverture de la voiture sans clé, boîtier connecté) : à ajouter quand vous aurez un fournisseur de boîtiers.

## Mise en production — ce qu'il vous reste à fournir

| Élément | Où le configurer | Notes |
|---|---|---|
| **Contrat marchand CMI** (`CMI_CLIENT_ID`, `CMI_STORE_KEY`) | `backend/.env` | Mettre `CMI_GATEWAY_URL` sur l'URL de production fournie par le CMI. L'URL de callback est `https://<api>/api/payments/cmi/callback`. |
| **Assureur partenaire** | Back-office → Assurances | Les 3 formules fournies sont des exemples : alignez prix et franchises sur votre contrat. |
| **Fournisseur SMS** | `backend/src/lib/notify.ts` → `sendSms` | Pour les codes de vérification du téléphone. |
| **E-mail (SMTP)** | `backend/src/lib/notify.ts` → `sendEmail` | Pour la réinitialisation du mot de passe. |
| **Clé Google Maps Android** | `mobile/app.json` → `android.config.googleMaps.apiKey` | Nécessaire pour la carte sur Android. iOS utilise Apple Plans, le web utilise OpenStreetMap. |
| **Projet EAS** (Expo) | `npx eas-cli init` dans `mobile/` | Pour les notifications push et la publication sur l'App Store et le Play Store (`eas build`, `eas submit`). |
| **Stockage des fichiers** | `backend/src/middleware/upload.ts` | En local par défaut (`backend/uploads/`). En production, prévoir un disque persistant ou un stockage S3. |
| **Domaine et HTTPS** | `PUBLIC_API_URL`, `PUBLIC_APP_URL`, `JWT_SECRET` | Le `JWT_SECRET` doit être long et secret. |
| **RIB Rentaya et support** | Back-office → Paramètres | Affichés aux clients pour les virements, Wafacash et Cash Plus. |
| **Textes légaux** | `mobile/src/locales/*.ts` → `legal` | CGU et confidentialité (loi 09-08, CNDP) : à faire valider par un juriste. |

## Architecture de l'API

- `src/routes/` : `auth`, `users`, `cars` (recherche, annonces, calendrier), `bookings` (cycle de vie complet), `payments` (CMI et paiements manuels), `messages`, `account` (notifications, favoris, portefeuille, revenus, support), `public`, `admin`.
- `src/lib/pricing.ts` : calcul du prix, réductions, commission, remboursements d'annulation, prix conseillé.
- `src/lib/cmi.ts` : formulaire CMI 3D_PAY_HOSTING et hash SHA-512 (ver3), vérification du callback.
- `src/jobs/scheduler.ts` : expiration des demandes et des réservations non payées, rappels avant départ et retour, génération des versements.

Cycle de vie d'une réservation :
`REQUESTED → PENDING_PAYMENT → CONFIRMED → IN_PROGRESS (état des lieux de départ) → COMPLETED (état des lieux de retour)`, avec en parallèle `DECLINED`, `EXPIRED` et `CANCELLED_*`.

## Démo en ligne (GitHub Pages)

Le dossier `docs/` contient une version de démonstration autonome (sans serveur, données fictives) :
- page d'accueil : `docs/index.html`
- application : `docs/demo/` (générée avec `WEB_BASE_URL=/RENTAYA/demo EXPO_PUBLIC_DEMO=1 EXPO_PUBLIC_API_URL=/ npx expo export --platform web --output-dir ../docs/demo` depuis `mobile/`)
- back-office : `docs/admin/index.html` (généré avec `VITE_DEMO=1 npx vite build && python3 build-demo-html.py …` depuis `admin/`)

Activation : GitHub → Settings → Pages → « Deploy from a branch », dossier `/docs`.
