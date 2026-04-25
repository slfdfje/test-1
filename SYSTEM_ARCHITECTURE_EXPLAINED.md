# 🎓 Complete System Architecture - How Everything Works

## 📊 System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    YOUR COMPLETE SYSTEM                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   CUSTOMER   │  │    ADMIN     │  │   BACKEND    │      │
│  │   FACING     │  │    TOOLS     │  │   SERVERS    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                 │                  │               │
│         │                 │                  │               │
│    AR Try-On        Alignment Tool      API + Database      │
│    (Port 5173)      (Port 5173)        (Port 5002)         │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## 🔄 Complete Data Flow

### Flow 1: Admin Uploads New Glasses

```
1. ADMIN OPENS: admin-workflow.html
   ↓
2. FILLS FORM:
   - Upload image (glasses photo)
   - Brand: "Ray-Ban"
   - Model: "Aviator"
   - Price: $150
   - Category: "sunglasses"
   ↓
3. CLICKS "Upload"
   ↓
4. FRONTEND (admin-workflow.html):
   - Creates FormData
   - Sends POST to /admin/upload-glasses
   ↓
5. BACKEND (admin-workflow-server.mjs):
   - Receives image + data
   - Generates unique ID (UUID)
   - Saves thumbnail
   - Creates database entry:
     {
       id: "abc-123",
       brand: "Ray-Ban",
       model: "Aviator",
       status: "pending",
       thumbnailUrl: "/thumbnails/abc-123.jpg"
     }
   - Saves to glasses-database.json
   ↓
6. RESPONSE: { success: true, id: "abc-123" }
   ↓
7. FRONTEND: Shows success message, refreshes list
```

### Flow 2: Generate 3D Model

```
1. ADMIN CLICKS: "Generate Model" button
   ↓
2. MODAL OPENS: Enter measurements
   - Width: 140mm
   - Bridge: 20mm
   - Temple: 145mm
   ↓
3. CLICKS "Generate"
   ↓
4. FRONTEND:
   - Sends POST to /admin/generate-model/abc-123
   - Body: { width: 140, bridge: 20, temple: 145 }
   ↓
5. BACKEND:
   - Receives request
   - Spawns Blender process:
     blender --background --python glasses_parametric.py -- 140 20 145 abc-123
   ↓
6. BLENDER (glasses_parametric.py):
   - Creates 3D geometry:
     * Left lens (torus)
     * Right lens (torus)
     * Bridge (cube)
     * Left temple (cube)
     * Right temple (cube)
   - Scales based on measurements
   - Positions components
   - Exports to: output/abc-123.glb
   ↓
7. BACKEND:
   - Updates database:
     {
       ...previous data,
       status: "generated",
       modelUrl: "/output/abc-123.glb",
       measurements: { width: 140, bridge: 20, temple: 145 }
     }
   ↓
8. RESPONSE: { success: true, modelUrl: "/output/abc-123.glb" }
   ↓
9. FRONTEND: Shows success, updates card status
```

### Flow 3: Align Glasses on 3D Head

```
1. ADMIN OPENS: admin-alignment.html
   ↓
2. PAGE LOADS:
   - Initializes Three.js scene
   - Creates camera, renderer, lights
   - Loads 3D head model (head.glb)
   - Fetches glasses list from /models
   ↓
3. ADMIN SELECTS: Glasses from dropdown
   ↓
4. FRONTEND (admin-alignment.js):
   - Loads glasses GLB file
   - Checks for saved alignment:
     GET /admin/glasses/abc-123
   - If exists, applies saved alignment
   - If not, uses defaults:
     {
       position: { x: 0, y: 0, z: 0.1 },
       scale: { x: 1, y: 1, z: 1 },
       rotation: { x: 0, y: 0, z: 0 }
     }
   ↓
5. ADMIN ADJUSTS:
   - Presses Arrow Up → position.y += 0.01
   - Presses Q → scale *= 1.05
   - Moves slider → rotation.z = value
   ↓
6. REAL-TIME UPDATE:
   - glassesModel.position.set(x, y, z)
   - glassesModel.scale.set(sx, sy, sz)
   - glassesModel.rotation.set(rx, ry, rz)
   - Renders frame (60 FPS)
   ↓
7. ADMIN CLICKS: "Save Alignment"
   ↓
8. FRONTEND:
   - Sends POST to /admin/save-alignment/abc-123
   - Body: { alignment: { position, scale, rotation } }
   ↓
9. BACKEND:
   - Updates database:
     {
       ...previous data,
       alignment: { position, scale, rotation },
       alignmentUpdated: "2026-04-15T..."
     }
   - Saves to glasses-database.json
   ↓
10. RESPONSE: { success: true }
    ↓
11. FRONTEND: Shows "Alignment saved!" message
```

