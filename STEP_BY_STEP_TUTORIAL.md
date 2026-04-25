# 📚 Step-by-Step Tutorial - From Zero to Working System

## 🎯 Goal

By the end of this tutorial, you'll have a fully working AR glasses try-on system with perfect alignment.

## ⏱️ Time Required

- **Setup**: 15 minutes
- **First Model**: 10 minutes
- **Testing**: 5 minutes
- **Total**: 30 minutes

## 📋 Prerequisites

- ✅ Node.js installed
- ✅ Blender installed
- ✅ Code downloaded
- ✅ Basic terminal knowledge

---

## PART 1: Initial Setup (15 minutes)

### Step 1.1: Install Backend Dependencies

```bash
# Open terminal
cd backend

# Install packages
npm install

# You should see:
# ✓ added 126 packages
```

**What this does**: Installs Express, Multer, CORS, UUID for the server.

### Step 1.2: Install Frontend Dependencies

```bash
# New terminal
cd frontend

# Install packages
npm install

# You should see:
# ✓ added packages
```

**What this does**: Installs React, Vite, Three.js for the frontend.

### Step 1.3: Get 3D Head Model

**Option A: Quick (Use Placeholder)**
- Skip this step
- System will create a simple head automatically

**Option B: Realistic (Recommended)**

1. Go to: https://readyplayer.me/
2. Click "Create Avatar"
3. Skip customization (use default)
4. Click "Download"
5. Select "GLB" format
6. Save as: `frontend/public/models/head.glb`

```bash
# Create directory
mkdir -p frontend/public/models

# Move downloaded file
# (drag and drop or copy to frontend/public/models/head.glb)
```

### Step 1.4: Start Backend Server

```bash
# In backend terminal
node admin-workflow-server.mjs

# You should see:
# 🎯 Admin Workflow System running on port 5002
# 📊 Dashboard: http://localhost:5002/admin/stats
# 📦 Total models: 0
# ✅ Approved: 0
# ⏳ Pending: 0
```

**What this does**: Starts the API server that handles all requests.

**Keep this terminal open!**

### Step 1.5: Start Frontend Server

```bash
# In frontend terminal
npm run dev

# You should see:
# VITE v5.4.0  ready in 500 ms
# ➜  Local:   http://localhost:5173/
# ➜  Network: use --host to expose
```

**What this does**: Starts the development server for all web pages.

**Keep this terminal open!**

---

## PART 2: Upload Your First Glasses (10 minutes)

### Step 2.1: Open Admin Dashboard

1. Open browser
2. Go to: `http://localhost:5173/admin-workflow.html`
3. You should see:
   - Header: "Admin Workflow Dashboard"
   - Stats: 0 Total Glasses, 0 Pending, etc.
   - Upload form

### Step 2.2: Prepare Glasses Image

**You need**: A photo of glasses (any glasses)

**Options**:
- Take photo of your own glasses
- Download from Google Images
- Use stock photo

**Requirements**:
- Format: JPG or PNG
- Clear image
- Glasses visible

### Step 2.3: Fill Upload Form

1. **Image**: Click "Choose File" → Select your glasses photo
2. **Brand**: Type "Ray-Ban" (or any brand)
3. **Model**: Type "Aviator" (or any model name)
4. **Price**: Type "150"
5. **Category**: Select "Sunglasses"
6. Click **"Upload"** button

**What happens**:
```
1. Image uploads to server
2. Server generates unique ID: "abc-123-def-456"
3. Image saved to: backend/thumbnails/abc-123-def-456.jpg
4. Database entry created
5. Success message appears
6. Card appears in "Pending" section
```

**You should see**:
- Green success message: "✓ Glasses uploaded successfully!"
- New card in the list with your glasses
- Status badge: "PENDING"

### Step 2.4: Generate 3D Model

1. Find your glasses card (should be visible)
2. Click **"Generate Model"** button
3. Modal opens with measurements
4. Enter values:
   - **Frame Width**: 140 (typical)
   - **Bridge Width**: 20 (typical)
   - **Temple Length**: 145 (typical)
5. Click **"Generate"** button

**What happens**:
```
1. Request sent to backend
2. Backend spawns Blender process
3. Blender runs Python script
4. Creates 3D geometry:
   - Left lens (circle)
   - Right lens (circle)
   - Bridge (bar connecting them)
   - Left temple (arm)
   - Right temple (arm)
5. Exports to: backend/output/abc-123-def-456.glb
6. Database updated
7. Status changes to "GENERATED"
```

**Wait**: 5-10 seconds

**You should see**:
- Alert: "Model generated successfully!"
- Status badge changes to: "GENERATED"
- New buttons appear: "Approve" and "Reject"

**Check backend terminal**:
```
[Generate] Creating model for Ray-Ban Aviator
[Blender] Generating parametric glasses...
[Blender] GLB exported: output/abc-123-def-456.glb
[Generate] Model created: /output/abc-123-def-456.glb
```

