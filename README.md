# 喫茶 KISSA - AI Vinyl Companion 💿

**Kissa** est une application Fullstack permettant de numériser et gérer une collection de vinyles instantanément.
En prenant simplement une photo d'une pochette, l'application identifie l'album grâce à une chaîne d'IA hybride, récupère les métadonnées (Discogs), les liens de streaming (Spotify) et sauvegarde le tout dans une bibliothèque personnelle.

![Status](https://img.shields.io/badge/Status-MVP%20Live-success)
![Stack](https://img.shields.io/badge/Stack-Next.js%20%7C%20FastAPI%20%7C%20Supabase-blue)

## ✨ Fonctionnalités

* **Scan Visuel Intelligent** : Identification d'albums via caméra mobile (compatible reflets et pochettes complexes).
* **Pipeline IA Avancé** : Utilisation de Google Vision (Web Entities + OCR) combiné à un **LLM Reasoning (GPT-4o)** pour nettoyer et contextualiser les données brutes avant la recherche.
* **Recherche Manuelle** : Fallback manuel pour les disques introuvables visuellement.
* **Bibliothèque Cloud** : Sauvegarde persistante des albums, artistes, années et tracklists.
* **Streaming** : Lien direct vers l'album sur Spotify.
* **Gestion** : Suppression et consultation détaillée des albums.

## 🏗️ Architecture & Pipeline de Vision

L'application repose sur une architecture découplée (Frontend Vercel / Backend Render) :

1.  **Input** : L'utilisateur envoie une photo via le Frontend Next.js.
2.  **Vision (Google Cloud)** : Analyse de l'image (Web Detection pour les pochettes connues + OCR pour le texte).
3.  **Reasoning (OpenAI GPT-4o)** : Un agent LLM analyse les données brutes pour séparer le "bruit" (ex: "Stereo", "LP") de l'information utile (Artiste, Titre).
4.  **Metadata (Discogs)** : Recherche précise basée sur les données nettoyées.
5.  **Enrichissement (Spotify)** : Récupération du lien d'écoute.
6.  **Stockage (Supabase)** : Sauvegarde en base de données PostgreSQL.

## 🛠️ Stack Technique

### Frontend
* **Framework** : Next.js 14 (App Router)
* **Langage** : TypeScript
* **Styling** : Tailwind CSS
* **Hébergement** : Vercel

### Backend (API)
* **Framework** : FastAPI (Python 3.10+)
* **IA & Data** : Google Cloud Vision, OpenAI API, Discogs Client, Spotipy
* **Serveur** : Uvicorn
* **Hébergement** : Render

### Base de données
* **SGBD** : Supabase (PostgreSQL)

---

### 🔮 Roadmap (Futur)
[ ] Agent Vision Autonome (Niveau 3) : Envoyer l'image directement au LLM pour une analyse stylistique (polices illisibles, logos).

[ ] Mode Social : Partager sa collection ou ses écoutes.

[ ] Export Discogs : Synchroniser la collection Kissa vers un compte Discogs.

📄 Licence
Projet Open Source - MIT License.

### Auteur
Ivan de Murard