### Flow 4: Customer Uses AR Try-On

```
1. CUSTOMER OPENS: ar-tryon.html
   ↓
2. PAGE LOADS:
   - Initializes Three.js scene
   - Initializes MediaPipe Face Mesh
   - Requests camera permission
   ↓
3. CAMERA STARTS:
   - Video stream begins
   - MediaPipe starts processing frames
   ↓
4. LOADS GLASSES LIST:
   - Fetches GET /models
   - Gets approved glasses only
   - Populates selector
   ↓
5. CUSTOMER SELECTS: Glasses
   ↓
6. FRONTEND (ar-tryon.js):
   - Loads GLB file
   - Fetches saved alignment:
     GET /admin/glasses/abc-123
   - Stores as baseAlignment
   ↓
7. FACE DETECTION (60 FPS):
   
   Frame 1:
   - Camera captures video frame
   - MediaPipe detects 468 face landmarks
   - Extracts key points:
     * leftEye (landmark 33)
     * rightEye (landmark 263)
     * noseTip (landmark 1)
     * temples (234, 454)
   
   Frame 2:
   - Calculates position:
     centerX = (leftEye.x + rightEye.x) / 2
     centerY = (leftEye.y + rightEye.y) / 2
     x = -(centerX - 0.5) * 10
     y = -(centerY - 0.5) * 10
   
   Frame 3:
   - Calculates scale:
     eyeDistance = distance(leftEye, rightEye)
     scale = eyeDistance * 15 * baseAlignment.scale
   
   Frame 4:
   - Calculates rotation:
     tiltAngle = atan2(dy, dx)  // Head tilt
     turnAngle = eyeWidth / faceWidth  // Head turn
     nodAngle = noseToEyeY * PI * 2  // Head nod
   
   Frame 5:
   - Applies to glasses:
     glassesGroup.position.set(
       x + baseAlignment.position.x,
       y + baseAlignment.position.y,
       z + baseAlignment.position.z
     )
     glassesGroup.scale.set(scale, scale, scale)
     glassesGroup.rotation.set(
       nodAngle + baseAlignment.rotation.x,
       turnAngle + baseAlignment.rotation.y,
       tiltAngle + baseAlignment.rotation.z
     )
   
   Frame 6:
   - Renders scene
   - Displays on canvas
   
   ... repeats 60 times per second
   ↓
8. CUSTOMER CLICKS: "Capture"
   ↓
9. FRONTEND:
   - Creates canvas
   - Draws video frame
   - Draws 3D glasses on top
   - Converts to image
   - Downloads as PNG
```

## 🔧 Code Components Explained

### 1. admin-workflow.html (Admin Dashboard)

**Purpose**: Manage glasses catalog

**Key Functions**:

```javascript
// Upload glasses
async function upload() {
  const formData = new FormData();
  formData.append("image", file);
  formData.append("brand", "Ray-Ban");
  
  const res = await fetch("/upload-glasses", {
    method: "POST",
    body: formData
  });
  
  // Result: Glasses added to database
}

// Generate 3D model
async function confirmGenerate() {
  const res = await fetch(`/generate-model/${id}`, {
    method: "POST",
    body: JSON.stringify({ width, bridge, temple })
  });
  
  // Result: Blender creates GLB file
}

// Approve glasses
async function approve(id) {
  const res = await fetch(`/approve/${id}`, {
    method: "POST"
  });
  
  // Result: Status changes to "approved"
  // Now visible in AR try-on
}
```

**Data Flow**:
```
User Input → FormData → POST Request → Backend → Database → Response → UI Update
```

### 2. admin-alignment.html (Alignment Tool)

**Purpose**: Adjust glasses position on 3D head

**Key Functions**:

```javascript
// Initialize scene
function init() {
  // Create 3D environment
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(...);
  renderer = new THREE.WebGLRenderer(...);
  
  // Load 3D head
  loader.load("/models/head.glb", (gltf) => {
    headModel = gltf.scene;
    scene.add(headModel);
  });
  
  // Load glasses
  loader.load("/output/abc-123.glb", (gltf) => {
    glassesModel = gltf.scene;
    scene.add(glassesModel);
  });
  
  // Start animation loop (60 FPS)
  animate();
}

// Adjust position
function adjustPosition(axis, delta) {
  // User presses Arrow Up
  currentAlignment.position.y += 0.01;
  
  // Update 3D model
  glassesModel.position.y += 0.01;
  
  // Renders automatically in next frame
}

// Save alignment
async function saveAlignment() {
  const res = await fetch(`/save-alignment/${id}`, {
    method: "POST",
    body: JSON.stringify({
      alignment: {
        position: { x: 0, y: 0.05, z: 0.1 },
        scale: { x: 1.2, y: 1.2, z: 1.2 },
        rotation: { x: 0, y: 0, z: 5 }
      }
    })
  });
  
  // Result: Saved to database
  // Will be used in AR try-on
}
```