---

## PART 3: Align Glasses (10 minutes)

### Step 3.1: Open Alignment Tool

1. Open new browser tab
2. Go to: `http://localhost:5173/admin-alignment.html`
3. You should see:
   - 3D view (black background)
   - 3D head model (or placeholder)
   - Controls panel on right
   - Keyboard shortcuts info at bottom

### Step 3.2: Select Your Glasses

1. Look at **"Select Glasses Model"** dropdown (top right panel)
2. Click dropdown
3. Select: "Ray-Ban Aviator" (your uploaded model)
4. Wait 2 seconds

**What happens**:
```
1. Loads GLB file from backend
2. Centers the model
3. Checks for saved alignment (none yet)
4. Applies default position:
   - Position: (0, 0, 0.1)
   - Scale: 1.0
   - Rotation: (0, 0, 0)
5. Adds to scene
6. Renders
```

**You should see**:
- Glasses appear on the 3D head
- May not be perfectly aligned yet
- That's okay! We'll fix it now.

### Step 3.3: Adjust Position

**Goal**: Center glasses on face

**Using Mouse**:
1. Click and drag to rotate view
2. Look at glasses from different angles
3. Check if centered

**Using Keyboard**:
1. Press **Arrow Up** → Glasses move up
2. Press **Arrow Down** → Glasses move down
3. Press **Arrow Left** → Glasses move left
4. Press **Arrow Right** → Glasses move right
5. Press **W** → Glasses move forward
6. Press **S** → Glasses move backward

**Using Buttons**:
1. Click **↑** button → Glasses move up
2. Click **↓** button → Glasses move down
3. Click **→** button → Glasses move right
4. Click **←** button → Glasses move left
5. Click **Forward** → Glasses move forward
6. Click **Back** → Glasses move backward

**Target**:
- Glasses centered on face
- Bridge on nose
- Lenses in front of eyes

### Step 3.4: Adjust Scale

**Goal**: Make glasses right size

**Using Slider**:
1. Find "Scale" section
2. Drag slider left → Smaller
3. Drag slider right → Bigger
4. Watch value change (0.5 to 2.0)

**Using Keyboard**:
1. Press **Q** → Bigger
2. Press **A** → Smaller

**Using Buttons**:
1. Click **"Bigger"** → Scale up
2. Click **"Smaller"** → Scale down
3. Click **"Reset"** → Back to 1.0

**Target**:
- Glasses look natural size
- Not too big, not too small
- Typical value: 0.8 to 1.2

### Step 3.5: Adjust Rotation

**Goal**: Align glasses angle

**Using Sliders**:
1. **Tilt (Z)**: Drag slider
   - Left: Tilt left
   - Right: Tilt right
   - Typical: -5° to 5°

2. **Turn (Y)**: Drag slider
   - Left: Turn left
   - Right: Turn right
   - Typical: -10° to 10°

3. **Nod (X)**: Drag slider
   - Left: Tilt down
   - Right: Tilt up
   - Typical: -10° to 10°

**Using Keyboard**:
1. Press **Z** → Rotate left
2. Press **X** → Rotate right

**Target**:
- Glasses parallel to face
- Not tilted
- Looks natural

### Step 3.6: Fine-Tune

**Tips**:
1. Rotate view 360° (click and drag)
2. Check from front, side, top
3. Make small adjustments
4. Use **Shift + Key** for tiny steps

**Common Adjustments**:
- Too high? → Press Arrow Down
- Too low? → Press Arrow Up
- Too big? → Press A
- Too small? → Press Q
- Tilted? → Adjust Z rotation slider

### Step 3.7: Save Alignment

1. Click **"💾 Save Alignment"** button (bottom of panel)
2. Wait 1 second

**What happens**:
```
1. Collects current values:
   {
     position: { x: 0, y: 0.05, z: 0.1 },
     scale: { x: 1.2, y: 1.2, z: 1.2 },
     rotation: { x: 0, y: 0, z: 5 }
   }
2. Sends POST to backend
3. Backend updates database
4. Saves to glasses-database.json
5. Returns success
```

**You should see**:
- Green message: "✓ Alignment saved successfully!"
- Message disappears after 3 seconds

**Check backend terminal**:
```
[Alignment] Saved for Ray-Ban Aviator
```

---

## PART 4: Test & Approve (5 minutes)

### Step 4.1: Test on Real Face

1. In alignment tool, click **"👤 Test on Real Face"** button
2. New tab opens: AR Try-On
3. Allow camera access (click "Allow")
4. Your face appears on screen
5. Glasses should appear on your face!

**What happens**:
```
1. Opens ar-tryon.html
2. Loads your glasses model
3. Fetches saved alignment
4. Starts camera
5. MediaPipe detects your face
6. Applies alignment + face tracking
7. Renders glasses on your face
```

