FieldOps360  —  Dossier d'Architecture Technique 
v1.0 — CONFIDENTIEL 
© 2026 FieldOps360 — Architecture Technique — Usage Interne 
Page 1 / 24 
FieldOps360 
Dossier d'Architecture Technique 
 
DAT 
Solution Architecture Document 
Version  1.0 
Date  Mars 2026 
Statut  Pour Révision 
Auteur  Architecte Solutions 
Diffusion  Restreinte — Confidentiel 
 
Historique des Révisions 
 
Version 
Date 
Auteur 
Description 
1.0 
Mars 2026 
Architecte 
Solutions 
Création initiale du DAT — version complète 
 
 


FieldOps360  —  Dossier d'Architecture Technique 
v1.0 — CONFIDENTIEL 
© 2026 FieldOps360 — Architecture Technique — Usage Interne 
Page 2 / 24 
1. Synthèse Exécutive 
📌  Objectif du document 
Ce Dossier d'Architecture Technique (DAT) décrit les choix d'architecture retenus pour la solution 
FieldOps360, une plateforme cloud-native de gestion des opérations terrain. Il constitue la référence 
technique opposable pour les équipes de développement, d'infrastructure et de sécurité. 
 
1.1 Positionnement de la Solution 
FieldOps360 est une plateforme SaaS multi-tenant dédiée à la gestion des chantiers BTP et des 
opérations terrain. Elle couvre l'ensemble du cycle opérationnel : planification, exécution, supervision 
temps réel, reporting et traçabilité. 
 
Axe 
Description 
Modèle de 
déploiement 
SaaS Cloud-Native (K3s / Kubernetes) avec isolation multi-tenant par base 
de données 
Architecture 
applicative 
Microservices (5 services) + API Gateway (Traefik) + Frontends découplés 
Surfaces applicatives 
Web App (React/TypeScript), Mobile App (React Native iOS+Android), Admin 
Portal 
Paradigme de 
communication 
REST synchrone (inter-client) + AMQP asynchrone (inter-services via 
RabbitMQ) 
Stratégie de données 
PostgreSQL par tenant, Redis cache, MinIO stockage objet, Jaeger tracing 
distribué 
Sécurité 
Zero Trust, JWT/RBAC, TLS 1.3, chiffrement AES-256, RGPD by Design 
Observabilité 
Stack PLG (Prometheus + Loki + Grafana) + Jaeger distributed tracing 
 
1.2 Contraintes Architecturales Majeures 
• 
Connectivité intermittente : les opérateurs terrain évoluent dans des zones à faible 
couverture réseau. L'application mobile doit fonctionner en mode offline-first avec 
synchronisation différée. 
• 
Multi-tenancy strict : isolation complète des données entre clients (database-per-tenant). 
Aucune fuite de données entre tenants tolérée. 
• 
Performance temps réel : le pointage GPS, la carte des chantiers et les alertes incidents 
nécessitent une latence P95 < 200ms. 
• 
Scalabilité horizontale : la charge peut varier de façon significative (morning peaks lors des 
check-in). Auto-scaling automatisé requis. 
• 
Hétérogénéité technologique : 5 microservices dans 5 langages différents. La gouvernance 
des APIs et des contrats d'interface est critique. 
 
 


FieldOps360  —  Dossier d'Architecture Technique 
v1.0 — CONFIDENTIEL 
© 2026 FieldOps360 — Architecture Technique — Usage Interne 
Page 3 / 24 
2. Vues d'Architecture 
2.1 Vue Logique — Couches Applicatives 
L'architecture est organisée en 4 couches logiques bien délimitées, favorisant la séparation des 
responsabilités et la scalabilité indépendante de chaque composant. 
 
Couche 
Composants 
Rôle 
Présentation 
Web App (React/TS), Mobile App 
(React Native), Admin Portal 
Interfaces utilisateurs, consommateurs 
des APIs REST 
API Gateway 
Traefik (TLS, Routing, Rate Limiting, 
Auth Middleware) 
Point d'entrée unique, terminaison TLS, 
routage vers microservices 
Microservices 
Auth, Project, Resource, Planning, 
Reporting 
Logique métier encapsulée, APIs REST 
indépendantes 
Data Layer 
PostgreSQL, Redis, MinIO, 
RabbitMQ 
Persistance, cache, stockage objet, 
messagerie asynchrone 
 
2.2 Vue des Composants — Microservices 
Service 
Stack 
Port 
#API 
Responsabilités 
Base de 
données 
Auth Service 
NestJS 10 
3001 
12 
AuthN/AuthZ, JWT, RBAC, 
Sessions, Tenants, Audit Log 
auth_db 
(PostgreSQL) 
Project 
Service 
Express.js 4 
3002 
28 
Projets, Équipes, Tâches, 
Incidents, Documents, Rapports 
journaliers 
project_db 
(PostgreSQL) 
Resource 
Service 
FastAPI 0.11 
3003 
16 
Véhicules, Matériels, Stocks, 
Réservations, Alertes 
maintenance 
resource_db 
(PostgreSQL) 
Planning 
Service 
Go 1.22 (Gin) 
3004 
12 
Gantt, Tâches, Pointages GPS, 
Présences, Météo, Notifications 
planning_db 
(PostgreSQL) 
Reporting 
Service 
Rust 1.77 
(Actix) 
3005 
14 
KPIs, Dashboards, Exports 
PDF/Excel, Rapports schedulés 
reporting_db 
(PostgreSQL) + 
Redis 
 
2.3 Vue de Déploiement — Infrastructure K3s 
Tous les services sont conteneurisés (Docker) et orchestrés via K3s (distribution légère de 
Kubernetes). Chaque microservice est déployé dans son propre namespace avec des politiques 
réseau strictes. 
 