**Rendering Loop**:
```
Frame 1: Read user input → Update position
Frame 2: Apply to 3D model → Render scene
Frame 3: Display on screen
... repeats 60 times per second
```

### 3. ar-tryon.html (Customer AR Try-On)

**Purpose**: Real-time AR glasses try-on

**Key Functions**:

```javascript
// Initialize camera
async function initCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user' }
  });
  video.srcObject = stream;
  
  // Start face detection
  const camera = new Camera(video, {
    onFrame: async () => {
      await faceMesh.send({ image: video });
    }
  });
  camera.start();
}

// Face tracking (called 60 times per second)
function onFaceResults(results) {
  // 1. Get face landmarks
  const landmarks = results.multiFaceLandmarks[0];
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  
  // 2. Calculate position
  const centerX = (leftEye.x + rightEye.x) / 2;
  const x = -(centerX - 0.5) * 10;
  
  // 3. Apply saved alignment
  const baseOffset = window.baseAlignment?.position || { x: 0, y: 0.3, z: 0 };
  glassesGroup.position.set(
    x + baseOffset.x,
    y + baseOffset.y,
    z + baseOffset.z
  );
  
  // 4. Calculate scale
  const eyeDistance = distance(leftEye, rightEye);
  const baseScale = window.baseAlignment?.scale?.x || 1;
  const scale = eyeDistance * 15 * baseScale;
  glassesGroup.scale.set(scale, scale, scale);
  
  // 5. Calculate rotation
  const tiltAngle = atan2(dy, dx);
  const baseRot = window.baseAlignment?.rotation || { x: 0, y: 0, z: 0 };
  glassesGroup.rotation.z = tiltAngle + (baseRot.z * PI / 180);
  
  // 6. Renders automatically
}

// Load saved alignment
async function applySavedAlignment(modelId) {
  const res = await fetch(`/admin/glasses/${modelId}`);
  const data = await res.json();
  
  if (data.alignment) {
    window.baseAlignment = data.alignment;
    // Now used in onFaceResults
  }
}
```

**Processing Pipeline**:
```
Camera Frame → MediaPipe → 468 Landmarks → Calculate Position/Scale/Rotation → Apply Base Alignment → Update 3D Model → Render → Display
(60 times per second)
```

### 4. admin-workflow-server.mjs (Backend)

**Purpose**: API server and database management

**Key Endpoints**:

```javascript
// Upload glasses
app.post("/admin/upload-glasses", upload.single("image"), (req, res) => {
  // 1. Receive file
  const file = req.file;
  
  // 2. Generate ID
  const id = uuidv4(); // "abc-123-def-456"
  
  // 3. Save thumbnail
  fs.copyFileSync(file.path, `thumbnails/${id}.jpg`);
  
  // 4. Create database entry
  const item = {
    id,
    brand: req.body.brand,
    model: req.body.model,
    status: "pending",
    thumbnailUrl: `/thumbnails/${id}.jpg`
  };
  
  // 5. Add to database
  glassesDatabase.push(item);
  
  // 6. Save to file
  fs.writeFileSync("glasses-database.json", JSON.stringify(glassesDatabase));
  
  // 7. Return response
  res.json({ success: true, id });
});

// Generate 3D model
app.post("/admin/generate-model/:id", (req, res) => {
  // 1. Get measurements
  const { width, bridge, temple } = req.body;
  
  // 2. Spawn Blender
  const blender = spawn('blender', [
    '--background',
    '--python', 'scripts/glasses_parametric.py',
    '--', width, bridge, temple, id
  ]);
  
  // 3. Wait for completion
  blender.on('close', (code) => {
    // 4. Update database
    item.modelUrl = `/output/${id}.glb`;
    item.status = "generated";
    saveDatabase();
    
    // 5. Return response
    res.json({ success: true, modelUrl: item.modelUrl });
  });
});

// Save alignment
app.post("/admin/save-alignment/:id", (req, res) => {
  // 1. Find item
  const item = glassesDatabase.find(g => g.id === id);
  
  // 2. Update alignment
  item.alignment = req.body.alignment;
  
  // 3. Save database
  saveDatabase();
  
  // 4. Return response
  res.json({ success: true });
});

// Get approved models (for AR try-on)
app.get("/models", (req, res) => {
  // 1. Filter approved only
  const approved = glassesDatabase.filter(g => 
    g.status === 'approved' && g.modelUrl
  );
  
  // 2. Format response
  const models = approved.map(g => ({
    id: g.id,
    name: `${g.brand} ${g.model}`,
    url: `http://localhost:5002${g.modelUrl}`,
    thumbnailUrl: `http://localhost:5002${g.thumbnailUrl}`
  }));
  
  // 3. Return list
  res.json(models);
});
```

**Database Structure**:
```javascript
// glasses-database.json
[
  {
    id: "abc-123",
    brand: "Ray-Ban",
    model: "Aviator",
    price: 150,
    category: "sunglasses",
    status: "approved",
    thumbnailUrl: "/thumbnails/abc-123.jpg",
    modelUrl: "/output/abc-123.glb",
    measurements: {
      width: 140,
      bridge: 20,
      temple: 145
    },
    alignment: {
      position: { x: 0, y: 0.05, z: 0.1 },
      scale: { x: 1.2, y: 1.2, z: 1.2 },
      rotation: { x: 0, y: 0, z: 5 }
    },
    uploadedAt: "2026-04-15T10:00:00Z",
    approvedAt: "2026-04-15T10:30:00Z"
  }
]
```

### 5. glasses_parametric.py (3D Generation)

**Purpose**: Generate 3D glasses model from measurements

**How It Works**:

```python
# 1. Get parameters
width = 140  # mm
bridge = 20  # mm
temple = 145  # mm

