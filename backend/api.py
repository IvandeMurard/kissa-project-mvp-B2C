import os
import sys
import logging
from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
from dotenv import load_dotenv
from pydantic import BaseModel
from starlette.middleware.base import BaseHTTPMiddleware
import time

# Configuration du logging pour forcer l'affichage
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Import de notre moteur
from main import KissaCore

# Chargement des variables d'environnement
load_dotenv()

# --- CONFIGURATION SUPABASE ---
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")

if not url or not key:
    print("⚠️  ATTENTION : SUPABASE_URL ou SUPABASE_KEY manquant dans le .env")

# Initialisation du client Supabase
supabase: Client = create_client(url, key)

# --- CONFIGURATION FASTAPI ---
app = FastAPI(title="Kissa API", description="Backend avec mémoire Supabase")

# --- BLOC CORS CRITIQUE (IMMEDIATEMENT APRES app = FastAPI()) ---
# Doit être placé IMMEDIATEMENT après app = FastAPI() pour garantir le fonctionnement
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Middleware pour logger toutes les requêtes (EN SECOND)
class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        logger.info("="*70)
        logger.info(f"🌐 REQUÊTE REÇUE: {request.method} {request.url.path}")
        logger.info(f"   Headers: {dict(request.headers)}")
        sys.stdout.flush()  # Force l'affichage immédiat
        
        if request.method == "POST":
            try:
                body = await request.body()
                logger.info(f"   Body: {body.decode()[:200]}")
                sys.stdout.flush()
            except:
                pass
        
        response = await call_next(request)
        
        process_time = time.time() - start_time
        logger.info(f"✅ RÉPONSE: {response.status_code} (temps: {process_time:.2f}s)")
        logger.info("="*70)
        sys.stdout.flush()
        return response

app.add_middleware(LoggingMiddleware)

# On démarre le moteur Kissa
kissa = KissaCore()

@app.get("/")
def read_root():
    logger.info("="*70)
    logger.info("🔥 TEST - REQUÊTE GET / REÇUE")
    logger.info("="*70)
    sys.stdout.flush()
    return {"message": "API Kissa connectée à Supabase. Prête ! 🚀"}

@app.get("/library")
def get_library():
    """
    Récupère tous les albums enregistrés dans Supabase.
    Classés du plus récent au plus ancien.
    """
    try:
        # On interroge la table 'albums', on trie par date de création descendante
        response = supabase.table("albums").select("*").order("created_at", desc=True).execute()
        return response.data
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
    temp_filename = f"temp_{file.filename}"
    
    try:
        # A. Sauvegarde temporaire
        print(f"📥 Réception : {file.filename}")
        contents = await file.read()
        if len(contents) == 0:
            raise HTTPException(status_code=400, detail="Fichier vide.")
            
        with open(temp_filename, "wb") as f:
            f.write(contents)

        # B. Analyse Kissa
        result = kissa.process(temp_filename)
        
        # C. Nettoyage image
        if os.path.exists(temp_filename):
            os.remove(temp_filename)
            
        # D. Vérification erreur
        if result.get("status") == "error":
            raise HTTPException(status_code=404, detail=result["message"])

        # E. SAUVEGARDE DANS SUPABASE (L'étape cruciale)
        # On prépare l'objet à plat pour la base de données
        new_album = {
            "artist": result['display']['artist'],
            "title": result['display']['title'],
            "cover_image": result['display']['cover_image'],
            "year": result['details']['year'],
            "label": result['details']['label'],
            "genre": result['details']['genre'], # Supabase gère les tableaux (text[])
            "spotify_url": result['links']['spotify_url'],
            "discogs_url": result['links']['discogs_url']
        }

        print("💾 Sauvegarde en base de données...")
        db_response = supabase.table("albums").insert(new_album).execute()
        
        # On renvoie le résultat complet (incluant potentiellement l'ID créé)
        return result

    except HTTPException as he:
        if os.path.exists(temp_filename):
            os.remove(temp_filename)
        raise he
    except Exception as e:
        print(f"❌ Erreur critique : {e}")
        if os.path.exists(temp_filename):
            os.remove(temp_filename)
        raise HTTPException(status_code=500, detail=str(e))

