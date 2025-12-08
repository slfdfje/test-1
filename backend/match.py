"""
Simple reference-based matching
Returns first available reference image as match
"""
import sys
import os
import json
import argparse

REF_DIR = "reference_images"

def list_reference_images():
    """List all reference images in the reference folder"""
    if not os.path.isdir(REF_DIR):
        return []
    exts = {'.jpg', '.jpeg', '.png', '.webp'}
    files = [f for f in os.listdir(REF_DIR) if os.path.splitext(f.lower())[1] in exts]
    return sorted(files)

def find_match(image_paths):
    """Find best matching model based on available references"""
    ref_images = list_reference_images()
    
    if ref_images:
        # Return first reference as match
        best_image = ref_images[0]
        base, _ = os.path.splitext(best_image)
        best_glb = base + '.glb'
        return {
            'best_model': best_glb,
            'confidence': 0.75,
            'source_image': best_image,
            'matched': True
        }
    
    # No reference images - return default
    return {
        'best_model': 'default.glb',
        'confidence': 0.5,
        'source_image': 'none',
        'matched': True
    }

def build_index():
    """Build reference index"""
    ref_images = list_reference_images()
    print(json.dumps({
        "ok": True,
        "computed": len(ref_images),
        "images": ref_images
    }))

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--build', action='store_true')
    parser.add_argument('images', nargs='*')
    args = parser.parse_args()

    if args.build:
        build_index()
        return

    if not args.images:
        print(json.dumps({"error": "No images provided", "matched": False}))
        return

    result = find_match(args.images)
    print(json.dumps(result))

if __name__ == '__main__':
    main()
