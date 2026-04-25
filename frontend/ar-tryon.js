// Configuration
const API_URL = 'http://localhost:5002';
let currentCamera = 'user'; // 'user' or 'environment'
let currentModelUrl = null;

// DOM Elements
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const statusDiv = document.getElementById('status');
const modelList = document.getElementById('modelList');

// Three.js Setup
const scene = new THREE.Scene();
const camera3D = new THREE.PerspectiveCamera(
    63, // FOV to match typical webcam
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera3D.position.set(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ 
    canvas: canvas,
    alpha: true,
    antialias: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight.position.set(0, 1, 1);
scene.add(directionalLight);

// Glasses model
let glasses = null;
let glassesGroup = new THREE.Group();
scene.add(glassesGroup);

// MediaPipe Face Mesh
const faceMesh = new FaceMesh({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
});

faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

// Face tracking results
faceMesh.onResults(onFaceResults);

// Initialize camera
async function initCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: currentCamera,
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        });
        
        video.srcObject = stream;
        
        // Wait for video to be ready
        await new Promise((resolve) => {
            video.onloadedmetadata = resolve;
        });
        
        updateStatus('Camera ready', 'ready');
        
        // Start face detection
        const camera = new Camera(video, {
            onFrame: async () => {
                await faceMesh.send({ image: video });
            },
            width: 1280,
            height: 720
        });
        
        camera.start();
        
    } catch (error) {
        console.error('Camera error:', error);
        updateStatus('Camera access denied', 'error');
    }
}

// Face tracking callback
function onFaceResults(results) {
    if (!results.multiFaceLandmarks || !glasses) return;
    
    const landmarks = results.multiFaceLandmarks[0];
    
    // Key facial landmarks (MediaPipe indices)
    const leftEye = landmarks[33];   // Left eye outer corner
    const rightEye = landmarks[263]; // Right eye outer corner
    const noseTip = landmarks[1];    // Nose tip
    const leftTemple = landmarks[234]; // Left temple
    const rightTemple = landmarks[454]; // Right temple
    
    // Calculate position (center between eyes, slightly above)
    const centerX = (leftEye.x + rightEye.x) / 2;
    const centerY = (leftEye.y + rightEye.y) / 2;
    const centerZ = (leftEye.z + rightEye.z) / 2;
    
    // Convert normalized coordinates to 3D space
    // Flip X for mirror mode
    const x = -(centerX - 0.5) * 10;
    const y = -(centerY - 0.5) * 10;
    const z = centerZ * 10;
    
    // Apply base alignment offset if exists
    const baseOffset = window.baseAlignment?.position || { x: 0, y: 0.3, z: 0 };
    glassesGroup.position.set(
        x + baseOffset.x, 
        y + baseOffset.y, 
        z + baseOffset.z
    );
    
    // Calculate scale based on eye distance
    const eyeDistance = Math.sqrt(
        Math.pow(leftEye.x - rightEye.x, 2) +
        Math.pow(leftEye.y - rightEye.y, 2) +
        Math.pow(leftEye.z - rightEye.z, 2)
    );
    
    // Scale factor (adjust based on your model size)
    const baseScale = window.baseAlignment?.scale?.x || 1;
    const scale = eyeDistance * 15 * baseScale;
    glassesGroup.scale.set(scale, scale, scale);
    
    // Calculate rotation
    // Z-axis rotation (head tilt)
    const dx = rightEye.x - leftEye.x;
    const dy = rightEye.y - leftEye.y;
    const tiltAngle = Math.atan2(dy, dx);
    
    // Y-axis rotation (head turn)
    const faceWidth = Math.abs(leftTemple.x - rightTemple.x);
    const eyeWidth = Math.abs(leftEye.x - rightEye.x);
    const turnRatio = eyeWidth / faceWidth;
    const turnAngle = (turnRatio - 0.5) * Math.PI * 0.5;
    
    // X-axis rotation (head nod)
    const noseToEyeY = noseTip.y - centerY;
    const nodAngle = noseToEyeY * Math.PI * 2;
    
    // Apply base rotation offset if exists
    const baseRot = window.baseAlignment?.rotation || { x: 0, y: 0, z: 0 };
    glassesGroup.rotation.set(
        nodAngle + (baseRot.x * Math.PI / 180), 
        turnAngle + (baseRot.y * Math.PI / 180), 
        tiltAngle + (baseRot.z * Math.PI / 180)
    );
}

