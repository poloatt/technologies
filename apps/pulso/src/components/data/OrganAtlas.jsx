import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { FigureBackButton, FigureHelpButton } from '@shared/components/common/FigureCornerIcons';

const CDN = 'https://cdn.humanatlas.io/digital-objects/ref-organ';

/** Modelos del Human Reference Atlas (CC BY 4.0), varón, ya colocados en el cuerpo. */
const MODELS = [
  { id: 'brain', system: 'nervioso', zone: 'cabeza', url: `${CDN}/brain-male/v1.4/assets/3d-allen-m-brain.glb`, anchor: [0, 1.55, 0], size: 0.22 },
  { id: 'eye-l', system: 'sentidos', zone: 'ojos', url: `${CDN}/eye-male-left/v1.3/assets/3d-vh-m-eye-l.glb`, anchor: [-0.04, 1.48, 0.06], size: 0.04 },
  { id: 'eye-r', system: 'sentidos', zone: 'ojos', url: `${CDN}/eye-male-right/v1.3/assets/3d-vh-m-eye-r.glb`, anchor: [0.04, 1.48, 0.06], size: 0.04 },
  { id: 'spinal', system: 'nervioso', zone: 'cabeza', url: `${CDN}/spinal-cord-male/v1.1/assets/3d-vh-m-spinal-cord.glb`, anchor: [0, 0.85, -0.02], size: 0.55 },
  { id: 'larynx', system: 'respiratorio', zone: 'pecho', url: `${CDN}/larynx-male/v1.1/assets/3d-vh-m-larynx.glb`, anchor: [0, 1.28, 0.03], size: 0.06 },
  { id: 'trachea', system: 'respiratorio', zone: 'pecho', url: `${CDN}/trachea-male/v1.1/assets/3d-vh-m-trachea.glb`, anchor: [0, 1.08, 0.02], size: 0.16 },
  { id: 'bronchus', system: 'respiratorio', zone: 'pecho', url: `${CDN}/main-bronchus-male/v1.1/assets/3d-vh-m-main-bronchus.glb`, anchor: [0, 0.9, 0.03], size: 0.12 },
  { id: 'lung', system: 'respiratorio', zone: 'pecho', url: `${CDN}/lung-male/v1.4/assets/3d-vh-m-lung.glb`, anchor: [0, 0.78, 0], size: 0.38 },
  { id: 'heart', system: 'circulatorio', zone: 'pecho', url: `${CDN}/heart-male/v1.3/assets/3d-vh-m-heart.glb`, anchor: [-0.03, 0.72, 0.05], size: 0.16 },
  { id: 'liver', system: 'digestivo', zone: 'abdomen', url: `${CDN}/liver-male/v1.2/assets/3d-vh-m-liver.glb`, anchor: [0.06, 0.48, 0.04], size: 0.22 },
  { id: 'pancreas', system: 'digestivo', zone: 'abdomen', url: `${CDN}/pancreas-male/v1.3/assets/3d-vh-m-pancreas.glb`, anchor: [0, 0.44, 0.02], size: 0.14 },
  { id: 'spleen', system: 'digestivo', zone: 'abdomen', url: `${CDN}/spleen-male/v1.3/assets/3d-vh-m-spleen.glb`, anchor: [-0.1, 0.48, 0], size: 0.1 },
  { id: 'small-intestine', system: 'digestivo', zone: 'abdomen', url: `${CDN}/small-intestine-male/v1.2/assets/3d-vh-m-small-intestine.glb`, anchor: [0, 0.24, 0.02], size: 0.28 },
  { id: 'large-intestine', system: 'digestivo', zone: 'abdomen', url: `${CDN}/large-intestine-male/v1.3/assets/3d-sbu-m-large-intestine.glb`, anchor: [0, 0.2, 0], size: 0.3 },
  { id: 'kidney-l', system: 'urinario', zone: 'abdomen', url: `${CDN}/kidney-male-left/v1.3/assets/3d-vh-m-kidney-l.glb`, anchor: [-0.08, 0.4, -0.03], size: 0.1 },
  { id: 'kidney-r', system: 'urinario', zone: 'abdomen', url: `${CDN}/kidney-male-right/v1.3/assets/3d-vh-m-kidney-r.glb`, anchor: [0.08, 0.4, -0.03], size: 0.1 },
  { id: 'ureter-l', system: 'urinario', zone: 'abdomen', url: `${CDN}/ureter-male-left/v1.2/assets/3d-vh-m-ureter-l.glb`, anchor: [-0.05, 0.22, 0], size: 0.16 },
  { id: 'ureter-r', system: 'urinario', zone: 'abdomen', url: `${CDN}/ureter-male-right/v1.2/assets/3d-vh-m-ureter-r.glb`, anchor: [0.05, 0.22, 0], size: 0.16 },
  { id: 'bladder', system: 'urinario', zone: 'abdomen', url: `${CDN}/urinary-bladder-male/v1.2/assets/3d-vh-m-urinary-bladder.glb`, anchor: [0, 0.06, 0.04], size: 0.1 },
  { id: 'prostate', system: 'reproductor', zone: 'abdomen', url: `${CDN}/prostate-male/v1.2/assets/3d-vh-m-prostate.glb`, anchor: [0, 0.02, 0.04], size: 0.05 },
  { id: 'mouth', system: 'digestivo', zone: 'cabeza', url: `${CDN}/mouth-male/v1.0/assets/3d-vh-m-mouth.glb`, anchor: [0, 1.42, 0.06], size: 0.06 },
  { id: 'tonsil-l', system: 'respiratorio', zone: 'pecho', url: `${CDN}/palatine-tonsil-male-left/v1.2/assets/3d-vh-m-palatine-tonsil-l.glb`, anchor: [-0.02, 1.32, 0.04], size: 0.03 },
  { id: 'tonsil-r', system: 'respiratorio', zone: 'pecho', url: `${CDN}/palatine-tonsil-male-right/v1.2/assets/3d-vh-m-palatine-tonsil-r.glb`, anchor: [0.02, 1.32, 0.04], size: 0.03 },
  { id: 'lymph', system: 'circulatorio', zone: 'pecho', url: `${CDN}/lymph-node-male/v1.4/assets/3d-nih-m-lymph-node.glb`, anchor: [0.04, 1.2, 0.02], size: 0.04 },
  { id: 'vessels', system: 'circulatorio', zone: 'pecho', url: `${CDN}/blood-vasculature-male/v1.3/assets/3d-vh-m-blood-vasculature.glb`, anchor: [0, 0.8, 0], size: 0.7 },
  { id: 'skin', system: null, zone: null, url: `${CDN}/skin-male/v1.4/assets/3d-vh-m-skin.glb`, anchor: [0, 0.85, 0], size: 1.7 },
];

