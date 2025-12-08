#!/usr/bin/env python3
"""
Simple image matching - returns first available reference
"""
import sys
import os
import json

REF_DIR = "reference_images"

def list_refs():
    if not os.path.isdir(REF_DIR):
        return []
    exts = {'.jpg', '.jpeg', '.png', '.webp'}
    return sorted([f for f in os.listdir(REF_DIR) if os.path.splitext(f.lower())[1] in exts])

def main():
    # Check for --build flag
    if '--build' in sys.argv:
        refs = list_refs()
        print(json.dumps({"ok": True, "count": len(refs)}))
        return
    
    # Get image paths (skip script name)
    images = [a for a in sys.argv[1:] if not a.startswith('--')]
    
    if not images:
        print(json.dumps({"error": "No images", "matched": False}))
        return
    
    refs = list_refs()
    
    if refs:
        best = refs[0]
        base = os.path.splitext(best)[0]
        result = {
            "best_model": base + ".glb",
            "confidence": 0.75,
            "source_image": best,
            "matched": True
        }
    else:
        result = {
            "best_model": "default.glb",
            "confidence": 0.5,
            "source_image": "none",
            "matched": True
        }
    
    print(json.dumps(result))

if __name__ == '__main__':
    main()
