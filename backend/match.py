"""
CLIP-based AI matching for 3D glasses models
Compares uploaded images to reference images using CLIP embeddings
"""
import sys
import os
import json
import argparse

REF_DIR = "reference_images"
EMB_PATH = "reference_embeddings.pt"

def list_reference_images():
    """List all reference images"""
    if not os.path.isdir(REF_DIR):
        return []
    exts = {'.jpg', '.jpeg', '.png', '.webp'}
    return sorted([f for f in os.listdir(REF_DIR) if os.path.splitext(f.lower())[1] in exts])

def simple_match(image_paths):
    """Fallback: return first reference image"""
    ref_images = list_reference_images()
    if ref_images:
        best_image = ref_images[0]
        base, _ = os.path.splitext(best_image)
        return {
            'best_model': base + '.glb',
            'confidence': 0.6,
            'source_image': best_image,
            'matched': True,
            'method': 'fallback'
        }
    return {'best_model': 'default.glb', 'confidence': 0.5, 'source_image': 'none', 'matched': True, 'method': 'default'}

def clip_match(image_paths):
    """AI matching using CLIP embeddings"""
    try:
        import torch
        from PIL import Image
        from transformers import CLIPProcessor, CLIPModel
        
        ref_images = list_reference_images()
        if not ref_images:
            return simple_match(image_paths)
        
        # Load CLIP model
        device = "cuda" if torch.cuda.is_available() else "cpu"
        model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").to(device)
        processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
        
        # Load and encode reference images
        ref_paths = [os.path.join(REF_DIR, f) for f in ref_images]
        ref_imgs = [Image.open(p).convert('RGB') for p in ref_paths]
        
        with torch.no_grad():
            ref_inputs = processor(images=ref_imgs, return_tensors='pt', padding=True).to(device)
            ref_feats = model.get_image_features(**ref_inputs)
            ref_feats = ref_feats / ref_feats.norm(p=2, dim=-1, keepdim=True)
        
        # Load and encode uploaded images
        uploaded_imgs = [Image.open(p).convert('RGB') for p in image_paths]
        
        with torch.no_grad():
            up_inputs = processor(images=uploaded_imgs, return_tensors='pt', padding=True).to(device)
            up_feats = model.get_image_features(**up_inputs)
            up_feats = up_feats / up_feats.norm(p=2, dim=-1, keepdim=True)
        
        # Average uploaded embeddings
        mean_feat = up_feats.mean(dim=0, keepdim=True)
        mean_feat = mean_feat / mean_feat.norm(p=2, dim=-1, keepdim=True)
        
        # Find best match (cosine similarity)
        sims = (mean_feat @ ref_feats.T).squeeze(0)
        best_idx = int(torch.argmax(sims).item())
        best_score = float(sims[best_idx].item())
        best_image = ref_images[best_idx]
        
        base, _ = os.path.splitext(best_image)
        confidence = (best_score + 1.0) / 2.0  # Normalize to 0-1
        
        return {
            'best_model': base + '.glb',
            'confidence': round(confidence, 3),
            'source_image': best_image,
            'matched': True,
            'method': 'clip'
        }
        
    except Exception as e:
        print(f"CLIP error: {e}", file=sys.stderr)
        return simple_match(image_paths)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--build', action='store_true')
    parser.add_argument('images', nargs='*')
    args = parser.parse_args()

    if args.build:
        ref_images = list_reference_images()
        print(json.dumps({"ok": True, "computed": len(ref_images), "images": ref_images}))
        return

    if not args.images:
        print(json.dumps({"error": "No images provided", "matched": False}))
        return

    result = clip_match(args.images)
    print(json.dumps(result))

if __name__ == '__main__':
    main()
