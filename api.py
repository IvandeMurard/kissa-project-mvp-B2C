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
from typing import Optional, List, Dict, Tuple
import difflib
import shutil
import os
import tempfile
import unicodedata
import uuid
import requests
import colorgram
from pathlib import Path
from dotenv import load_dotenv

# Charger .env depuis le répertoire du projet (évite les soucis de CWD au démarrage)
load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env")

from main import KissaCore
from supabase import create_client, Client

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
    """Modèle pour mettre à jour les données d'achat (mémoire personnelle), localisation physique et notes personnelles"""
    date: Optional[str] = None
    location: Optional[str] = None
    price: Optional[float] = None
    condition: Optional[str] = None
    storage_location: Optional[str] = None
    mood_colors: Optional[List[str]] = None
    personal_notes: Optional[str] = None

class GenerateNotesResponse(BaseModel):
    """Réponse de génération de notes éditoriales"""
    editorial_notes: str
    album_id: str

class SettingsUpdate(BaseModel):
    """Modèle pour mettre à jour les settings (configuration des Moods)"""
    mood_config: Optional[Dict[str, str]] = None


# --- Discogs Bridge ---
DISCOGS_SPOTIFY_ARTIST_THRESHOLD = 60  # score 0-100 on artist only; below = reject Spotify match


def _normalize_for_match(s: str) -> str:
    """Normalise une chaîne pour la comparaison fuzzy (minuscules, strip, NFD)."""
    if not s:
        return ""
    s = (s or "").strip().lower()
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s


def _similarity_score(a: str, b: str) -> float:
    """Score de similarité 0-100 entre deux chaînes (difflib)."""
    na, nb = _normalize_for_match(a), _normalize_for_match(b)
    if not na and not nb:
        return 100.0
    if not na or not nb:
        return 0.0
    return difflib.SequenceMatcher(None, na, nb).ratio() * 100


def _extract_dominant_color(source: str, is_url: bool) -> Tuple[Optional[str], Optional[float]]:
    """
    Extract dominant color (hex) and hue (0-360) from an image.
    source: local file path or URL. is_url: True if source is a URL.
    Returns (hex_str, hue_float) or (None, None) on error.
    """
    path: Optional[str] = None
    try:
        if is_url:
            if not source or not source.strip():
                return (None, None)
            resp = requests.get(source, timeout=10)
            resp.raise_for_status()
            content = resp.content
            if not content:
                return (None, None)
            tmp = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
            path = tmp.name
            try:
                tmp.write(content)
                tmp.close()
            except Exception:
                try:
                    tmp.close()
                except Exception:
                    pass
                try:
                    os.unlink(path)
                except OSError:
                    pass
                return (None, None)
        else:
            if not source or not os.path.isfile(source):
                return (None, None)
            path = source

        colors = colorgram.extract(path, 1)
        if not colors:
            return (None, None)
        c = colors[0]
        r, g, b = c.rgb.r, c.rgb.g, c.rgb.b
        hex_str = "#%02x%02x%02x" % (r, g, b)
        # colorgram hsl: h,s,l in 0-255; convert h to 0-360
        h_raw = c.hsl.h
        hue_float = (h_raw / 255.0) * 360.0 if h_raw is not None else None
        return (hex_str, hue_float)
    except Exception as e:
        print(f"Dominant color extraction failed: {e}")
        return (None, None)
    finally:
        if is_url and path and os.path.isfile(path):
            try:
                os.unlink(path)
            except OSError:
                pass


class DiscogsCollectionItem(BaseModel):
    """Un album simplifié renvoyé par GET /discogs/collection/{username}"""
    discogs_id: int
    artist: str
    title: str
    year: Optional[str] = None
    thumb: Optional[str] = None
    resource_url: Optional[str] = None
    cover_image: Optional[str] = None


class DiscogsImportBatchRequest(BaseModel):
    """Body de POST /discogs/import-batch : liste d'albums au format simplifié"""
    albums: List[DiscogsCollectionItem]


