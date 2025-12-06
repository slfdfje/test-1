"""
CLIP-based image matching for 3D glasses models
Matches uploaded images to reference images using CLIP embeddings
"""
import sys
import os
import json
import argparse
import torch
from PIL import Image
from transformers import CLIPProcessor, CLIPModel

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
MODEL_NAME = "openai/clip-vit-base-patch32"
REF_DIR = "reference_images"
EMB_PATH = "reference_embeddings.pt"

def load_clip():
    """Load CLIP model and processor"""
    model = CLIPModel.from_pretrained(MODEL_NAME).to(DEVICE)
    processor = CLIPProcessor.from_pretrained(MODEL_NAME)
    return model, processor

def list_reference_images():
    """List all reference images in the reference folder"""
    if not os.path.isdir(REF_DIR):
        return []
    exts = {'.jpg', '.jpeg', '.png', '.webp'}
    files = [f for f in os.listdir(REF_DIR) if os.path.splitext(f.lower())[1] in exts]
    return files

def compute_reference_embeddings(model, processor):
    """Compute and save embeddings for all reference images"""
    files = list_reference_images()
    if not files:
        print(json.dumps({"ok": False, "error": "No reference images found"}))
        return None
    
    paths = [os.path.join(REF_DIR, f) for f in files]
    images = [Image.open(p).convert('RGB') for p in paths]
    
    with torch.no_grad():
        inputs = processor(images=images, return_tensors='pt', padding=True).to(DEVICE)
        feats = model.get_image_features(**inputs)
        feats = feats / feats.norm(p=2, dim=-1, keepdim=True)
    
    data = {'files': files, 'features': feats.cpu()}
    torch.save(data, EMB_PATH)
    print(json.dumps({'ok': True, 'computed': len(files)}))
    return data

def load_reference_embeddings(model, processor):
    """Load cached embeddings or compute new ones"""
    if os.path.exists(EMB_PATH):
        return torch.load(EMB_PATH, map_location='cpu', weights_only=False)
    return compute_reference_embeddings(model, processor)

def image_to_embedding(model, processor, path):
    """Convert a single image to CLIP embedding"""
    img = Image.open(path).convert('RGB')
    with torch.no_grad():
        inputs = processor(images=img, return_tensors='pt').to(DEVICE)
        feat = model.get_image_features(**inputs)
        feat = feat / feat.norm(p=2, dim=-1, keepdim=True)
    return feat.cpu()

def match_images(image_paths):
    """Match uploaded images against reference images using CLIP"""
    model, processor = load_clip()
    ref_data = load_reference_embeddings(model, processor)
    
    if ref_data is None or 'files' not in ref_data:
        return {"error": "No reference embeddings available", "matched": False}
    
    # Compute embeddings for uploaded images
    feats = [image_to_embedding(model, processor, p) for p in image_paths]
    stacked = torch.stack(feats, dim=0)
    mean_feat = stacked.mean(dim=0)
    mean_feat = mean_feat / mean_feat.norm(p=2, dim=-1, keepdim=True)
    
    # Find best match
    ref_feats = ref_data['features']
    sims = (mean_feat @ ref_feats.T).squeeze(0)
    best_idx = int(torch.argmax(sims).item())
    best_score = float(sims[best_idx].item())
    best_image = ref_data['files'][best_idx]
    
    # Convert reference image name to GLB model name
    base, _ = os.path.splitext(best_image)
    best_glb = base + '.glb'
    
    # Normalize confidence to 0-1 range
    confidence = (best_score + 1.0) / 2.0
    
    return {
        'best_model': best_glb,
        'confidence': round(confidence, 3),
        'source_image': best_image,
        'matched': True
    }

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--build', action='store_true', help='Build reference embeddings')
    parser.add_argument('images', nargs='*')
    args = parser.parse_args()

    if args.build:
        model, processor = load_clip()
        compute_reference_embeddings(model, processor)
        return

    if not args.images:
        print(json.dumps({"error": "No images provided", "matched": False}))
        return

    result = match_images(args.images)
    print(json.dumps(result))

if __name__ == '__main__':
    main()
