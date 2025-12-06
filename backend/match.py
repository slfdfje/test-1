"""
CLIP-based image matching for 3D glasses models
Matches uploaded images to reference images using CLIP embeddings
"""
import sys
import os
import json
import argparse

REF_DIR = "reference_images"
EMB_PATH = "reference_embeddings.pt"

def list_reference_images():
    """List all reference images in the reference folder"""
    if not os.path.isdir(REF_DIR):
        return []
    exts = {'.jpg', '.jpeg', '.png', '.webp'}
    files = [f for f in os.listdir(REF_DIR) if os.path.splitext(f.lower())[1] in exts]
    return files

def simple_match(image_paths):
    """Simple fallback matching based on available reference images"""
    ref_images = list_reference_images()
    
    if not ref_images:
        return {
            "error": "No reference images available",
            "matched": False
        }
    
    # Return first available reference as fallback
    best_image = ref_images[0]
    base, _ = os.path.splitext(best_image)
    best_glb = base + '.glb'
    
    return {
        'best_model': best_glb,
        'confidence': 0.7,
        'source_image': best_image,
        'matched': True,
        'match_type': 'fallback'
    }

def clip_match(image_paths):
    """Match using CLIP embeddings"""
    try:
        import torch
        from PIL import Image
        from transformers import CLIPProcessor, CLIPModel
        
        DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
        MODEL_NAME = "openai/clip-vit-base-patch32"
        
        # Load model
        model = CLIPModel.from_pretrained(MODEL_NAME).to(DEVICE)
        processor = CLIPProcessor.from_pretrained(MODEL_NAME)
        
        # Load or compute reference embeddings
        ref_images = list_reference_images()
        if not ref_images:
            return {"error": "No reference images", "matched": False}
        
        # Compute reference embeddings
        if os.path.exists(EMB_PATH):
            ref_data = torch.load(EMB_PATH, map_location='cpu', weights_only=False)
        else:
            paths = [os.path.join(REF_DIR, f) for f in ref_images]
            images = [Image.open(p).convert('RGB') for p in paths]
            with torch.no_grad():
                inputs = processor(images=images, return_tensors='pt', padding=True).to(DEVICE)
                feats = model.get_image_features(**inputs)
                feats = feats / feats.norm(p=2, dim=-1, keepdim=True)
            ref_data = {'files': ref_images, 'features': feats.cpu()}
            torch.save(ref_data, EMB_PATH)
        
        # Compute embeddings for uploaded images
        uploaded_images = [Image.open(p).convert('RGB') for p in image_paths]
        with torch.no_grad():
            inputs = processor(images=uploaded_images, return_tensors='pt', padding=True).to(DEVICE)
            feats = model.get_image_features(**inputs)
            feats = feats / feats.norm(p=2, dim=-1, keepdim=True)
        
        # Average embeddings if multiple images
        mean_feat = feats.mean(dim=0, keepdim=True)
        mean_feat = mean_feat / mean_feat.norm(p=2, dim=-1, keepdim=True)
        
        # Find best match
        ref_feats = ref_data['features']
        sims = (mean_feat @ ref_feats.T).squeeze(0)
        best_idx = int(torch.argmax(sims).item())
        best_score = float(sims[best_idx].item())
        best_image = ref_data['files'][best_idx]
        
        base, _ = os.path.splitext(best_image)
        best_glb = base + '.glb'
        confidence = (best_score + 1.0) / 2.0
        
        return {
            'best_model': best_glb,
            'confidence': round(confidence, 3),
            'source_image': best_image,
            'matched': True,
            'match_type': 'clip'
        }
        
    except Exception as e:
        return {"error": str(e), "matched": False}

def match_images(image_paths):
    """Try CLIP matching, fall back to simple matching on error"""
    result = clip_match(image_paths)
    if not result.get('matched'):
        # Try simple fallback
        fallback = simple_match(image_paths)
        if fallback.get('matched'):
            return fallback
    return result

def build_embeddings():
    """Build reference embeddings"""
    try:
        import torch
        from PIL import Image
        from transformers import CLIPProcessor, CLIPModel
        
        DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
        MODEL_NAME = "openai/clip-vit-base-patch32"
        
        model = CLIPModel.from_pretrained(MODEL_NAME).to(DEVICE)
        processor = CLIPProcessor.from_pretrained(MODEL_NAME)
        
        ref_images = list_reference_images()
        if not ref_images:
            print(json.dumps({"ok": False, "error": "No reference images"}))
            return
        
        paths = [os.path.join(REF_DIR, f) for f in ref_images]
        images = [Image.open(p).convert('RGB') for p in paths]
        
        with torch.no_grad():
            inputs = processor(images=images, return_tensors='pt', padding=True).to(DEVICE)
            feats = model.get_image_features(**inputs)
            feats = feats / feats.norm(p=2, dim=-1, keepdim=True)
        
        ref_data = {'files': ref_images, 'features': feats.cpu()}
        torch.save(ref_data, EMB_PATH)
        print(json.dumps({'ok': True, 'computed': len(ref_images)}))
        
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}))

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--build', action='store_true', help='Build reference embeddings')
    parser.add_argument('images', nargs='*')
    args = parser.parse_args()

    if args.build:
        build_embeddings()
        return

    if not args.images:
        print(json.dumps({"error": "No images provided", "matched": False}))
        return

    result = match_images(args.images)
    print(json.dumps(result))

if __name__ == '__main__':
    main()
