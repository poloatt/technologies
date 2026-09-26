import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { FigureBackButton, FigureHelpButton } from '@shared/components/common/FigureCornerIcons';
import { facesBack, muscleGroup } from './muscleGroups';

const MODEL = '/muscles/body-raw.glb';

function placeOf(name = '') {
  const hit = muscleGroup(name);
  return hit ? { zone: hit.section, group: hit.muscle } : { zone: '', group: '' };
}

function metaOf(node) {
  let current = node;
  while (current) {
    if (current.userData?.type) return current.userData;
    current = current.parent;
  }
  return {};
}

export default function MuscleAtlas({
  focusZone = null,
  focusGroup = null,
  onZoneClick,
  onZoomOut,
  height = 300,
  active = true,
}) {
  const mountRef = useRef(null);
  const frameRef = useRef(() => {});
  const focusRef = useRef({ zone: focusZone, group: focusGroup });
  const onClickRef = useRef(onZoneClick);
  const activeRef = useRef(active);
  const kickRef = useRef(() => {});
  const [status, setStatus] = useState('loading');
  const [licenseHover, setLicenseHover] = useState(false);
  const [licensePinned, setLicensePinned] = useState(false);
  const licenseOpen = licenseHover || licensePinned;
  focusRef.current = { zone: focusZone, group: focusGroup };
  onClickRef.current = onZoneClick;
  activeRef.current = active;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const [
        THREE,
        { GLTFLoader },
        { OrbitControls },
      ] = await Promise.all([
        import('three'),
        import('three/examples/jsm/loaders/GLTFLoader.js'),
        import('three/examples/jsm/controls/OrbitControls.js'),
      ]);
      if (disposed) return;

      const viewWidth = Math.max(1, mount.clientWidth || 360);
      const viewHeight = Math.max(1, mount.clientHeight || height);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(28, viewWidth / viewHeight, 0.01, 100);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(viewWidth, viewHeight);
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      mount.appendChild(renderer.domElement);

      scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      const key = new THREE.DirectionalLight(0xfff4ea, 1.35);
      key.position.set(1.4, 2.2, 2.4);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0x9eb0c8, 0.45);
      fill.position.set(-1.6, 0.4, -1.2);
      scene.add(fill);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enablePan = false;
      controls.enableZoom = false;
      controls.enableDamping = true;
      controls.minPolarAngle = Math.PI / 2;
      controls.maxPolarAngle = Math.PI / 2;

      const loader = new GLTFLoader();
      let gltf;
      try {
        gltf = await loader.loadAsync(MODEL);
      } catch {
        if (!disposed) setStatus('error');
        return;
      }
      if (disposed) return;

      const root = gltf.scene;
      const muscles = [];
      root.traverse((node) => {
        if (!node.isMesh) return;
        const meta = metaOf(node);
        if (meta.type !== 'muscle') {
          node.visible = false;
          return;
        }
        const place = placeOf(meta.name || node.name);
        node.userData.zone = place.zone;
        node.userData.group = place.group;
        const fadeable = (material) => {
          const next = material.clone();
          next.transparent = true;
          next.opacity = 1;
          next.depthWrite = true;
          next.needsUpdate = true;
          return next;
        };
        node.material = Array.isArray(node.material)
          ? node.material.map(fadeable)
          : fadeable(node.material);
        muscles.push(node);
      });
      scene.add(root);
      if (!muscles.length) {
        setStatus('error');
        return;
      }

      let zoomId = 0;
      let framing = false;
      const goTo = () => {
        const { zone, group } = focusRef.current;
        const chosen = muscles.filter((mesh) => {
          if (!zone) return true;
          if (mesh.userData.zone !== zone) return false;
          return !group || mesh.userData.group === group;
        });
        const list = chosen.length ? chosen : muscles;
        const box = new THREE.Box3();
        list.forEach((mesh) => box.expandByObject(mesh));
        if (box.isEmpty()) return;
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const aspect = camera.aspect || 1;
        const vFov = (camera.fov * Math.PI) / 180;
        const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
        const dist = Math.max(
          (size.y / 2) / Math.tan(vFov / 2),
          (size.x / 2) / Math.tan(hFov / 2),
          0.02,
        ) * (zone ? 1.35 : 1.08);
        const fromPos = camera.position.clone();
        const fromLook = controls.target.clone();
        const fromYaw = Math.atan2(fromPos.x - fromLook.x, fromPos.z - fromLook.z);
        const desiredYaw = zone && facesBack(zone, group) ? Math.PI : 0;
        const yawDelta = Math.atan2(Math.sin(desiredYaw - fromYaw), Math.cos(desiredYaw - fromYaw));
        const toYaw = fromYaw + yawDelta;
        const toLook = center.clone();
        const applyView = (yaw, look, radius) => {
          camera.position.set(
            look.x + Math.sin(yaw) * radius,
            look.y,
            look.z + Math.cos(yaw) * radius,
          );
          controls.target.copy(look);
          camera.near = Math.max(radius / 200, 0.001);
          camera.far = radius * 20;
          camera.updateProjectionMatrix();
          controls.update();
        };
        if (!zone) {
          cancelAnimationFrame(zoomId);
          framing = false;
          applyView(toYaw, toLook, dist);
          return;
        }
        const fromDist = Math.hypot(fromPos.x - fromLook.x, fromPos.z - fromLook.z) || dist;
        const started = performance.now();
        cancelAnimationFrame(zoomId);
        framing = true;
        const step = (now) => {
          const t = Math.min(1, (now - started) / 420);
          const eased = t * (2 - t);
          const look = fromLook.clone().lerp(toLook, eased);
          applyView(fromYaw + yawDelta * eased, look, fromDist + (dist - fromDist) * eased);
          if (t < 1) zoomId = requestAnimationFrame(step);
          else framing = false;
        };
        zoomId = requestAnimationFrame(step);
      };
      frameRef.current = goTo;

      const paint = () => {
        const { zone, group } = focusRef.current;
        muscles.forEach((mesh) => {
          const active = !zone || (mesh.userData.zone === zone && (!group || mesh.userData.group === group));
          const materials = [].concat(mesh.material || []);
          materials.forEach((material) => {
            material.opacity = active ? 1 : 0.02;
            material.depthWrite = active;
          });
        });
      };

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      let downX = 0;
      let downY = 0;
      const onDown = (event) => {
        downX = event.clientX;
        downY = event.clientY;
      };
      const onUp = (event) => {
        if (Math.hypot(event.clientX - downX, event.clientY - downY) > 6) return;
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(muscles, false)[0];
        if (hit?.object.userData.zone) {
          onClickRef.current?.(hit.object.userData.zone, hit.object.userData.group);
        }
      };
      renderer.domElement.addEventListener('pointerdown', onDown);
      renderer.domElement.addEventListener('pointerup', onUp);

      let frameId = 0;
      const loop = () => {
        if (!activeRef.current) {
          frameId = 0;
          return;
        }
        frameId = requestAnimationFrame(loop);
        if (!framing) controls.update();
        paint();
        renderer.render(scene, camera);
      };
      kickRef.current = () => {
        if (!frameId) loop();
      };
      setStatus('ready');
      goTo();
      if (activeRef.current) loop();

      const onResize = () => {
        const nextWidth = Math.max(1, mount.clientWidth || viewWidth);
        const nextHeight = Math.max(1, mount.clientHeight || viewHeight);
        camera.aspect = nextWidth / nextHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(nextWidth, nextHeight);
      };
      const observer = new ResizeObserver(onResize);
      observer.observe(mount);

      cleanup = () => {
        cancelAnimationFrame(frameId);
        cancelAnimationFrame(zoomId);
        observer.disconnect();
        renderer.domElement.removeEventListener('pointerdown', onDown);
        renderer.domElement.removeEventListener('pointerup', onUp);
        controls.dispose();
        renderer.dispose();
        if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      };
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
    frameRef.current();
  }, [focusZone, focusGroup, active]);

  return (
    <Box sx={{ width: '100%', height: '100%' }}>
      <Box
        ref={mountRef}
        role="img"
        aria-label="Músculos en 3D"
        sx={{ width: '100%', height, position: 'relative' }}
      >
        {status === 'loading' && (
          <Typography variant="caption" color="text.secondary" sx={{ position: 'absolute', left: 12, top: 8 }}>
            Cargando músculos…
          </Typography>
        )}
        {status === 'error' && (
          <Typography variant="caption" color="text.secondary" sx={{ position: 'absolute', left: 12, top: 8 }}>
            No se pudo cargar el modelo muscular
          </Typography>
        )}
        {focusZone && <FigureBackButton onClick={onZoomOut} />}
        <FigureHelpButton
          open={licenseOpen}
          label="Referencia de los músculos"
          title="Z-Anatomy, CC BY-SA 4.0."
          onToggle={() => setLicensePinned((open) => !open)}
          onOpen={() => setLicenseHover(true)}
          onClose={() => setLicenseHover(false)}
        />
      </Box>
    </Box>
  );
}
