import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const SKIN_URL = '/bones/skin.glb';

let pending = null;

export function loadSkin() {
  if (!pending) {
    pending = new Promise((resolve, reject) => {
      new GLTFLoader().load(SKIN_URL, resolve, undefined, reject);
    });
  }
  return pending;
}

export function makeSkin(gltf, THREE) {
  const shell = gltf.scene.clone(true);
  shell.name = 'skin';
  shell.traverse((node) => {
    if (!node.isMesh) return;
    const fade = (material) => {
      const next = material.clone();
      next.transparent = true;
      next.depthWrite = false;
      next.opacity = 0.5;
      next.side = THREE.DoubleSide;
      next.needsUpdate = true;
      return next;
    };
    node.material = Array.isArray(node.material) ? node.material.map(fade) : fade(node.material);
    node.raycast = () => {};
    node.renderOrder = 2;
  });
  return shell;
}

export function fitSkin(shell, targetBox, THREE) {
  shell.rotation.set(-Math.PI / 2, 0, 0);
  shell.updateMatrixWorld(true);
  const shellSize = new THREE.Box3().setFromObject(shell).getSize(new THREE.Vector3());
  const targetSize = targetBox.getSize(new THREE.Vector3());
  shell.scale.setScalar((targetSize.y || 1) / (shellSize.y || 1));
  shell.updateMatrixWorld(true);
  const fitted = new THREE.Box3().setFromObject(shell);
  shell.position.add(targetBox.getCenter(new THREE.Vector3()).sub(fitted.getCenter(new THREE.Vector3())));
  shell.updateMatrixWorld(true);
}

export function paintSkin(shell, opacity) {
  if (!shell) return;
  shell.traverse((node) => {
    if (!node.isMesh) return;
    [].concat(node.material || []).forEach((material) => {
      material.opacity = opacity;
      material.depthWrite = false;
    });
  });
}