class DiscogsImportBatchResponse(BaseModel):
    """Résumé de l'import par lots"""
    processed: int
    success: int
    failed: int


@app.get("/")
def read_root():
    return {"message": "API Kissa connectée à Supabase. Prête ! 🚀"}

@app.get("/health")
def health():
    """État des services (ex. openai_configured pour Generate Story)."""
    return {"openai_configured": kissa.openai_client is not None}

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

        # C. Couleur dominante (avant suppression du fichier)
        dominant_color, dominant_hue = _extract_dominant_color(file_location, is_url=False)
        
        # D. Nettoyage image après analyse
        if os.path.exists(file_location):
            os.remove(file_location)
            
        # E. Vérification erreur
        if result.get("status") == "error":
            raise HTTPException(status_code=400, detail=result["message"])

        # F. Sauvegarde dans Supabase
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
        if dominant_color is not None:
            new_album["dominant_color"] = dominant_color
        if dominant_hue is not None:
            new_album["dominant_hue"] = dominant_hue

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

        cover_image_url = result.get("display", {}).get("cover_image")
        dominant_color, dominant_hue = _extract_dominant_color(cover_image_url or "", is_url=True)

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
        if dominant_color is not None:
            new_album["dominant_color"] = dominant_color
        if dominant_hue is not None:
            new_album["dominant_hue"] = dominant_hue

        supabase.table("albums").insert(new_album).execute()
        return result
    except HTTPException as he:
        # Erreurs "prévues" (404) : on les laisse passer telles quelles
        raise he
    except Exception as e:
        # Crashs imprévus : deviennent 500
        raise HTTPException(status_code=500, detail=str(e))


# --- Discogs Bridge : récupération collection ---
DISCOGS_COLLECTION_MAX_ITEMS = 500
DISCOGS_PER_PAGE = 100
DISCOGS_USER_AGENT = "KissaApp/1.0 +https://github.com/kissa"


@app.get("/discogs/collection/{username}", response_model=List[DiscogsCollectionItem])
def get_discogs_collection(username: str):
    """
    Récupère la collection Discogs d'un utilisateur (folder 0) et la renvoie
    en liste simplifiée. Pagination gérée en interne, plafonnée à 500 items (v1).
    """
    token = os.environ.get("DISCOGS_TOKEN")
    if not token:
        raise HTTPException(
            status_code=503,
            detail="DISCOGS_TOKEN manquant. Configurez-le dans .env pour accéder à la collection.",
        )
    headers = {
        "User-Agent": DISCOGS_USER_AGENT,
        "Authorization": f"Discogs token={token}",
    }
    all_items: List[DiscogsCollectionItem] = []
    page = 1

    while len(all_items) < DISCOGS_COLLECTION_MAX_ITEMS:
        url = (
            f"https://api.discogs.com/users/{username}/collection/folders/0/releases"
            f"?page={page}&per_page={DISCOGS_PER_PAGE}"
        )
        try:
            resp = requests.get(url, headers=headers, timeout=30)
        except requests.RequestException as e:
            print(f"Discogs request error: {e}")
            raise HTTPException(status_code=502, detail="Discogs API indisponible.")

        if resp.status_code == 401:
            raise HTTPException(
                status_code=401,
                detail="Token Discogs invalide ou expiré.",
            )
        if resp.status_code == 403:
            raise HTTPException(
                status_code=403,
                detail="Accès refusé à la collection Discogs.",
            )
        if resp.status_code == 404:
            raise HTTPException(
                status_code=404,
                detail=f"Utilisateur Discogs '{username}' introuvable ou collection vide.",
            )
        if resp.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=f"Discogs API a renvoyé {resp.status_code}.",
            )

        data = resp.json()
        releases = data.get("releases") or []
        pagination = data.get("pagination") or {}

        for item in releases:
            if len(all_items) >= DISCOGS_COLLECTION_MAX_ITEMS:
                break
            info = item.get("basic_information") or item
            # Release ID: prefer basic_information.id (release), fallback to item.id
            release_id = info.get("id") or item.get("id")
            if release_id is None:
                continue
            artists = info.get("artists") or []
            artist = "Unknown"
            if artists:
                names = [a.get("name") for a in artists if a.get("name")]
                artist = ", ".join(names) if names else "Unknown"
            title = (info.get("title") or "").strip() or "Unknown"
            year_val = info.get("year")
            year = str(year_val) if year_val is not None else None
            thumb = info.get("thumb")
            resource_url = info.get("resource_url")
            cover_image = info.get("cover_image")
            all_items.append(
                DiscogsCollectionItem(
                    discogs_id=int(release_id),
                    artist=artist,
                    title=title,
                    year=year,
                    thumb=thumb,
                    resource_url=resource_url,
                    cover_image=cover_image,
                )
            )

        pages = pagination.get("pages", 1)
        if page >= pages or not releases:
            break
        page += 1

    return all_items


