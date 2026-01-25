#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de test automatisé pour l'endpoint POST /albums/{id}/generate-notes
Teste la génération de notes éditoriales via GPT-4o
"""

import requests
import json
import sys
import os
from datetime import datetime

# Configuration de l'encodage UTF-8 pour Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Configuration
API_BASE_URL = "http://localhost:8000"
ALBUM_ID = "a44ae748-bcae-4256-8e8e-2c715b9f30d2"

def print_header(text):
    """Affiche un en-tête formaté"""
    print("\n" + "=" * 70)
    print(f"  {text}")
    print("=" * 70 + "\n")

def print_section(text):
    """Affiche une section formatée"""
    print("-" * 70)
    print(f"  {text}")
    print("-" * 70)

def test_generate_notes():
    """Teste l'endpoint POST /albums/{id}/generate-notes"""
    
    print_header("TEST : Génération de Notes Éditoriales")
    
    # 1. Vérifier que le serveur est accessible
    print_section("1. Vérification du serveur")
    try:
        response = requests.get(f"{API_BASE_URL}/", timeout=5)
        if response.status_code == 200:
            print(f"✅ Serveur accessible : {response.json()}")
        else:
            print(f"⚠️  Serveur répond avec le code {response.status_code}")
    except requests.exceptions.ConnectionError:
        print("❌ ERREUR : Impossible de se connecter au serveur")
        print(f"   Assurez-vous que le serveur FastAPI est démarré sur {API_BASE_URL}")
        print("   Commande : uvicorn api:app --reload")
        return False
    except Exception as e:
        print(f"❌ Erreur lors de la vérification du serveur : {e}")
        return False
    
    # 2. Vérifier que l'album existe
    print_section("2. Vérification de l'album")
    try:
        response = requests.get(f"{API_BASE_URL}/library", timeout=10)
        if response.status_code == 200:
            albums = response.json()
            album = next((a for a in albums if a.get("id") == ALBUM_ID), None)
            if album:
                print(f"✅ Album trouvé : {album.get('artist', 'N/A')} - {album.get('title', 'N/A')}")
                print(f"   ID : {ALBUM_ID}")
            else:
                print(f"⚠️  Album avec l'ID {ALBUM_ID} non trouvé dans la bibliothèque")
                print(f"   Albums disponibles : {len(albums)}")
        else:
            print(f"⚠️  Impossible de récupérer la bibliothèque (code {response.status_code})")
    except Exception as e:
        print(f"⚠️  Erreur lors de la vérification de l'album : {e}")
    
    # 3. Appeler l'endpoint de génération de notes
    print_section("3. Appel de l'endpoint POST /albums/{id}/generate-notes")
    endpoint = f"{API_BASE_URL}/albums/{ALBUM_ID}/generate-notes"
    print(f"📡 URL : {endpoint}")
    print(f"📅 Heure : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    try:
        print("⏳ Envoi de la requête...")
        response = requests.post(endpoint, timeout=60)  # Timeout de 60s pour GPT-4o
        
        print_section("4. Résultat de la requête")
        print(f"📊 Status Code : {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ SUCCÈS : Notes éditoriales générées avec succès\n")
            
            print("📝 Données retournées :")
            print(f"   Album ID : {data.get('album_id', 'N/A')}")
            print(f"   Notes générées : {len(data.get('editorial_notes', ''))} caractères\n")
            
            print("📄 Contenu des notes éditoriales :")
            print("-" * 70)
            editorial_notes = data.get('editorial_notes', '')
            print(editorial_notes)
            print("-" * 70)
            
            # Statistiques
            word_count = len(editorial_notes.split())
            print(f"\n📊 Statistiques :")
            print(f"   Nombre de mots : {word_count}")
            print(f"   Nombre de caractères : {len(editorial_notes)}")
            print(f"   Objectif : ~150 mots (max 300 tokens)")
            
            if word_count > 200:
                print("   ⚠️  Le texte dépasse légèrement l'objectif de 150 mots")
            elif word_count < 100:
                print("   ⚠️  Le texte est plus court que l'objectif de 150 mots")
            else:
                print("   ✅ Longueur conforme à l'objectif")
            
            # Vérifier le format markdown
            has_bold = "**" in editorial_notes
            print(f"   Format Markdown : {'✅ Présent' if has_bold else '⚠️  Aucun gras détecté'}")
            
            return True
            
        elif response.status_code == 404:
            print("❌ ERREUR 404 : Album introuvable")
            print(f"   Vérifiez que l'ID {ALBUM_ID} existe dans Supabase")
            return False
            
        elif response.status_code == 500:
            error_detail = response.json().get('detail', 'Erreur inconnue')
            print(f"❌ ERREUR 500 : {error_detail}")
            
            if "OpenAI" in error_detail or "OPENAI_API_KEY" in error_detail:
                print("\n💡 Solution :")
                print("   1. Vérifiez que OPENAI_API_KEY est défini dans votre .env")
                print("   2. Vérifiez que la clé API est valide")
                print("   3. Redémarrez le serveur après modification du .env")
            
            return False
            
        else:
            print(f"❌ ERREUR {response.status_code}")
            try:
                error_data = response.json()
                print(f"   Détail : {error_data}")
            except:
                print(f"   Réponse brute : {response.text[:200]}")
            return False
            
    except requests.exceptions.Timeout:
        print("❌ TIMEOUT : La requête a pris plus de 60 secondes")
        print("   Cela peut arriver si OpenAI met du temps à répondre")
        return False
        
    except requests.exceptions.RequestException as e:
        print(f"❌ ERREUR DE REQUÊTE : {e}")
        return False
        
    except Exception as e:
        print(f"❌ ERREUR INATTENDUE : {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Fonction principale"""
    print_header("TEST AUTOMATISÉ - Génération de Notes Éditoriales")
    print(f"🎵 Album ID : {ALBUM_ID}")
    print(f"🌐 API Base URL : {API_BASE_URL}")
    
    success = test_generate_notes()
    
    print_header("RÉSUMÉ DU TEST")
    if success:
        print("✅ TEST RÉUSSI")
        print("   Les notes éditoriales ont été générées et sauvegardées dans Supabase")
        print("\n💡 Prochaines étapes :")
        print("   1. Vérifiez dans Supabase que la colonne 'editorial_notes' a été mise à jour")
        print("   2. Testez l'endpoint PATCH /albums/{id}/context pour la mémoire personnelle")
    else:
        print("❌ TEST ÉCHOUÉ")
        print("   Consultez les messages d'erreur ci-dessus pour plus de détails")
    
    return 0 if success else 1

if __name__ == "__main__":
    # Permettre de passer l'album_id en argument
    if len(sys.argv) > 1:
        ALBUM_ID = sys.argv[1]
        print(f"📝 Utilisation de l'ID fourni : {ALBUM_ID}")
    
    # Permettre de passer l'URL de l'API en argument
    if len(sys.argv) > 2:
        API_BASE_URL = sys.argv[2]
        print(f"📝 Utilisation de l'URL fournie : {API_BASE_URL}")
    
    sys.exit(main())
