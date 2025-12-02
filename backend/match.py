import sys, os, json, argparse
import torch
from PIL import Image
from transformers import CLIPProcessor, CLIPModel

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
MODEL_NAME = "openai/clip-vit-base-patch32"
REF_DIR = "reference_images"
EMB_PATH = "reference_embeddings.pt"

def load_clip():
    model = CLIPModel.from_pretrained(MODEL_NAME, use_safetensors=True).to(DEVICE)
    processor = CLIPProcessor.from_pretrained(MODEL_NAME)
    return model, processor

def list_reference_images():
    if not os.path.isdir(REF_DIR):
        raise RuntimeError(f"reference_images folder not found: {REF_DIR}")
    exts = {'.jpg','.jpeg','.png','.webp'}
    files = [f for f in os.listdir(REF_DIR) if os.path.splitext(f.lower())[1] in exts]
    if not files:
        raise RuntimeError('No reference images found in reference_images/')
    return files

def compute_reference_embeddings(model, processor):
    files = list_reference_images()
    paths = [os.path.join(REF_DIR, f) for f in files]
    images = [Image.open(p).convert('RGB') for p in paths]
    with torch.no_grad():
        inputs = processor(images=images, return_tensors='pt', padding=True).to(DEVICE)
        feats = model.get_image_features(**inputs)
        feats = feats / feats.norm(p=2, dim=-1, keepdim=True)
    data = {'files': files, 'features': feats.cpu()}
    torch.save(data, EMB_PATH)
    print(json.dumps({'ok':True, 'computed': len(files)}))
    return data

def load_reference_embeddings(model, processor):
    if os.path.exists(EMB_PATH):
        return torch.load(EMB_PATH, map_location='cpu')
    else:
        return compute_reference_embeddings(model, processor)

def image_to_embedding(model, processor, path):
    img = Image.open(path).convert('RGB')
    with torch.no_grad():
        inputs = processor(images=img, return_tensors='pt').to(DEVICE)
        feat = model.get_image_features(**inputs)
        feat = feat / feat.norm(p=2, dim=-1, keepdim=True)
    return feat.cpu()

def match_images(image_paths):
    model, processor = load_clip()
    ref_data = load_reference_embeddings(model, processor)
    feats = [image_to_embedding(model, processor, p) for p in image_paths]
    stacked = torch.stack(feats, dim=0)
    mean_feat = stacked.mean(dim=0)
    mean_feat = mean_feat / mean_feat.norm(p=2, dim=-1, keepdim=True)
    ref_feats = ref_data['features']
    sims = (mean_feat @ ref_feats.T).squeeze(0)
    best_idx = int(torch.argmax(sims).item())
    best_score = float(sims[best_idx].item())
    best_image = ref_data['files'][best_idx]
    base, _ = os.path.splitext(best_image)
    best_glb = base + '.glb'
    confidence = (best_score + 1.0) / 2.0
    return {'best_model': best_glb, 'confidence': confidence, 'source_image': best_image}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--build', action='store_true', help='(re)build reference embeddings from reference_images/')
    parser.add_argument('images', nargs='*')
    args = parser.parse_args()

    if args.build:
        model, processor = load_clip()
        compute_reference_embeddings(model, processor)
        return

    if not args.images:
        print(json.dumps({'error':'No images provided'}))
        return

    res = match_images(args.images)
    print(json.dumps(res))

if __name__ == '__main__':
    main()
