"""
CLIP-based image matching for 3D glasses models
Matches uploaded images to reference images using CLIP embeddings
With robust fallback handling
"""

import sys
import os
import json
import argparse
from pathlib import Path

REF_DIR = "reference_images"
EMB_PATH = "reference_embeddings.pt"


def list_reference_images():
    """List all reference images in the reference folder"""
    if not os.path.isdir(REF_DIR):
        return []
    exts = {".jpg", ".jpeg", ".png", ".webp"}
    files = [f for f in os.listdir(REF_DIR) if os.path.splitext(f.lower())[1] in exts]
    return files


def simple_match(image_paths):
    """Simple fallback matching based on available reference images or local models"""
    ref_images = list_reference_images()

    # First check for reference images
    if ref_images:
        best_image = ref_images[0]
        base, _ = os.path.splitext(best_image)
        best_glb = base + ".glb"

        # Check if GLB exists in local_models
        local_models_dir = "local_models"
        if os.path.exists(local_models_dir):
            glb_path = os.path.join(local_models_dir, best_glb)
            if os.path.exists(glb_path):
                return {
                    "best_model": best_glb,
                    "confidence": 0.5,
                    "source_image": best_image,
                    "matched": True,
                    "match_type": "fallback",
                    "note": "Using fallback matching - matched reference to local model",
                }

        # Check if there's a matching GLB in reference_images (for backward compat)
        ref_glb_path = os.path.join("reference_images", best_glb)
        if os.path.exists(ref_glb_path):
            return {
                "best_model": best_glb,
                "confidence": 0.5,
                "source_image": best_image,
                "matched": True,
                "match_type": "fallback",
                "note": "Using fallback matching",
            }

    # If no reference images, check local_models directly
    local_models_dir = "local_models"
    if os.path.exists(local_models_dir):
        local_models = [
            f for f in os.listdir(local_models_dir) if f.lower().endswith(".glb")
        ]
        if local_models:
            return {
                "best_model": local_models[0],
                "confidence": 0.3,
                "source_image": None,
                "matched": True,
                "match_type": "fallback",
                "note": "No reference images - returning first available model",
            }

    return {
        "error": "No matching models found",
        "matched": False,
        "reason": "Add GLB files to local_models folder or reference images to reference_images folder",
    }

    # Return first available reference as fallback
    best_image = ref_images[0]
    base, _ = os.path.splitext(best_image)
    best_glb = base + ".glb"

    # Check if GLB exists
    glb_path = (
        os.path.join("local_models", best_glb)
        if os.path.exists("local_models")
        else None
    )
    if not glb_path or not os.path.exists(glb_path):
        return {
            "error": "No matching 3D model found",
            "matched": False,
            "reason": f"Reference image {best_image} exists but no matching GLB found",
        }

    return {
        "best_model": best_glb,
        "confidence": 0.5,
        "source_image": best_image,
        "matched": True,
        "match_type": "fallback",
        "note": "Using fallback matching - no AI model available",
    }


