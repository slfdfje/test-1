#!/usr/bin/env python3
"""
CLIP AI matching for 3D glasses models
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

def simple_match():
    refs = list_refs()
    if refs:
        base = os.path.splitext(refs[0])[0]
        return {"best_model": base + ".glb", "confidence": 0.6, "source_image": refs[0], "matched": True, "method": "fallback"}
    return {"best_model": "default.glb", "confidence": 0.5, "source_image": "none", "matched": True, "method": "default"}

def clip_match(image_paths):
    refs = list_refs()
    if not refs:
        print(f"No reference images in {REF_DIR}", file=sys.stderr)
        return simple_match()
    
    # Try importing torch
    try:
        import torch
        print(f"PyTorch version: {torch.__version__}", file=sys.stderr)
    except ImportError as e:
        print(f"PyTorch import failed: {e}", file=sys.stderr)
        return simple_match()
    
    # Try importing transformers
    try:
        from transformers import CLIPProcessor, CLIPModel
        print("Transformers imported OK", file=sys.stderr)
    except ImportError as e:
        print(f"Transformers import failed: {e}", file=sys.stderr)
        return simple_match()
    
    # Try importing PIL
    try:
        from PIL import Image
        print("PIL imported OK", file=sys.stderr)
    except ImportError as e:
        print(f"PIL import failed: {e}", file=sys.stderr)
        return simple_match()
    
    try:
        device = "cpu"
        print("Loading CLIP model...", file=sys.stderr)
        model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").to(device)
        processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
        print("CLIP model loaded", file=sys.stderr)
        
        # Encode reference images
        ref_paths = [os.path.join(REF_DIR, f) for f in refs]
        print(f"Loading {len(ref_paths)} reference images...", file=sys.stderr)
        ref_imgs = [Image.open(p).convert('RGB') for p in ref_paths]
        
        with torch.no_grad():
            ref_inputs = processor(images=ref_imgs, return_tensors='pt', padding=True).to(device)
            ref_feats = model.get_image_features(**ref_inputs)
            ref_feats = ref_feats / ref_feats.norm(p=2, dim=-1, keepdim=True)
        
        # Encode uploaded images
        print(f"Loading {len(image_paths)} uploaded images...", file=sys.stderr)
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
        best_ref = refs[best_idx]
        
        base = os.path.splitext(best_ref)[0]
        confidence = (best_score + 1.0) / 2.0
        
        print(f"Best match: {best_ref} with score {best_score:.3f}", file=sys.stderr)
        
        return {
            "best_model": base + ".glb",
            "confidence": round(confidence, 3),
            "source_image": best_ref,
            "matched": True,
            "method": "clip"
        }
        
    except Exception as e:
        print(f"CLIP matching error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        return simple_match()

def main():
    if '--build' in sys.argv:
        refs = list_refs()
        print(json.dumps({"ok": True, "count": len(refs)}))
        return
    
    images = [a for a in sys.argv[1:] if not a.startswith('--')]
    
    if not images:
        print(json.dumps({"error": "No images", "matched": False}))
        return
    
    result = clip_match(images)
    print(json.dumps(result))

if __name__ == '__main__':
    main()
