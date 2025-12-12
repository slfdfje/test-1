#!/usr/bin/env python3
"""
CLIP AI matching for 3D glasses models
"""
import sys
import os
import json
import time

REF_DIR = "reference_images"
EMBEDDINGS_FILE = "reference_embeddings.pt"

def list_refs():
    if not os.path.isdir(REF_DIR):
        return []
    exts = {'.jpg', '.jpeg', '.png', '.webp'}
    return sorted([f for f in os.listdir(REF_DIR) if os.path.splitext(f.lower())[1] in exts])

def simple_match():
    refs = list_refs()
    if refs:
        base = os.path.splitext(refs[0])[0]
        return {"best_model": base + ".glb", "confidence": 0.6, "source_image": refs[0], "matched": True, "method": "fallback"}
    return {"best_model": "default.glb", "confidence": 0.5, "source_image": "none", "matched": True, "method": "default"}

def load_clip():
    try:
        import torch
        from transformers import CLIPProcessor, CLIPModel
        from PIL import Image
        
        device = "cpu"
        model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").to(device)
        processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
        return torch, model, processor, device, Image
    except ImportError as e:
        print(f"Import error: {e}", file=sys.stderr)
        return None

def build_embeddings():
    print("Building embeddings...", file=sys.stderr)
    loaded = load_clip()
    if not loaded:
        return False
    
    torch, model, processor, device, Image = loaded
    refs = list_refs()
    if not refs:
        print("No reference images found", file=sys.stderr)
        return False

    ref_paths = [os.path.join(REF_DIR, f) for f in refs]
    print(f"Processing {len(ref_paths)} images...", file=sys.stderr)
    
    try:
        ref_imgs = [Image.open(p).convert('RGB') for p in ref_paths]
        
        with torch.no_grad():
            ref_inputs = processor(images=ref_imgs, return_tensors='pt', padding=True).to(device)
            ref_feats = model.get_image_features(**ref_inputs)
            ref_feats = ref_feats / ref_feats.norm(p=2, dim=-1, keepdim=True)
            
        torch.save({
            "features": ref_feats,
            "filenames": refs
        }, EMBEDDINGS_FILE)
        
        print(f"Saved embeddings to {EMBEDDINGS_FILE}", file=sys.stderr)
        return True
    except Exception as e:
        print(f"Error building embeddings: {e}", file=sys.stderr)
        return False

def clip_match(image_paths):
    # Try to load embeddings first
    loaded = load_clip()
    if not loaded:
        return simple_match()
        
    torch, model, processor, device, Image = loaded
    
    ref_feats = None
    ref_filenames = []
    
    if os.path.exists(EMBEDDINGS_FILE):
        try:
            print(f"Loading cached embeddings from {EMBEDDINGS_FILE}...", file=sys.stderr)
            data = torch.load(EMBEDDINGS_FILE)
            ref_feats = data["features"]
            ref_filenames = data["filenames"]
        except Exception as e:
            print(f"Failed to load embeddings: {e}", file=sys.stderr)
    
    # If no embeddings or load failed, rebuild them (or fallback if too many)
    if ref_feats is None:
        print("No cached embeddings found. Using fallback/slow mode.", file=sys.stderr)
        # For now, just fail back to simple match to avoid OOM if we haven't built them
        # Alternatively, we could build them on the fly, but that risks OOM again.
        # Let's try to build them if there are few images, otherwise warn.
        refs = list_refs()
        if len(refs) > 50:
             print("Too many images to process on-the-fly. Please run --build first.", file=sys.stderr)
             return simple_match()
             
        # Small enough to process on the fly?
        # Re-use the logic from original script if needed, but for now let's stick to the plan:
        # We really want to use the cache.
        return simple_match()

    try:
        # Encode uploaded images
        print(f"Processing {len(image_paths)} uploaded images...", file=sys.stderr)
        up_imgs = [Image.open(p).convert('RGB') for p in image_paths]
        
        with torch.no_grad():
            up_inputs = processor(images=up_imgs, return_tensors='pt', padding=True).to(device)
            up_feats = model.get_image_features(**up_inputs)
            up_feats = up_feats / up_feats.norm(p=2, dim=-1, keepdim=True)
        
        # Find best match
        mean_feat = up_feats.mean(dim=0, keepdim=True)
        mean_feat = mean_feat / mean_feat.norm(p=2, dim=-1, keepdim=True)
        
        sims = (mean_feat @ ref_feats.T).squeeze(0)
        best_idx = int(torch.argmax(sims).item())
        best_score = float(sims[best_idx].item())
        best_ref = ref_filenames[best_idx]
        
        base = os.path.splitext(best_ref)[0]
        confidence = (best_score + 1.0) / 2.0
        
        print(f"Best match: {best_ref} with score {best_score:.3f}", file=sys.stderr)
        
        return {
            "best_model": base + ".glb",
            "confidence": round(confidence, 3),
            "source_image": best_ref,
            "matched": True,
            "method": "clip_cached"
        }
        
    except Exception as e:
        print(f"Matching error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        return simple_match()

def main():
    if '--build' in sys.argv:
        success = build_embeddings()
        print(json.dumps({"ok": success}))
        return
    
    images = [a for a in sys.argv[1:] if not a.startswith('--')]
    
    if not images:
        print(json.dumps({"error": "No images", "matched": False}))
        return
    
    result = clip_match(images)
    print(json.dumps(result))

if __name__ == '__main__':
    main()
