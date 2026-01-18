# Configuration des variables d'environnement

Ce guide explique comment configurer les variables d'environnement nécessaires pour faire fonctionner l'application Kissa.

## Variables requises

L'application nécessite les variables d'environnement suivantes :

- `NEXT_PUBLIC_SUPABASE_URL` : L'URL de votre projet Supabase
- `NEXT_PUBLIC_SUPABASE_KEY` : La clé API publique (anon/public key) de votre projet Supabase
- `NEXT_PUBLIC_API_URL` : L'URL de votre backend API (optionnel, par défaut : `http://127.0.0.1:8000`)

## 1. Obtenir les clés Supabase

1. Allez sur [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Connectez-vous ou créez un compte
3. Sélectionnez votre projet (ou créez-en un nouveau)
4. Allez dans **Settings** → **API**
5. Vous trouverez :
   - **Project URL** → C'est votre `NEXT_PUBLIC_SUPABASE_URL`
   - **Project API keys** → **anon/public** key → C'est votre `NEXT_PUBLIC_SUPABASE_KEY`

## 2. Configuration pour le développement local

1. Dans le dossier `kissa-frontend`, créez un fichier `.env.local` (s'il n'existe pas déjà)
2. Ajoutez les variables suivantes :

```env
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_KEY=votre_cle_anon_ou_public
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

3. Remplacez les valeurs par vos vraies clés Supabase
4. Redémarrez le serveur de développement Next.js (`npm run dev`)

> **Note** : Le fichier `.env.local` est ignoré par git et ne sera pas commité. C'est normal et souhaitable pour la sécurité.

## 3. Configuration pour Vercel (production)

### Via l'interface Vercel

1. Allez sur [https://vercel.com/dashboard](https://vercel.com/dashboard)
2. Sélectionnez votre projet
3. Allez dans **Settings** → **Environment Variables**
4. Ajoutez chaque variable :
   - Cliquez sur **Add New**
   - Entrez le nom de la variable (ex: `NEXT_PUBLIC_SUPABASE_URL`)
   - Entrez la valeur
   - Sélectionnez les environnements concernés :
     - **Production** : pour le site en production
     - **Preview** : pour les déploiements de prévisualisation (branches)
     - **Development** : pour les environnements de développement (si utilisé)
   - Cliquez sur **Save**
5. Répétez pour `NEXT_PUBLIC_SUPABASE_KEY` et `NEXT_PUBLIC_API_URL` (si nécessaire)
6. **Important** : Redéployez l'application pour que les nouvelles variables prennent effet
   - Allez dans **Deployments**
   - Cliquez sur les trois points (⋯) du dernier déploiement
   - Sélectionnez **Redeploy**

### Via la CLI Vercel

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_KEY production
vercel env add NEXT_PUBLIC_API_URL production
```

## 4. Vérification

Pour vérifier que les variables sont bien configurées :

1. **En local** : Vérifiez que le fichier `.env.local` contient bien toutes les variables
2. **Sur Vercel** : Allez dans Settings → Environment Variables et vérifiez que toutes les variables sont présentes
3. **Dans l'application** : Si les variables ne sont pas configurées, vous verrez un message d'erreur avec des instructions détaillées

## 5. Structure de la base de données Supabase

Assurez-vous que votre base de données Supabase contient une table `albums` avec les colonnes suivantes :

- `id` (uuid, primary key)
- `artist` (text)
- `title` (text)
- `cover_image` (text)
- `year` (text)
- `label` (text)
- `genre` (text array)
- `spotify_url` (text)
- `discogs_url` (text)
- `tracklist` (text array, optionnel)
- `created_at` (timestamp, auto-generated)

## Dépannage

### Les variables ne sont pas prises en compte

- Vérifiez que vous avez bien redémarré le serveur de développement après avoir créé/modifié `.env.local`
- Vérifiez que les noms des variables commencent bien par `NEXT_PUBLIC_` pour Next.js
- Pour Vercel, assurez-vous d'avoir redéployé l'application après avoir ajouté les variables

### Erreur "Supabase client non initialisé"

- Vérifiez que les variables d'environnement sont bien définies
- Vérifiez que vous n'avez pas d'erreurs de typo dans les noms des variables
- Vérifiez que les valeurs ne sont pas vides ou mal formatées

### La base de données ne se connecte pas

- Vérifiez que l'URL Supabase est correcte (commence par `https://`)
- Vérifiez que la clé API est la bonne (anon/public key, pas la service_role key)
- Vérifiez que votre projet Supabase est actif

## 6. Sécurité des clés API

### Pourquoi les clés NEXT_PUBLIC_* sont publiques ?

Les variables d'environnement préfixées par `NEXT_PUBLIC_` dans Next.js sont incluses dans le bundle JavaScript côté client. Cela signifie qu'elles sont visibles dans le code source du navigateur. **C'est normal et attendu** pour Supabase.

### Clés publiques vs privées

**Clés publiques (anon/public) :**
- Conçues pour être exposées côté client
- Utilisées pour `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_KEY`
- Ne permettent PAS d'administrer la base de données
- Ne permettent PAS d'accéder aux données sans Row Level Security (RLS)

**Clés privées (service_role) :**
- ⚠️ **JAMAIS** utiliser côté client
- Accès complet à la base de données (bypass RLS)
- Réservées au backend/server-side uniquement
- Doivent rester secrètes

### Sécurité assurée par Row Level Security (RLS)

La sécurité de vos données est assurée par les **politiques RLS** dans Supabase, pas par la confidentialité des clés :

1. **RLS activé** : Activez Row Level Security pour toutes vos tables dans Supabase
2. **Politiques de sécurité** : Configurez des politiques pour limiter l'accès aux données
3. **Authentification** : Utilisez l'authentification Supabase pour identifier les utilisateurs
4. **Politiques basées sur l'utilisateur** : Limitez l'accès aux données en fonction de l'utilisateur connecté

### Bonnes pratiques de sécurité

1. ✅ Utiliser uniquement la clé **anon/public** côté client
2. ✅ Activer **RLS** pour toutes les tables dans Supabase
3. ✅ Configurer des **politiques RLS** appropriées pour limiter l'accès
4. ✅ Ne jamais commiter les vraies clés dans Git (utiliser `.env.local` qui est ignoré)
5. ✅ Utiliser `.env.local` pour le développement local (jamais commité)
6. ✅ Configurer les variables via l'interface Vercel pour la production
7. ❌ Ne jamais utiliser la clé **service_role** côté client
8. ❌ Ne jamais exposer la clé service_role dans le code frontend

### Exemple de politique RLS (Supabase)

Pour protéger votre table `albums`, vous pourriez avoir une politique comme :

```sql
-- Permettre à tous les utilisateurs authentifiés de lire les albums
CREATE POLICY "Users can read albums"
ON albums FOR SELECT
TO authenticated
USING (true);

-- Permettre à tous les utilisateurs authentifiés d'insérer des albums
CREATE POLICY "Users can insert albums"
ON albums FOR INSERT
TO authenticated
WITH CHECK (true);
```

Pour plus d'informations sur RLS dans Supabase, consultez la [documentation officielle](https://supabase.com/docs/guides/auth/row-level-security).
