import os

import json
import base64

from dotenv import load_dotenv



# Clients APIs

from google.cloud import vision
from google.oauth2 import service_account

import discogs_client

import spotipy

from spotipy.oauth2 import SpotifyClientCredentials

from openai import OpenAI



# Chargement des variables d'environnement

load_dotenv()



class KissaCore:

    """

    Le moteur central de Kissa. 

    Gère l'OCR, la récupération de métadonnées et le lien streaming.

    """

    

    def __init__(self):

        print("Initialisation du Core Kissa...")

        # --- 1. GOOGLE VISION (SETUP HYBRIDE) ---
        # On vérifie si on a le JSON brut dans une variable (Cas Render/Prod)
        google_json = os.environ.get("GOOGLE_CREDENTIALS_JSON")
        
        if google_json:
            print("Mode Cloud : Chargement Google depuis variable d'environnement")
            try:
                info = json.loads(google_json)
                creds = service_account.Credentials.from_service_account_info(info)
                self.vision_client = vision.ImageAnnotatorClient(credentials=creds)
            except Exception as e:
                print(f"ERREUR chargement Google JSON: {e}")
                self.vision_client = None
        else:
            print("Mode Local : Chargement Google depuis fichier standard")
            # En local, il utilisera automatiquement le fichier pointé par GOOGLE_APPLICATION_CREDENTIALS
            try:
                credentials_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
                if credentials_path and os.path.exists(credentials_path):
                    self.vision_client = vision.ImageAnnotatorClient()
                elif os.path.exists('kissa-vision-key.json'):
                    os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = 'kissa-vision-key.json'
                    self.vision_client = vision.ImageAnnotatorClient()
                else:
                    print("ATTENTION : GOOGLE_APPLICATION_CREDENTIALS non configuré. OCR désactivé.")
                    self.vision_client = None
            except Exception as e:
                print(f"ATTENTION : Erreur lors de l'initialisation de Google Vision : {e}. OCR désactivé.")
                self.vision_client = None

        

        # 2. Setup Discogs

        user_token = os.getenv('DISCOGS_TOKEN')

        if not user_token:

            print("ATTENTION : DISCOGS_TOKEN manquant dans le .env")

        self.discogs = discogs_client.Client('KissaApp/1.0', user_token=user_token)

        

        # 3. Setup Spotify

        client_id = os.getenv('SPOTIPY_CLIENT_ID')

        client_secret = os.getenv('SPOTIPY_CLIENT_SECRET')

        if client_id and client_secret:

            auth_manager = SpotifyClientCredentials(client_id=client_id, client_secret=client_secret)

            self.sp = spotipy.Spotify(auth_manager=auth_manager)

        else:

            print("ATTENTION : Identifiants Spotify manquants dans le .env")

            self.sp = None

        

        # 4. Setup OpenAI (LLM Reasoning)

        openai_key = os.environ.get("OPENAI_API_KEY")

        if openai_key:

            self.openai_client = OpenAI(api_key=openai_key)

        else:

            print("ATTENTION : OPENAI_API_KEY manquant. LLM-reasoning désactivé.")

            self.openai_client = None



    def _clean_text(self, text):

        """Nettoie le texte brut de l'OCR pour la recherche"""

        return text.replace("\n", " ").strip()


    def _llm_extract_metadata(self, image_path, best_guess=None, raw_text=None):

        """Utilise GPT-4o Vision pour extraire les métadonnées directement depuis l'image de pochette"""

        if not self.openai_client:

            return None

        if not image_path or not os.path.exists(image_path):

            return None

        

        # Encoder l'image en base64

        try:

            with open(image_path, "rb") as image_file:

                image_data = image_file.read()

                base64_image = base64.b64encode(image_data).decode('utf-8')

        except Exception as e:

            print(f"ATTENTION : Erreur lecture image pour GPT-4o Vision : {e}")

            return None

        

        # Nouveau prompt système d'expert archiviste

        system_prompt = """Tu es un expert archiviste de disques vinyles (Digger). Ta mission est d'extraire les métadonnées exactes à partir d'une photo de pochette, même si elle est abîmée, vintage ou obscure.

ANALYSE VISUELLE AVANCÉE :
1. **Format Detection :** Regarde les proportions et le style.
   * Si c'est un **45 Tours (Single)** (souvent titre de la chanson en TRÈS GROS, artiste plus petit, logo '45' ou 'EP'): Le terme de recherche DOIT être "Artiste - Titre de la chanson". Ne cherche pas un nom d'album.
   * Si c'est une **Bande Originale (OST)** (mots clés: 'Bande Originale', 'Soundtrack', 'Film de...'): Le Titre principal est le NOM DU FILM (ex: 'Orfeu Negro'), pas le compositeur ou le réalisateur.

2. **OCR & Hiérarchie :**
   * Ignore les textes marketing ('Disque d'or', 'Succès', 'Extraits de...').
   * Sur l'image 'France Gall' fournie en exemple : Le texte rose 'FRANCE GALL' est l'artiste. Le texte blanc centré 'IL JOUAIT DU PIANO DEBOUT' est le titre. 'Extrait de l'album Paris-France' est une info secondaire, mais utile pour la recherche.
   * Sur l'image 'Orfeu Negro' : 'ORFEU NEGRO' est le titre clé. 'Bande originale du film de Marcel Camus' est le contexte.

STRATÉGIE DE RECHERCHE (Search Query Construction) :
Ton but n'est pas juste de décrire, mais de créer la meilleure requête pour l'API Spotify/Discogs.
* Pour un Single : Retourne le nom de l'album original dont il est issu si mentionné (ex: pour France Gall, l'album est 'Paris, France'), sinon utilise le titre de la chanson comme titre d'album.
* Renvoie un JSON strict :
    {
      "artist": "Nom corrigé",
      "title": "Titre corrigé",
      "search_query": "La requête optimisée pour Spotify (ex: 'France Gall Il jouait du piano debout')",
      "format_guess": "Single" | "LP" | "OST"
    }"""

        # Construire le message utilisateur avec l'image

        user_content = []

        # Ajouter l'image

        user_content.append({

            "type": "image_url",

            "image_url": {

                "url": f"data:image/jpeg;base64,{base64_image}"

            }

        })

        # Ajouter du contexte textuel si disponible (pour aider l'IA)

        text_context = "Analyse cette pochette de vinyle et extrais les métadonnées."

        if raw_text:

            text_context += f"\n\nTexte détecté par OCR : {raw_text}"

        if best_guess:

            text_context += f"\n\nSuggestion Google Vision : {best_guess}"

        user_content.append({

            "type": "text",

            "text": text_context

        })

        try:

            response = self.openai_client.chat.completions.create(

                model="gpt-4o",

                messages=[

                    {"role": "system", "content": system_prompt},

                    {"role": "user", "content": user_content}

                ],

                temperature=0.3

            )

            

            content = response.choices[0].message.content.strip()

            

            # Parser la réponse JSON

            # Si le LLM a ajouté des markdown code blocks, on les retire

            if content.startswith("```json"):

                content = content[7:]

            if content.startswith("```"):

                content = content[3:]

            if content.endswith("```"):

                content = content[:-3]

            content = content.strip()

            

            # Si le LLM a renvoyé null, on retourne None

            if content.lower() == "null":

                return None

            

            result = json.loads(content)

            

            # Vérifier que les champs requis sont présents et non vides

            if result.get("artist") and result.get("title") and result.get("search_query"):

                print(f"🤖 GPT-4o Vision extrait : {result['artist']} - {result['title']} (Format: {result.get('format_guess', 'Unknown')})")

                print(f"   🔍 Search query : {result['search_query']}")

                return result

            else:

                print(f"ATTENTION : Réponse LLM incomplète : {result}")

                return None

                

        except json.JSONDecodeError as e:

            print(f"ATTENTION : Erreur parsing JSON LLM : {e}")

            print(f"   Contenu reçu : {content[:200]}...")

            return None

        except Exception as e:

            print(f"ATTENTION : Erreur appel LLM (non bloquant) : {e}")

            return None



    def step_1_ocr(self, image_path):

        """Lit le texte sur la pochette (Google Vision)"""

        if not self.vision_client:
            print("ATTENTION : OCR non disponible : Google Vision credentials manquants")
            return None

        print(f"Analyse visuelle de {image_path}...")

        try:

            with open(image_path, "rb") as image_file:

                content = image_file.read()

            image = vision.Image(content=content)

            response = self.vision_client.text_detection(image=image)
            
            # Vérification des erreurs de l'API
            if response.error.message:
                print(f"ERREUR Google Vision : {response.error.message}")
                return None

            texts = response.text_annotations

            if texts:

                raw_text = texts[0].description

                clean_query = self._clean_text(raw_text)

                print(f"Texte détecté : {clean_query}")

                return clean_query

            else:

                return None

        except Exception as e:

            print(f"ERREUR OCR : {e}")

            return None



    def step_2_discogs(self, query):

        """Récupère les métadonnées (Discogs)"""

        print("Recherche Discogs...")

        try:

            results = self.discogs.search(query, type='release')

            

            if not results:

                return None

            

            # On prend le premier résultat pertinent

            album = results[0]

            

            # Sécurisation des champs (au cas où il manque une info)

            if album.artists:

                # On joint tous les noms trouvés (ex: "Floating Points, Pharoah Sanders, LSO")

                artist_name = ", ".join([artist.name for artist in album.artists])

            else:

                artist_name = "Artiste Inconnu"

            label_name = album.labels[0].name if album.labels else "Label Inconnu"

            cover_url = album.images[0]['uri'] if album.images else None

            

            # On filtre la tracklist pour éviter les titres de faces (ex: "Side A")

            clean_tracklist = [t.title for t in album.tracklist if t.position]



            return {

                "artist": artist_name,

                "album_title": album.title,

                "year": str(album.year) if album.year else "Année inconnue",

                "label": label_name,

                "genre": album.genres,

                "tracklist": clean_tracklist,

                "discogs_url": album.url,

                "discogs_image": cover_url

            }

        except Exception as e:

            print(f"ERREUR Discogs: {e}")

            return None



    def _fetch_spotify_tracks(self, album_id):

        """Récupère toutes les pistes d'un album Spotify avec pagination"""

        if not self.sp:

            return None

        try:

            # Récupérer la première page (limite 50 par défaut)

            tracks_response = self.sp.album_tracks(album_id, limit=50)

            all_tracks = tracks_response['items']

            

            # Pagination : récupérer toutes les pages suivantes

            while tracks_response['next']:

                tracks_response = self.sp.next(tracks_response)

                all_tracks.extend(tracks_response['items'])

            

            # Formater en liste simple de titres

            tracklist = [track['name'] for track in all_tracks]

            print(f"   ✅ {len(tracklist)} pistes récupérées depuis Spotify")

            return tracklist

            

        except Exception as e:

            print(f"ATTENTION : Erreur récupération tracks Spotify (non bloquant) : {e}")

            return None



    def step_3_spotify(self, artist, album_title, search_query=None):

        """Récupère le lien audio, la cover HD et les tracks (Spotify)"""

        if not self.sp:

            return None

            

        print("Recherche Spotify...")

        # Utiliser search_query optimisé si fourni, sinon construire la requête classique

        if search_query:

            q = search_query

            print(f"   Utilisation search_query optimisé : {q}")

        else:

            q = f"artist:{artist} album:{album_title}"

        

        try:

            results = self.sp.search(q=q, type='album', limit=1)

            items = results['albums']['items']

            

            if items:

                spotify_album = items[0]

                album_id = spotify_album['id']

                # Spotify classe les images par taille, index 0 = la plus grande (640x640)

                hd_cover = spotify_album['images'][0]['url'] if spotify_album['images'] else None

                

                # Récupérer les tracks avec pagination

                tracks = self._fetch_spotify_tracks(album_id)

                

                return {

                    "spotify_link": spotify_album['external_urls']['spotify'],

                    "spotify_uri": spotify_album['uri'],

                    "cover_hd": hd_cover,

                    "tracks": tracks

                }

            return None

        except Exception as e:

            print(f"ATTENTION : Erreur Spotify (non bloquant) : {e}")

            return None



    def process(self, image_path):
        """Pipeline intelligent : Vision (Web+Text) -> Discogs -> Spotify"""
        print(f"👁️ Analyse visuelle de : {image_path}")
        
        if not self.vision_client:
            return {"status": "error", "message": "OCR non disponible : Google Vision credentials manquants"}
        
        # Charger l'image en mémoire pour Google
        with open(image_path, "rb") as image_file:
            content = image_file.read()
        image = vision.Image(content=content)

        # 1. TENTATIVE INTELLIGENTE : WEB DETECTION (Google Lens style)
        web_response = self.vision_client.web_detection(image=image)
        best_guess = ""
        
        if web_response.web_detection and web_response.web_detection.best_guess_labels:
            best_guess = web_response.web_detection.best_guess_labels[0].label
            print(f"🧠 Google suggère (Web Detection) : {best_guess}")

        # 2. TENTATIVE CLASSIQUE : TEXT DETECTION
        text_response = self.vision_client.text_detection(image=image)
        raw_text = ""
        if text_response.text_annotations:
            raw_text = text_response.text_annotations[0].description.replace('\n', ' ')
        
        # 3. TENTATIVE LLM REASONING (GPT-4o Vision)
        llm_result = self._llm_extract_metadata(image_path, best_guess, raw_text)
        
        if llm_result:
            # Utiliser search_query optimisé pour la recherche Discogs
            query = llm_result.get('search_query') or f"{llm_result['artist']} {llm_result['title']}"
            print(f"🔍 Recherche Discogs avec données GPT-4o Vision : '{query}'")
            print(f"   Format détecté : {llm_result.get('format_guess', 'Unknown')}")
            candidates = self.search_candidates(query)
            if candidates:
                print("   ✅ Trouvé avec GPT-4o Vision !")
                best_match = candidates[0]
                # Passer search_query à process_by_id pour optimiser la recherche Spotify
                search_query = llm_result.get('search_query')
                result = self.process_by_id(best_match['discogs_id'], search_query=search_query)
                # Stocker le format_guess dans le résultat si disponible
                if result.get('status') == 'success' and llm_result.get('format_guess'):
                    result['format_guess'] = llm_result['format_guess']
                return result
        
        # 4. FALLBACK : STRATÉGIE DE RECHERCHE & NETTOYAGE MANUEL
        search_terms = []
        
        # Priorité 1 : La devinette Google
        if best_guess:
            search_terms.append(best_guess)
            
        # Priorité 2 : Le texte brut nettoyé
        if raw_text:
            banned_words = ["STEREO", "MONO", "LP", "VINYL", "RECORDS", "DIGITAL", "HI-FI", "SIDE", "33RPM"]
            clean_text = raw_text
            for word in banned_words:
                clean_text = clean_text.replace(word, "").replace(word.lower(), "")
            # Nettoyage espaces doubles/caractères spéciaux
            clean_text = " ".join(clean_text.split())
            search_terms.append(clean_text)

        print(f"🔍 Termes candidats pour Discogs (fallback manuel) : {search_terms}")

        # 5. BOUCLE DE RECHERCHE
        candidates = []
        for query in search_terms:
            print(f"   👉 Essai Discogs avec : '{query}'")
            candidates = self.search_candidates(query)
            if candidates:
                print("   ✅ Trouvé !")
                break 
        
        if not candidates:
            return {"status": "error", "message": "Aucun résultat trouvé (ni par image, ni par texte)."}

        # Récupération du meilleur résultat
        best_match = candidates[0]
        return self.process_by_id(best_match['discogs_id'])



    def search_by_text(self, text_query):

        """Recherche manuelle sans image (texte -> Discogs -> Spotify)"""

        print(f"Recherche manuelle pour : {text_query}")

        

        # 1. Discogs (Directement avec le texte utilisateur)

        discogs_data = self.step_2_discogs(text_query)

        if not discogs_data:

            return {"status": "error", "message": "Album introuvable sur Discogs."}

            

        # 2. Spotify

        spotify_data = self.step_3_spotify(discogs_data['artist'], discogs_data['album_title'])

        

        # 3. Construction objet final (Idem process classique)

        final_cover = discogs_data['discogs_image']

        spotify_link = None

        spotify_uri = None

        

        if spotify_data:

            spotify_link = spotify_data['spotify_link']

            spotify_uri = spotify_data['spotify_uri']

            if spotify_data['cover_hd']:

                final_cover = spotify_data['cover_hd']

        # Prioriser la tracklist Spotify si disponible, sinon utiliser Discogs

        if spotify_data and spotify_data.get('tracks'):

            tracklist = spotify_data['tracks']

            print(f"   ✅ Tracklist récupérée depuis Spotify ({len(tracklist)} pistes)")

        else:

            tracklist = discogs_data['tracklist']

            print(f"   ✅ Tracklist récupérée depuis Discogs ({len(tracklist)} pistes)")

        return {

            "status": "success",

            "display": {

                "artist": discogs_data['artist'],

                "title": discogs_data['album_title'],

                "cover_image": final_cover,

                "original_photo": None # Pas de photo en mode manuel

            },

            "details": {

                "year": discogs_data['year'],

                "label": discogs_data['label'],

                "genre": discogs_data['genre'],

                "tracklist": tracklist

            },

            "links": {

                "spotify_url": spotify_link,

                "spotify_uri": spotify_uri,

                "discogs_url": discogs_data['discogs_url']

            }

        }



    def search_candidates(self, query):

        """Recherche 'Google Style' : Tolérante et robuste"""

        print(f"Recherche robuste pour : {query}")

        

        try:

            # 1. Recherche large sur Discogs

            # On demande explicitement les types 'release' et 'master' pour éviter

            # de récupérer trop d'artistes ou de labels qui polluent, 

            # mais on reste assez large pour trouver les albums par nom d'artiste.

            results = self.discogs.search(query, type='release')

            # Note: Si on met type='all', Discogs renvoie l'artiste en premier.

            # En mettant type='release', si tu tapes "Apparat", Discogs renvoie les albums d'Apparat.

            # Si cela ne suffit pas, on peut retirer le paramètre type, mais il faudra filtrer plus bas.

            

            # TEST : On essaie sans filtre de type pour voir tout, et on triera nous-mêmes

            results = self.discogs.search(query)

            candidates = []

            count = 0

            total_items = 0

            

            # On itère sur les résultats

            for item in results:

                total_items += 1

                if count >= 10:

                    break

                # --- 1. FILTRAGE INTELLIGENT ---

                # On vérifie si c'est un album (Master/Release) en testant la présence d'attributs clés

                # Les Artist/Label n'ont généralement pas de 'title' ou 'artists' comme les albums

                # On utilise une approche permissive : si ça ressemble à un album, on le prend

                

                # Vérification : si l'objet n'a pas de titre, on le saute

                # (les Artist/Label n'ont généralement pas de title, mais les albums oui)

                if not hasattr(item, 'title') or not item.title:

                    continue

                # --- 2. EXTRACTION SÉCURISÉE (Airbag) ---

                try:

                    # Titre

                    title = item.title # Souvent "Artist - Album"

                    

                    # Artiste (Extraction propre)

                    artist = "Artiste Divers"

                    if hasattr(item, 'artists') and item.artists:

                        artist = item.artists[0].name

                    

                    # Si le titre contient déjà l'artiste (format Discogs classique "Artist - Title")

                    # On peut nettoyer pour l'affichage si besoin, mais gardons brut pour l'instant

                    

                    # Année

                    year = ""

                    if hasattr(item, 'year'):

                        year = str(item.year)

                    

                    # Label

                    label = ""

                    if hasattr(item, 'labels') and item.labels:

                        label = item.labels[0].name

                        

                    # Image (Thumb) - Gère tous les cas de figure

                    thumb = ""

                    if hasattr(item, 'thumb'):

                        thumb = item.thumb

                    elif hasattr(item, 'images') and item.images:

                        thumb = item.images[0].get('uri', '')

                    

                    # ID

                    discogs_id = item.id

                    candidates.append({

                        "discogs_id": discogs_id,

                        "title": title,

                        "artist": artist,

                        "year": year,

                        "label": label,

                        "thumb": thumb

                    })

                    count += 1

                    

                except Exception as item_error:

                    # Si UN élément est mal formé, on l'affiche dans la console mais on ne plante pas la liste

                    print(f"ATTENTION : Element ignore (Erreur de donnee) : {item_error}")

                    continue

            print(f"SUCCES : {len(candidates)} resultats trouves sur {total_items} elements examines pour '{query}'")

            return candidates

        except Exception as e:

            print(f"ERREUR critique recherche globale : {e}")

            return []



    def process_by_id(self, discogs_id, search_query=None):

        """Ajoute un album via son ID Discogs précis (Sélection utilisateur)"""

        print(f"Recuperation ID Discogs : {discogs_id}")

        try:

            # 1. Tentative Release ID d'abord
            print(f"   👉 Tentative Release ID : {discogs_id}")
            try:
                album = self.discogs.release(discogs_id)
                print(f"   ✅ Trouvé comme Release")
            except Exception as release_error:
                # Si l'appel Release échoue, essayer Master ID
                print(f"   ⚠️ Release ID échoué ({release_error}), tentative Master ID...")
                try:
                    master = self.discogs.master(discogs_id)
                    print(f"   ✅ Trouvé comme Master, récupération de la main_release...")
                    # Récupérer la main_release du Master
                    if hasattr(master, 'main_release') and master.main_release:
                        main_release_id = master.main_release.id
                        print(f"   📦 Main Release ID : {main_release_id}")
                        album = self.discogs.release(main_release_id)
                    else:
                        # Si pas de main_release, essayer le premier release disponible
                        if hasattr(master, 'versions') and master.versions:
                            first_version = master.versions[0]
                            if hasattr(first_version, 'id'):
                                print(f"   📦 Utilisation de la première version : {first_version.id}")
                                album = self.discogs.release(first_version.id)
                            else:
                                raise Exception("Master trouvé mais aucune release disponible")
                        else:
                            raise Exception("Master trouvé mais pas de main_release ni de versions")
                except Exception as master_error:
                    print(f"   ❌ Master ID aussi échoué : {master_error}")
                    raise Exception(f"ID {discogs_id} n'est ni un Release ni un Master valide : {release_error}")

            

            # Extraction des données (similaire au scan)

            artist_name = album.artists[0].name if album.artists else "Inconnu"

            if album.artists and len(album.artists) > 1:

                artist_name = ", ".join([a.name for a in album.artists])

            # 2. Spotify (On utilise les infos précises de Discogs)
            # Utiliser search_query optimisé si fourni (venant de GPT-4o Vision)

            spotify_data = self.step_3_spotify(artist_name, album.title, search_query=search_query)

            

            # 3. Construction objet final

            final_cover = album.images[0]['uri'] if album.images else None

            spotify_link = None

            spotify_uri = None

            

            if spotify_data:

                spotify_link = spotify_data['spotify_link']

                spotify_uri = spotify_data['spotify_uri']

                if spotify_data['cover_hd']:

                    final_cover = spotify_data['cover_hd']

            # Prioriser la tracklist Spotify si disponible, sinon utiliser Discogs

            if spotify_data and spotify_data.get('tracks'):

                clean_tracklist = spotify_data['tracks']

                print(f"   ✅ Tracklist récupérée depuis Spotify ({len(clean_tracklist)} pistes)")

            else:

                clean_tracklist = [t.title for t in album.tracklist if t.position]

                print(f"   ✅ Tracklist récupérée depuis Discogs ({len(clean_tracklist)} pistes)")

            return {

                "status": "success",

                "display": {

                    "artist": artist_name,

                    "title": album.title,

                    "cover_image": final_cover,

                },

                "details": {

                    "year": str(album.year) if album.year else "",

                    "label": album.labels[0].name if album.labels else "",

                    "genre": album.genres,

                    "tracklist": clean_tracklist

                },

                "links": {

                    "spotify_url": spotify_link,

                    "spotify_uri": spotify_uri,

                    "discogs_url": album.url

                }

            }

        except Exception as e:

            print(f"Erreur process ID: {e}")

            return {"status": "error", "message": str(e)}



# --- EXECUTION DE TEST ---

if __name__ == "__main__":

    # Instanciation

    app = KissaCore()

    

    # Image de test (Assure-toi d'avoir ce fichier dans le dossier)

    TEST_IMAGE = "test_vinyl.jpg" 

    

    if os.path.exists(TEST_IMAGE):

        print("Demarrage du crash test Kissa...")

        result = app.process(TEST_IMAGE)

        

        print("\n--- RÉSULTAT JSON FINAL ---")

        print(json.dumps(result, indent=4, ensure_ascii=False))

    else:

        print(f"ERREUR : Fichier '{TEST_IMAGE}' introuvable. Ajoute une photo pour tester.")

