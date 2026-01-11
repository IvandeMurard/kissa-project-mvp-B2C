from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import shutil
import os
from main import KissaCore

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
        response = kissa.get_library()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/album/{album_id}")
def delete_album(album_id: str):
    try:
        # Note: Assure-toi que ta méthode delete existe dans main.py ou utilise supabase directement ici
        # Si tu utilises supabase direct dans api.py, assure-toi d'avoir importé supabase
        # Sinon, pour faire simple, on suppose que kissa a une méthode delete ou on l'ajoute
        # Voici la version simple directe si tu as supabase ici, sinon via kissa:
        response = kissa.supabase.table("albums").delete().eq("id", album_id).execute()
        return {"message": "Album supprimé"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/scan")
async def scan_vinyl(file: UploadFile = File(...)):
    file_location = f"temp_{file.filename}"
    try:
        with open(file_location, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        result = kissa.process(file_location)
        
        if result.get("status") == "error":
             raise HTTPException(status_code=400, detail=result["message"])
             
        # Sauvegarde
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
        kissa.supabase.table("albums").insert(new_album).execute()
        
        return result
        
    except Exception as e:
        print(f"Erreur API: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(file_location):
            os.remove(file_location)

@app.post("/search-candidates")
async def get_candidates(request: CandidateRequest):
    return kissa.search_candidates(request.query)

@app.post("/add-by-id")
async def add_vinyl_by_id(request: AddByIdRequest):
    try:
        result = kissa.process_by_id(request.discogs_id)
        if result.get("status") == "error":
            raise HTTPException(status_code=404, detail=result["message"])

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
        
        kissa.supabase.table("albums").insert(new_album).execute()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))