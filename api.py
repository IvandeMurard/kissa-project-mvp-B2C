"""
=== MIGRATION SUPABASE ===
À exécuter manuellement dans Supabase SQL Editor :

-- Migration : Focus Track Indices (Pistes favorites pour DJs/Sélecteurs)
ALTER TABLE albums
ADD COLUMN IF NOT EXISTS focus_track_indices INTEGER[] DEFAULT '{}';

Cette colonne permet de stocker les indices des pistes marquées comme "Favorites" ou "Pépites".
Exemple : [0, 2] signifie que la piste 1 (index 0) et la piste 3 (index 2) sont marquées.
"""

import sys
import io

# Configuration de l'encodage UTF-8 pour Windows
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import shutil
import os
import uuid
from main import KissaCore
from supabase import create_client, Client
from dotenv import load_dotenv

# Chargement des variables d'environnement
load_dotenv()

# --- CONFIGURATION SUPABASE ---
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")

if not url or not key:
    print("⚠️  ATTENTION : SUPABASE_URL ou SUPABASE_KEY manquant dans le .env")

# Initialisation du client Supabase
supabase: Client = create_client(url, key)

# Création de l'application
app = FastAPI()

# --- BLOC SÉCURITÉ (CORS) ---
# Doit être placé IMMÉDIATEMENT après app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# -----------------------------

kissa = KissaCore()

# Modèles de données
class SearchRequest(BaseModel):
    query: str

class AddByIdRequest(BaseModel):
    discogs_id: int

class CandidateRequest(BaseModel):
    query: str

class PurchaseDataUpdate(BaseModel):
    """Modèle pour mettre à jour les données d'achat (mémoire personnelle) et la localisation physique"""
    date: Optional[str] = None
    location: Optional[str] = None
    price: Optional[float] = None
    condition: Optional[str] = None
    storage_location: Optional[str] = None
    mood_colors: Optional[List[str]] = None

class GenerateNotesResponse(BaseModel):
    """Réponse de génération de notes éditoriales"""
    editorial_notes: str
    album_id: str

@app.get("/")
def read_root():
    return {"message": "API Kissa connectée à Supabase. Prête ! 🚀"}

