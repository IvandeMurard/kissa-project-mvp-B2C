# scripts/update_colors.py
import os
import sys
# Ajoute le dossier parent pour trouver api.py si besoin, ou setup direct
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from supabase import create_client, Client
import colorgram
import requests
from io import BytesIO
from dotenv import load_dotenv

# Load .env from project root (parent of scripts/)
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

# Config Supabase: SUPABASE_URL + SUPABASE_KEY (ou SUPABASE_SERVICE_KEY pour bypass RLS)
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY")


def get_dominant_color_and_hue(image_url: str):
    """
    Extract dominant color (hex) and hue (0-360) from an image URL.
    Returns (hex_str, hue_float) or (None, None) on error.
    """
    try:
        response = requests.get(image_url, timeout=10)
        response.raise_for_status()
        image = BytesIO(response.content)
        
        # Extrait 1 couleur
        colors = colorgram.extract(image, 1)
        if not colors:
            return (None, None)
        
        c = colors[0]
        r, g, b = c.rgb.r, c.rgb.g, c.rgb.b
        hex_str = "#{:02x}{:02x}{:02x}".format(r, g, b)
        
        # colorgram hsl: h,s,l in 0-255; convert h to 0-360
        h_raw = c.hsl.h
        hue_float = (h_raw / 255.0) * 360.0 if h_raw is not None else None
        
        return (hex_str, hue_float)
    except Exception as e:
        print(f"Error extracting color: {e}")
        return (None, None)


def main():
    if not url or not key:
        print("❌ Missing SUPABASE_URL or Supabase key (SUPABASE_KEY or SUPABASE_SERVICE_KEY) in .env.")
        sys.exit(1)
    supabase: Client = create_client(url, key)

    print("🎨 Starting Color Backfill...")

    # 1. Récupérer les albums sans dominant_color OU sans dominant_hue
    try:
        response = supabase.table("albums").select("id, title, cover_image, dominant_color, dominant_hue").execute()
        albums = response.data or []
    except Exception as e:
        print(f"❌ Error fetching albums from Supabase: {e}")
        print("   Check your SUPABASE_URL and key, and ensure you have network connectivity.")
        sys.exit(1)

    if not albums:
        print("ℹ️  No albums found in database.")
        return

    count = 0
    errors = 0
    skipped = 0

    for album in albums:
        if not album.get("cover_image"):
            skipped += 1
            continue

        # Skip si déjà une couleur ET un hue (pour éviter de recalculer inutilement)
        if album.get('dominant_color') and album.get('dominant_hue') is not None:
            skipped += 1
            continue

        album_id = album.get("id")
        album_title = album.get("title", "Unknown")
        
        print(f"Processing: {album_title} (ID: {album_id})...")
        hex_color, hue_float = get_dominant_color_and_hue(album["cover_image"])

        if hex_color:
            update_data = {"dominant_color": hex_color}
            if hue_float is not None:
                update_data["dominant_hue"] = hue_float
            
            try:
                supabase.table("albums").update(update_data).eq("id", album_id).execute()
                print(f"   ✅ Updated: {hex_color} (hue: {hue_float:.1f})" if hue_float is not None else f"   ✅ Updated: {hex_color}")
                count += 1
            except Exception as e:
                errors += 1
                print(f"   ❌ Failed to update album {album_id} ({album_title}): {e}")
                # Continue processing other albums
        else:
            errors += 1
            print(f"   ⚠️  Could not extract color for {album_title}")

    print(f"\n✅ Finished!")
    print(f"   Updated: {count} albums")
    if skipped > 0:
        print(f"   Skipped: {skipped} albums (already have color+hue or no cover_image)")
    if errors > 0:
        print(f"   Errors: {errors} albums failed")


if __name__ == "__main__":
    main()