FieldOps360  —  Dossier d'Architecture Technique 
v1.0 — CONFIDENTIEL 
© 2026 FieldOps360 — Architecture Technique — Usage Interne 
Page 4 / 24 
Namespace K3s 
Workloads 
Politique Réseau 
fieldops-gateway 
Traefik (DaemonSet), Cert-Manager 
Entrée : Internet → Traefik 
uniquement 
fieldops-auth 
Auth Service (2 replicas) 
Sortie : auth-db, redis. Entrée 
: gateway 
fieldops-core 
Project, Resource, Planning (2 replicas 
chacun) 
Sortie : bases dédiées, 
rabbitmq. Entrée : gateway 
fieldops-reporting 
Reporting Service (3 replicas) 
Sortie : reporting-db, redis, 
minio. Entrée : gateway + 
rabbitmq 
fieldops-data 
PostgreSQL (StatefulSet), Redis, MinIO, 
RabbitMQ 
Entrée : namespaces internes 
uniquement. Pas d'accès 
externe 
fieldops-observability 
Prometheus, Grafana, Loki, Jaeger 
Lecture-seule sur tous 
namespaces (ServiceMonitor) 
 
🔒  Principe d'isolation réseau 
NetworkPolicy Kubernetes : chaque namespace n'autorise que les flux strictement nécessaires. 
Toute communication non explicitement autorisée est rejetée (Default Deny). Les microservices ne 
communiquent jamais directement entre eux — uniquement via le broker RabbitMQ pour les flux 
asynchrones. 
 
 


FieldOps360  —  Dossier d'Architecture Technique 
v1.0 — CONFIDENTIEL 
© 2026 FieldOps360 — Architecture Technique — Usage Interne 
Page 5 / 24 
3. Architecture Applicative Détaillée 
3.1 API Gateway — Traefik 
Traefik est le point d'entrée unique (single ingress) de l'ensemble des flux HTTP/HTTPS. Il assure la 
terminaison TLS, le routage par path/header, le rate limiting et l'injection des middlewares de sécurité. 
 