@app.get("/library")
def get_library():
    try:
        response = supabase.table("albums").select("*").order("created_at", desc=True).execute()
        data = response.data
        print(f"Library fetch: {len(data)} items found")
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/album/{album_id}")
def delete_album(album_id: str):
    try:
        # Note: Assure-toi que ta méthode delete existe dans main.py ou utilise supabase directement ici
        # Si tu utilises supabase direct dans api.py, assure-toi d'avoir importé supabase
        # Sinon, pour faire simple, on suppose que kissa a une méthode delete ou on l'ajoute
        # Voici la version simple directe si tu as supabase ici, sinon via kissa:
        response = supabase.table("albums").delete().eq("id", album_id).execute()
        return {"message": "Album supprimé"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/scan")
async def scan_vinyl(file: UploadFile = File(...)):
    """
    1. Reçoit l'image
    2. Analyse avec Kissa (Google/Discogs/Spotify)
    3. Sauvegarde le résultat dans Supabase
    4. Renvoie le résultat au frontend
    """
    file_location = f"temp_{uuid.uuid4()}.jpg"
    
    try:
        # A. Vérification fichier vide AVANT de lancer les processus lourds
        print(f"📥 Réception : {file.filename}")
        contents = await file.read()
        if len(contents) == 0:
            raise HTTPException(status_code=400, detail="Fichier vide.")
            
        with open(file_location, "wb") as f:
            f.write(contents)

        # B. Analyse Kissa
        result = kissa.process(file_location)
        
        # C. Nettoyage image après analyse
        if os.path.exists(file_location):
            os.remove(file_location)
            
        # D. Vérification erreur
        if result.get("status") == "error":
            raise HTTPException(status_code=400, detail=result["message"])

        # E. Sauvegarde dans Supabase
        new_album = {
            "artist": result['display']['artist'],
            "title": result['display']['title'],
            "cover_image": result['display']['cover_image'],
            "year": result['details']['year'],
            "label": result['details']['label'],
            "genre": result['details']['genre'],
            "spotify_url": result['links']['spotify_url'],
            "discogs_url": result['links']['discogs_url'],
            "tracklist": result['details']['tracklist']
        }

        print("💾 Sauvegarde en base de données...")
        supabase.table("albums").insert(new_album).execute()
        
        return result

    except HTTPException as he:
        # Erreurs "prévues" (400/404) : on les laisse passer telles quelles
        if os.path.exists(file_location):
            os.remove(file_location)
        raise he
    except Exception as e:
        # Crashs imprévus : deviennent 500
        print(f"Erreur API: {e}")
        if os.path.exists(file_location):
            os.remove(file_location)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/search-candidates")
async def get_candidates(request: CandidateRequest):
    return kissa.search_candidates(request.query)

@app.post("/add-by-id")
async def add_vinyl_by_id(request: AddByIdRequest):
    """Ajoute le vinyle spécifique choisi par l'utilisateur"""
    try:
        result = kissa.process_by_id(request.discogs_id)
        if result.get("status") == "error":
            raise HTTPException(status_code=404, detail=result["message"])

        # Sauvegarde dans Supabase
        new_album = {
            "artist": result['display']['artist'],
            "title": result['display']['title'],
            "cover_image": result['display']['cover_image'],
            "year": result['details']['year'],
            "label": result['details']['label'],
            "genre": result['details']['genre'],
            "spotify_url": result['links']['spotify_url'],
            "discogs_url": result['links']['discogs_url'],
            "tracklist": result['details']['tracklist']
        }
        
        supabase.table("albums").insert(new_album).execute()
        return result
    except HTTPException as he:
        # Erreurs "prévues" (404) : on les laisse passer telles quelles
        raise he
    except Exception as e:
        # Crashs imprévus : deviennent 500
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/albums/{album_id}/generate-notes")
async def generate_editorial_notes(album_id: str):
    """
    Génère du contenu éditorial via GPT-4o sur l'album.
    Style critique musical expert (Rolling Stone / Pitchfork mais concis).
    """
    try:
        # 1. Vérifier que le client OpenAI est disponible
        if not kissa.openai_client:
            raise HTTPException(
                status_code=500, 
                detail="OpenAI client non disponible. Vérifiez OPENAI_API_KEY dans le .env"
            )
        
        # 2. Récupérer l'album depuis Supabase
        response = supabase.table("albums").select("id, artist, title").eq("id", album_id).execute()
        
        if not response.data or len(response.data) == 0:
            raise HTTPException(status_code=404, detail=f"Album avec l'ID {album_id} introuvable")
        
        album = response.data[0]
        artist = album.get("artist", "Artiste inconnu")
        title = album.get("title", "Titre inconnu")
        
        # 3. Construire le prompt pour GPT-4o
        system_prompt = """Tu es le propriétaire d'un 'Jazz Kissa' (bar audiophile) à Tokyo. Tu es un expert musical passionné, poétique et précis.
Ta mission est d'écrire une courte note de pochette (Liner Note) pour l'album : {artist} - {title}.

Règles de style :
1. **Ton :** Intime, atmosphérique, narratif. Utilise le présent de narration. Ne sois pas scolaire.
2. **Structure :**
   * Commence par une phrase d'accroche sensorielle (ambiance, son, contexte).
   * Raconte une anecdote spécifique sur l'enregistrement ou l'artiste (pas de biographie générale).
   * Termine par une phrase sur pourquoi cet album est essentiel dans une collection.
3. **Format :** Markdown léger. Mets les mots importants en gras.
4. **Longueur :** 150 mots maximum.
5. **Langue :** Français élégant.

Exemple de ton attendu : 'Dès les premières mesures de Space is Only Noise, on entend le craquement du bois et la poussière. Nicolas Jaar ne fait pas de la techno, il sculpte le silence...'"""

        user_prompt = f"Écris un texte éditorial sur l'album '{title}' de {artist}."
        
        # 4. Appeler GPT-4o
        print(f"🤖 Génération de notes éditoriales pour {artist} - {title}...")
        openai_response = kissa.openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7,
            max_tokens=300  # Limite pour garantir ~150 mots
        )
        
        editorial_notes = openai_response.choices[0].message.content.strip()
        
        # 5. Sauvegarder dans Supabase
        supabase.table("albums").update({"editorial_notes": editorial_notes}).eq("id", album_id).execute()
        
        print(f"✅ Notes éditoriales générées et sauvegardées pour {album_id}")
        
        # 6. Retourner le résultat
        return GenerateNotesResponse(
            editorial_notes=editorial_notes,
            album_id=album_id
        )
        
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"❌ Erreur lors de la génération de notes : {e}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de la génération de notes : {str(e)}")