**Check**:
- ✅ Glasses centered?
- ✅ Right size?
- ✅ Follows face movement?
- ✅ Looks natural?

**If not perfect**:
1. Go back to alignment tool tab
2. Make adjustments
3. Click "Save Alignment"
4. Refresh AR try-on tab
5. Test again

### Step 4.2: Approve Model

1. Go back to: `http://localhost:5173/admin-workflow.html`
2. Find your glasses card
3. Status should be: "GENERATED"
4. Click **"Approve"** button
5. Confirm: "Approve this glasses model?" → Click OK

**What happens**:
```
1. Sends POST to backend
2. Backend updates status to "approved"
3. Saves database
4. Returns success
```

**You should see**:
- Alert: "Glasses approved!"
- Status badge changes to: "APPROVED"
- Card moves to "Approved" tab

**Check backend terminal**:
```
[Approve] Ray-Ban Aviator approved by admin
```

### Step 4.3: Test Customer Experience

1. Open new tab
2. Go to: `http://localhost:5173/ar-tryon.html`
3. Allow camera
4. Click **"🕶️ Change Style"** button
5. You should see: "Ray-Ban Aviator" in list
6. Click it
7. Glasses appear on your face!

**Try**:
- Move head left/right → Glasses follow
- Tilt head → Glasses tilt
- Move closer/farther → Glasses scale
- Click **"💾 Capture"** → Photo saves

**Success!** Your first model is live! 🎉

---

## PART 5: Add More Models (Optional)

### Repeat for Each Model:

1. **Upload** (2 min):
   - Go to admin-workflow.html
   - Upload new image
   - Fill form
   - Click Upload

2. **Generate** (1 min):
   - Click "Generate Model"
   - Enter measurements
   - Wait 5 seconds

3. **Align** (3 min):
   - Go to admin-alignment.html
   - Select model
   - Adjust position/scale/rotation
   - Save alignment

4. **Approve** (1 min):
   - Go to admin-workflow.html
   - Click "Approve"

**Total per model**: ~7 minutes

**Tip**: Do 5-10 models to build a good catalog

---

## 🎯 Troubleshooting

### Problem: Backend won't start

**Error**: `Cannot find module 'express'`

**Solution**:
```bash
cd backend
npm install
node admin-workflow-server.mjs
```

### Problem: Frontend won't start

**Error**: `Command not found: vite`

**Solution**:
```bash
cd frontend
npm install
npm run dev
```

### Problem: Blender not found

**Error**: `blender: command not found`

**Solution**:
1. Install Blender: https://www.blender.org/download/
2. Add to PATH
3. Test: `blender --version`

### Problem: Head model not loading

**Error**: "Head model not found"

**Solution**:
- Option 1: Download from Ready Player Me
- Option 2: Use placeholder (automatic)
- Option 3: Check file path: `frontend/public/models/head.glb`

### Problem: Glasses not visible in alignment tool

**Solution**:
1. Check dropdown selected
2. Press W key (move forward)
3. Increase scale (press Q)
4. Rotate view (click and drag)

### Problem: Camera not working in AR try-on

**Solution**:
1. Check browser permissions
2. Use HTTPS (or localhost)
3. Try different browser
4. Check camera not used by other app

### Problem: Alignment not saving

**Solution**:
1. Check backend running
2. Check browser console (F12)
3. Check network tab for errors
4. Verify model selected

---

## 📊 Quick Reference

### URLs:
```
Admin Dashboard:  http://localhost:5173/admin-workflow.html
Alignment Tool:   http://localhost:5173/admin-alignment.html
AR Try-On:        http://localhost:5173/ar-tryon.html
Backend API:      http://localhost:5002/
```

### Commands:
```bash
# Start backend
cd backend && node admin-workflow-server.mjs

# Start frontend
cd frontend && npm run dev

# Check Blender
blender --version
```

### Keyboard Shortcuts (Alignment Tool):
```
Arrow Keys:  Move position (X/Y)
W/S:         Move forward/back (Z)
Q/A:         Scale up/down
Z/X:         Rotate left/right
R:           Reset all
Shift + Key: Fine adjustment
```

### Typical Values:
```
Position:
  X: -0.05 to 0.05
  Y: -0.05 to 0.05
  Z: 0.05 to 0.15

Scale:
  0.8 to 1.2

Rotation:
  X: -10° to 10°
  Y: -10° to 10°
  Z: -5° to 5°
```

---

## 🎉 Congratulations!

You now have:
- ✅ Working backend server
- ✅ Working frontend
- ✅ First glasses model uploaded
- ✅ 3D model generated
- ✅ Perfect alignment saved
- ✅ Model approved and live
- ✅ AR try-on working

**Next Steps**:
1. Add 10-20 more models
2. Test with different people
3. Refine alignments
4. Launch to customers!

**You're ready to build your business!** 🚀