Fonctionnalité 
Configuration Traefik 
Détail 
Terminaison TLS 
ACME (Let's Encrypt) + TLS 
1.3 
Certificats auto-renouvelés, HSTS activé, 
OCSP Stapling 
Routage 
PathPrefix / IngressRoute 
CRD 
Règles : /api/v1/auth → :3001, /api/v1/projects 
→ :3002, etc. 
Rate Limiting 
Middleware RateLimiter 
200 req/min par IP (global), 50 req/min sur 
/auth/login 
Auth Middleware 
ForwardAuth → Auth Service 
/api/v1/auth/validate — vérification JWT sur 
routes protégées 
Compression 
Middleware Compress 
Gzip/Brotli pour réponses > 1KB 
CORS 
Middleware Headers 
Origines whitelist, credentials, preflight cache 
86400s 
Circuit Breaker 
HealthCheck sur backends 
Exclusion automatique si 3 erreurs 
consécutives / 10s 
Load Balancing 
Round-Robin pondéré 
Avec sticky sessions pour WebSocket 
(messagerie) 
 
3.2 Auth Service — NestJS 
▸  3.2.1 Modèle de Sécurité JWT 
Le service d'authentification implémente un modèle à double token pour équilibrer sécurité et 
expérience utilisateur : 
Token 
Durée de vie 
Stockage client 
Usage 
Access 
Token (JWT) 
15 minutes 
Memory (JS Variable) 
Envoyé dans Authorization: Bearer 
header à chaque requête 
Refresh 
Token 
(opaque) 
7 jours 
(mobile) / 24h 
(web) 
HttpOnly Cookie (secure, 
SameSite=Strict) 
Échange contre nouveau Access Token 
— rotation à chaque usage 
 
Payload JWT (claims) : 
Claim 
Type 
Description 
sub 
UUID 
Identifiant unique utilisateur 
tid 
UUID 
Tenant ID — utilisé pour le routing base de données 


FieldOps360  —  Dossier d'Architecture Technique 
v1.0 — CONFIDENTIEL 
© 2026 FieldOps360 — Architecture Technique — Usage Interne 
Page 6 / 24 
Claim 
Type 
Description 
role 
Enum 
Manager | ChefProjet | ChefChantier | Operateur | Admin 
permissions 
string[] 
Permissions granulaires accordées au rôle (ex: project:write) 
iat / exp 
timestamp 
Issued at / Expiration (15 min) 
jti 
UUID 
JWT ID unique — permet la révocation individuelle via blacklist 
Redis 
 
▸  3.2.2 Matrice RBAC 
Permission 
Manager 
Chef Projet 
Chef 
Chantier 
Opérateur 
Admin 
project:read (tous) 
✅ 
❌ 
(assignés) 
❌ 
(assignés) 
❌ 
✅ 
project:write 
✅ 
✅ 
❌ 
❌ 
✅ 
resource:manage 
✅ 
❌ 
❌ 
❌ 
✅ 
checkin:write 
❌ 
❌ 
✅ 
✅ 
❌ 
incident:write 
❌ 
✅ 
✅ 
✅ 
❌ 
report:export 
✅ 
✅ 
✅ 
❌ 
✅ 
admin:users 
❌ 
❌ 
❌ 
❌ 
✅ 
 
3.3 Project Service — Express.js 
Service central du domaine métier avec 28 endpoints REST. Gère le cycle de vie complet des projets, 
la gestion documentaire, les incidents et les rapports journaliers. 
 
▸  3.3.1 Modèle de Données Principal 
Entité 
Relations Clés 
Points d'attention techniques 
Project 
→ Team (M:N), → Tasks (1:N), → 
Documents (1:N), → Incidents (1:N) 
Soft delete (deleted_at), statut machine 
d'état (FSM) 
Task 
→ Project (N:1), → Assignee (N:1), 
→ Checklist (1:N) 
Arbre de dépendances (self-join), calcul 
chemin critique 
Document 
→ Project (N:1), → Versions (1:N) 
Stockage binaire dans MinIO, metadata 
en PostgreSQL, versionning sémantique 
Incident 
→ Project (N:1), → Photos (1:N), → 
Assignee (N:1) 
Sévérité 1-5, machine d'état 
(Ouvert→EnCours→Résolu→Clos), 
escalade auto 
DailyReport 
→ Project (N:1), → Signature (1:1) 
Signature numérique (hash SHA-256 + 
timestamp), export PDF async 


FieldOps360  —  Dossier d'Architecture Technique 
v1.0 — CONFIDENTIEL 
© 2026 FieldOps360 — Architecture Technique — Usage Interne 
Page 7 / 24 
 
▸  3.3.2 Pattern d'Escalade des Incidents 
Un consumer RabbitMQ surveille les incidents non assignés. La règle d'escalade automatique 
déclenche des notifications push et email selon la sévérité : 
Sévérité 
Label 
SLA 
Assignation 
SLA Résolution 
Escalade automatique vers 
1 
Bloquant 
5 min 
1 heure 
Chef Chantier + Chef Projet + 
Manager (simultané) 
2 
Critique 
15 min 
4 heures 
Chef Chantier + Chef Projet 
3 
Majeur 
1 heure 
1 jour 
Chef Chantier 
4 
Mineur 
4 heures 
3 jours 
Notification Chef Chantier seul 
5 
Informatif 
24 heures 
7 jours 
Inscription dans log seulement 
 
3.4 Resource Service — FastAPI (Python) 
Exploite les capacités asynchrones natives de FastAPI (async/await) pour les opérations I/O-bound 
(PostgreSQL via asyncpg, Redis via aioredis). Le service expose des algorithmes d'optimisation 
d'allocation des ressources. 
 
• 
Détection de conflits : algorithme interval overlap en O(n log n) pour identifier les réservations 
concurrentes sur une même ressource. 
• 
Alertes préventives : scheduler APScheduler déclenche des jobs toutes les 24h pour vérifier 
les échéances de maintenance (J-30, J-7, J-1). 
• 
Inventaire temps réel : mouvements de stock publiés via RabbitMQ — les dashboards 
Reporting sont mis à jour sans polling. 
 
3.5 Planning Service — Go (Gin) 
Écrit en Go pour ses performances natives sur le traitement concurrent. Gère les flux les plus latence-
sensibles : pointage GPS en temps réel et calculs de Gantt. 
 
▸  3.5.1 Architecture du Géofencing 
Le géofencing est implémenté côté serveur pour éviter la falsification client : 
Étape 
Composant 
Détail Technique 
1 
Mobile App 
Envoi des coordonnées GPS (lat, lng) + project_id via POST 
/api/v1/checkin 
2 
Planning Service 
Calcul distance haversine entre coordonnées reçues et coordonnées 
du chantier 
3 
Validation 
Si distance ≤ rayon_geofencing (configurable, défaut 200m) → check-
in validé 


FieldOps360  —  Dossier d'Architecture Technique 
v1.0 — CONFIDENTIEL 
© 2026 FieldOps360 — Architecture Technique — Usage Interne 
Page 8 / 24 
Étape 
Composant 
Détail Technique 
4 
Anomalie 
Si distance > rayon → check-in enregistré avec flag HORS_SITE + 
notification chef chantier 
5 
Historique 
Toutes les tentatives (valides et hors-site) persistées avec timestamp 
et coordonnées exactes 
 
▸  3.5.2 Intégration Météo 
Le service météo est consommé depuis une API tierce (OpenWeatherMap ou Météo-France API). Les 
données sont cachées dans Redis (TTL 30 min) pour éviter la sur-sollicitation de l'API et garantir la 
disponibilité en cas d'indisponibilité du fournisseur. 
 
3.6 Reporting Service — Rust (Actix-Web) 
Le service de reporting est le composant le plus exigeant en CPU (génération PDF, agrégations 
analytics). Rust garantit des performances maximales avec une empreinte mémoire minimale. 
 
• 
Génération PDF : librairie printpdf (Rust natif) — aucune dépendance sur Chrome/Puppeteer. 
Templates prédéfinis compilés. SLA : < 3 secondes pour un rapport de 50 pages. 
• 
Export Excel : librairie rust_xlsxwriter pour génération native .xlsx. Les exports > 100 000 
lignes sont traités en streaming pour éviter les OOM. 
• 
KPIs temps réel : les agrégats sont pré-calculés et mis à jour toutes les 5 minutes via un job 
Rust async, stockés dans Redis. Les dashboards lisent depuis Redis (latence < 5ms) sans 
requêter PostgreSQL. 
• 
Scheduled Reports : scheduler Tokio (runtime async Rust) déclenche les rapports 
programmés. Les fichiers générés sont uploadés dans MinIO et le lien de téléchargement est 
envoyé par email via SMTP relay. 
 
 


FieldOps360  —  Dossier d'Architecture Technique 
v1.0 — CONFIDENTIEL 
© 2026 FieldOps360 — Architecture Technique — Usage Interne 
Page 9 / 24 
4. Architecture Frontend & Mobile 
4.1 Web Application — React / TypeScript 
▸  4.1.1 Structure et Patterns 
Décision 
Choix Retenu 
Justification 
State Management 
Zustand + React Query 
Zustand pour l'état global UI, React Query pour 
le cache serveur et les mutations 
Routing 
React Router v6 
Routes protégées par rôle (PrivateRoute HOC 
vérifiant les permissions JWT) 
UI Components 
shadcn/ui + Tailwind CSS 
Design system cohérent, accessibilité WCAG 
2.1 AA intégrée 
Cartographie 
MapLibre GL JS 
Open source, WebGL, support tuiles 
vectorielles, clustering 10k+ points 
Gantt 
dhtmlx-gantt 
Bibliothèque référence, drag & drop, 
dépendances, chemin critique 
Charts 
Recharts 
SVG-based, responsive, intégration React 
native, accessible 
WebSocket 
Socket.IO client 
Présences temps réel, messagerie, tableau de 
pointage live 
Build 
Vite 5 
Dev server < 1s, HMR instantané, bundle 
optimisé (code splitting par route) 
Tests 
Vitest + React Testing 
Library + Playwright E2E 
Tests unitaires, composants et parcours 
critiques automatisés 
 
▸  4.1.2 Stratégie de Code Splitting 
Chaque espace utilisateur (Manager, Chef de Projet, Chef de Chantier) est un chunk JavaScript 
distinct chargé à la demande selon le rôle détecté dans le JWT. Cela réduit le bundle initial de ~70% 
pour les utilisateurs mobile avec une connexion lente. 
 
4.2 Mobile Application — React Native 
▸  4.2.1 Architecture Offline-First 
La contrainte majeure de l'application mobile est la gestion de la connectivité intermittente. 
L'architecture offline-first garantit que les fonctionnalités critiques restent disponibles sans réseau : 
Composant 
Technologie 
Rôle 
Base locale 
WatermelonDB (SQLite) 
Cache structuré des données métier (tâches, 
projets, utilisateurs) 
Sync Engine 
WatermelonDB Sync 
Protocol 
Synchronisation bidirectionnelle delta avec 
détection de conflits 


FieldOps360  —  Dossier d'Architecture Technique 
v1.0 — CONFIDENTIEL 
© 2026 FieldOps360 — Architecture Technique — Usage Interne 
Page 10 / 24 
Composant 
Technologie 
Rôle 
Queue d'actions 
react-native-queue 
File d'attente persistante des actions offline 
(check-in, photos, tâches) 
Détection réseau 
NetInfo API 
Surveillance connectivité, déclenchement 
sync automatique au retour réseau 
Stockage fichiers 
react-native-fs 
Photos en attente stockées localement 
jusqu'à upload MinIO confirmé 
 
▸  4.2.2 Module Caméra avec Filigrane 
La caméra avec filigrane automatique est un composant natif custom : 
1. Capture via react-native-camera en mode RAW (JPEG non compressé pour qualité maximale) 
2. Récupération GPS temps réel via react-native-geolocation-service (haute précision) 
3. Composition du filigrane : overlay Canvas avec Date, Heure, Coordonnées GPS, Nom du 
projet, Nom utilisateur — police monospace pour lisibilité 
4. Compression JPEG 85% appliquée après le filigrane (économie bande passante) 
5. Upload multipart vers MinIO via présigned URL (contournant l'API Gateway pour les gros 
fichiers) 
 
▸  4.2.3 Sécurité Mobile 
Vecteur 
Contre-mesure Implémentée 
Stockage credentials 
Keychain (iOS) / Keystore (Android) — jamais en AsyncStorage 
Certificate Pinning 
TrustKit (iOS) + OkHttp (Android) — rejet certificats non reconnus 
Root/Jailbreak detection 
react-native-jail-monkey — avertissement utilisateur, blocage 
optionnel 
Screenshot prevention 
FLAG_SECURE (Android) + blurring (iOS) sur les écrans sensibles 
Biométrie 
react-native-biometrics (Face ID/Touch ID) avec fallback PIN 
Obfuscation 
Hermes bytecode (React Native) + ProGuard (Android) 
 
 


FieldOps360  —  Dossier d'Architecture Technique 
v1.0 — CONFIDENTIEL 
© 2026 FieldOps360 — Architecture Technique — Usage Interne 
Page 11 / 24 
5. Architecture des Données 
5.1 Stratégie Multi-Tenant 
🏗  Pattern retenu : Database-per-Tenant 
Chaque organisation cliente dispose d'une base de données PostgreSQL dédiée (ex: tenant_acme, 
tenant_bouygues). Cette approche garantit l'isolation maximale des données, simplifie la conformité 
RGPD (purge complète d'un tenant = DROP DATABASE), et permet des optimisations de 
performance indépendantes (index, vacuum, connexions). 
 
Critère 
Database-per-Tenant ✅ 
Schema-per-Tenant 
Row-level Security 
Isolation 
Totale 
Partielle 
Logique uniquement 
Purge RGPD 
DROP DATABASE 
DROP SCHEMA 
DELETE + audit 
Performance 
Indépendante 
Partagée 
Partagée 
Complexité opé. 
Élevée 
Moyenne 
Faible 
Migrations 
Par tenant (Flyway) 
Par tenant 
Globales 
 
5.2 PostgreSQL — Schéma et Conventions 
▸  5.2.1 Conventions de Nommage et Bonnes Pratiques 
• 
UUID v7 : tous les identifiants primaires utilisent UUID v7 (time-ordered) — indexation B-tree 
efficace, pas de hotspot séquentiel. 
• 
Soft Delete universel : champ deleted_at TIMESTAMPTZ nullable sur toutes les entités. Les 
requêtes incluent systématiquement WHERE deleted_at IS NULL. 
• 
Audit Columns : created_at, updated_at, created_by, updated_by sur toutes les tables — 
alimentés par triggers PostgreSQL. 
• 
JSONB pour métadonnées : champ metadata JSONB sur Project et Task pour les champs 
customs tenant-spécifiques — indexé avec GIN. 
• 
Partitionnement : tables daily_reports et checkins partitionnées par RANGE sur created_at 
(partition mensuelle) pour les volumes élevés. 
 
▸  5.2.2 Stratégie d'Indexation 
Table 
Index 
Type 
Justification 
projects 
(tenant_id, status, 
deleted_at) 
B-tree 
composite 
Filtre principal du dashboard 
manager 
projects 
(latitude, longitude) 
GiST 
Requêtes géospatiales carte temps 
réel 
tasks 
(project_id, assignee_id, 
status) 
B-tree 
composite 
Vue 'Mes Tâches' mobile 


FieldOps360  —  Dossier d'Architecture Technique 
v1.0 — CONFIDENTIEL 
© 2026 FieldOps360 — Architecture Technique — Usage Interne 
Page 12 / 24 
Table 
Index 
Type 
Justification 
checkins 
(user_id, checked_at 
DESC) 
B-tree 
Historique pointages utilisateur 
incidents 
(project_id, severity, status) 
B-tree 
composite 
Filtrage incidents par sévérité 
documents 
(project_id, parent_id) 
B-tree 
Navigation arborescence 
documents 
resources 
(type, status, tenant_id) 
B-tree 
composite 
Recherche disponibilité ressources 
 
5.3 Redis — Stratégie de Cache 
Clé Redis (pattern) 
TTL 
Usage 
Invalidation 
jwt:blacklist:{jti} 
15 
min 
Révocation tokens JWT — 
vérifiée par Auth Service 
Expiration naturelle (= 
durée Access Token) 
session:{refresh_token} 
7 
jours 
Sessions actives avec user_id 
+ tenant_id 
Déconnexion explicite ou 
expiration 
dashboard:kpis:{tenant_id} 
5 min 
KPIs précalculés pour 
dashboard manager 
Recalcul par Reporting 
Service (cron) 
weather:{lat}:{lng} 
30 
min 
Données météo par 
coordonnées (arrondi 0.01°) 
Expiration naturelle 
resource:availability:{id}:{date} 
10 
min 
Disponibilité ressource pour 
date donnée 
Invalidation sur mutation 
réservation 
rate_limit:{ip}:{endpoint} 
1 min 
Compteur rate limiting par 
IP/endpoint 
Expiration naturelle 
(fenêtre glissante) 
ws:presence:{project_id} 
TTL 
Live 
Utilisateurs connectés en 
temps réel (WebSocket) 
Suppression sur 
déconnexion 
 
5.4 MinIO — Stockage Objet 
MinIO est déployé en mode distribué (4 nœuds minimum pour erasure coding 2+2). Les buckets sont 
organisés par type d'objet et tenant : 
Bucket 
Contenu 
Rétention 
Accès 
fieldops-documents 
Plans, permis, rapports PDF 
Illimitée 
(versioning 
activé) 
Présigned URLs (15 min) 
fieldops-photos 
Photos terrain avec filigrane 
5 ans 
(configurable par 
tenant) 
Présigned URLs (15 min) 
fieldops-reports 
Rapports PDF générés 
(export) 
90 jours puis 
purge auto 
Présigned URLs (24h) 


FieldOps360  —  Dossier d'Architecture Technique 
v1.0 — CONFIDENTIEL 
© 2026 FieldOps360 — Architecture Technique — Usage Interne 
Page 13 / 24 
Bucket 
Contenu 
Rétention 
Accès 
fieldops-exports 
Exports Excel/CSV 
7 jours 
Présigned URLs (1h) 
fieldops-backups 
Dumps PostgreSQL chiffrés 
90 jours (rotation 
FIFO) 
Accès interne 
uniquement (K8s SA) 
 
5.5 RabbitMQ — Architecture de Messagerie 
RabbitMQ orchestre les communications asynchrones inter-services, découplant les producteurs des 
consommateurs et garantissant la livraison des messages critiques. 
 
Exchange 
Type 
Routing Key (pattern) 
Producteur → 
Consommateur 
Usage 
fieldops.events 
Topic 
project.incident.created.* 
Project → 
Planning, 
Reporting 
Déclenchement 
notifications 
incident 
fieldops.events 
Topic 
resource.stock.low.* 
Resource → 
Reporting 
Alerte stock 
sous seuil 
fieldops.events 
Topic 
planning.checkin.completed.* 
Planning → 
Reporting 
Mise à jour 
présences 
dashboard 
fieldops.reports 
Direct 
report.generate.pdf 
Reporting → 
Reporting 
(worker) 
Génération PDF 
asynchrone 
fieldops.notifications 
Fanout 
— 
Planning → 
Mobile Push, 
Email 
Broadcast 
notifications 
fieldops.sync 
Direct 
sync.mobile.{tenant_id} 
Project → Mobile 
Sync 
Delta sync 
données mobile 
 
 


FieldOps360  —  Dossier d'Architecture Technique 
v1.0 — CONFIDENTIEL 
© 2026 FieldOps360 — Architecture Technique — Usage Interne 
Page 14 / 24 
6. Architecture de Sécurité 
🛡  Principe : Zero Trust Architecture 
Aucune confiance implicite n'est accordée — ni aux réseaux internes, ni aux services, ni aux 
utilisateurs. Chaque requête doit être authentifiée, autorisée et chiffrée, indépendamment de sa 
provenance. Le périmètre de sécurité est défini au niveau de chaque ressource, pas au niveau du 
réseau. 
 
6.1 Défense en Profondeur — Couches de Sécurité 
Couche 
Mécanismes 
L1 — Réseau 
WAF (Traefik + plugins), DDoS protection, TLS 1.3 obligatoire, HSTS, Firewall 
K3s NetworkPolicy 
L2 — 
Authentification 
JWT + Refresh Token rotation, Biométrie mobile, MFA TOTP (optionnel), 
lockout après 5 échecs 
L3 — Autorisation 
RBAC granulaire par permission, vérification tenant_id systématique, Row-
Level Security PostgreSQL 
L4 — Application 
Input validation (Joi/Zod), Parameterized queries (pas d'ORM raw), XSS/CSRF 
protection, OWASP Top10 
L5 — Données 
AES-256-GCM at-rest (PostgreSQL, MinIO), TLS 1.3 in-transit, chiffrement PII 
(email, téléphone) 
L6 — Secrets 
HashiCorp Vault pour tous les secrets (DB passwords, API keys, JWT signing 
keys) 
L7 — Audit 
Audit log immuable (append-only table PostgreSQL) pour toutes actions 
critiques 
 
6.2 Gestion des Secrets — HashiCorp Vault 
• 
Dynamic Secrets : les credentials de base de données sont générés à la demande par Vault 
(TTL 1h) — jamais stockés dans les configurations des pods Kubernetes. 
• 
Secret Rotation : rotation automatique des clés de signature JWT tous les 30 jours. 
Coexistence de l'ancienne et nouvelle clé pendant 15 minutes (durée de vie Access Token). 
• 
Kubernetes Auth : les pods s'authentifient auprès de Vault via ServiceAccount Kubernetes. 
Aucun secret statique dans les manifestes YAML. 
• 
Audit Vault : toutes les lectures/écritures de secrets sont tracées avec l'identité du demandeur 
(pod name, namespace, SA). 
 
6.3 Conformité RGPD 


FieldOps360  —  Dossier d'Architecture Technique 
v1.0 — CONFIDENTIEL 
© 2026 FieldOps360 — Architecture Technique — Usage Interne 
Page 15 / 24 
Exigence RGPD 
Implémentation Technique 
Droit à l'effacement 
DROP DATABASE pour effacement tenant complet. Soft-delete + 
purge async pour utilisateur individuel (cascade vers toutes tables) 
Portabilité des données 
Export JSON/CSV de toutes les données personnelles d'un 
utilisateur — API dédiée /api/v1/users/{id}/export 
Minimisation des données 
PII uniquement dans Auth Service. Les autres services ne 
manipulent que des UUIDs. Pseudonymisation dans logs et 
métriques. 
Consentement 
Traçage horodaté des consentements en base. Révocation possible 
via profil utilisateur. 
Breach Notification 
Alerte Prometheus sur pattern accès anormal → notification CISO < 
15 min. Template notification CNIL prêt. 
DPO Access 
Portail Admin DPO avec vues anonymisées des traitements, registre 
activités auto-généré. 
 
6.4 Sécurité des APIs — OWASP API Top 10 
Risque OWASP API 
Contre-mesure Implémentée 
API1 — BOLA (Broken Object Level 
Authorization) 
Vérification systématique du tenant_id dans chaque requête. 
Middleware dédié injecté sur tous les routes. 
API2 — Broken Auth 
JWT + Refresh rotation, blacklist, biométrie, lockout. 
API3 — Broken Object Property 
Auth 
DTOs stricts avec whitelist de champs exposés (class-
transformer). Jamais d'expose raw ORM objects. 
API4 — Unrestricted Resource 
Consumption 
Rate limiting (Traefik), pagination obligatoire (max 100 items), 
timeout 30s sur toutes routes. 
API5 — Function Level 
Authorization 
Décorateurs RBAC (@RequirePermission) sur chaque 
endpoint contrôleur. 
API8 — Security Misconfiguration 
CIS Benchmark K8s automatisé (kube-bench), Trivy scan 
images Docker en CI/CD. 
API9 — Improper Asset 
Management 
API versionnée (/v1/), documentation OpenAPI auto-générée, 
endpoints deprecated marqués et retirés après 6 mois. 
 
 


FieldOps360  —  Dossier d'Architecture Technique 
v1.0 — CONFIDENTIEL 
© 2026 FieldOps360 — Architecture Technique — Usage Interne 
Page 16 / 24 
7. Infrastructure & DevOps 
7.1 Kubernetes (K3s) — Configuration des Workloads 
Workload 
Replicas 
Strategy 
CPU Request/Limit 
Memory 
Request/Limit 
Auth Service 
2 (min) / 5 
(max) 
RollingUpdate 
(maxSurge: 
1) 
100m / 500m 
128Mi / 512Mi 
Project Service 
2 (min) / 8 
(max) 
RollingUpdate 
(maxSurge: 
2) 
200m / 1000m 
256Mi / 1Gi 
Resource Service 
2 (min) / 4 
(max) 
RollingUpdate 
(maxSurge: 
1) 
150m / 700m 
192Mi / 768Mi 
Planning Service 
2 (min) / 6 
(max) 
RollingUpdate 
(maxSurge: 
2) 
100m / 400m 
128Mi / 256Mi 
Reporting Service 
3 (min) / 10 
(max) 
RollingUpdate 
(maxSurge: 
2) 
500m / 2000m 
512Mi / 2Gi 
PostgreSQL 
1 
(StatefulSet) 
Recreate 
500m / 2000m 
1Gi / 4Gi 
Redis 
1 
(StatefulSet) 
Recreate 
100m / 500m 
256Mi / 1Gi 
 
▸  7.1.1 Horizontal Pod Autoscaler (HPA) 
L'auto-scaling est configuré sur les métriques CPU et sur des métriques custom (requêtes RabbitMQ 
en queue) pour le Reporting Service : 
• 
Planning Service : HPA déclenché à CPU > 60% — pic attendu le matin (7h-9h) lors des 
check-in massifs. 
• 
Reporting Service : HPA sur queue depth RabbitMQ fieldops.reports > 50 messages en 
attente. 
• 
Project Service : HPA CPU > 70% + mémorisation en semaine (PodDisruptionBudget : min 2 
pods disponibles). 
 
7.2 Pipeline CI/CD — GitHub Actions 
Stage 
Déclencheur 
Durée Cible 
Actions 
1. Lint & 
Format 
Push toutes 
branches 
< 2 min 
ESLint, Prettier, golangci-lint, clippy (Rust), 
ruff (Python) 
2. Unit Tests 
Push toutes 
branches 
< 5 min 
Tests unitaires par service, couverture > 80% 
obligatoire (gate) 


FieldOps360  —  Dossier d'Architecture Technique 
v1.0 — CONFIDENTIEL 
© 2026 FieldOps360 — Architecture Technique — Usage Interne 
Page 17 / 24 
Stage 
Déclencheur 
Durée Cible 
Actions 
3. Security 
Scan 
Push toutes 
branches 
< 3 min 
Trivy (CVE scan image), Snyk 
(dépendances), Gitleaks (secrets) 
4. Build & 
Push 
Merge sur develop 
< 8 min 
Build multi-stage Docker, push registry 
(ghcr.io), tag commit SHA 
5. Integration 
Tests 
Merge sur develop 
< 10 min 
Tests d'intégration en docker-compose, 
contrats API (Pact) 
6. Deploy 
Staging 
Merge sur develop 
< 5 min 
Helm upgrade --install sur cluster staging, 
smoke tests 
7. E2E Tests 
Deploy Staging OK 
< 15 min 
Playwright sur staging — parcours critiques 
(auth, checkin, rapport) 
8. Deploy 
Production 
Tag vX.Y.Z sur 
main + approbation 
manuelle 
< 8 min 
Helm rolling update prod, validation post-
deploy (healthchecks) 
 
7.3 Infrastructure as Code — Terraform 
• 
Modules Terraform : un module par composant infra (k3s-cluster, postgresql, redis, minio, 
rabbitmq, monitoring). Réutilisables entre environnements. 
• 
State Management : Terraform state stocké dans un backend S3 distant (MinIO dédié) avec 
locking DynamoDB pour éviter les conflits. 
• 
Environnements : trois workspaces Terraform distincts : dev, staging, production. Les 
variables sensibles sont injectées depuis Vault au moment du plan. 
• 
Drift Detection : job GitHub Actions quotidien exécutant terraform plan — alerte Slack si drift 
détecté entre code et état réel. 
 
7.4 Stratégie de Sauvegarde & PRA 
Composant 
Fréquence 
Rétention 
Méthode 
RTO 
RPO 
PostgreSQL (tous 
tenants) 
Continu 
(WAL) 
30 jours 
pg_basebackup + 
WAL streaming → 
MinIO chiffré 
< 1h 
< 5 min 
PostgreSQL (daily) 
Quotidien 
02h00 
90 jours 
pg_dump compressé 
+ chiffré → MinIO 
< 1h 
< 24h 
MinIO (fichiers) 
Toutes les 
6h 
1 an 
Réplication MinIO 
bucket versioning 
< 2h 
< 6h 
Redis 
Quotidien 
7 jours 
RDB snapshot 
< 30 min 
< 24h 
(cache 
reconstruit) 
Config K3s (etcd) 
Continu 
30 jours 
etcd backup 
automatique K3s 
< 2h 
< 1 min 
 


FieldOps360  —  Dossier d'Architecture Technique 
v1.0 — CONFIDENTIEL 
© 2026 FieldOps360 — Architecture Technique — Usage Interne 
Page 18 / 24 
🔁  Test de Restauration 
Un exercice de restauration complète est planifié mensuellement sur l'environnement staging. Les 
résultats (RTO/RPO réels) sont documentés et comparés aux cibles. Toute dérive déclenche un plan 
d'action sous 48h. 
 
 


FieldOps360  —  Dossier d'Architecture Technique 
v1.0 — CONFIDENTIEL 
© 2026 FieldOps360 — Architecture Technique — Usage Interne 
Page 19 / 24 
8. Architecture d'Observabilité 
L'observabilité de FieldOps360 repose sur les 3 piliers (Métriques, Logs, Traces) avec une stack PLG 
(Prometheus + Loki + Grafana) complétée par Jaeger pour le distributed tracing. 
 
8.1 Métriques — Prometheus 
Catégorie 
Métriques Clés 
Seuils d'Alerte 
Latence API 
http_request_duration_p95, p99 par 
service et endpoint 
P95 > 200ms → Warning / P95 > 
500ms → Critical 
Disponibilité 
up{job=...} — probe HTTP healthchecks 
toutes les 30s 
0 réponse sur 3 tentatives → 
PagerDuty 
Erreurs 
http_requests_total{status=~'5..'} / total 
(taux) 
Taux erreur 5xx > 1% sur 5 min → 
Warning 
Saturation 
CPU throttling, memory usage, disk I/O 
PostgreSQL 
CPU > 80% pendant 10 min → 
HPA Scale-Out 
Business 
checkins_per_hour, active_projects, 
incidents_open 
Incidents sévérité 1 non assignés 
> 5 min → PagerDuty 
RabbitMQ 
messages_ready, 
messages_unacknowledged par queue 
Queue depth > 1000 messages → 
Warning 
 
8.2 Logging — Loki 
• 
Structured Logging : tous les services émettent des logs JSON (format standardisé) avec les 
champs obligatoires : timestamp, level, service, trace_id, tenant_id, user_id. 
• 
Labels Loki : indexation uniquement sur {service, environment, tenant_id}. Les autres champs 
sont dans le payload JSON (queryable via LogQL). 
• 
Rétention : 30 jours pour les logs INFO/WARN, 90 jours pour les logs ERROR, 1 an pour les 
logs AUDIT (compliance RGPD). 
• 
PII Masking : agent Promtail applique des patterns de masquage (regex) avant ingestion dans 
Loki pour masquer les données personnelles dans les logs. 
 
8.3 Tracing — Jaeger 
Chaque requête entrante dans Traefik reçoit un trace_id unique (W3C TraceContext header). Ce 
trace_id est propagé dans tous les appels inter-services (HTTP headers + RabbitMQ message 
headers). 
 
Service 
Instrumentation 
Spans Tracés 
Traefik 
Plugin OpenTelemetry natif 
Réception requête, forward auth, routing vers 
backend 


FieldOps360  —  Dossier d'Architecture Technique 
v1.0 — CONFIDENTIEL 
© 2026 FieldOps360 — Architecture Technique — Usage Interne 
Page 20 / 24 
Service 
Instrumentation 
Spans Tracés 
NestJS (Auth) 
@opentelemetry/sdk-node 
Validation JWT, query PostgreSQL, lecture 
Redis 
Express.js (Project) 
@opentelemetry/sdk-node 
CRUD opérations, upload MinIO, publish 
RabbitMQ 
FastAPI 
(Resource) 
opentelemetry-sdk-python 
Requêtes async PostgreSQL, calculs 
disponibilité 
Go (Planning) 
go.opentelemetry.io/otel 
Requêtes DB, appels API météo, publish 
notifications 
Rust (Reporting) 
opentelemetry crate 
Requêtes DB, génération PDF, upload MinIO, 
envoi emails 
 
8.4 Dashboards Grafana 
• 
Dashboard Opérationnel : vue temps réel de la santé de tous les services (latence, erreurs, 
saturation) avec drill-down vers Loki logs et Jaeger traces. 
• 
Dashboard Business : KPIs métiers temps réel — check-ins/heure, incidents ouverts par 
sévérité, projets actifs, taux de complétion tâches. 
• 
Dashboard Infrastructure : utilisation ressources K3s (CPU, RAM, réseau par namespace), 
état PostgreSQL (queries/s, locks, replication lag). 
• 
Dashboard SLA : suivi des SLOs (P95 latence, uptime, taux d'erreur) avec calcul automatique 
Error Budget sur 30 jours glissants. 
 
 


FieldOps360  —  Dossier d'Architecture Technique 
v1.0 — CONFIDENTIEL 
© 2026 FieldOps360 — Architecture Technique — Usage Interne 
Page 21 / 24 
9. Architecture Decision Records (ADR) 
Les ADR documentent les décisions architecturales significatives et leurs justifications pour assurer la 
continuité de la connaissance et permettre des réévaluations futures. 
 
ADR-001 : Microservices multi-langages vs Monolithe modulaire 
Attribut 
Détail 
Statut 
Accepté 
Contexte 
La plateforme couvre des domaines techniques hétérogènes avec des 
exigences de performance très différentes. 
Décision 
5 microservices dans 5 langages, chacun optimisé pour son use case. 
Justification 
Rust pour le reporting (CPU-bound), Go pour le planning (concurrence), 
FastAPI pour resource (I/O async), NestJS pour auth (richesse 
framework), Express pour projects (flexibilité). 
Conséquences positives 
Performance optimale par domaine, déploiements indépendants, 
résilience par isolation. 
Conséquences 
négatives 
Complexité opérationnelle accrue, nécessite une gouvernance API stricte 
et un contrat d'interface figé dès le départ. 
Mitigation 
API versionnée, tests de contrat Pact, documentation OpenAPI 
obligatoire, équipe DevOps dédiée. 
 
ADR-002 : Database-per-Tenant vs Schema-per-Tenant 
Attribut 
Détail 
Statut 
Accepté 
Contexte 
Les clients ont des exigences strictes d'isolation des données et de 
conformité RGPD. 
Décision 
Base de données PostgreSQL dédiée par tenant (database-per-tenant). 
Justification 
Isolation maximale, purge RGPD triviale (DROP DATABASE), 
performance indépendante, facilité de migration vers un cloud dédié si 
requis par un grand compte. 
Conséquences positives 
Conformité RGPD native, SLA personnalisable par tenant, pas de risque 
de fuite cross-tenant. 
Conséquences 
négatives 
Connection pool par tenant (PgBouncer requis), migrations coordonnées 
sur N bases. 
Mitigation 
PgBouncer en mode transaction pooling, outil de migration custom 
(Flyway multi-database), HPA sur tenant actif. 
 
ADR-003 : Offline-First Mobile (WatermelonDB) 


FieldOps360  —  Dossier d'Architecture Technique 
v1.0 — CONFIDENTIEL 
© 2026 FieldOps360 — Architecture Technique — Usage Interne 
Page 22 / 24 
Attribut 
Détail 
Statut 
Accepté 
Contexte 
Les opérateurs travaillent fréquemment dans des zones sans couverture 
réseau (tunnels, zones industrielles, chantiers isolés). 
Décision 
Architecture offline-first avec WatermelonDB (SQLite) et synchronisation 
delta. 
Alternatives évaluées 
AsyncStorage (rejeté : pas de requêtes complexes), Realm (rejeté : coût 
licence), simple API retry (rejeté : UX dégradée sans réseau). 
Justification 
WatermelonDB offre SQLite embarqué, lazy loading, et un protocole de 
sync standard compatible avec nos APIs REST. 
Conséquences 
Complexité sync accrue, gestion de conflits nécessaire, tests d'intégration 
offline spécifiques. 
 
ADR-004 : Traefik comme API Gateway vs Kong vs AWS API Gateway 
Attribut 
Détail 
Statut 
Accepté 
Décision 
Traefik v3 comme API Gateway et Ingress Controller K3s. 
Alternatives évaluées 
Kong (rejeté : complexité configuration, base de données requise), AWS 
API GW (rejeté : vendor lock-in, coût à l'appel), Nginx (rejeté : moins natif 
K8s). 
Justification 
Traefik est nativement intégré à K8s/K3s (CRD IngressRoute), discover 
automatique les services, gestion ACME native, interface Web incluse, 
configuration déclarative. 
Conséquences 
Fonctionnalités avancées (analytics, developer portal) moins riches que 
Kong — compensé par Grafana dashboards. 
 
 


FieldOps360  —  Dossier d'Architecture Technique 
v1.0 — CONFIDENTIEL 
© 2026 FieldOps360 — Architecture Technique — Usage Interne 
Page 23 / 24 
10. Matrice des Risques Techniques 
ID 
Risque 
Prob. 
Impact 
Score 
Plan de Mitigation 
Responsable 
RT01 
Complexité sync 
offline mobile 
(conflits de 
données) 
Haute 
Haute 
9 
WatermelonDB 
conflict resolution 
policy. Tests 
régression offline. 
Stratégie last-write-
wins + timestamp 
server. 
Mobile Lead 
RT02 
Saturation 
connection pool 
PostgreSQL (multi-
tenant peak) 
Moyenne 
Haute 
6 
PgBouncer 
transaction pooling. 
HPA sur metrics DB. 
Connection limit par 
tenant. 
DBA / Infra 
RT03 
Dérive des contrats 
d'API inter-services 
Haute 
Moyenne 
6 
Consumer-Driven 
Contract Tests 
(Pact). API 
versionnée. Review 
obligatoire avant 
merge. 
Tech Lead 
RT04 
Performance 
géolocalisation 
temps réel (GPS 
drift) 
Moyenne 
Haute 
6 
Algorithme 
haversine optimisé 
en Go. Tests terrain 
early sprint 3. Rayon 
géofencing 
configurable. 
Planning 
Lead 
RT05 
Fuite de données 
cross-tenant 
Faible 
Critique 
5 
Middleware 
tenant_id obligatoire. 
Tests de 
pénétration. Row-
Level Security 
PostgreSQL en 
double vérification. 
Sécu / DBA 
RT06 
Complexité 
migrations DB sur 
N tenants 
Haute 
Moyenne 
6 
Flyway multi-
database 
automatisé. 
Migration en rolling 
(backward 
compatible). 
Rollback 
automatique si 
échec. 
DBA 
RT07 
Indisponibilité 
service météo tiers 
Faible 
Faible 
1 
Cache Redis 30min. 
Fallback sur 
données météo J-1 
si API down. Circuit 
breaker + alerte 
monitoring. 
Planning 
Lead 


FieldOps360  —  Dossier d'Architecture Technique 
v1.0 — CONFIDENTIEL 
© 2026 FieldOps360 — Architecture Technique — Usage Interne 
Page 24 / 24 
ID 
Risque 
Prob. 
Impact 
Score 
Plan de Mitigation 
Responsable 
RT08 
Vulnérabilité 
dépendances 
(Supply Chain) 
Moyenne 
Haute 
6 
Trivy + Snyk en 
CI/CD. Dependabot 
activé. Images de 
base minimales 
(distroless). 
DevSecOps 
 
📊  Légende Scoring 
Score = Probabilité × Impact. Probabilité : Faible=1, Moyenne=2, Haute=3. Impact : Faible=1, 
Moyenne=2, Haute=3, Critique=4. Score ≥ 6 → Plan de mitigation obligatoire + suivi sprint review. 
 
10.1 Critères de Qualité Architecturale (ATAM) 
Attribut Qualité 
Tactique Architecturale 
Mesure 
Performance 
Cache Redis multi-niveaux, Rust pour 
reporting, Go pour planning, HPA K3s 
P95 latence < 200ms (target 
mesuré via Prometheus) 
Disponibilité 
Multi-replicas, circuit breaker, graceful 
shutdown, health probes K8s 
Uptime > 99.9% (< 8.7h/an de 
downtime) 
Sécurité 
Zero Trust, RBAC, chiffrement end-to-
end, Vault, pentest annuel 
0 faille critique ou haute en prod 
(CVSS ≥ 7.0) 
Modifiabilité 
Microservices découplés, API versionnée, 
ADR documentés 
Déploiement service isolé sans 
downtime autre service 
Testabilité 
CI/CD automatisé, coverage > 80%, 
contrats API, E2E Playwright 
Pipeline complet < 35 min pour 
feedback rapide 
Portabilité 
Docker + K3s, Terraform IaC, aucun 
vendor lock-in 
Migration cloud provider en < 1 
journée de travail 
 


