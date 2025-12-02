import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
const API = "https://ai-glasses-backend.onrender.com";

export default function Viewer({ modelName }) {
  const ref = useRef(null);
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!modelName) return;

    // Fetch the model URL from API
    fetch(`${API}/models`)
      .then(r => r.json())
      .then(models => {
        const model = models.find(m => m.name === modelName);
        if (model) {
          setUrl(model.url);
        }
      })
      .catch(err => console.error('Failed to fetch model URL:', err));
  }, [modelName]);

  useEffect(() => {
    if (!url) return;
    const container = ref.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf7fafc);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    container.appendChild(renderer.domElement);
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight || 1, 0.01, 1000);
    camera.position.set(0, 0.2, 1.5);
    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);
    const dir1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dir1.position.set(5, 5, 5);
    scene.add(dir1);
    const dir2 = new THREE.DirectionalLight(0xffffff, 0.3);
    dir2.position.set(-5, 3, -5);
    scene.add(dir2);
    
    // Grid and axes for reference
    const gridHelper = new THREE.GridHelper(10, 10);
    scene.add(gridHelper);
    const axes = new THREE.AxesHelper(2);
    scene.add(axes);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = 0.05;
    const boxGeo = new THREE.BoxGeometry(0.4, 0.2, 0.12); const boxMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, wireframe: true }); const skeleton = new THREE.Mesh(boxGeo, boxMat); skeleton.visible = false; scene.add(skeleton);
    let current = null;
    const loader = new GLTFLoader();
    function resize() { const w = container.clientWidth || 600; const h = container.clientHeight || 400; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    window.addEventListener("resize", resize); resize();
    let stop = false;
    function animate() { if (stop) return; requestAnimationFrame(animate); if (current) current.rotation.y += 0.01; else if (skeleton.visible) skeleton.rotation.y += 0.01; controls.update(); renderer.render(scene, camera); }
    animate();
    function clearCurrent() { if (current) { scene.remove(current); current.traverse(c => { if (c.isMesh) { c.geometry && c.geometry.dispose(); if (c.material) { if (Array.isArray(c.material)) c.material.forEach(m => m.dispose && m.dispose()); else c.material.dispose && c.material.dispose(); } } }); current = null; } }
    setLoading(true); skeleton.visible = true;
    loader.load(url, gltf => {
      console.log("GLB loaded successfully", url);
      setLoading(false); 
      skeleton.visible = false; 
      clearCurrent(); 
      current = gltf.scene; 
      
      // Center and scale the model
      const box = new THREE.Box3().setFromObject(current);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      
      console.log("Model size:", size, "Center:", center);
      
      // Scale first, then center
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 0 && isFinite(maxDim)) {
        const scale = 2.0 / maxDim;  // Make it bigger
        current.scale.setScalar(scale);
        console.log("Applied scale:", scale);
        
        // Recalculate box after scaling
        box.setFromObject(current);
        box.getCenter(center);
      }
      
      // Move model to origin
      current.position.set(-center.x, -center.y, -center.z);
      console.log("Model positioned at:", current.position);
      
      // Ensure all meshes have materials and log mesh info
      let meshCount = 0;
      current.traverse((child) => {
        if (child.isMesh) {
          meshCount++;
          console.log(`Mesh ${meshCount}:`, child.name, 'Geometry:', child.geometry, 'Material:', child.material);
          if (!child.material) {
            child.material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
            console.log('Added default red material to mesh');
          }
          // Make sure material is visible
          if (child.material) {
            child.material.side = THREE.DoubleSide;
            child.material.needsUpdate = true;
          }
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      console.log(`Total meshes in model: ${meshCount}`);
      
      scene.add(current);
      console.log('Model added to scene. Scene children:', scene.children.length);
      
      // Position camera to view the model
      camera.position.set(0, 0, 5);
      camera.lookAt(0, 0, 0);
      controls.target.set(0, 0, 0);
      controls.minDistance = 0.5;
      controls.maxDistance = 50;
      controls.update();
      
      console.log("Camera positioned at:", camera.position);
      console.log("Controls target:", controls.target);
    }, progress => { 
      if (progress.total > 0) {
        console.log("Loading progress:", (progress.loaded / progress.total * 100).toFixed(2) + "%"); 
      }
    }, err => { 
      setLoading(false); 
      skeleton.visible = false; 
      console.error("Failed to load GLB from:", url, "Error:", err); 
      alert("Failed to load 3D model. Check console for details."); 
    });
    return () => { stop = true; window.removeEventListener("resize", resize); clearCurrent(); renderer.dispose(); if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement); };
  }, [url]);
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {loading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10,
          padding: '1rem 2rem',
          background: 'rgba(255, 255, 255, 0.95)',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          fontSize: '0.95rem',
          color: '#2d3748'
        }}>
          <div style={{
            width: '20px',
            height: '20px',
            border: '3px solid #e2e8f0',
            borderTopColor: '#667eea',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }}></div>
          Loading 3D model...
        </div>
      )}
      <div ref={ref} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
