import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function Viewer({ 
  modelName, 
  lensColor = "#3b82f6", 
  frameColor = "#1a1a1a", 
  tintOpacity = 0.5, 
  frameScale = 1.0,
  frameMaterial = "plastic",
  frameMetalness = 0.1,
  frameThickness = "medium",
  frameWidth = 1.0
}) {
  const ref = useRef(null);
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!modelName) return;
    fetch(`${API}/models`)
      .then(r => r.json())
      .then(models => {
        if (!Array.isArray(models)) {
          setError('Failed to load models');
          return;
        }
        const model = models.find(m => m.name === modelName);
        if (model) {
          setUrl(model.url);
          setError(null);
        } else {
          setError(`Model ${modelName} not found`);
        }
      })
      .catch(err => setError('Failed to fetch models'));
  }, [modelName]);

  useEffect(() => {
    if (!url) return;
    const container = ref.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f4f8);
    
    // Convert colors
    const lensColorThree = new THREE.Color(lensColor);
    const frameColorThree = new THREE.Color(frameColor);
    
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight || 1, 0.01, 1000);
    camera.position.set(0, 0.5, 3);
    
    // Enhanced lighting for better material visibility
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambient);
    
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
    keyLight.position.set(5, 5, 5);
    keyLight.castShadow = true;
    scene.add(keyLight);
    
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(-5, 3, -5);
    scene.add(fillLight);
    
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
    rimLight.position.set(0, -3, -5);
    scene.add(rimLight);
    
    // Add environment for reflections (important for metal materials)
    const envTexture = new THREE.CubeTextureLoader().load([
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    ]);
    scene.environment = envTexture;
    
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.0;
    
    let current = null;
    const loader = new GLTFLoader();
    
    function resize() {
      const w = container.clientWidth || 600;
      const h = container.clientHeight || 400;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    window.addEventListener("resize", resize);
    resize();
    
    let stop = false;
    function animate() {
      if (stop) return;
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();
    
    function clearCurrent() {
      if (current) {
        scene.remove(current);
        current.traverse(c => {
          if (c.isMesh) {
            c.geometry?.dispose();
            if (c.material) {
              if (Array.isArray(c.material)) c.material.forEach(m => m.dispose?.());
              else c.material.dispose?.();
            }
          }
        });
        current = null;
      }
    }
    
    setLoading(true);
    
    loader.load(url, gltf => {
      console.log("GLB loaded:", url);
      setLoading(false);
      clearCurrent();
      current = gltf.scene;
      
      // Center and scale
      const box = new THREE.Box3().setFromObject(current);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 0 && isFinite(maxDim)) {
        const scale = 2.5 / maxDim * frameScale * frameWidth;
        current.scale.setScalar(scale);
        box.setFromObject(current);
        box.getCenter(center);
      }
      
      current.position.set(-center.x, -center.y, -center.z);
      
      // Apply materials based on detected properties
      const meshes = [];
      current.traverse(child => {
        if (child.isMesh) meshes.push(child);
      });
      
      console.log(`Applying styles: material=${frameMaterial}, metalness=${frameMetalness}, thickness=${frameThickness}`);
      
      meshes.forEach((child, idx) => {
        const name = (child.name || '').toLowerCase();
        const matName = (child.material?.name || '').toLowerCase();
        
        // Detect lens vs frame
        let isLens = name.includes('lens') || name.includes('glass') || 
                     matName.includes('lens') || matName.includes('glass') ||
                     matName.includes('blue') || matName.includes('tint');
        
        // Check material properties for lens detection
        if (child.material) {
          const mat = child.material;
          if (mat.transparent && mat.opacity < 0.9) isLens = true;
          if (mat.color) {
            const { r, g, b } = mat.color;
            if (b > r * 1.2 && b > 0.3) isLens = true;
          }
        }
        
        // For small mesh count, use geometry analysis
        if (meshes.length <= 6 && !isLens) {
          child.geometry.computeBoundingBox();
          const geoBox = child.geometry.boundingBox;
          if (geoBox) {
            const geoSize = new THREE.Vector3();
            geoBox.getSize(geoSize);
            const minDim = Math.min(geoSize.x, geoSize.y, geoSize.z);
            const maxDim = Math.max(geoSize.x, geoSize.y, geoSize.z);
            if (minDim < maxDim * 0.1) isLens = true;
          }
        }
        
        if (isLens) {
          // Apply lens material with extracted color
          console.log(`🔵 Lens: ${child.name} - color: ${lensColor}, opacity: ${tintOpacity}`);
          child.material = new THREE.MeshPhysicalMaterial({
            color: lensColorThree,
            transparent: true,
            opacity: tintOpacity,
            roughness: 0.05,
            metalness: 0.0,
            transmission: 0.8,
            thickness: 0.2,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1,
            side: THREE.DoubleSide,
            envMapIntensity: 1.0
          });
        } else {
          // Apply frame material based on detected type
          console.log(`🖼️ Frame: ${child.name} - material: ${frameMaterial}, color: ${frameColor}`);
          
          if (frameMaterial === "metal") {
            child.material = new THREE.MeshStandardMaterial({
              color: frameColorThree,
              roughness: 0.2,
              metalness: frameMetalness,
              side: THREE.DoubleSide,
              envMapIntensity: 1.5
            });
          } else {
            // Plastic material
            child.material = new THREE.MeshStandardMaterial({
              color: frameColorThree,
              roughness: 0.6,
              metalness: 0.05,
              side: THREE.DoubleSide
            });
          }
        }
        
        child.castShadow = true;
        child.receiveShadow = true;
      });
      
      scene.add(current);
      
      camera.position.set(0, 0, 4);
      camera.lookAt(0, 0, 0);
      controls.target.set(0, 0, 0);
      controls.update();
      
    }, progress => {
      if (progress.total > 0) {
        console.log("Loading:", (progress.loaded / progress.total * 100).toFixed(0) + "%");
      }
    }, err => {
      setLoading(false);
      console.error("Load error:", err);
      setError("Failed to load 3D model");
    });
    
    return () => {
      stop = true;
      window.removeEventListener("resize", resize);
      clearCurrent();
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, [url, lensColor, frameColor, tintOpacity, frameScale, frameMaterial, frameMetalness, frameWidth]);
  
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {loading && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)', zIndex: 10,
          padding: '1rem 2rem', background: 'rgba(255,255,255,0.95)',
          borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          display: 'flex', alignItems: 'center', gap: '0.75rem'
        }}>
          <div style={{
            width: '20px', height: '20px',
            border: '3px solid #e2e8f0', borderTopColor: '#667eea',
            borderRadius: '50%', animation: 'spin 0.8s linear infinite'
          }}></div>
          Loading 3D model...
        </div>
      )}
      {error && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)', color: '#e53e3e',
          textAlign: 'center', padding: '1rem'
        }}>
          {error}
        </div>
      )}
      <div ref={ref} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