# 2. Create left lens (torus shape)
bpy.ops.mesh.primitive_torus_add(
    location=(-(width/2) * scale, 0, 0),
    major_radius=25 * scale,
    minor_radius=2 * scale
)
left_lens = bpy.context.active_object

# 3. Create right lens
bpy.ops.mesh.primitive_torus_add(
    location=((width/2) * scale, 0, 0),
    major_radius=25 * scale,
    minor_radius=2 * scale
)
right_lens = bpy.context.active_object

# 4. Create bridge (connects lenses)
bpy.ops.mesh.primitive_cube_add(
    location=(0, 0, lens_radius * 0.8),
    scale=(bridge * scale / 2, 2 * scale, 2 * scale)
)
bridge_obj = bpy.context.active_object

# 5. Create left temple (arm)
bpy.ops.mesh.primitive_cube_add(
    location=(-(width/2 + temple/2) * scale, 0, 0),
    scale=(temple * scale / 2, 2 * scale, 2 * scale)
)
left_temple = bpy.context.active_object

# 6. Create right temple
bpy.ops.mesh.primitive_cube_add(
    location=((width/2 + temple/2) * scale, 0, 0),
    scale=(temple * scale / 2, 2 * scale, 2 * scale)
)
right_temple = bpy.context.active_object

# 7. Apply material (color, metallic)
mat = bpy.data.materials.new(name="GlassesMaterial")
mat.use_nodes = True
bsdf = mat.node_tree.nodes["Principled BSDF"]
bsdf.inputs['Base Color'].default_value = (0.1, 0.1, 0.1, 1.0)
bsdf.inputs['Metallic'].default_value = 0.8

# 8. Join all parts
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.join()

# 9. Export as GLB
bpy.ops.export_scene.gltf(
    filepath=f"output/{job_id}.glb",
    export_format='GLB'
)
```

**Result**: Creates a 3D glasses model file (GLB format)

## 🔄 Complete User Journey

### Admin Journey:

```
Day 1:
1. Opens admin-workflow.html
2. Uploads 10 glasses images
3. For each:
   - Clicks "Generate Model"
   - Enters measurements
   - Waits 5 seconds
   - Model created

Day 2:
1. Opens admin-alignment.html
2. For each model:
   - Selects from dropdown
   - Adjusts position (Arrow keys)
   - Adjusts scale (Q/A keys)
   - Adjusts rotation (Sliders)
   - Clicks "Save Alignment"
   - Clicks "Test on Real Face"
   - Verifies fit
   - Goes back to admin-workflow.html
   - Clicks "Approve"

