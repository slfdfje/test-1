# 🎯 3D Alignment Tool - Complete Guide

## What This Does

The **3D Alignment Tool** lets admins preview glasses on a 3D human head and adjust positioning **before** customers see them. This ensures perfect alignment for everyone.

## 🚀 Why This Is Powerful

### Without Alignment Tool:
- ❌ Glasses too big/small
- ❌ Wrong position on face
- ❌ Trial and error with real users
- ❌ Poor customer experience

### With Alignment Tool:
- ✅ Perfect positioning every time
- ✅ Preview before going live
- ✅ Consistent quality
- ✅ Professional results

## 📦 What You Got

### 1. Alignment Interface
**File**: `frontend/admin-alignment.html`
**URL**: http://localhost:5173/admin-alignment.html

**Features**:
- 3D head model preview
- Real-time glasses positioning
- Position/Scale/Rotation controls
- Keyboard shortcuts
- Save alignment
- Test on real face

### 2. Integration with AR Try-On
- Saved alignments automatically applied
- Consistent across all users
- No manual adjustment needed

### 3. Backend Support
- Alignment storage in database
- Per-model configuration
- API endpoints

## 🎯 Quick Start

### Step 1: Get a 3D Head Model

You need a 3D head model in GLB format. Here are free options:

**Option A: Ready Player Me** (Recommended)
1. Go to: https://readyplayer.me/
2. Create a basic avatar
3. Download as GLB
4. Save to: `frontend/public/models/head.glb`

**Option B: Sketchfab**
1. Go to: https://sketchfab.com/
2. Search: "human head neutral glb"
3. Filter: Downloadable
4. Download GLB format
5. Save to: `frontend/public/models/head.glb`

**Option C: Use Placeholder**
- The tool creates a simple placeholder head automatically
- Works for testing, but not as realistic

### Step 2: Start Servers

```bash
# Terminal 1 - Backend
cd backend
node admin-workflow-server.mjs

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### Step 3: Open Alignment Tool

Go to: http://localhost:5173/admin-alignment.html

### Step 4: Align Glasses

1. Select glasses model from dropdown
2. Use controls to adjust:
   - **Position**: Arrow buttons or keyboard
   - **Scale**: Slider or Q/A keys
   - **Rotation**: Sliders or Z/X keys
3. Click "Save Alignment"
4. Click "Test on Real Face" to verify

## 🎮 Controls

### Mouse Controls
- **Left Click + Drag**: Rotate view
- **Right Click + Drag**: Pan view
- **Scroll Wheel**: Zoom in/out

### Keyboard Shortcuts
- **Arrow Keys**: Move position (X/Y)
- **W/S**: Move forward/back (Z)
- **Q/A**: Scale up/down
- **Z/X**: Rotate left/right
- **R**: Reset alignment
- **Shift + Key**: Fine adjustment (smaller steps)

### UI Controls
- **Position Buttons**: Move in all directions
- **Scale Slider**: Adjust size (0.5x to 2x)
- **Rotation Sliders**: Tilt, turn, nod
- **Presets**: Quick common adjustments

## 📐 Alignment Parameters

### Position
- **X**: Left (-) / Right (+)
- **Y**: Down (-) / Up (+)
- **Z**: Back (-) / Forward (+)

**Typical Values**:
- X: -0.05 to 0.05
- Y: -0.05 to 0.05
- Z: 0.05 to 0.15

### Scale
- **Uniform scaling** (all axes together)
- **Range**: 0.5 to 2.0
- **Typical**: 0.8 to 1.2

### Rotation
- **X (Nod)**: Up/down tilt
- **Y (Turn)**: Left/right turn
- **Z (Tilt)**: Roll/tilt

**Typical Values**:
- X: -10° to 10°
- Y: -10° to 10°
- Z: -5° to 5°

## 🎯 Best Practices

### 1. Start with Default
- Load model
- Check default position
- Make small adjustments

### 2. Use Reference Points
- Align with eyes
- Check nose bridge
- Verify temple position

### 3. Test Multiple Angles
- Rotate view 360°
- Check from front, side, top
- Ensure no clipping

### 4. Save Frequently
- Save after each major change
- Test on real face
- Iterate if needed

### 5. Use Presets
- Start with "Default"
- Try "Higher" or "Lower"
- Fine-tune from there

## 🔧 Technical Details

### How Alignment Works

1. **Admin Tool**:
   - Adjust position/scale/rotation
   - Save to database
   - Stored per model

2. **AR Try-On**:
   - Load model
   - Fetch saved alignment
   - Apply as base offset
   - Add face tracking on top

### Alignment Data Structure

```javascript
{
  position: { x: 0, y: 0, z: 0.1 },
  scale: { x: 1, y: 1, z: 1 },
  rotation: { x: 0, y: 0, z: 0 }  // in degrees
}
```

### API Endpoints

```bash
# Save alignment
POST /admin/save-alignment/:modelId
Body: { alignment: {...} }