@app.patch("/albums/{album_id}/context")
async def update_purchase_context(album_id: str, purchase_data: PurchaseDataUpdate):
    """
    Met à jour le champ purchase_data (mémoire personnelle), storage_location et/ou mood_colors d'un album.
    Permet de stocker : date, location, price, condition, storage_location, mood_colors.
    """
    try:
        # 1. Vérifier que l'album existe
        check_response = supabase.table("albums").select("id").eq("id", album_id).execute()
        
        if not check_response.data or len(check_response.data) == 0:
            raise HTTPException(status_code=404, detail=f"Album avec l'ID {album_id} introuvable")
        
        # 2. Construire l'objet purchase_data (seulement les champs fournis)
        purchase_dict = {}
        if purchase_data.date is not None:
            purchase_dict["date"] = purchase_data.date
        if purchase_data.location is not None:
            purchase_dict["location"] = purchase_data.location
        if purchase_data.price is not None:
            purchase_dict["price"] = purchase_data.price
        if purchase_data.condition is not None:
            purchase_dict["condition"] = purchase_data.condition
        
        has_storage = purchase_data.storage_location is not None
        has_mood_colors = purchase_data.mood_colors is not None
        
        # Au moins un champ requis (purchase, storage_location ou mood_colors)
        if not purchase_dict and not has_storage and not has_mood_colors:
            raise HTTPException(
                status_code=400,
                detail="Au moins un champ doit être fourni (date, location, price, condition, storage_location, mood_colors)"
            )
        
        update_payload = {}
        
        if purchase_dict:
            existing_response = supabase.table("albums").select("purchase_data").eq("id", album_id).execute()
            existing_purchase_data = existing_response.data[0].get("purchase_data") or {}
            update_payload["purchase_data"] = {**existing_purchase_data, **purchase_dict}
        
        if has_storage:
            update_payload["storage_location"] = purchase_data.storage_location
        
        if has_mood_colors:
            update_payload["mood_colors"] = purchase_data.mood_colors
        
        update_response = supabase.table("albums").update(update_payload).eq("id", album_id).execute()
        
        if not update_response.data:
            raise HTTPException(status_code=500, detail="Erreur lors de la mise à jour")
        
        print(f"✅ Contexte d'achat mis à jour pour l'album {album_id}")
        
        return update_response.data[0]
        
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"❌ Erreur lors de la mise à jour du contexte : {e}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de la mise à jour : {str(e)}")

@app.patch("/albums/{album_id}/toggle-track/{track_index}")
async def toggle_focus_track(album_id: str, track_index: int):
    """
    Toggle le statut "Focus Track" d'une piste spécifique d'un album.
    Si la piste est déjà marquée, elle est retirée. Sinon, elle est ajoutée.
    """
    try:
        # 1. Vérifier que l'album existe
        response = supabase.table("albums").select("id, focus_track_indices, tracklist").eq("id", album_id).execute()
        
        if not response.data or len(response.data) == 0:
            raise HTTPException(status_code=404, detail=f"Album avec l'ID {album_id} introuvable")
        
        album = response.data[0]
        
        # 2. Valider track_index
        if track_index < 0:
            raise HTTPException(status_code=400, detail="track_index doit être un entier positif ou nul")
        
        # Optionnel : vérifier que l'index correspond à une piste existante
        tracklist = album.get("tracklist") or []
        if tracklist and track_index >= len(tracklist):
            raise HTTPException(
                status_code=400, 
                detail=f"track_index {track_index} est hors limites (album contient {len(tracklist)} piste(s))"
            )
        
        # 3. Récupérer la liste actuelle des indices focus
        current_indices = album.get("focus_track_indices") or []
        
        # 4. Toggle : si présent, retirer ; sinon, ajouter
        if track_index in current_indices:
            updated_indices = [i for i in current_indices if i != track_index]
        else:
            updated_indices = sorted(current_indices + [track_index])
        
        # 5. Sauvegarder dans Supabase
        update_response = supabase.table("albums").update(
            {"focus_track_indices": updated_indices}
        ).eq("id", album_id).execute()
        
        if not update_response.data:
            raise HTTPException(status_code=500, detail="Erreur lors de la mise à jour")
        
        print(f"✅ Focus track togglé pour l'album {album_id}, piste {track_index}. Indices: {updated_indices}")
        
        # 6. Retourner l'album mis à jour
        return update_response.data[0]
        
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"❌ Erreur lors du toggle focus track : {e}")
        raise HTTPException(status_code=500, detail=f"Erreur lors du toggle : {str(e)}")
