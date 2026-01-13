from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
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