@app.post("/discogs/import-batch", response_model=DiscogsImportBatchResponse)
async def discogs_import_batch(request: DiscogsImportBatchRequest):
    """
    Importe par lots des albums au format simplifié (ex. issus de GET /discogs/collection/{username}).
    Dédoublonnage uniquement par discogs_id (plusieurs éditions = plusieurs imports).
    Match Spotify validé par fuzzy matching (seuil 80/100) ; sinon image Discogs (cover_image ou thumb).
    """
    processed = len(request.albums)
    success = 0
    failed = 0

    for album in request.albums:
        try:
            # 1. Dédoublonnage : par discogs_id uniquement (permettre plusieurs éditions artist+title)
            existing = (
                supabase.table("albums")
                .select("id")
                .eq("discogs_id", album.discogs_id)
                .execute()
            )
            if existing.data and len(existing.data) > 0:
                continue

            # 2. Recherche Spotify + fuzzy matching (artiste seul, seuil 60 %)
            spotify_url = None
            cover_image = album.cover_image or album.thumb
            tracklist = []
            try:
                if kissa.sp and (album.artist or "").strip():
                    search_query = f"album:{album.title} artist:{album.artist}"
                    spotify_data = kissa.step_3_spotify(album.artist, album.title, search_query=search_query)
                    if spotify_data:
                        spotify_artist = spotify_data.get("spotify_artist") or ""
                        score_artist = _similarity_score(album.artist, spotify_artist)
                        if score_artist >= DISCOGS_SPOTIFY_ARTIST_THRESHOLD:
                            spotify_url = spotify_data.get("spotify_link")
                            if spotify_data.get("cover_hd"):
                                cover_image = spotify_data["cover_hd"]
                            tracklist = spotify_data.get("tracks") or []
                        else:
                            pass  # rejeter le match : garder spotify_url=None, cover Discogs
            except Exception as e:
                print(f"Spotify lookup failed for {album.artist} - {album.title}: {e}")

            # 3. Couleur dominante (cover_image = URL)
            dominant_color, dominant_hue = (None, None)
            if cover_image:
                dominant_color, dominant_hue = _extract_dominant_color(cover_image, is_url=True)

            # 4. Insertion Supabase
            discogs_url = album.resource_url or (
                f"https://www.discogs.com/release/{album.discogs_id}"
            )
            new_album = {
                "artist": album.artist,
                "title": album.title,
                "cover_image": cover_image,
                "year": album.year or "",
                "label": "",
                "genre": [],
                "spotify_url": spotify_url,
                "discogs_url": discogs_url,
                "tracklist": tracklist,
                "discogs_id": album.discogs_id,
                "tags": ["Imported"],
            }
            if dominant_color is not None:
                new_album["dominant_color"] = dominant_color
            if dominant_hue is not None:
                new_album["dominant_hue"] = dominant_hue
            supabase.table("albums").insert(new_album).execute()
            success += 1
        except Exception as e:
            print(f"Import failed for {album.artist} - {album.title}: {e}")
            failed += 1

    return DiscogsImportBatchResponse(
        processed=processed,
        success=success,
        failed=failed,
    )


