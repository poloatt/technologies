import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography, useMediaQuery, useTheme } from '@mui/material';
import { FigureBackButton, FigureHelpButton } from '@shared/components/common/FigureCornerIcons';
import { boneMatchesGroup, isNeckBone } from './boneGroups';
import { loadSkin, makeSkin, paintSkin } from './skinShell';
import { loadSkeleton } from './skeletonBin';
const POINT_ZONES = {
  cabeza: ['cabeza', 'ojos'],
  pecho: ['pecho', 'abdomen', 'sangre'],
  brazos: ['brazos', 'piel'],
  piernas: ['piernas'],
};
const BONE = 0xd9d3c7;
const ZONE_LABEL = {
  cabeza: 'Cabeza',
  pecho: 'Tronco',
  abdomen: 'Abdomen',
  brazos: 'Brazos',
  piernas: 'Piernas',
};

function calloutOf(id) {
  const side = id === 'cabeza' || id === 'pecho' || id === 'abdomen' || id === 'mano' || id === 'dientes' ? 'l' : 'r';
  const gap = id === 'cabeza' ? 42 : id === 'mano' ? 128 : id === 'dientes' ? 78 : id === 'pecho' || id === 'abdomen' ? 72 : 36;
  return { side, gap, shift: 0 };
}

function sideOf(name) {
  if (/derech/.test(name)) return 'r';
  if (/izquierd/.test(name)) return 'l';
  return '';
}

function needsAttention(zone, highlights) {
  return (POINT_ZONES[zone] || [zone]).some((key) => highlights[key] === 'attention' || highlights[key] === 'both');
}