Day 3:
1. All 10 models now live
2. Customers can try them on
```

### Customer Journey:

```
1. Opens ar-tryon.html
2. Allows camera access
3. Face appears on screen
4. Clicks "Change Style"
5. Sees 10 glasses options
6. Clicks "Ray-Ban Aviator"
7. Glasses appear on face (perfectly aligned!)
8. Moves head → glasses follow
9. Smiles → glasses stay in place
10. Clicks "Capture"
11. Photo saved
12. Shares on social media
13. Clicks "Buy Now"
```

## 📊 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      DATA FLOW                               │
└─────────────────────────────────────────────────────────────┘

ADMIN UPLOADS IMAGE
       ↓
   [FormData]
       ↓
POST /admin/upload-glasses
       ↓
Backend receives file
       ↓
Saves to thumbnails/
       ↓
Creates database entry
       ↓
Saves to glasses-database.json
       ↓
Returns { success: true, id: "abc-123" }
       ↓
Frontend shows success

ADMIN GENERATES MODEL
       ↓
POST /admin/generate-model/abc-123
   Body: { width: 140, bridge: 20, temple: 145 }
       ↓
Backend spawns Blender
       ↓
Blender runs glasses_parametric.py
       ↓
Creates 3D geometry
       ↓
Exports to output/abc-123.glb
       ↓
Backend updates database
       ↓
Returns { success: true, modelUrl: "..." }
       ↓
Frontend shows success

ADMIN ALIGNS MODEL
       ↓
Opens admin-alignment.html
       ↓
Loads 3D head model
       ↓
Loads glasses model
       ↓
Adjusts position/scale/rotation
       ↓
POST /admin/save-alignment/abc-123
   Body: { alignment: {...} }
       ↓
Backend updates database
       ↓
Returns { success: true }
       ↓
Frontend shows "Saved!"

ADMIN APPROVES
       ↓
POST /admin/approve/abc-123
       ↓
Backend updates status to "approved"
       ↓
Returns { success: true }
       ↓
Model now visible in AR try-on

CUSTOMER TRIES ON
       ↓
Opens ar-tryon.html
       ↓
GET /models
       ↓
Backend returns approved models
       ↓
Frontend shows list
       ↓
Customer selects model
       ↓
Loads GLB file
       ↓
GET /admin/glasses/abc-123
       ↓
Backend returns alignment data
       ↓
Frontend stores as baseAlignment
       ↓
Camera starts
       ↓
MediaPipe detects face (60 FPS)
       ↓
Calculates position/scale/rotation
       ↓
Applies baseAlignment offset
       ↓
Updates 3D glasses position
       ↓
Renders frame
       ↓
Displays on screen
       ↓
Repeats 60 times per second
```

## 🎯 Key Concepts

### 1. Three.js Scene

Think of it like a movie set:

```javascript
// The stage
scene = new THREE.Scene();

// The camera (your viewpoint)
camera = new THREE.PerspectiveCamera(...);

// The projector (renders to screen)
renderer = new THREE.WebGLRenderer(...);

// The actors (3D models)
headModel = gltf.scene;
glassesModel = gltf.scene;

// The lights
ambientLight = new THREE.AmbientLight(...);
directionalLight = new THREE.DirectionalLight(...);

// Action! (60 FPS)
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
```

### 2. MediaPipe Face Mesh

Think of it like a motion capture system:

```javascript
// Setup detector
faceMesh = new FaceMesh({...});

// Process each frame
faceMesh.onResults(results => {
  // Get 468 points on face
  const landmarks = results.multiFaceLandmarks[0];
  
  // Use key points
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  
  // Calculate where glasses should be
  const position = calculatePosition(leftEye, rightEye);
  
  // Move glasses
  glassesModel.position.set(position.x, position.y, position.z);
});
```

### 3. Alignment System

Think of it like a template:

```javascript
// Admin sets template
const template = {
  position: { x: 0, y: 0.05, z: 0.1 },
  scale: { x: 1.2, y: 1.2, z: 1.2 },
  rotation: { x: 0, y: 0, z: 5 }
};

// Customer's face tracking
const facePosition = detectFace();

// Combine both
const finalPosition = {
  x: facePosition.x + template.position.x,
  y: facePosition.y + template.position.y,
  z: facePosition.z + template.position.z
};

// Result: Perfect fit for everyone!
```

## 🎓 Summary

### How It All Works Together:

1. **Admin uploads** → Image saved → Database entry created
2. **Admin generates** → Blender creates 3D model → GLB file saved
3. **Admin aligns** → Adjusts on 3D head → Alignment saved
4. **Admin approves** → Status updated → Model goes live
5. **Customer tries on** → Loads model + alignment → Face tracking → Perfect fit!

### Key Technologies:

- **Three.js**: 3D rendering engine
- **MediaPipe**: Face detection (468 landmarks)
- **Blender**: 3D model generation
- **Express.js**: Backend API server
- **GLB/GLTF**: 3D model file format

### Data Storage:

- **glasses-database.json**: All product data + alignments
- **thumbnails/**: Product images
- **output/**: Generated 3D models

**Everything is connected and works together seamlessly!** 🎉
