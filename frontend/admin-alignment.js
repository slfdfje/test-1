// Configuration
const API_URL = 'http://localhost:5002';

// Three.js scene
let scene, camera, renderer, controls;
let headModel, glassesModel;
let currentGlassesId = null;
let currentAlignment = {
    position: { x: 0, y: 0, z: 0.1 },
    scale: { x: 1, y: 1, z: 1 },
    rotation: { x: 0, y: 0, z: 0 }
};

// Initialize scene
function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2d3748);

    // Camera
    camera = new THREE.PerspectiveCamera(
        45,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(0, 0, 3);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    // Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 1;
    controls.maxDistance = 10;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight1.position.set(5, 5, 5);
    scene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight2.position.set(-5, 3, -5);
    scene.add(directionalLight2);

    // Grid helper
    const gridHelper = new THREE.GridHelper(10, 10, 0x444444, 0x222222);
    scene.add(gridHelper);

    // Load models
    loadHeadModel();
    loadGlassesList();

    // Keyboard controls
    setupKeyboardControls();

    // Animation loop
    animate();

    // Window resize
    window.addEventListener('resize', onWindowResize);
}

// Load 3D head model
function loadHeadModel() {
    const loader = new THREE.GLTFLoader();
    
    // Try to load head model (you need to provide this)
    loader.load(
        '/models/head.glb',
        (gltf) => {
            headModel = gltf.scene;
            
            // Center and scale head
            const box = new THREE.Box3().setFromObject(headModel);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 2 / maxDim;
            
            headModel.scale.setScalar(scale);
            headModel.position.sub(center.multiplyScalar(scale));
            
            scene.add(headModel);
            console.log('Head model loaded');
        },
        undefined,
        (error) => {
            console.error('Head model not found. Using placeholder.');
            createPlaceholderHead();
        }
    );
}

// Create placeholder head if model not available
function createPlaceholderHead() {
    const group = new THREE.Group();
    
    // Head sphere
    const headGeo = new THREE.SphereGeometry(0.5, 32, 32);
    const headMat = new THREE.MeshStandardMaterial({ 
        color: 0xffdbac,
        roughness: 0.8
    });
    const head = new THREE.Mesh(headGeo, headMat);
    head.scale.set(1, 1.2, 1);
    group.add(head);
    
    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.05, 16, 16);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
    
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.15, 0.1, 0.45);
    group.add(leftEye);
    
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.15, 0.1, 0.45);
    group.add(rightEye);
    
    // Nose
    const noseGeo = new THREE.ConeGeometry(0.05, 0.15, 8);
    const noseMat = new THREE.MeshStandardMaterial({ color: 0xffdbac });
    const nose = new THREE.Mesh(noseGeo, noseMat);
    nose.position.set(0, 0, 0.5);
    nose.rotation.x = Math.PI / 2;
    group.add(nose);
    
    headModel = group;
    scene.add(headModel);
    
    console.log('Using placeholder head model');
}

// Load glasses list
async function loadGlassesList() {
    try {
        const response = await fetch(`${API_URL}/models`);
        const models = await response.json();
        
        const select = document.getElementById('glassesSelect');
        select.innerHTML = '<option value="">Select a model...</option>';
        
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.name;
            option.dataset.url = model.url;
            select.appendChild(option);
        });
        
        // Load first model by default
        if (models.length > 0) {
            select.value = models[0].id;
            loadGlassesModel(models[0].id);
        }
        
    } catch (error) {
        console.error('Failed to load glasses list:', error);
        showMessage('Failed to load glasses list', 'error');
    }
}

// Load glasses model
function loadGlassesModel(modelId) {
    if (!modelId) return;
    
    const select = document.getElementById('glassesSelect');
    const option = select.options[select.selectedIndex];
    const url = option.dataset.url;
    
    if (!url) return;
    
    currentGlassesId = modelId;
    
    const loader = new THREE.GLTFLoader();
    
    loader.load(
        url,
        (gltf) => {
            // Remove old glasses
            if (glassesModel) {
                scene.remove(glassesModel);
            }
            
            glassesModel = gltf.scene;
            
            // Center the model
            const box = new THREE.Box3().setFromObject(glassesModel);
            const center = box.getCenter(new THREE.Vector3());
            glassesModel.position.sub(center);
            
            // Apply saved alignment if exists
            loadSavedAlignment(modelId);
            
            scene.add(glassesModel);
            
            console.log('Glasses model loaded:', modelId);
            showMessage('Glasses loaded successfully', 'success');
        },
        undefined,
        (error) => {
            console.error('Failed to load glasses:', error);
            showMessage('Failed to load glasses model', 'error');
        }
    );
}

// Load saved alignment
async function loadSavedAlignment(modelId) {
    try {
        const response = await fetch(`${API_URL}/admin/glasses/${modelId}`);
        const data = await response.json();
        
        if (data.alignment) {
            currentAlignment = data.alignment;
            applyAlignment();
            updateUI();
            showMessage('Loaded saved alignment', 'success');
        } else {
            resetAlignment();
        }
    } catch (error) {
        console.log('No saved alignment found, using defaults');
        resetAlignment();
    }
}

// Apply alignment to glasses
function applyAlignment() {
    if (!glassesModel) return;
    
    glassesModel.position.set(
        currentAlignment.position.x,
        currentAlignment.position.y,
        currentAlignment.position.z
    );
    
    glassesModel.scale.set(
        currentAlignment.scale.x,
        currentAlignment.scale.y,
        currentAlignment.scale.z
    );
    
    glassesModel.rotation.set(
        currentAlignment.rotation.x * Math.PI / 180,
        currentAlignment.rotation.y * Math.PI / 180,
        currentAlignment.rotation.z * Math.PI / 180
    );
}