export default function NamedSkeleton({
  highlights = {},
  activeBone = '',
  focusZone = null,
  focusSide = null,
  focusPart = null,
  focusGroup = null,
  onBoneClick,
  onZonePick,
  onZoomOut,
  onCatalog,
  active = true,
  width = 188,
  height = 320,
}) {
  const theme = useTheme();
  const showMarkerLabels = useMediaQuery('(pointer: coarse), (max-width:599.95px)');
  const mountRef = useRef(null);
  const paintRef = useRef(() => {});
  const frameRef = useRef(() => {});
  const resizeRef = useRef(() => {});
  const [error, setError] = useState('');
  const [markers, setMarkers] = useState([]);
  const [licenseHover, setLicenseHover] = useState(false);
  const [licensePinned, setLicensePinned] = useState(false);
  const licenseOpen = active && (licenseHover || licensePinned);
  const markerRefs = useRef({});
  const labelRefs = useRef({});
  const projectRef = useRef(() => {});
  const highlightsRef = useRef(highlights);
  const activeBoneRef = useRef(activeBone);
  const focusZoneRef = useRef(focusZone);
  const focusSideRef = useRef(focusSide);
  const focusPartRef = useRef(focusPart);
  const focusGroupRef = useRef(focusGroup);
  const onBoneClickRef = useRef(onBoneClick);
  const onZonePickRef = useRef(onZonePick);
  const onCatalogRef = useRef(onCatalog);
  const colorsRef = useRef({
    attention: theme.palette.warning.main,
    primary: theme.palette.primary.main,
  });
  highlightsRef.current = highlights;
  activeBoneRef.current = activeBone;
  focusZoneRef.current = focusZone;
  focusSideRef.current = focusSide;
  focusPartRef.current = focusPart;
  focusGroupRef.current = focusGroup;
  onBoneClickRef.current = onBoneClick;
  onZonePickRef.current = onZonePick;
  onCatalogRef.current = onCatalog;
  colorsRef.current = {
    attention: theme.palette.warning.main,
    primary: theme.palette.primary.main,
  };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      try {
        const THREE = await import('three');
        const parsed = await loadSkeleton();
        if (disposed) return;
        onCatalogRef.current?.(parsed.bones.map((bone) => ({ name: bone.name, zone: bone.zone })));

        const scene = new THREE.Scene();
        const group = new THREE.Group();
        scene.add(group);
        const min = new THREE.Vector3(Infinity, Infinity, Infinity);
        const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
        const meshes = [];

        parsed.bones.forEach((bone) => {
          const geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.BufferAttribute(bone.verts, 3));
          geo.setIndex(new THREE.BufferAttribute(bone.indices, 1));
          geo.computeVertexNormals();
          geo.computeBoundingBox();
          min.min(geo.boundingBox.min);
          max.max(geo.boundingBox.max);
          const mat = new THREE.MeshStandardMaterial({
            color: BONE,
            roughness: 0.42,
            metalness: 0.02,
            side: THREE.FrontSide,
          });
          const mesh = new THREE.Mesh(geo, mat);
          mesh.userData = { name: bone.name, zone: bone.zone };
          group.add(mesh);
          meshes.push(mesh);
        });

        const center = min.clone().add(max).multiplyScalar(0.5);
        group.position.copy(center).multiplyScalar(-1);
        group.updateMatrixWorld(true);

        const centroidOf = (list) => {
          const box = new THREE.Box3();
          list.forEach((mesh) => box.expandByObject(mesh));
          return group.worldToLocal(box.getCenter(new THREE.Vector3()));
        };
        const sectionOf = (mesh) => {
          const name = mesh.userData.name;
          if (isNeckBone(name) || mesh.userData.zone === 'abdomen') return 'pecho';
          return mesh.userData.zone;
        };
        const anchors = ['cabeza', 'pecho', 'brazos', 'piernas'].flatMap((zone) => {
          const list = meshes.filter((mesh) => sectionOf(mesh) === zone);
          const right = list.filter((mesh) => sideOf(mesh.userData.name) === 'r');
          const placed = (zone === 'brazos' || zone === 'piernas') && right.length ? right : list;
          if (!placed.length) return [];
          return [{ id: zone, zone, label: ZONE_LABEL[zone], point: centroidOf(placed) }];
        });
        if (!disposed) {
          setMarkers(anchors.map(({ id, zone, label }) => ({
            id,
            zone,
            label,
            groupId: null,
          })));
        }
        const size = max.clone().sub(min);
        const viewWidth = Math.max(1, Math.round(mount.clientWidth || width));
        const viewHeight = Math.max(1, Math.round(mount.clientHeight || height));
        const aspect = viewWidth / viewHeight;
        const fov = 28;
        const vFov = (fov * Math.PI) / 180;
        const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
        const dist = Math.max(
          (size.z / 2) / Math.tan(vFov / 2),
          (size.x / 2) / Math.tan(hFov / 2),
        ) * 1.08;
        const camera = new THREE.PerspectiveCamera(fov, aspect, 1, dist * 8);
        const sign = parsed.frontSign || 1;
        camera.position.set(0, sign * dist, 0);
        camera.up.set(0, 0, 1);
        const lookTarget = new THREE.Vector3();
        camera.lookAt(lookTarget);
        let anim = 0;

        const partTest = (part) => {
          if (part === 'mano') return /metacarpiano|falange|escafoides|semilunar|ganchoso|pisiforme|trapecio|trapezoide|hueso grande/;
          if (part === 'cuello') return { test: (name) => isNeckBone(name) };
          if (part === 'dientes') return /maxilar|mandíbula/;
          if (part === 'cadera') return /ilíaco/;
          if (part === 'pie') return /astrágalo|calcáneo|metatarsiano|falange|cuboides|cuneiforme|navicular/;
          return null;
        };
        const splitOff = {
          cabeza: /atlas|axis|cervical|hioides|maxilar|mandíbula/,
          brazos: /metacarpiano|falange|escafoides|semilunar|ganchoso|pisiforme|trapecio|trapezoide|hueso grande/,
          piernas: /ilíaco|astrágalo|calcáneo|metatarsiano|falange|cuboides|cuneiforme|navicular/,
        };
        const inZoom = (mesh) => {
          const zone = focusZoneRef.current;
          const part = partTest(focusPartRef.current);
          const name = mesh.userData.name;
          const group = focusGroupRef.current;
          const meshZone = mesh.userData.zone;
          const neck = isNeckBone(name);
          if (zone === 'cabeza' && neck) return false;
          if (zone) {
            const inParent = meshZone === zone
              || (zone === 'pecho' && meshZone === 'abdomen' && (!group || group === 'abdomen'))
              || (zone === 'pecho' && neck && (!group || group === 'cuello'));
            if (group === 'abdomen' && meshZone !== 'abdomen') return false;
            if (group === 'cuello' && !neck) return false;
            if (!inParent) return false;
          }
          if (part && !part.test(name)) return false;
          if (!part && focusGroupRef.current && splitOff[zone]?.test(name)) return false;
          return true;
        };
        const isChosen = (mesh) => {
          if (!inZoom(mesh)) return false;
          const side = focusSideRef.current;
          const boneSide = sideOf(mesh.userData.name);
          if (side && boneSide && boneSide !== side) return false;
          const group = focusGroupRef.current;
          if (group && !boneMatchesGroup(mesh.userData.zone, group, mesh.userData.name)) return false;
          return true;
        };
        const frameOf = (zone) => {
          const box = new THREE.Box3();
          const targets = zone ? meshes.filter(inZoom) : meshes;
          if (!targets.length) meshes.forEach((mesh) => box.expandByObject(mesh));
          targets.forEach((mesh) => box.expandByObject(mesh));
          const center = box.getCenter(new THREE.Vector3());
          const span = box.getSize(new THREE.Vector3());
          const horizontal = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
          const nextDist = Math.max(
            (span.z / 2) / Math.tan(vFov / 2),
            (span.x / 2) / Math.tan(horizontal / 2),
            8,
          ) * (zone ? 1.35 : 1.08);
          return { center, dist: nextDist };
        };

        const goTo = (zone) => {
          const { center, dist: nextDist } = frameOf(zone);
          const fromPos = camera.position.clone();
          const fromLook = lookTarget.clone();
          const toPos = new THREE.Vector3(center.x, center.y + sign * nextDist, center.z);
          const toLook = center.clone();
          const started = performance.now();
          cancelAnimationFrame(anim);
          const step = (now) => {
            const t = Math.min(1, (now - started) / 280);
            const eased = t * (2 - t);
            camera.position.lerpVectors(fromPos, toPos, eased);
            lookTarget.lerpVectors(fromLook, toLook, eased);
            camera.lookAt(lookTarget);
            camera.near = Math.max(0.4, nextDist * 0.02);
            camera.far = nextDist * 14;
            camera.updateProjectionMatrix();
            paint();
            if (t < 1) anim = requestAnimationFrame(step);
          };
          anim = requestAnimationFrame(step);
        };

        scene.add(new THREE.AmbientLight(0xffffff, 0.22));
        scene.add(new THREE.HemisphereLight(0xfff4ea, 0x141414, 0.38));
        const key = new THREE.DirectionalLight(0xfffaf4, 2.1);
        key.position.set(sign * 2.2, sign * 0.85, 1.35);
        scene.add(key);
        const fill = new THREE.DirectionalLight(0x8ea0b8, 0.28);
        fill.position.set(-sign * 0.6, -sign * 0.2, -0.4);
        scene.add(fill);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.92;
        const canvas = renderer.domElement;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(viewWidth, viewHeight, false);
        canvas.style.setProperty('width', '100%', 'important');
        canvas.style.setProperty('height', '100%', 'important');
        canvas.style.display = 'block';
        renderer.setClearColor(0x000000, 0);
        mount.appendChild(canvas);

        let skin = null;
        const paint = () => {
          const { primary } = colorsRef.current;
          meshes.forEach((mesh) => {
            const focus = focusZoneRef.current;
            const inGroup = isChosen(mesh);
            const solid = !focus || inGroup;
            const mat = mesh.material;
            const opacity = solid ? 1 : (inZoom(mesh) ? 0.04 : 0.02);
            if (mat.opacity !== opacity || mat.transparent !== !solid) mat.needsUpdate = true;
            mat.opacity = opacity;
            mat.transparent = !solid;
            mat.depthWrite = solid;
            if (focus && inGroup) {
              mat.color.set(primary);
              mat.emissive.set(primary);
              mat.emissiveIntensity = 0.35;
            } else {
              mat.color.set(BONE);
              mat.emissive.set(0x000000);
              mat.emissiveIntensity = 0;
            }
          });
          paintSkin(skin, focusZoneRef.current ? 0.02 : 0.5);
          renderer.render(scene, camera);
          projectRef.current();
        };

        const project = () => {
          if (focusZoneRef.current) return;
          const w = canvas.clientWidth || viewWidth;
          const h = canvas.clientHeight || viewHeight;
          const screenOf = (world) => {
            const projected = world.project(camera);
            return {
              behind: projected.z > 1,
              x: (projected.x * 0.5 + 0.5) * w,
              y: (-projected.y * 0.5 + 0.5) * h,
            };
          };
          anchors.forEach((anchor) => {
            const dot = markerRefs.current[anchor.id];
            const label = labelRefs.current[anchor.id];
            const live = screenOf(group.localToWorld(anchor.point.clone()));
            const rest = screenOf(anchor.point.clone().add(group.position));
            if (dot) {
              dot.style.visibility = live.behind ? 'hidden' : 'visible';
              dot.style.left = `${live.x}px`;
              dot.style.top = `${live.y}px`;
            }
            if (!label) return;
            const { side, gap, shift } = calloutOf(anchor.id);
            const ax = rest.x + (side === 'l' ? gap : -gap);
            const ay = rest.y + shift;
            label.style.visibility = 'visible';
            label.style.left = `${ax}px`;
            label.style.top = `${ay}px`;
            const leader = label.querySelector('.zone-leader');
            if (!leader || live.behind) {
              if (leader) leader.style.width = '0px';
              return;
            }
            const dx = live.x - ax;
            const dy = live.y - ay;
            leader.style.width = `${Math.hypot(dx, dy)}px`;
            leader.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
          });
        };
        projectRef.current = project;

        const pointer = new THREE.Vector2();
        const raycaster = new THREE.Raycaster();
        let dragging = false;
        let lastX = 0;
        let moved = 0;
        canvas.style.touchAction = 'none';
        canvas.style.cursor = 'pointer';

        const onDown = (event) => {
          dragging = true;
          lastX = event.clientX;
          moved = 0;
        };
        const onMove = (event) => {
          if (!dragging) return;
          const dx = event.clientX - lastX;
          moved += Math.abs(dx);
          lastX = event.clientX;
          turn(dx * 0.01);
        };
        const onUp = (event) => {
          if (!dragging) return;
          dragging = false;
          if (moved > 6 || !onBoneClickRef.current) return;
          const rect = canvas.getBoundingClientRect();
          pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
          raycaster.setFromCamera(pointer, camera);
          const hit = raycaster.intersectObjects(meshes, false)[0];
          if (hit) {
            onBoneClickRef.current({
              name: hit.object.userData.name,
              zone: hit.object.userData.zone,
              clinicalZone: hit.object.userData.zone,
            });
          }
        };

        const turn = (angle) => {
          if (focusZoneRef.current) {
            const pivot = lookTarget.clone();
            const offset = group.position.clone().sub(pivot);
            offset.applyAxisAngle(new THREE.Vector3(0, 0, 1), angle);
            group.position.copy(pivot).add(offset);
          }
          group.rotation.z += angle;
          renderer.render(scene, camera);
          projectRef.current();
        };
        const surface = mount.parentElement;
        surface.addEventListener('pointerdown', onDown);
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        let lastW = viewWidth;
        let lastH = viewHeight;
        const applySize = (nextWidth, nextHeight) => {
          if (nextWidth === lastW && nextHeight === lastH) {
            paint();
            return;
          }
          lastW = nextWidth;
          lastH = nextHeight;
          renderer.setSize(nextWidth, nextHeight, false);
          camera.aspect = nextWidth / nextHeight;
          camera.updateProjectionMatrix();
          goTo(focusZoneRef.current);
        };
        const measure = () => {
          applySize(
            Math.max(1, Math.round(mount.clientWidth || viewWidth)),
            Math.max(1, Math.round(mount.clientHeight || viewHeight)),
          );
        };
        const observer = new ResizeObserver(measure);
        paint();
        loadSkin().then((gltf) => {
          if (disposed) return;
          skin = makeSkin(gltf, THREE);
          group.add(skin);
          paint();
        }).catch(() => {});
        paintRef.current = paint;
        frameRef.current = goTo;
        resizeRef.current = applySize;
        observer.observe(mount);
        if (focusZoneRef.current) goTo(focusZoneRef.current);

        cleanup = () => {
          observer.disconnect();
          cancelAnimationFrame(anim);
          surface.removeEventListener('pointerdown', onDown);
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          meshes.forEach((mesh) => {
            mesh.geometry.dispose();
            mesh.material.dispose();
          });
          renderer.dispose();
          if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
          paintRef.current = () => {};
          frameRef.current = () => {};
          resizeRef.current = () => {};
          projectRef.current = () => {};
        };
      } catch (err) {
        if (!disposed) setError(err.message || 'error al cargar');
      }
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [width]);

  useEffect(() => {
    const node = mountRef.current;
    const nextWidth = Math.max(1, Math.round(node?.clientWidth || width));
    const nextHeight = Math.max(1, Math.round(node?.clientHeight || height));
    resizeRef.current(nextWidth, nextHeight);
  }, [width, height]);

  useEffect(() => {
    frameRef.current(focusZone);
  }, [focusZone, focusSide, focusPart]);

  useEffect(() => {
    paintRef.current();
  }, [highlights, activeBone, focusSide, focusGroup, theme.palette.primary.main, theme.palette.warning.main]);

  useEffect(() => {
    projectRef.current();
  }, [markers, focusZone, width, height]);

  return (
    <Box
      sx={{
        position: 'relative',
        alignSelf: 'stretch',
        width: '100%',
        height,
        overflow: 'visible',
        flexShrink: 0,
      }}
    >
      <Box ref={mountRef} role="img" aria-label="Esqueleto" sx={{ width: '100%', height: '100%' }} />
      {!focusZone && markers.map((marker) => {
        const { side } = calloutOf(marker.id);
        return (
        <React.Fragment key={marker.id}>
          <Box
            component="button"
            type="button"
            ref={(node) => { markerRefs.current[marker.id] = node; }}
            aria-label={marker.label}
            onClick={(event) => {
              event.stopPropagation();
              onZonePickRef.current?.({
                zone: marker.zone,
                groupId: marker.groupId,
                clinicalZone: marker.zone,
              });
            }}
            sx={{
              position: 'absolute',
              left: 0,
              top: 0,
              visibility: 'hidden',
              transform: 'translate(-50%, -50%)',
              width: '10px',
              height: '10px',
              minWidth: '10px',
              minHeight: '10px',
              boxSizing: 'border-box',
              borderRadius: '50%',
              border: '1px solid',
              borderColor: 'background.default',
              bgcolor: needsAttention(marker.zone, highlights) ? 'warning.main' : 'rgba(255,255,255,0.85)',
              p: 0,
              cursor: 'pointer',
              zIndex: 1,
              '&:hover, &:focus-visible': {
                width: '14px',
                height: '14px',
                bgcolor: 'primary.main',
                borderColor: 'background.default',
              },
              '&:hover + .zone-callout, &:focus-visible + .zone-callout': { opacity: 1 },
            }}
          />
          <Box
            className="zone-callout"
            ref={(node) => { labelRefs.current[marker.id] = node; }}
            data-out={side}
            sx={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: 0,
              height: 0,
              visibility: 'hidden',
              pointerEvents: 'none',
              opacity: showMarkerLabels ? 1 : 0,
              zIndex: 1,
              '& .zone-leader': {
                position: 'absolute',
                left: 0,
                top: 0,
                height: '1px',
                transformOrigin: '0 50%',
                bgcolor: 'rgba(255,255,255,0.4)',
              },
              '&[data-out="l"] .zone-label': { left: '4px', top: 0, transform: 'translateY(-50%)' },
              '&[data-out="r"] .zone-label': { right: '4px', top: 0, transform: 'translateY(-50%)' },
            }}
          >
            <Box className="zone-leader" />
            <Typography
              className="zone-label"
              variant="caption"
              sx={{
                position: 'absolute',
                whiteSpace: 'nowrap',
                color: 'text.secondary',
                fontSize: 10,
                lineHeight: 1.2,
              }}
            >
              {marker.label}
            </Typography>
          </Box>
        </React.Fragment>
        );
      })}
      {focusZone && <FigureBackButton onClick={onZoomOut} />}
      <FigureHelpButton
        open={licenseOpen}
        title="BodyParts3D, © DBCLS, CC BY-SA 2.1 Japón. Nombres FMA, Universidad de Washington."
        onToggle={() => setLicensePinned((open) => !open)}
        onOpen={() => setLicenseHover(true)}
        onClose={() => setLicenseHover(false)}
      />
      {error && (
        <Typography variant="caption" color="error">{error}</Typography>
      )}
    </Box>
  );
}
