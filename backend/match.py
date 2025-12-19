import sys, os, json, argparse, colorsys
import torch
import numpy as np
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

def remove_background(image_path):
    """Remove background from glasses image using simple segmentation"""
    try:
        img = Image.open(image_path).convert('RGB')
        img_array = np.array(img)
        h, w, c = img_array.shape
        
        # Get corner pixels (likely background)
        corner_size = min(15, w//12, h//12)
        corners = []
        corners.extend(img_array[:corner_size, :corner_size].reshape(-1, 3))
        corners.extend(img_array[:corner_size, -corner_size:].reshape(-1, 3))
        corners.extend(img_array[-corner_size:, :corner_size].reshape(-1, 3))
        corners.extend(img_array[-corner_size:, -corner_size:].reshape(-1, 3))
        
        if len(corners) > 0:
            bg_color = np.mean(corners, axis=0)
            
            # Create mask for pixels similar to background
            pixels = img_array.reshape(-1, 3)
            distances = np.linalg.norm(pixels - bg_color, axis=1)
            threshold = np.percentile(distances, 25)  # Remove 25% most similar pixels
            
            mask = distances > threshold
            mask = mask.reshape(h, w)
            
            # Create new image with white background
            result = img_array.copy()
            result[~mask] = [255, 255, 255]  # Set background to white
            
            return Image.fromarray(result)
        else:
            return img
            
    except Exception as e:
        print(f"Background removal failed for {image_path}: {e}", file=sys.stderr)
        return Image.open(image_path).convert('RGB')

def detect_frame_material(pixels):
    """Detect if frame is plastic or metal based on color variance and reflectivity"""
    if len(pixels) < 10:
        return "plastic", 0.3
    
    # Calculate color variance - metal tends to have more uniform colors
    color_std = np.std(pixels, axis=0)
    avg_std = np.mean(color_std)
    
    # Calculate brightness variance - metal has more highlights
    brightness = np.mean(pixels, axis=1)
    brightness_std = np.std(brightness)
    
    # Metal detection: low color variance but high brightness variance (reflections)
    # Plastic: more uniform brightness, can have varied colors
    
    # Check for metallic colors (silver, gold, bronze)
    avg_color = np.mean(pixels, axis=0)
    r, g, b = avg_color
    
    # Silver/chrome: high brightness, low saturation
    is_silver = brightness.mean() > 150 and np.std([r, g, b]) < 20
    
    # Gold/bronze: warm tones with some shine
    is_gold = r > g > b and brightness_std > 30
    
    if is_silver or is_gold or (avg_std < 25 and brightness_std > 40):
        material = "metal"
        metalness = 0.7 if is_silver else 0.5
    else:
        material = "plastic"
        metalness = 0.1
    
    return material, metalness

def detect_frame_style(img):
    """Detect frame style: thick/thin, round/square"""
    try:
        img_array = np.array(img.convert('L'))  # Grayscale
        h, w = img_array.shape
        
        # Find edges to detect frame thickness
        from PIL import ImageFilter
        edges = img.convert('L').filter(ImageFilter.FIND_EDGES)
        edge_array = np.array(edges)
        
        # Count edge pixels to estimate frame thickness
        edge_density = np.sum(edge_array > 50) / (h * w)
        
        # Thick frames have more edge density
        if edge_density > 0.15:
            thickness = "thick"
            frame_width = 1.2
        elif edge_density > 0.08:
            thickness = "medium"
            frame_width = 1.0
        else:
            thickness = "thin"
            frame_width = 0.8
        
        # Detect shape by analyzing aspect ratio of non-white regions
        non_white = img_array < 240
        if np.any(non_white):
            rows = np.any(non_white, axis=1)
            cols = np.any(non_white, axis=0)
            rmin, rmax = np.where(rows)[0][[0, -1]]
            cmin, cmax = np.where(cols)[0][[0, -1]]
            
            aspect = (cmax - cmin) / max(1, rmax - rmin)
            
            if aspect > 2.5:
                shape = "rectangular"
            elif aspect > 1.8:
                shape = "square"
            else:
                shape = "round"
        else:
            shape = "square"
            
        return {
            "thickness": thickness,
            "shape": shape,
            "frameWidth": frame_width
        }
    except Exception as e:
        print(f"Frame style detection error: {e}", file=sys.stderr)
        return {"thickness": "medium", "shape": "square", "frameWidth": 1.0}

def extract_glasses_properties(image_paths):
    """Extract lens color, frame color, material, style from uploaded images"""
    all_lens_colors = []
    all_frame_colors = []
    all_frame_pixels = []
    all_brightness = []
    all_styles = []
    
    for img_path in image_paths:
        try:
            # Remove background first
            img = remove_background(img_path)
            width, height = img.size
            
            # Detect frame style
            style = detect_frame_style(img)
            all_styles.append(style)
            
            # Resize for faster processing
            img_small = img.resize((100, 100))
            pixels = np.array(img_small)
            pixels_flat = pixels.reshape(-1, 3)
            
            # Filter out white background pixels
            white_mask = np.sum(pixels_flat, axis=1) < 720
            filtered_pixels = pixels_flat[white_mask]
            
            if len(filtered_pixels) < 10:
                continue
                
            brightness = np.mean(filtered_pixels, axis=1)
            
            # Frame colors: darker pixels (frame material)
            dark_mask = (brightness > 10) & (brightness < 120)
            dark_pixels = filtered_pixels[dark_mask]
            
            if len(dark_pixels) > 10:
                frame_color = np.median(dark_pixels, axis=0).astype(int)
                all_frame_colors.append(frame_color)
                all_frame_pixels.extend(dark_pixels.tolist())
            
            # Lens colors from center region
            center_crop = img.crop((width//4, height//4, 3*width//4, 3*height//4))
            center_crop = center_crop.resize((50, 50))
            center_pixels = np.array(center_crop).reshape(-1, 3)
            
            # Filter out white background
            center_white_mask = np.sum(center_pixels, axis=1) < 720
            center_filtered = center_pixels[center_white_mask]
            
            if len(center_filtered) > 10:
                center_brightness = np.mean(center_filtered, axis=1)
                tint_mask = (center_brightness > 30) & (center_brightness < 220)
                tint_pixels = center_filtered[tint_mask]
                
                if len(tint_pixels) > 5:
                    lens_color = np.mean(tint_pixels, axis=0).astype(int)
                    all_lens_colors.append(lens_color)
            
            all_brightness.append(np.mean(brightness))
            
        except Exception as e:
            print(f"Error processing {img_path}: {e}", file=sys.stderr)
            continue
    
    # Detect frame material
    frame_pixels_array = np.array(all_frame_pixels) if all_frame_pixels else np.array([[50, 50, 50]])
    material, metalness = detect_frame_material(frame_pixels_array)
    
    # Calculate final frame color
    if all_frame_colors:
        final_frame = np.mean(all_frame_colors, axis=0).astype(int)
        r, g, b = int(final_frame[0]), int(final_frame[1]), int(final_frame[2])
        frame_color = f"#{r:02x}{g:02x}{b:02x}"
    else:
        frame_color = "#1a1a1a"
    
    # Calculate final lens color
    if all_lens_colors:
        final_lens = np.mean(all_lens_colors, axis=0).astype(int)
        r, g, b = int(final_lens[0]), int(final_lens[1]), int(final_lens[2])
        lens_color = f"#{r:02x}{g:02x}{b:02x}"
        h, s, v = colorsys.rgb_to_hsv(r/255, g/255, b/255)
        tint_opacity = min(0.85, max(0.2, s * 0.5 + 0.3))
    else:
        lens_color = "#4a5568"
        tint_opacity = 0.4
    
    # Aggregate frame style
    if all_styles:
        avg_width = np.mean([s["frameWidth"] for s in all_styles])
        most_common_shape = max(set([s["shape"] for s in all_styles]), key=[s["shape"] for s in all_styles].count)
        most_common_thickness = max(set([s["thickness"] for s in all_styles]), key=[s["thickness"] for s in all_styles].count)
    else:
        avg_width = 1.0
        most_common_shape = "square"
        most_common_thickness = "medium"
    
    avg_brightness = np.mean(all_brightness) if all_brightness else 128
    frame_scale = 1.0 + (128 - avg_brightness) / 500
    frame_scale = min(1.15, max(0.9, frame_scale))
    
    return {
        "lensColor": lens_color,
        "frameColor": frame_color,
        "tintOpacity": round(tint_opacity, 2),
        "frameScale": round(frame_scale, 2),
        "frameMaterial": material,
        "frameMetalness": round(metalness, 2),
        "frameThickness": most_common_thickness,
        "frameShape": most_common_shape,
        "frameWidth": round(avg_width, 2)
    }

def image_to_embedding(model, processor, path):
    # Remove background before processing
    img = remove_background(path)
    print(f"Processed {path} with background removal", file=sys.stderr)
    
    with torch.no_grad():
        inputs = processor(images=img, return_tensors='pt').to(DEVICE)
        feat = model.get_image_features(**inputs)
        feat = feat / feat.norm(p=2, dim=-1, keepdim=True)
    return feat.cpu()

def match_images(image_paths):
    model, processor = load_clip()
    ref_data = load_reference_embeddings(model, processor)
    
    # Extract glasses properties from uploaded images
    properties = extract_glasses_properties(image_paths)
    print(f"Extracted properties: {properties}", file=sys.stderr)
    
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
    
    result = {
        'best_model': best_glb, 
        'confidence': confidence, 
        'source_image': best_image,
        'matched': True,
        'method': 'clip_with_bg_removal'
    }
    result.update(properties)
    return result

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
