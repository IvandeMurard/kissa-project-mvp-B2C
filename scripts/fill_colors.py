# scripts/fill_colors.py
import os
import sys
from supabase import create_client, Client
import colorgram
import requests
from io import BytesIO
from dotenv import load_dotenv

# Load .env from project root (parent of scripts/)
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

# --- CONFIGURATION (Supporte plusieurs noms de variables pour flexibilité) ---
# URL: NEXT_PUBLIC_SUPABASE_URL (frontend) ou SUPABASE_URL (backend)
URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
# Clé: SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_SERVICE_KEY (les deux sont des clés service role)
KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")
# --------------------------------------------------------------------------

if not URL or not KEY:
    print("❌ Erreur : Clés Supabase manquantes.")
    print("   Vérifiez que votre .env contient :")
    print("   - NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_URL")
    print("   - SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_SERVICE_KEY")
    sys.exit(1)

supabase: Client = create_client(URL, KEY)


def get_hex_color_and_hue(image_url: str):
    """
    Extract dominant color (hex) and hue (0-360) from an image URL.
    Returns (hex_str, hue_float) or (None, None) on error.
    """
    try:
        # Headers pour éviter les erreurs 403 (Discogs bloque les requêtes sans User-Agent)
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(image_url, timeout=10, headers=headers)
        response.raise_for_status()
        image = BytesIO(response.content)
        colors = colorgram.extract(image, 1)
        if colors:
            c = colors[0]
            
            # Gérer les deux formats possibles de c.rgb (objet avec attributs ou tuple)
            if isinstance(c.rgb, tuple):
                r, g, b = c.rgb[0], c.rgb[1], c.rgb[2]
            else:
                r, g, b = c.rgb.r, c.rgb.g, c.rgb.b
            
            hex_str = "#{:02x}{:02x}{:02x}".format(r, g, b)
            
            # Calcul du hue pour le tri optimal (Rainbow Shelf)
            # colorgram hsl: h,s,l in 0-255; convert h to 0-360
            # Gérer aussi le cas où hsl pourrait être un tuple
            if hasattr(c.hsl, 'h'):
                h_raw = c.hsl.h
            elif isinstance(c.hsl, tuple):
                h_raw = c.hsl[0] if len(c.hsl) > 0 else None
            else:
                h_raw = None
                
            hue_float = (h_raw / 255.0) * 360.0 if h_raw is not None else None
            
            return (hex_str, hue_float)
    except Exception as e:
        print(f"   ⚠️ Erreur image: {e}")
    return (None, None)


def main():
    print("🎨 Démarrage du remplissage des couleurs...")
    
    # On récupère TOUS les albums (même ceux qui ont déjà une couleur, pour être sûr)
    try:
        response = supabase.table('albums').select('id, title, cover_image').execute()
        albums = response.data or []
    except Exception as e:
        print(f"❌ Erreur lors de la récupération des albums : {e}")
        print("   Vérifiez votre connexion et vos clés Supabase.")
        sys.exit(1)
    
    if not albums:
        print("ℹ️  Aucun album trouvé dans la base de données.")
        return
    
    print(f"📊 {len(albums)} albums trouvés.")

    count = 0
    skipped = 0
    errors = 0
    
    for album in albums:
        if not album.get('cover_image'):
            skipped += 1
            continue
            
        album_id = album.get("id")
        album_title = album.get("title", "Unknown")
        
        print(f"Traitement : {album_title}...")
        hex_color, hue_float = get_hex_color_and_hue(album['cover_image'])
        
        if hex_color:
            # Mise à jour avec dominant_color et dominant_hue (pour tri optimal)
            update_data = {"dominant_color": hex_color}
            if hue_float is not None:
                update_data["dominant_hue"] = hue_float
            
            try:
                supabase.table('albums').update(update_data).eq('id', album_id).execute()
                if hue_float is not None:
                    print(f"   ✅ Couleur : {hex_color} (hue: {hue_float:.1f})")
                else:
                    print(f"   ✅ Couleur : {hex_color}")
                count += 1
            except Exception as e:
                errors += 1
                print(f"   ❌ Erreur lors de la mise à jour : {e}")
        else:
            errors += 1
            print("   ❌ Pas de couleur trouvée.")

    print(f"\n✨ Terminé !")
    print(f"   Mis à jour : {count} albums")
    if skipped > 0:
        print(f"   Ignorés : {skipped} albums (pas de cover_image)")
    if errors > 0:
        print(f"   Erreurs : {errors} albums")


if __name__ == "__main__":
    main()