def clip_match(image_paths):
    """Match using CLIP embeddings"""
    try:
        print(
            f"DEBUG: Starting CLIP match with {len(image_paths)} images",
            file=sys.stderr,
        )

        import torch
        from PIL import Image
        from transformers import CLIPProcessor, CLIPModel

        print(f"DEBUG: Imports successful", file=sys.stderr)

        DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"DEBUG: Using device: {DEVICE}", file=sys.stderr)

        MODEL_NAME = "openai/clip-vit-base-patch32"

        # Load model - this might fail
        print(f"DEBUG: Loading CLIP model...", file=sys.stderr)
        model = CLIPModel.from_pretrained(MODEL_NAME).to(DEVICE)
        processor = CLIPProcessor.from_pretrained(MODEL_NAME)
        print(f"DEBUG: CLIP model loaded successfully", file=sys.stderr)

        # Load or compute reference embeddings
        ref_images = list_reference_images()
        if not ref_images:
            return {"error": "No reference images", "matched": False}

        print(f"DEBUG: Found {len(ref_images)} reference images", file=sys.stderr)

        # Compute reference embeddings
        if os.path.exists(EMB_PATH):
            print(f"DEBUG: Loading cached embeddings", file=sys.stderr)
            ref_data = torch.load(EMB_PATH, map_location="cpu", weights_only=False)
        else:
            print(f"DEBUG: Computing new embeddings", file=sys.stderr)
            paths = [os.path.join(REF_DIR, f) for f in ref_images]
            images = [Image.open(p).convert("RGB") for p in paths]
            with torch.no_grad():
                inputs = processor(images=images, return_tensors="pt", padding=True).to(
                    DEVICE
                )
                feats = model.get_image_features(**inputs)
                feats = feats / feats.norm(p=2, dim=-1, keepdim=True)
            ref_data = {"files": ref_images, "features": feats.cpu()}
            torch.save(ref_data, EMB_PATH)

        # Compute embeddings for uploaded images
        print(f"DEBUG: Processing uploaded images", file=sys.stderr)
        uploaded_images = []
        for p in image_paths:
            try:
                img = Image.open(p).convert("RGB")
                uploaded_images.append(img)
            except Exception as e:
                print(f"DEBUG: Error loading {p}: {e}", file=sys.stderr)

        if not uploaded_images:
            return {"error": "Could not read any uploaded images", "matched": False}

        with torch.no_grad():
            inputs = processor(
                images=uploaded_images, return_tensors="pt", padding=True
            ).to(DEVICE)
            feats = model.get_image_features(**inputs)
            feats = feats / feats.norm(p=2, dim=-1, keepdim=True)

        # Average embeddings if multiple images
        mean_feat = feats.mean(dim=0, keepdim=True)
        mean_feat = mean_feat / mean_feat.norm(p=2, dim=-1, keepdim=True)

        # Find best match
        ref_feats = ref_data["features"]
        sims = (mean_feat @ ref_feats.T).squeeze(0)
        best_idx = int(torch.argmax(sims).item())
        best_score = float(sims[best_idx].item())
        best_image = ref_data["files"][best_idx]

        base, _ = os.path.splitext(best_image)
        best_glb = base + ".glb"
        confidence = (best_score + 1.0) / 2.0

        print(
            f"DEBUG: Best match: {best_glb} with confidence {confidence}",
            file=sys.stderr,
        )

        return {
            "best_model": best_glb,
            "confidence": round(confidence, 3),
            "source_image": best_image,
            "matched": True,
            "match_type": "clip",
        }

    except Exception as e:
        error_msg = str(e)
        print(f"DEBUG: CLIP error: {error_msg}", file=sys.stderr)

        # If it's a model loading error, use fallback
        if (
            "model does not support" in error_msg.lower()
            or "could not load" in error_msg.lower()
        ):
            return simple_match(image_paths)

        return {"error": error_msg, "matched": False}


def match_images(image_paths):
    """Try CLIP matching, fall back to simple matching on error"""
    print(
        f"DEBUG: match_images called with {len(image_paths) if image_paths else 0} paths",
        file=sys.stderr,
    )

    if not image_paths:
        return {"error": "No images provided", "matched": False}

    # Check if reference images exist
    ref_images = list_reference_images()
    if not ref_images:
        return {
            "error": "No reference images available",
            "matched": False,
            "hint": "Upload reference images to reference_images folder first",
        }

    # Try CLIP matching
    try:
        result = clip_match(image_paths)

        # If CLIP failed, use fallback
        if not result.get("matched"):
            print(f"DEBUG: CLIP failed, using fallback", file=sys.stderr)
            return simple_match(image_paths)

        return result

    except Exception as e:
        print(f"DEBUG: Exception in match_images: {e}", file=sys.stderr)
        return simple_match(image_paths)


def build_embeddings():
    """Build reference embeddings"""
    try:
        ref_images = list_reference_images()
        if not ref_images:
            print(json.dumps({"ok": False, "error": "No reference images found"}))
            return

        import torch
        from PIL import Image
        from transformers import CLIPProcessor, CLIPModel

        DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
        MODEL_NAME = "openai/clip-vit-base-patch32"

        print(f"Loading CLIP model for embedding build (device: {DEVICE})...")
        model = CLIPModel.from_pretrained(MODEL_NAME).to(DEVICE)
        processor = CLIPProcessor.from_pretrained(MODEL_NAME)

        paths = [os.path.join(REF_DIR, f) for f in ref_images]
        images = [Image.open(p).convert("RGB") for p in paths]

        with torch.no_grad():
            inputs = processor(images=images, return_tensors="pt", padding=True).to(
                DEVICE
            )
            feats = model.get_image_features(**inputs)
            feats = feats / feats.norm(p=2, dim=-1, keepdim=True)

        ref_data = {"files": ref_images, "features": feats.cpu()}
        torch.save(ref_data, EMB_PATH)

        print(f"Built embeddings for {len(ref_images)} images")
        print(json.dumps({"ok": True, "computed": len(ref_images)}))

    except Exception as e:
        print(f"Error building embeddings: {e}", file=sys.stderr)
        # Don't fail - just report the error
        print(json.dumps({"ok": False, "error": str(e)}))


def main():
    parser = argparse.ArgumentParser(
        description="Match uploaded images to 3D glasses models"
    )
    parser.add_argument(
        "--build", action="store_true", help="Build reference embeddings"
    )
    parser.add_argument("images", nargs="*", help="Image paths to match")
    args = parser.parse_args()

    if args.build:
        build_embeddings()
        return

    if not args.images:
        print(json.dumps({"error": "No images provided", "matched": False}))
        return

    print(f"Processing {len(args.images)} images for matching...")
    result = match_images(args.images)
    print(json.dumps(result))


if __name__ == "__main__":
    main()