# NOUVELLE ROUTE : SUPPRIMER UN ALBUM
@app.delete("/album/{album_id}")
def delete_album(album_id: str):
    try:
        # On demande à Supabase de supprimer la ligne où l'id correspond
        response = supabase.table("albums").delete().eq("id", album_id).execute()
        return {"message": "Album supprimé"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Définition du format de donnée reçue
class SearchRequest(BaseModel):
    query: str

@app.post("/search-manual")
async def search_manual_vinyl(request: SearchRequest):
    """Reçoit un texte, cherche sur Discogs/Spotify et sauvegarde."""
    try:
        # A. Recherche
        result = kissa.search_by_text(request.query)
        
        if result.get("status") == "error":
            raise HTTPException(status_code=404, detail=result["message"])
        # B. Sauvegarde Supabase (Copier-coller de la logique du scan)
        new_album = {
            "artist": result['display']['artist'],
            "title": result['display']['title'],
            "cover_image": result['display']['cover_image'],
            "year": result['details']['year'],
            "label": result['details']['label'],
            "genre": result['details']['genre'],
            "spotify_url": result['links']['spotify_url'],
            "discogs_url": result['links']['discogs_url']
        }
        
        print(f"💾 Sauvegarde manuelle : {new_album['title']}")
        supabase.table("albums").insert(new_album).execute()
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class CandidateRequest(BaseModel):
    query: str

class AddByIdRequest(BaseModel):
    discogs_id: int

@app.get("/test-simple")
def test_simple():
    """Endpoint de test ultra-simple"""
    logger.info("="*70)
    logger.info("🧪 TEST SIMPLE - GET /test-simple")
    logger.info("="*70)
    sys.stdout.flush()
    return {"test": "OK", "message": "Le serveur fonctionne !"}

@app.get("/test-search")
def test_search_direct():
    """Endpoint de test pour vérifier que la recherche fonctionne"""
    try:
        logger.info("="*70)
        logger.info("🧪 TEST DIRECT - Recherche 'Apparat'")
        logger.info("="*70)
        sys.stdout.flush()
        results = kissa.search_candidates("Apparat")
        logger.info(f"🧪 Résultats : {len(results)} éléments")
        logger.info("="*70)
        sys.stdout.flush()
        return {"count": len(results), "results": results[:3] if len(results) > 0 else []}
    except Exception as e:
        logger.error(f"❌ Erreur test : {e}")
        import traceback
        traceback.print_exc()
        sys.stdout.flush()
        return {"error": str(e)}

@app.post("/search-candidates")
def get_candidates(request: CandidateRequest):
    """Renvoie une liste de vinyles possibles"""
    try:
        logger.info("="*70)
        logger.info(f"🔍 RECHERCHE REÇUE : '{request.query}'")
        logger.info("="*70)
        logger.info(f"📥 Type de la requête : {type(request)}")
        logger.info(f"📥 Query value : {request.query}")
        sys.stdout.flush()
        
        # Test direct pour voir si kissa fonctionne
        logger.info(f"🔍 Test direct avec kissa.search_candidates...")
        sys.stdout.flush()
        results = kissa.search_candidates(request.query)
        logger.info(f"📤 Résultats obtenus : {len(results)} éléments, type: {type(results)}")
        sys.stdout.flush()
        
        if len(results) == 0:
            logger.warning("⚠️ ATTENTION : Liste vide retournée par search_candidates")
            # Test avec une requête fixe pour voir si c'est la requête qui pose problème
            test_results = kissa.search_candidates("Apparat")
            logger.info(f"🧪 Test avec 'Apparat' : {len(test_results)} résultats")
            sys.stdout.flush()
        
        # S'assurer que les résultats sont sérialisables en JSON
        serializable_results = []
        for result in results:
            try:
                serializable_result = {
                    "discogs_id": int(result.get("discogs_id", 0)) if result.get("discogs_id") else 0,
                    "title": str(result.get("title", "")),
                    "artist": str(result.get("artist", "")),
                    "year": str(result.get("year", "")),
                    "label": str(result.get("label", "")),
                    "thumb": str(result.get("thumb", ""))
                }
                serializable_results.append(serializable_result)
            except Exception as item_error:
                logger.warning(f"⚠️ Erreur sérialisation item : {item_error}")
                continue
        
        logger.info(f"📤 Résultats sérialisés : {len(serializable_results)} éléments")
        sys.stdout.flush()
        return serializable_results
    except Exception as e:
        logger.error(f"❌ Erreur dans /search-candidates : {e}")
        import traceback
        traceback.print_exc()
        sys.stdout.flush()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/add-by-id")
async def add_vinyl_by_id(request: AddByIdRequest):
    """Ajoute le vinyle spécifique choisi par l'utilisateur"""
    try:
        # A. Récupération des détails complets
        result = kissa.process_by_id(request.discogs_id)
        
        if result.get("status") == "error":
            raise HTTPException(status_code=404, detail=result["message"])
        # B. Sauvegarde Supabase
        new_album = {
            "artist": result['display']['artist'],
            "title": result['display']['title'],
            "cover_image": result['display']['cover_image'],
            "year": result['details']['year'],
            "label": result['details']['label'],
            "genre": result['details']['genre'],
            "spotify_url": result['links']['spotify_url'],
            "discogs_url": result['links']['discogs_url']
        }
        
        supabase.table("albums").insert(new_album).execute()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/albums/{album_id}/toggle-track/{track_index}")
def toggle_focus_track(album_id: str, track_index: int):
    """Toggle le statut Focus Track d'une piste."""
    try:
        response = supabase.table("albums").select("id, focus_track_indices, tracklist").eq("id", album_id).execute()
        if not response.data or len(response.data) == 0:
            raise HTTPException(status_code=404, detail=f"Album avec l'ID {album_id} introuvable")
        album = response.data[0]
        current_indices = album.get("focus_track_indices") or []
        if track_index in current_indices:
            updated_indices = [i for i in current_indices if i != track_index]
        else:
            updated_indices = sorted(current_indices + [track_index])
        update_response = supabase.table("albums").update(
            {"focus_track_indices": updated_indices}
        ).eq("id", album_id).execute()
        if not update_response.data:
            raise HTTPException(status_code=500, detail="Erreur lors de la mise à jour")
        return update_response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/albums/{album_id}/favorite")
def toggle_favorite(album_id: str):
    """Toggle le statut favori (is_favorite) d'un album."""
    try:
        response = supabase.table("albums").select("id, is_favorite").eq("id", album_id).execute()
        if not response.data or len(response.data) == 0:
            raise HTTPException(status_code=404, detail=f"Album avec l'ID {album_id} introuvable")
        album = response.data[0]
        current = album.get("is_favorite")
        new_value = not (current is True)
        update_response = supabase.table("albums").update(
            {"is_favorite": new_value}
        ).eq("id", album_id).execute()
        if not update_response.data:
            raise HTTPException(status_code=500, detail="Erreur lors de la mise à jour")
        return update_response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
