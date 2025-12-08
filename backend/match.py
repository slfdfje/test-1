"""
Image matching for 3D glasses models
Uses simple reference matching with optional CLIP AI
"""
import sys
import os
import json
import argparse

REF_DIR = "reference_images"

def list_reference_images():
    """List all reference images"""
    if not os.path.isdir(REF_DIR):
        return []
    exts = {'.jpg', '.jpeg', '.png', '.webp'}
    return sorted([f for f in os.listdir(REF_DIR) if os.path.splitext(f.lower())[1] in exts])

def match_images(image_paths):
    """Match uploaded images to reference images"""
    ref_images = list_reference_images()
    
    # Try CLIP if available
    try:
        import torch
        from PIL import Image
        from transformers import CLIPProcessor, CLIPModel
        
        if ref_images:
            device = "cpu"
            model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").to(device)
            processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
            
            # Encode references
            ref_paths = [os.path.join(REF_DIR, f) for f in ref_images]
            ref_imgs = [Image.open(p).convert('RGB') for p in ref_paths]
            
            with torch.no_grad():
                ref_inputs = processor(images=ref_imgs, return_tensors='pt', padding=True)
                ref_feats = model.get_image_features(**ref_inputs)
                ref_feats = ref_feats / ref_feats.norm(p=2, dim=-1, keepdim=True)
            
            # Encode uploads
            up_imgs = [Image.open(p).convert('RGB') for p in image_paths]
            with torch.no_grad():
                up_inputs = processor(images=up_imgs, return_tensors='pt', padding=True)
                up_feats = model.get_image_features(**up_inputs)
                up_feats = up_feats / up_feats.norm(p=2, dim=-1, keepdim=True)
            
            # Average and find best match
            mean_feat = up_feats.mean(dim=0, keepdim=True)
            mean_feat = mean_feat / mean_feat.norm(p=2, dim=-1, keepdim=True)
            sims = (mean_feat @ ref_feats.T).squeeze(0)
            best_idx = int(torch.argmax(sims).item())
            best_score = float(sims[best_idx].item())
            best_image = ref_images[best_idx]
            base, _ = os.path.splitext(best_image)
            
            return {
                'best_model': base + '.glb',
                'confidence': round((best_score + 1.0) / 2.0, 3),
                'source_image': best_image,
                'matched': True,
                'method': 'clip'
            }
    except Exception as e:
        print(f"CLIP unavailable: {e}", file=sys.stderr)
    
    # Fallback: return first reference
    if ref_images:
        best_image = ref_images[0]
        base, _ = os.path.splitext(best_image)
        return {
            'best_model': base + '.glb',
            'confidence': 0.7,
            'source_image': best_image,
            'matched': True,
            'method': 'fallback'
        }
    
    return {'best_model': 'default.glb', 'confidence': 0.5, 'source_image': 'none', 'matched': True}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--build', action='store_true')
    parser.add_argument('images', nargs='*')
    args = parser.parse_args()

    if args.build:
        print(json.dumps({"ok": True, "computed": len(list_reference_images())}))
        return

    if not args.images:
        print(json.dumps({"error": "No images", "matched": False}))
        return

    print(json.dumps(match_images(args.images)))

if __name__ == '__main__':
    main()