// Adjust position
function adjustPosition(axis, delta) {
    if (!glassesModel) return;
    
    currentAlignment.position[axis] += delta;
    glassesModel.position[axis] += delta;
}

// Adjust scale
function adjustScale(value) {
    if (!glassesModel) return;
    
    const scale = parseFloat(value);
    currentAlignment.scale = { x: scale, y: scale, z: scale };
    glassesModel.scale.set(scale, scale, scale);
    
    document.getElementById('scaleValue').textContent = scale.toFixed(2);
}

function adjustScaleBtn(delta) {
    const slider = document.getElementById('scaleSlider');
    const newValue = parseFloat(slider.value) + delta;
    slider.value = Math.max(0.5, Math.min(2, newValue));
    adjustScale(slider.value);
}

function resetScale() {
    document.getElementById('scaleSlider').value = 1;
    adjustScale(1);
}

// Adjust rotation
function adjustRotation(axis, value) {
    if (!glassesModel) return;
    
    const degrees = parseFloat(value);
    currentAlignment.rotation[axis] = degrees;
    glassesModel.rotation[axis] = degrees * Math.PI / 180;
    
    document.getElementById(`rot${axis.toUpperCase()}Value`).textContent = degrees + '°';
}

// Apply presets
function applyPreset(preset) {
    switch (preset) {
        case 'default':
            currentAlignment = {
                position: { x: 0, y: 0, z: 0.1 },
                scale: { x: 1, y: 1, z: 1 },
                rotation: { x: 0, y: 0, z: 0 }
            };
            break;
        case 'higher':
            currentAlignment.position.y += 0.05;
            break;
        case 'lower':
            currentAlignment.position.y -= 0.05;
            break;
        case 'wider':
            currentAlignment.scale.x *= 1.1;
            currentAlignment.scale.y *= 1.1;
            currentAlignment.scale.z *= 1.1;
            break;
    }
    
    applyAlignment();
    updateUI();
}

// Reset alignment
function resetAlignment() {
    currentAlignment = {
        position: { x: 0, y: 0, z: 0.1 },
        scale: { x: 1, y: 1, z: 1 },
        rotation: { x: 0, y: 0, z: 0 }
    };
    
    applyAlignment();
    updateUI();
    showMessage('Alignment reset', 'success');
}

// Update UI controls
function updateUI() {
    document.getElementById('scaleSlider').value = currentAlignment.scale.x;
    document.getElementById('scaleValue').textContent = currentAlignment.scale.x.toFixed(2);
    
    document.getElementById('rotXSlider').value = currentAlignment.rotation.x;
    document.getElementById('rotXValue').textContent = currentAlignment.rotation.x + '°';
    
    document.getElementById('rotYSlider').value = currentAlignment.rotation.y;
    document.getElementById('rotYValue').textContent = currentAlignment.rotation.y + '°';
    
    document.getElementById('rotZSlider').value = currentAlignment.rotation.z;
    document.getElementById('rotZValue').textContent = currentAlignment.rotation.z + '°';
}

// Save alignment
async function saveAlignment() {
    if (!currentGlassesId) {
        showMessage('No glasses model selected', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/admin/save-alignment/${currentGlassesId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ alignment: currentAlignment })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showMessage('✓ Alignment saved successfully!', 'success');
        } else {
            showMessage('Failed to save alignment', 'error');
        }
    } catch (error) {
        console.error('Save error:', error);
        showMessage('Error saving alignment', 'error');
    }
}

// Test on real face
function testOnFace() {
    if (!currentGlassesId) {
        showMessage('No glasses model selected', 'error');
        return;
    }
    
    // Open AR try-on in new window
    window.open(`/ar-tryon.html?model=${currentGlassesId}`, '_blank');
}

// Keyboard controls
function setupKeyboardControls() {
    window.addEventListener('keydown', (e) => {
        if (!glassesModel) return;
        
        const step = e.shiftKey ? 0.001 : 0.01;
        
        switch (e.key.toLowerCase()) {
            // Position
            case 'arrowup':
                e.preventDefault();
                adjustPosition('y', step);
                break;
            case 'arrowdown':
                e.preventDefault();
                adjustPosition('y', -step);
                break;
            case 'arrowleft':
                e.preventDefault();
                adjustPosition('x', -step);
                break;
            case 'arrowright':
                e.preventDefault();
                adjustPosition('x', step);
                break;
            case 'w':
                adjustPosition('z', step);
                break;
            case 's':
                adjustPosition('z', -step);
                break;
            
            // Scale
            case 'q':
                adjustScaleBtn(0.05);
                break;
            case 'a':
                adjustScaleBtn(-0.05);
                break;
            
            // Rotation
            case 'z':
                currentAlignment.rotation.z -= 5;
                applyAlignment();
                updateUI();
                break;
            case 'x':
                currentAlignment.rotation.z += 5;
                applyAlignment();
                updateUI();
                break;
            
            // Reset
            case 'r':
                resetAlignment();
                break;
        }
    });
}

// Show message
function showMessage(text, type) {
    const msgDiv = document.getElementById('statusMessage');
    msgDiv.className = `status-message status-${type}`;
    msgDiv.textContent = text;
    
    setTimeout(() => {
        msgDiv.className = '';
        msgDiv.textContent = '';
    }, 3000);
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// Window resize
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Initialize on load
init();