# Get alignment
GET /admin/glasses/:modelId
Response: { alignment: {...}, ... }
```

## 🎨 Customization

### Change Head Model

Replace `frontend/public/models/head.glb` with your own model.

**Requirements**:
- Format: GLB
- Neutral expression
- Forward-facing
- Reasonable scale

### Adjust Default Values

Edit `admin-alignment.js`:

```javascript
// Default alignment
let currentAlignment = {
    position: { x: 0, y: 0.05, z: 0.1 },  // Adjust Y
    scale: { x: 1.2, y: 1.2, z: 1.2 },    // Adjust scale
    rotation: { x: 0, y: 0, z: 0 }
};
```

### Modify Control Sensitivity

```javascript
// In adjustPosition function
const step = e.shiftKey ? 0.001 : 0.01;  // Change 0.01

// In adjustScaleBtn function
adjustScaleBtn(0.05);  // Change 0.05
```

## 🚨 Troubleshooting

### Head Model Not Loading

**Problem**: "Head model not found" message

**Solutions**:
1. Check file exists: `frontend/public/models/head.glb`
2. Check file format (must be GLB, not GLTF)
3. Check file size (< 50MB recommended)
4. Use placeholder mode for testing

### Glasses Not Visible

**Problem**: Glasses loaded but not visible

**Solutions**:
1. Adjust Z position (move forward)
2. Increase scale
3. Check model is not inside head
4. Rotate view to find model

### Alignment Not Saving

**Problem**: Save button doesn't work

**Solutions**:
1. Check backend is running
2. Check console for errors
3. Verify model ID is selected
4. Check network tab for API call

### Alignment Not Applied in AR

**Problem**: Saved alignment not used in try-on

**Solutions**:
1. Check model ID matches
2. Verify alignment saved in database
3. Check AR try-on loads alignment
4. Clear browser cache

## 📊 Workflow

### Complete Admin Workflow

```
1. Upload Glasses Image
   ↓
2. Generate 3D Model
   ↓
3. Open Alignment Tool
   ↓
4. Adjust Position/Scale/Rotation
   ↓
5. Save Alignment
   ↓
6. Test on Real Face
   ↓
7. Approve Model
   ↓
8. Goes Live for Customers
```

### Customer Experience

```
1. Open AR Try-On
   ↓
2. Select Glasses
   ↓
3. Model Loads with Saved Alignment
   ↓
4. Perfect Fit Automatically
   ↓
5. Capture Photo
```

## 🎯 Advanced Features

### Batch Alignment

For similar models, copy alignment:

```javascript
// Get alignment from model A
const alignmentA = await fetch(`/admin/glasses/${modelA}`);

// Apply to model B
await fetch(`/admin/save-alignment/${modelB}`, {
  method: 'POST',
  body: JSON.stringify({ alignment: alignmentA.alignment })
});
```

### Alignment Templates

Create presets for common styles:

```javascript
const templates = {
  aviator: {
    position: { x: 0, y: 0, z: 0.12 },
    scale: { x: 1.1, y: 1.1, z: 1.1 },
    rotation: { x: 0, y: 0, z: 0 }
  },
  wayfarer: {
    position: { x: 0, y: -0.02, z: 0.1 },
    scale: { x: 1, y: 1, z: 1 },
    rotation: { x: 0, y: 0, z: 0 }
  }
};
```

### Analytics

Track alignment changes:

```javascript
function saveAlignment() {
  // ... save code ...
  
  // Track analytics
  analytics.track('alignment_saved', {
    modelId: currentGlassesId,
    adjustments: calculateAdjustments(),
    timestamp: Date.now()
  });
}
```

## 🎓 Tips & Tricks

### 1. Use Grid for Reference
- Grid shows scale
- Each square = 1 unit
- Use for consistent sizing

### 2. Orbit Around Model
- View from all angles
- Check for clipping
- Verify symmetry

### 3. Fine Adjustments
- Hold Shift for smaller steps
- Use sliders for precision
- Make incremental changes

### 4. Test with Different Faces
- Test on multiple people
- Check various face shapes
- Adjust for average fit

### 5. Document Settings
- Keep notes on good values
- Create style guide
- Share with team

## 📝 Checklist

Before approving a model:

- [ ] Glasses centered on face
- [ ] Proper distance from eyes
- [ ] No clipping through head
- [ ] Temples align with ears
- [ ] Bridge sits on nose
- [ ] Scale looks natural
- [ ] Tested from all angles
- [ ] Alignment saved
- [ ] Tested on real face
- [ ] Approved by QA

## 🚀 Next Steps

### This Week:
1. ✅ Get 3D head model
2. ✅ Align all existing glasses
3. ✅ Test on real faces
4. ✅ Document best practices

### Next Week:
1. Create alignment templates
2. Train team on tool
3. Establish QA process
4. Optimize workflow

### Next Month:
1. Add face shape detection
2. Auto-suggest alignments
3. Batch processing
4. Advanced analytics

## 🎉 Benefits

### For Admin:
- ✅ Visual preview
- ✅ Easy adjustments
- ✅ Quality control
- ✅ Faster workflow

### For Customers:
- ✅ Perfect fit
- ✅ Consistent quality
- ✅ Better experience
- ✅ Higher conversion

### For Business:
- ✅ Professional results
- ✅ Fewer returns
- ✅ Better reviews
- ✅ Competitive advantage

**You now have professional-grade alignment tools!** 🎯