@app.post("/albums/{album_id}/generate-notes")
async def generate_editorial_notes(album_id: str):
    """
    Génère du contenu éditorial via GPT-4o sur l'album.
    Style critique musical expert (Rolling Stone / Pitchfork mais concis).
    """
    try:
        # 0. Log de la requête reçue
        print(f"📥 Requête reçue pour génération de story - Album ID: {album_id}")
        
        # 1. Vérifier que le client OpenAI est disponible
        if not kissa.openai_client:
            print("❌ OpenAI client non disponible")
            raise HTTPException(
                status_code=500, 
                detail="OpenAI client non disponible. Vérifiez OPENAI_API_KEY dans le .env"
            )
        
        # 2. Récupérer l'album depuis Supabase (avec year)
        response = supabase.table("albums").select("id, artist, title, year").eq("id", album_id).execute()
        
        if not response.data or len(response.data) == 0:
            print(f"❌ Album avec l'ID {album_id} introuvable")
            raise HTTPException(status_code=404, detail=f"Album avec l'ID {album_id} introuvable")
        
        album = response.data[0]
        artist = album.get("artist", "Artiste inconnu")
        title = album.get("title", "Titre inconnu")
        year = album.get("year", "")
        
        # 3. Validation des données
        if not artist or artist.strip() == "" or not title or title.strip() == "":
            print(f"❌ Données invalides - Artist: '{artist}', Title: '{title}'")
            raise HTTPException(
                status_code=400, 
                detail="L'album doit avoir un artiste et un titre valides pour générer une story"
            )
        
        # 4. Construire le prompt pour GPT-4o (formaté correctement)
        year_info = f" ({year})" if year else ""
        system_prompt = f"""Tu es le propriétaire d'un 'Jazz Kissa' (bar audiophile) à Tokyo. Tu es un expert musical passionné, poétique et précis.
Ta mission est d'écrire une courte note de pochette (Liner Note) pour l'album : {artist} - {title}{year_info}.

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
        
        # 5. Appeler GPT-4o
        print(f"🤖 Génération de notes éditoriales pour {artist} - {title}{year_info}...")
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
        
        # 6. Sauvegarder dans Supabase
        supabase.table("albums").update({"editorial_notes": editorial_notes}).eq("id", album_id).execute()
        
        print(f"✅ Notes éditoriales générées et sauvegardées pour {album_id} ({artist} - {title}{year_info})")
        
        # 7. Retourner le résultat
        return GenerateNotesResponse(
            editorial_notes=editorial_notes,
            album_id=album_id
        )
        
    except HTTPException as he:
        raise he
    except Exception as e:
        err = str(e).lower()
        if "429" in str(e) or ("rate" in err and "limit" in err):
            raise HTTPException(status_code=503, detail="AI busy, try again")
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
        has_personal_notes = purchase_data.personal_notes is not None

        # Au moins un champ requis (purchase, storage_location, mood_colors ou personal_notes)
        if not purchase_dict and not has_storage and not has_mood_colors and not has_personal_notes:
            raise HTTPException(
                status_code=400,
                detail="Au moins un champ doit être fourni (date, location, price, condition, storage_location, mood_colors, personal_notes)"
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

        if has_personal_notes:
            update_payload["personal_notes"] = purchase_data.personal_notes
        
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

@app.post("/admin/refetch-tracks")
async def refetch_tracks():
    """
    Endpoint admin pour récupérer les tracklists manquantes depuis Spotify.
    Parcourt tous les albums avec tracklist vide/null et met à jour depuis Spotify.
    """
    try:
        # 1. Récupérer tous les albums avec tracklist vide ou null
        response = supabase.table("albums").select("id, artist, title, spotify_url, tracklist").execute()
        
        if not response.data:
            return {
                "processed": 0,
                "updated": 0,
                "failed": 0,
                "details": []
            }
        
        # Filtrer les albums sans tracklist ou avec tracklist vide
        albums_to_update = [
            album for album in response.data
            if not album.get('tracklist') or len(album.get('tracklist', [])) == 0
        ]
        
        if not albums_to_update:
            return {
                "processed": 0,
                "updated": 0,
                "failed": 0,
                "message": "Aucun album sans tracklist trouvé",
                "details": []
            }
        
        print(f"🔄 Début du refetch pour {len(albums_to_update)} album(s)...")
        
        updated = 0
        failed = 0
        details = []
        
        # 2. Pour chaque album, récupérer la tracklist depuis Spotify
        for album in albums_to_update:
            album_id = album.get('id')
            artist = album.get('artist', 'Unknown')
            title = album.get('title', 'Unknown')
            spotify_url = album.get('spotify_url')
            
            try:
                # Vérifier si spotify_url existe
                if not spotify_url:
                    details.append({
                        "album_id": album_id,
                        "artist": artist,
                        "title": title,
                        "status": "skipped",
                        "reason": "Pas de spotify_url"
                    })
                    continue
                
                # Extraire l'album_id Spotify depuis l'URL
                # Format: https://open.spotify.com/album/{album_id}
                try:
                    spotify_album_id = spotify_url.split('/album/')[1].split('?')[0].split('/')[0]
                except (IndexError, AttributeError):
                    details.append({
                        "album_id": album_id,
                        "artist": artist,
                        "title": title,
                        "status": "failed",
                        "reason": "Impossible d'extraire l'ID Spotify de l'URL"
                    })
                    failed += 1
                    continue
                
                # Récupérer les tracks depuis Spotify
                if not kissa.sp:
                    details.append({
                        "album_id": album_id,
                        "artist": artist,
                        "title": title,
                        "status": "failed",
                        "reason": "Client Spotify non disponible"
                    })
                    failed += 1
                    continue
                
                tracks = kissa._fetch_spotify_tracks(spotify_album_id)
                
                if tracks and len(tracks) > 0:
                    # Mettre à jour la BDD
                    supabase.table("albums").update({
                        "tracklist": tracks
                    }).eq("id", album_id).execute()
                    
                    updated += 1
                    details.append({
                        "album_id": album_id,
                        "artist": artist,
                        "title": title,
                        "status": "updated",
                        "tracks_count": len(tracks)
                    })
                    print(f"   ✅ {artist} - {title} : {len(tracks)} pistes récupérées")
                else:
                    details.append({
                        "album_id": album_id,
                        "artist": artist,
                        "title": title,
                        "status": "failed",
                        "reason": "Aucune piste récupérée depuis Spotify"
                    })
                    failed += 1
                    
            except Exception as e:
                print(f"   ❌ Erreur pour {artist} - {title} : {e}")
                details.append({
                    "album_id": album_id,
                    "artist": artist,
                    "title": title,
                    "status": "failed",
                    "reason": str(e)
                })
                failed += 1
        
        print(f"✅ Refetch terminé : {updated} mis à jour, {failed} échecs")
        
        return {
            "processed": len(albums_to_update),
            "updated": updated,
            "failed": failed,
            "details": details
        }
        
    except Exception as e:
        print(f"❌ Erreur lors du refetch des tracklists : {e}")
        raise HTTPException(status_code=500, detail=f"Erreur lors du refetch : {str(e)}")

@app.post("/admin/refetch-album-tracks/{album_id}")
async def refetch_album_tracks(album_id: str):
    """
    Endpoint admin pour forcer la récupération de tracklist pour un album spécifique.
    Utile pour diagnostiquer les problèmes de tracklist manquante.
    """
    try:
        # 1. Récupérer l'album depuis la BDD
        response = supabase.table("albums").select("id, artist, title, spotify_url, tracklist").eq("id", album_id).execute()
        
        if not response.data or len(response.data) == 0:
            raise HTTPException(status_code=404, detail=f"Album avec l'ID {album_id} introuvable")
        
        album = response.data[0]
        artist = album.get('artist', 'Unknown')
        title = album.get('title', 'Unknown')
        spotify_url = album.get('spotify_url')
        current_tracklist = album.get('tracklist', [])
        
        result = {
            "album_id": album_id,
            "artist": artist,
            "title": title,
            "spotify_url": spotify_url,
            "current_tracklist_count": len(current_tracklist) if current_tracklist else 0,
            "steps": []
        }
        
        # 2. Vérifier si spotify_url existe
        if not spotify_url:
            result["status"] = "failed"
            result["reason"] = "Pas de spotify_url dans la BDD"
            result["steps"].append({"step": "check_spotify_url", "status": "failed", "message": "Pas de spotify_url"})
            return result
        
        result["steps"].append({"step": "check_spotify_url", "status": "success", "message": f"spotify_url trouvé: {spotify_url}"})
        
        # 3. Extraire l'album_id Spotify depuis l'URL
        try:
            spotify_album_id = spotify_url.split('/album/')[1].split('?')[0].split('/')[0]
            result["spotify_album_id"] = spotify_album_id
            result["steps"].append({"step": "extract_spotify_id", "status": "success", "message": f"ID extrait: {spotify_album_id}"})
            print(f"   ✅ ID Spotify extrait avec succès: {spotify_album_id}")
        except (IndexError, AttributeError) as e:
            result["status"] = "failed"
            result["reason"] = f"Impossible d'extraire l'ID Spotify de l'URL: {str(e)}"
            result["steps"].append({"step": "extract_spotify_id", "status": "failed", "message": str(e)})
            return result
        
        # 4. Vérifier que le client Spotify est disponible
        if not kissa.sp:
            result["status"] = "failed"
            result["reason"] = "Client Spotify non disponible"
            result["steps"].append({"step": "check_spotify_client", "status": "failed", "message": "Client Spotify non initialisé"})
            return result
        
        result["steps"].append({"step": "check_spotify_client", "status": "success", "message": "Client Spotify disponible"})
        
        # 5. Récupérer les tracks depuis Spotify
        try:
            print(f"   🔍 Tentative récupération tracks pour album_id Spotify: {spotify_album_id}")
            print(f"   📋 Album: {artist} - {title}")
            tracks = kissa._fetch_spotify_tracks(spotify_album_id)
            
            if tracks is None:
                # Logger plus de détails
                print(f"   ⚠️ _fetch_spotify_tracks a retourné None pour {spotify_album_id}")
                print(f"   ⚠️ Vérifiez les logs serveur pour plus de détails sur l'erreur")
                result["status"] = "failed"
                result["reason"] = "_fetch_spotify_tracks a retourné None (erreur silencieuse)"
                result["steps"].append({"step": "fetch_tracks", "status": "failed", "message": "Aucune piste récupérée (None retourné). Vérifiez les logs serveur pour plus de détails."})
                return result
            
            if len(tracks) == 0:
                result["status"] = "failed"
                result["reason"] = "Aucune piste trouvée sur Spotify pour cet album"
                result["steps"].append({"step": "fetch_tracks", "status": "failed", "message": "Liste de tracks vide"})
                return result
            
            result["steps"].append({"step": "fetch_tracks", "status": "success", "message": f"{len(tracks)} pistes récupérées"})
            result["new_tracklist"] = tracks
            result["new_tracklist_count"] = len(tracks)
            
            # 6. Mettre à jour la BDD
            supabase.table("albums").update({
                "tracklist": tracks
            }).eq("id", album_id).execute()
            
            result["status"] = "success"
            result["message"] = f"Tracklist mise à jour avec {len(tracks)} pistes"
            result["steps"].append({"step": "update_database", "status": "success", "message": "BDD mise à jour"})
            
            return result
            
        except Exception as e:
            import traceback
            error_traceback = traceback.format_exc()
            print(f"   ❌ Exception lors de la récupération de tracks: {type(e).__name__}: {e}")
            print(f"   📋 Traceback complet:\n{error_traceback}")
            result["status"] = "failed"
            result["reason"] = f"Erreur lors de la récupération: {str(e)}"
            result["steps"].append({"step": "fetch_tracks", "status": "error", "message": f"{type(e).__name__}: {str(e)}"})
            result["error_details"] = {
                "exception_type": type(e).__name__,
                "exception_message": str(e),
                "traceback": error_traceback
            }
            return result
        
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"❌ Erreur lors du refetch de tracklist pour l'album {album_id} : {e}")
        raise HTTPException(status_code=500, detail=f"Erreur lors du refetch : {str(e)}")

@app.get("/settings")
def get_settings():
    """
    Récupère la configuration des settings (notamment mood_config).
    Retourne les valeurs par défaut si la ligne n'existe pas.
    """
    try:
        # Valeurs par défaut
        default_mood_config = {
            "#ef4444": "Peak Time / Banger",
            "#eab308": "Groove / Warm Up",
            "#3b82f6": "Deep / Mental",
            "#a855f7": "After / Hypnotic",
            "#22c55e": "Organic / Chill",
            "#171717": "Dark / Obscure"
        }
        
        # Essayer de récupérer depuis Supabase
        response = supabase.table("settings").select("mood_config").eq("id", 1).execute()
        
        if response.data and len(response.data) > 0:
            mood_config = response.data[0].get("mood_config", default_mood_config)
            # S'assurer que toutes les couleurs par défaut sont présentes
            for color, label in default_mood_config.items():
                if color not in mood_config:
                    mood_config[color] = label
            return {"mood_config": mood_config}
        else:
            # Si la ligne n'existe pas, retourner les valeurs par défaut
            return {"mood_config": default_mood_config}
            
    except Exception as e:
        print(f"❌ Erreur lors de la récupération des settings : {e}")
        # En cas d'erreur, retourner les valeurs par défaut
        return {
            "mood_config": {
                "#ef4444": "Peak Time / Banger",
                "#eab308": "Groove / Warm Up",
                "#3b82f6": "Deep / Mental",
                "#a855f7": "After / Hypnotic",
                "#22c55e": "Organic / Chill",
                "#171717": "Dark / Obscure"
            }
        }

@app.patch("/settings")
async def update_settings(settings_update: SettingsUpdate):
    """
    Met à jour la configuration des settings (notamment mood_config).
    """
    try:
        if settings_update.mood_config is None:
            raise HTTPException(status_code=400, detail="mood_config est requis")
        
        # Vérifier que toutes les couleurs requises sont présentes
        required_colors = ["#ef4444", "#eab308", "#3b82f6", "#a855f7", "#22c55e", "#171717"]
        for color in required_colors:
            if color not in settings_update.mood_config:
                raise HTTPException(
                    status_code=400,
                    detail=f"La couleur {color} est requise dans mood_config"
                )
        
        # Vérifier si la ligne existe
        check_response = supabase.table("settings").select("id").eq("id", 1).execute()
        
        if check_response.data and len(check_response.data) > 0:
            # Mise à jour
            update_response = supabase.table("settings").update({
                "mood_config": settings_update.mood_config
            }).eq("id", 1).execute()
            
            if not update_response.data:
                raise HTTPException(status_code=500, detail="Erreur lors de la mise à jour")
            
            print(f"✅ Settings mis à jour : mood_config")
            return {"mood_config": update_response.data[0].get("mood_config")}
        else:
            # Insertion si la ligne n'existe pas
            insert_response = supabase.table("settings").insert({
                "id": 1,
                "mood_config": settings_update.mood_config
            }).execute()
            
            if not insert_response.data:
                raise HTTPException(status_code=500, detail="Erreur lors de l'insertion")
            
            print(f"✅ Settings créés : mood_config")
            return {"mood_config": insert_response.data[0].get("mood_config")}
            
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"❌ Erreur lors de la mise à jour des settings : {e}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de la mise à jour : {str(e)}")