const gltfCache = new Map();

function loadGltf(GLTFLoader, url) {
  if (!gltfCache.has(url)) {
    gltfCache.set(url, new Promise((resolve, reject) => {
      new GLTFLoader().load(url, resolve, undefined, reject);
    }));
  }
  return gltfCache.get(url);
}

function centerOf(object, THREE) {
  return new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
}

export default function OrganAtlas({
  focusSystem = null,
  onSystemClick,
  onZoomOut,
  height = 300,
  active = true,
}) {
  const mountRef = useRef(null);
  const focusRef = useRef(focusSystem);
  const onClickRef = useRef(onSystemClick);
  const groupsRef = useRef([]);
  const frameRef = useRef(() => {});
  const activeRef = useRef(active);
  const kickRef = useRef(() => {});
  const [status, setStatus] = useState('loading');
  const [licenseHover, setLicenseHover] = useState(false);
  const [licensePinned, setLicensePinned] = useState(false);
  const licenseOpen = licenseHover || licensePinned;
  focusRef.current = focusSystem;
  onClickRef.current = onSystemClick;
  activeRef.current = active;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const THREE = await import('three');
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
      if (disposed) return;

      const scene = new THREE.Scene();
      const root = new THREE.Group();
      scene.add(root);
      scene.add(new THREE.AmbientLight(0xffffff, 0.7));
      const key = new THREE.DirectionalLight(0xffffff, 1.15);
      key.position.set(0.4, 0.8, 1);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xdde7ff, 0.35);
      fill.position.set(-0.6, 0.2, -0.4);
      scene.add(fill);

      const viewWidth = Math.max(1, mount.clientWidth || 280);
      const viewHeight = Math.max(1, mount.clientHeight || height);
      const camera = new THREE.PerspectiveCamera(28, viewWidth / viewHeight, 0.01, 100);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(viewWidth, viewHeight);
      renderer.setClearColor(0x000000, 0);
      mount.appendChild(renderer.domElement);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enablePan = false;
      controls.enableZoom = false;
      controls.enableDamping = true;
      controls.autoRotate = false;
      controls.minPolarAngle = Math.PI / 2;
      controls.maxPolarAngle = Math.PI / 2;

      const FIRST = new Set(['heart', 'liver', 'kidney-l', 'kidney-r', 'spleen', 'bladder', 'pancreas']);
      const loaded = [];
      const take = async (model) => {
        try {
          const gltf = await Promise.race([
            loadGltf(GLTFLoader, model.url),
            new Promise((_, reject) => {
              setTimeout(() => reject(new Error('timeout')), 20000);
            }),
          ]);
          if (disposed) return null;
          const group = gltf.scene.clone(true);
          group.userData = { id: model.id, system: model.system, zone: model.zone, anchor: model.anchor, size: model.size };
          const shell = model.id === 'skin';
          if (shell) group.renderOrder = 2;
          group.traverse((node) => {
            if (!node.isMesh) return;
            const fadeable = (material) => {
              const next = material.clone();
              next.transparent = true;
              next.opacity = shell ? 0.65 : 1;
              next.depthWrite = !shell;
              next.side = shell ? THREE.DoubleSide : next.side;
              if (shell) next.renderOrder = 2;
              next.needsUpdate = true;
              return next;
            };
            node.material = Array.isArray(node.material)
              ? node.material.map(fadeable)
              : fadeable(node.material);
            node.userData.system = model.system;
            node.userData.zone = model.zone;
          });
          root.add(group);
          loaded.push(group);
          return group;
        } catch {
          return null;
        }
      };
      await Promise.all(MODELS.filter((model) => FIRST.has(model.id)).map(take));
      if (disposed) return;
      groupsRef.current = loaded;
      if (!loaded.length) {
        setStatus('error');
        return;
      }

      const spread = loaded.reduce((max, group, index) => {
        const origin = centerOf(group, THREE);
        return loaded.slice(index + 1).reduce((inner, other) => (
          Math.max(inner, origin.distanceTo(centerOf(other, THREE)))
        ), max);
      }, 0);
      const largest = loaded.reduce((max, group) => {
        const size = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
        return Math.max(max, size.x, size.y, size.z);
      }, 0);
      const local = spread < largest * 0.35;
      const placeLocal = (group) => {
        if (!local || group.userData.placed) return;
        const target = group.userData.size || 0.16;
        const box = new THREE.Box3().setFromObject(group);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        group.scale.setScalar(target / maxDim);
        group.updateMatrixWorld(true);
        const center = centerOf(group, THREE);
        const [x, y, z] = group.userData.anchor;
        group.position.sub(center).add(new THREE.Vector3(x, y, z));
        group.userData.placed = true;
      };
      loaded.forEach(placeLocal);

      let zoomId = 0;
      let framing = false;
      let shown = false;
      const extentOf = (group) => {
        const size = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
        return Math.max(size.x, size.y, size.z);
      };
      const frameTargets = (system) => {
        if (system === 'nervioso') {
          return loaded.filter((group) => group.userData.id === 'brain');
        }
        const groups = system
          ? loaded.filter((group) => group.userData.system === system && group.userData.id !== 'vessels')
          : loaded;
        if (!groups.length) return loaded;
        if (!system || groups.length < 2) return groups;
        const measured = groups.map((group) => ({
          group,
          extent: extentOf(group),
        }));
        const anchor = measured.reduce((best, item) => (item.extent > best.extent ? item : best));
        const near = new THREE.Box3().setFromObject(anchor.group);
        near.expandByScalar(anchor.extent * 0.35);
        const core = measured
          .filter((item) => near.intersectsBox(new THREE.Box3().setFromObject(item.group)))
          .map((item) => item.group);
        return core.length ? core : groups;
      };
      const goTo = (system, allowPartial = false) => {
        if (!system && !allowPartial && !loaded.some((group) => group.userData.id === 'brain')) return;
        const box = new THREE.Box3();
        const list = frameTargets(system);
        list.forEach((group) => box.expandByObject(group));
        if (box.isEmpty()) return;
        if (!system && !list.some((group) => group.userData.id === 'skin')) {
          const span = box.getSize(new THREE.Vector3());
          const mid = box.getCenter(new THREE.Vector3());
          box.expandByPoint(new THREE.Vector3(mid.x, box.min.y - span.y * 1.05, mid.z));
        }
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const aspect = camera.aspect || 1;
        const vFov = (camera.fov * Math.PI) / 180;
        const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
        const dist = Math.max(
          (size.y / 2) / Math.tan(vFov / 2),
          (size.x / 2) / Math.tan(hFov / 2),
          0.02,
        ) * (system ? 1.35 : 1.08);
        const fromPos = camera.position.clone();
        const fromLook = controls.target.clone();
        const yaw = Math.atan2(fromPos.x - fromLook.x, fromPos.z - fromLook.z);
        const toPos = new THREE.Vector3(
          center.x + Math.sin(yaw) * dist,
          center.y,
          center.z + Math.cos(yaw) * dist,
        );
        const toLook = center.clone();
        const place = () => {
          camera.position.copy(toPos);
          controls.target.copy(toLook);
          camera.near = Math.max(dist / 200, 0.001);
          camera.far = dist * 20;
          camera.updateProjectionMatrix();
          controls.update();
        };
        if (!system) {
          cancelAnimationFrame(zoomId);
          framing = false;
          place();
          shown = true;
          if (!disposed) setStatus('ready');
          return;
        }
        shown = true;
        if (!disposed) setStatus('ready');
        const started = performance.now();
        cancelAnimationFrame(zoomId);
        framing = true;
        const step = (now) => {
          const t = Math.min(1, (now - started) / 280);
          const eased = t * (2 - t);
          camera.position.lerpVectors(fromPos, toPos, eased);
          controls.target.lerpVectors(fromLook, toLook, eased);
          camera.near = Math.max(dist / 200, 0.001);
          camera.far = dist * 20;
          camera.updateProjectionMatrix();
          controls.update();
          if (t < 1) zoomId = requestAnimationFrame(step);
          else framing = false;
        };
        zoomId = requestAnimationFrame(step);
      };
      frameRef.current = (system) => goTo(system);
      if (focusRef.current) goTo(focusRef.current);
      Promise.all(MODELS.filter((model) => !FIRST.has(model.id)).map(take)).then(() => {
        if (disposed) return;
        loaded.forEach(placeLocal);
        goTo(focusRef.current, true);
      });

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      const onPointer = (event) => {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(root.children, true).find((item) => item.object.userData.system);
        if (hit) onClickRef.current?.(hit.object.userData.system, hit.object.userData.zone);
      };
      renderer.domElement.addEventListener('pointerup', onPointer);

      const paint = () => {
        const focus = focusRef.current;
        loaded.forEach((group) => {
          const shell = group.userData.id === 'skin';
          const active = !focus || group.userData.system === focus;
          group.traverse((node) => {
            if (!node.isMesh) return;
            const materials = [].concat(node.material || []);
            materials.forEach((material) => {
              material.opacity = shell ? (focus ? 0.04 : 0.65) : (active ? 1 : 0.02);
              material.depthWrite = shell ? false : active;
            });
          });
        });
      };
      paint();

      let frameId = 0;
      const loop = () => {
        if (!activeRef.current) {
          frameId = 0;
          return;
        }
        frameId = requestAnimationFrame(loop);
        if (!shown) return;
        if (!framing) controls.update();
        paint();
        renderer.render(scene, camera);
      };
      kickRef.current = () => {
        if (!frameId) loop();
      };
      if (activeRef.current) loop();

      const onResize = () => {
        const nextWidth = Math.max(1, mount.clientWidth || viewWidth);
        const nextHeight = Math.max(1, mount.clientHeight || viewHeight);
        camera.aspect = nextWidth / nextHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(nextWidth, nextHeight);
      };
      const observer = new ResizeObserver(onResize);

      cleanup = () => {
        cancelAnimationFrame(frameId);
        cancelAnimationFrame(zoomId);
        observer.disconnect();
        renderer.domElement.removeEventListener('pointerup', onPointer);
        controls.dispose();
        renderer.dispose();
        if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      };
      observer.observe(mount);
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [height]);

  useEffect(() => {
    if (active) kickRef.current();
    else {
      setLicenseHover(false);
      setLicensePinned(false);
    }
  }, [active]);

  useEffect(() => {
    if (!active) return;
    frameRef.current(focusSystem);
  }, [focusSystem, active]);

  return (
    <Box sx={{ width: '100%', height: '100%' }}>
      <Box
        ref={mountRef}
        role="img"
        aria-label="Órganos en 3D"
        sx={{ width: '100%', height, position: 'relative' }}
      >
        {status === 'loading' && (
          <Typography variant="caption" color="text.secondary" sx={{ position: 'absolute', left: 12, top: 8 }}>
            Cargando órganos…
          </Typography>
        )}
        {status === 'error' && (
          <Typography variant="caption" color="text.secondary" sx={{ position: 'absolute', left: 12, top: 8 }}>
            No se pudo cargar el atlas 3D
          </Typography>
        )}
        {focusSystem && <FigureBackButton onClick={onZoomOut} />}
        <FigureHelpButton
          open={licenseOpen}
          label="Referencia de los órganos"
          title="Human Reference Atlas, HuBMAP, CC BY 4.0."
          onToggle={() => setLicensePinned((open) => !open)}
          onOpen={() => setLicenseHover(true)}
          onClose={() => setLicenseHover(false)}
        />
      </Box>
    </Box>
  );
}
