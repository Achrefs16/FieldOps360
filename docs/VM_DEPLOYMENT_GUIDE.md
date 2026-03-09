# FieldOps360 - VM Deployment Guide

Ce guide détaille les étapes exactes pour déployer l'infrastructure sur votre machine virtuelle (Ubuntu/K3s) de manière sécurisée, en utilisant Terraform, Vault et ArgoCD.

---

## Phase 1 : Préparation de l'environnement local

Puisque nous avons retiré les mots de passe codés en dur dans `dev.tfvars` pour des raisons de sécurité, vous devez les fournir en tant que variables d'environnement dans le terminal de votre VM **avant** d'exécuter Terraform.

1. Connectez-vous à votre VM en SSH.
2. Placez-vous dans le dossier du projet :
   ```bash
   cd FieldOps360
   ```
3. Exportez les secrets requis (remplacez les valeurs par vos vrais mots de passe sécurisés) :
   ```bash
   export TF_VAR_db_password="StrongDatabasePassword2026!"
   export TF_VAR_redis_password="StrongRedisPassword2026!"
   export TF_VAR_rabbitmq_password="StrongRabbitMQPassword2026!"
   export TF_VAR_minio_access_key="fieldops_admin"
   export TF_VAR_minio_secret_key="StrongMinioSecret2026!"
   export TF_VAR_grafana_password="StrongGrafanaAdmin2026!"
   ```

---

## Phase 2 : Provisionnement de l'Infrastructure Core (Terraform)

Dans cette phase, Terraform va déployer les services fondamentaux (PostgreSQL, Redis, RabbitMQ, Vault, MinIO).

1. Appliquez les CRDs Traefik essentiels en premier :
   ```bash
   sudo kubectl apply -f infra/k8s/00-crds/traefik-crds.yaml
   ```

2. Initialisez Terraform :
   ```bash
   cd infra/terraform
   # Assurez-vous d'avoir les droits sur le kubeconfig de k3s
   sudo chmod 644 /etc/rancher/k3s/k3s.yaml
   terraform init
   ```
   *⚠️ Important : Assurez-vous que le bloc `backend "s3"` dans `infra/terraform/backend.tf` est **commenté** pour cette première exécution, car le stockage MinIO n'existe pas encore !*

3. Lancez le déploiement :
   ```bash
   terraform apply -var-file="dev.tfvars"
   ```
   *Répondez `yes` quand Terraform vous le demande, puis attendez que tous les services (Bitnami charts) démarrent.*

---

## Phase 3 : Création des Secrets Manuels et Bootstrap Vault

Terraform a déployé HashiCorp Vault, mais il est vide. Nous devons y injecter les secrets avant qu'ArgoCD ne démarre les microservices.

1. Créez les secrets Kubernetes requis manuellement :
   ```bash
   # Remontez à la racine du projet
   cd ../.. 
   
   # JWT keys pour auth-service
   openssl genpkey -algorithm RSA -out /tmp/private.pem -pkeyopt rsa_keygen_bits:2048
   openssl rsa -in /tmp/private.pem -pubout -out /tmp/public.pem
   sudo kubectl create secret generic jwt-keys -n fieldops-auth \
     --from-file=private.pem=/tmp/private.pem --from-file=public.pem=/tmp/public.pem
   
   # Certificat TLS auto-signé
   openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
     -keyout /tmp/tls.key -out /tmp/tls.crt -subj "/CN=fieldops.local"
   sudo kubectl create secret tls default-cert -n fieldops-auth \
     --cert=/tmp/tls.crt --key=/tmp/tls.key
   sudo kubectl create secret tls default-cert -n fieldops-observability \
     --cert=/tmp/tls.crt --key=/tmp/tls.key
   ```

2. Vérifiez que Vault est en cours d'exécution :
   ```bash
   sudo kubectl get pods -n fieldops-data -l app.kubernetes.io/name=vault
   ```

3. Exécutez le script Bootstrap :
   ```bash
   chmod +x infra/scripts/vault-bootstrap.sh
   bash infra/scripts/vault-bootstrap.sh
   ```
   *Ce script active l'authentification K8s dans Vault et stocke en toute sécurité vos identifiants pour la DB, Redis, MinIO, etc.*