// Load 3D model
async function loadModel(url) {
    updateStatus('Loading model...', 'loading');
    
    const loader = new THREE.GLTFLoader();
    
    return new Promise((resolve, reject) => {
        loader.load(
            url,
            async (gltf) => {
                // Remove old model
                if (glasses) {
                    glassesGroup.remove(glasses);
                }
                
                glasses = gltf.scene;
                
                // Center the model
                const box = new THREE.Box3().setFromObject(glasses);
                const center = box.getCenter(new THREE.Vector3());
                glasses.position.sub(center);
                
                // Try to load saved alignment
                const modelId = getCurrentModelId();
                if (modelId) {
                    await applySavedAlignment(modelId);
                }
                
                // Add to group
                glassesGroup.add(glasses);
                
                currentModelUrl = url;
                updateStatus('Model loaded - Try it on!', 'ready');
                resolve();
            },
            (progress) => {
                const percent = (progress.loaded / progress.total * 100).toFixed(0);
                updateStatus(`Loading model... ${percent}%`, 'loading');
            },
            (error) => {
                console.error('Model load error:', error);
                updateStatus('Failed to load model', 'error');
                reject(error);
            }
        );
    });
}

// Get current model ID from URL or selection
function getCurrentModelId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('model');
}

// Apply saved alignment from admin
async function applySavedAlignment(modelId) {
    try {
        const response = await fetch(`${API_URL}/admin/glasses/${modelId}`);
        const data = await response.json();
        
        if (data.alignment && glasses) {
            // Store base alignment for later use
            window.baseAlignment = data.alignment;
            console.log('Loaded saved alignment:', data.alignment);
        }
    } catch (error) {
        console.log('No saved alignment found, using defaults');
    }
}

// Load available models
async function loadModelList() {
    try {
        const response = await fetch(`${API_URL}/models`);
        const models = await response.json();
        
        modelList.innerHTML = '';
        
        if (models.length === 0) {
            modelList.innerHTML = '<p style="color: #718096;">No models available</p>';
            return;
        }
        
        models.forEach((model, index) => {
            const div = document.createElement('div');
            div.className = 'model-item';
            div.textContent = model.name;
            div.onclick = () => selectModel(model.url, div);
            
            if (index === 0) {
                div.classList.add('active');
                loadModel(model.url);
            }
            
            modelList.appendChild(div);
        });
        
    } catch (error) {
        console.error('Failed to load models:', error);
        modelList.innerHTML = '<p style="color: #e53e3e;">Failed to load models</p>';
    }
}

// Select model
function selectModel(url, element) {
    // Update active state
    document.querySelectorAll('.model-item').forEach(item => {
        item.classList.remove('active');
    });
    element.classList.add('active');
    
    // Load model
    loadModel(url);
}

// Toggle camera
async function toggleCamera() {
    currentCamera = currentCamera === 'user' ? 'environment' : 'user';
    
    // Stop current stream
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
    }
    
    // Restart with new camera
    await initCamera();
}

// Capture photo
function capture() {
    const captureCanvas = document.createElement('canvas');
    captureCanvas.width = video.videoWidth;
    captureCanvas.height = video.videoHeight;
    
    const ctx = captureCanvas.getContext('2d');
    
    // Draw video frame
    ctx.save();
    ctx.scale(-1, 1); // Mirror
    ctx.drawImage(video, -captureCanvas.width, 0, captureCanvas.width, captureCanvas.height);
    ctx.restore();
    
    // Draw 3D glasses on top
    const glassesCanvas = document.createElement('canvas');
    glassesCanvas.width = canvas.width;
    glassesCanvas.height = canvas.height;
    
    const tempRenderer = new THREE.WebGLRenderer({ 
        canvas: glassesCanvas,
        alpha: true,
        preserveDrawingBuffer: true
    });
    tempRenderer.setSize(canvas.width, canvas.height);
    tempRenderer.render(scene, camera3D);
    
    ctx.drawImage(glassesCanvas, 0, 0, captureCanvas.width, captureCanvas.height);
    
    // Download
    captureCanvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tryon-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
        
        updateStatus('Photo saved!', 'ready');
        setTimeout(() => {
            updateStatus('Ready', 'ready');
        }, 2000);
    });
}

// Toggle model selector
function toggleSelector() {
    const selector = document.querySelector('.model-selector');
    selector.style.display = selector.style.display === 'none' ? 'block' : 'none';
}

// Update status
function updateStatus(message, type) {
    statusDiv.className = `status ${type}`;
    
    if (type === 'loading') {
        statusDiv.innerHTML = `<span class="loading-spinner"></span>${message}`;
    } else {
        statusDiv.textContent = message;
    }
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera3D);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera3D.aspect = window.innerWidth / window.innerHeight;
    camera3D.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Initialize
async function init() {
    updateStatus('Initializing...', 'loading');
    
    await initCamera();
    await loadModelList();
    
    animate();
}

// Start
init();
