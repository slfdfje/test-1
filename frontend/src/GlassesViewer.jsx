import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const API = import.meta.env.VITE_API_URL || "https://test-1-production-7a52.up.railway.app";

export default function GlassesViewer({ modelName, faceData }) {
  const ref = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf7fafc);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth || 600, container.clientHeight || 400);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight || 1, 0.01, 1000);
    camera.position.set(0, 0, 3);

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);

    const dir1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dir1.position.set(5, 5, 5);
    scene.add(dir1);

    const dir2 = new THREE.DirectionalLight(0xffffff, 0.3);
    dir2.position.set(-5, 3, -5);
    scene.add(dir2);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    let glasses = null;

    const createGlasses = (config = {}) => {
      const defaultConfig = {
        frameWidth: 1.4,
        frameHeight: 0.5,
        bridgeWidth: 0.2,
        lensWidth: 0.55,
        lensHeight: 0.42,
        templeLength: 0.9,
        frameThickness: 0.06,
        color: 0x1a1a1a,
        lensColor: 0x88ccff,
        lensOpacity: 0.3
      };

      const cfg = { ...defaultConfig, ...config };

      const glassesGroup = new THREE.Group();

      const frameMaterial = new THREE.MeshStandardMaterial({
        color: cfg.color,
        metalness: 0.9,
        roughness: 0.2
      });

      const lensMaterial = new THREE.MeshStandardMaterial({
        color: cfg.lensColor,
        metalness: 0.1,
        roughness: 0.1,
        transparent: true,
        opacity: cfg.lensOpacity,
        side: THREE.DoubleSide
      });

      const frameGeo = new THREE.BoxGeometry(
        cfg.frameWidth,
        cfg.frameHeight,
        cfg.frameThickness
      );
      const frame = new THREE.Mesh(frameGeo, frameMaterial);
      frame.position.set(0, 0, 0);
      glassesGroup.add(frame);

      const lensGeo = new THREE.BoxGeometry(
        cfg.lensWidth,
        cfg.lensHeight,
        cfg.frameThickness * 0.3
      );

      const lensLeft = new THREE.Mesh(lensGeo, lensMaterial);
      lensLeft.position.set(-(cfg.bridgeWidth / 2 + cfg.lensWidth / 2), 0, 0.01);
      glassesGroup.add(lensLeft);

      const lensRight = new THREE.Mesh(lensGeo, lensMaterial);
      lensRight.position.set((cfg.bridgeWidth / 2 + cfg.lensWidth / 2), 0, 0.01);
      glassesGroup.add(lensRight);

      const bridgeGeo = new THREE.BoxGeometry(cfg.bridgeWidth, cfg.frameHeight * 0.25, cfg.frameThickness * 0.8);
      const bridge = new THREE.Mesh(bridgeGeo, frameMaterial);
      bridge.position.set(0, cfg.frameHeight * 0.3, 0);
      glassesGroup.add(bridge);

      const templeGeo = new THREE.BoxGeometry(cfg.templeLength, cfg.frameThickness * 0.8, cfg.frameThickness * 0.6);

      const templeLeft = new THREE.Mesh(templeGeo, frameMaterial);
      templeLeft.position.set(-(cfg.frameWidth / 2 + cfg.templeLength / 2), -cfg.frameHeight * 0.1, 0);
      templeLeft.rotation.z = -Math.PI / 36;
      glassesGroup.add(templeLeft);

      const templeRight = new THREE.Mesh(templeGeo, frameMaterial);
      templeRight.position.set(cfg.frameWidth / 2 + cfg.templeLength / 2, -cfg.frameHeight * 0.1, 0);
      templeRight.rotation.z = Math.PI / 36;
      glassesGroup.add(templeRight);

      const hingeGeo = new THREE.BoxGeometry(0.08, 0.1, 0.08);
      const hingeLeft = new THREE.Mesh(hingeGeo, frameMaterial);
      hingeLeft.position.set(-cfg.frameWidth / 2, 0, 0);
      glassesGroup.add(hingeLeft);

      const hingeRight = new THREE.Mesh(hingeGeo, frameMaterial);
      hingeRight.position.set(cfg.frameWidth / 2, 0, 0);
      glassesGroup.add(hingeRight);

      return glassesGroup;
    };

    if (faceData && faceData.glassesConfig) {
      const { glassesConfig } = faceData;
      const scale = glassesConfig.scale || 1;
      
      glasses = createGlasses({
        frameWidth: 1.4 * scale,
        frameHeight: 0.5 * scale,
        bridgeWidth: glassesConfig.bridgeWidth ? glassesConfig.bridgeWidth / 100 : 0.2 * scale,
        lensWidth: 0.55 * scale,
        lensHeight: 0.42 * scale,
        templeLength: 0.9 * scale
      });
    } else {
      glasses = createGlasses({});
    }

    scene.add(glasses);

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      
      if (glasses) {
        glasses.rotation.y += 0.005;
      }
      
      renderer.render(scene, camera);
    };
    animate();

    setLoading(false);

    const handleResize = () => {
      const w = container.clientWidth || 600;
      const h = container.clientHeight || 400;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, [modelName, faceData]);

  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100%',
        color: '#e53e3e'
      }}>
        {error}
      </div>
    );
  }

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