---

## Phase 4 : Déploiement Applicatif (ArgoCD & GitOps)

Parce que le fichier `main.tf` contient le module ArgoCD, l'outil est déjà en train de surveiller le dossier `infra/k8s` de votre dépôt Git. 

### 4.1. Connecter ArgoCD à un dépôt GitHub privé 
Si votre dépôt GitHub `FieldOps360` est privé, ArgoCD ne pourra pas lire les manifestes Kubernetes ! Vous devez lui fournir un jeton d'accès (Personal Access Token).

1. Récupérez le mot de passe administrateur par défaut d'ArgoCD :
   ```bash
   sudo kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d; echo
   ```
2. Sur votre PC local, ouvrez l'interface web d'ArgoCD (via le nom de domaine ou l'IP défini dans Traefik, ex: `https://argocd.votre-vm.com`). 
3. Connectez-vous avec :
   - Username : `admin`
   - Password : *le mot de passe récupéré à l'étape 1*
4. Accédez à **Settings > Repositories > + Connect Repo** et remplissez :
   - Method : HTTPS
   - Repository URL : `https://github.com/Achrefs16/FieldOps360.git`
   - Username : Votre nom d'utilisateur GitHub
   - Password : Un Personal Access Token (PAT) généré sur GitHub avec les droits de lecture.

### 4.2. Synchronisation Automatique
1. Assurez-vous que toutes vos modifications locales sont "poussées" (Pushed) sur la branche surveillée par ArgoCD (ex: `develop`).
2. **ArgoCD Sync :** Une fois le dépôt connecté, ArgoCD détectera automatiquement les fichiers dans `infra/k8s/` et lancera vos IngressRoutes Traefik, vos CronJobs et l'`auth-service`. 
3. L'`auth-service` communiquera immédiatement avec le Vault Agent Injector pour récupérer ses identifiants en mémoire !

### 🛠️ Dépannage : "J'ai supprimé ArgoCD par accident !"
Si vous avez supprimé le namespace `argocd` ou l'application par erreur, ne paniquez pas. Puisque l'infrastructure est gérée comme du code (IaC), Terraform peut le restaurer instantanément :

1. Retournez dans le dossier terraform :
   ```bash
   cd infra/terraform
   ```

2. Dites à Terraform que l'état d'ArgoCD a été corrompu/supprimé dans le cluster (optionnel mais recommandé pour forcer la réinstallation) :
   ```bash
   terraform taint helm_release.argocd
   terraform taint kubernetes_manifest.argocd_ingress
   terraform taint kubernetes_manifest.argocd_application
   ```

3. Réappliquez Terraform. Il verra qu'ArgoCD manque et le réinstallera proprement :
   ```bash
   terraform apply -var-file="dev.tfvars"
   ```
*Après ça, ArgoCD redémarrera, se connectera à votre dépôt Git, et synchronisera à nouveau les microservices sans perte de données applicatives.*

---

## Phase 5 : Migration de l'État Terraform (Le correctif "Poules et Œufs")

Maintenant que MinIO fonctionne dans le cluster et que le bucket `fieldops-terraform-state` a été créé automatiquement, nous allons déplacer la mémoire de Terraform vers le cluster.

1. Décommentez le backend :
   Ouvrez `infra/terraform/backend.tf` et retirez les commentaires autour du bloc `backend "s3"`.

2. Migrez l'état :
   ```bash
   cd infra/terraform
   terraform init -migrate-state \
     -backend-config="access_key=$TF_VAR_minio_access_key" \
     -backend-config="secret_key=$TF_VAR_minio_secret_key"
   ```
3. Tapez `yes` quand on vous demande de confirmer la copie de l'état vers le nouveau backend.

🎉 **Terminé !** 
Votre cluster est maintenant entièrement sécurisé, découplé, et fonctionne avec l'intégration d'HashiCorp Vault, avec son état stocké de manière sécurisée dans un flux GitOps !

---

## Phase 6 : Runbook de Vérification (à faire après chaque déploiement)

Cette section sert de checklist rapide pour éviter les erreurs observées en VM (404 UI, redirections localhost, erreurs de login, etc.).

### 6.1 Vérification rapide de santé

```bash
kubectl get pods -n fieldops-data
kubectl get pods -n fieldops-observability
kubectl get ingressroutes.traefik.io -A
kubectl get middlewares.traefik.io -A
```

### 6.2 Vérifier les routes Traefik (Host-based)

L'UI web des outils observabilité/data doit utiliser des hôtes dédiés (pas des sous-chemins), sinon les assets JS/CSS peuvent casser.

Hôtes recommandés:
- `grafana.fieldops.local`
- `rabbitmq.fieldops.local`
- `jaeger.fieldops.local`
- `minio.fieldops.local`

Test depuis la VM:

```bash
curl -k -I https://192.168.50.10 -H "Host: grafana.fieldops.local"
curl -k -I https://192.168.50.10 -H "Host: rabbitmq.fieldops.local"
curl -k -I https://192.168.50.10 -H "Host: jaeger.fieldops.local"
curl -k -I https://192.168.50.10 -H "Host: minio.fieldops.local"
```

### 6.3 Entrées hosts sur Windows

Ajouter dans `C:\Windows\System32\drivers\etc\hosts`:

```txt
192.168.50.10 grafana.fieldops.local
192.168.50.10 rabbitmq.fieldops.local
192.168.50.10 jaeger.fieldops.local
192.168.50.10 minio.fieldops.local
```

### 6.4 Identifiants utiles (décodage depuis secrets)

RabbitMQ:

```bash
kubectl get secret -n fieldops-data rabbitmq -o jsonpath='{.data.rabbitmq-password}' | base64 -d; echo
```

Grafana:

```bash
kubectl get secret -n fieldops-observability kube-prometheus-grafana -o jsonpath='{.data.admin-password}' | base64 -d; echo
```

MinIO:

```bash
kubectl get secret -n fieldops-data minio -o jsonpath='{.data.rootUser}' | base64 -d; echo
kubectl get secret -n fieldops-data minio -o jsonpath='{.data.rootPassword}' | base64 -d; echo
```

> Note: le secret MinIO utilise `rootUser`/`rootPassword` (camelCase), pas `root-user`/`root-password`.

### 6.5 Corrections rapides connues

1. RabbitMQ en `0/1` avec erreurs de probe:
```bash
kubectl describe pod -n fieldops-data rabbitmq-0 | tail -30
```
Si besoin de recréer le pod après mise à jour Helm:
```bash
kubectl delete pod -n fieldops-data rabbitmq-0
```

2. Vault `Sealed` après redémarrage:
```bash
kubectl exec -n fieldops-data vault-0 -- vault operator unseal <UNSEAL_KEY>
```

3. RabbitMQ `401 not_authorized` dans UI:
- Vérifier mot de passe réel depuis secret.
- Si dérive de l'utilisateur dans l'état RabbitMQ:
```bash
kubectl exec -n fieldops-data rabbitmq-0 -- rabbitmqctl change_password fieldops <PASSWORD>
kubectl exec -n fieldops-data rabbitmq-0 -- rabbitmqctl set_user_tags fieldops administrator
kubectl exec -n fieldops-data rabbitmq-0 -- rabbitmqctl set_permissions -p / fieldops ".*" ".*" ".*"
```

4. Erreur certificat navigateur (host spécifique):
- Accepter le certificat autosigné pour chaque host (`grafana.fieldops.local`, `rabbitmq.fieldops.local`, etc.).

### 6.6 One-liner de contrôle final

```bash
kubectl get pods -n fieldops-data && \
kubectl get pods -n fieldops-observability && \
kubectl get ingressroutes.traefik.io -A && \
curl -k -I https://192.168.50.10 -H "Host: grafana.fieldops.local" && \
curl -k -I https://192.168.50.10 -H "Host: rabbitmq.fieldops.local" && \
curl -k -I https://192.168.50.10 -H "Host: jaeger.fieldops.local" && \
curl -k -I https://192.168.50.10 -H "Host: minio.fieldops.local"
```
