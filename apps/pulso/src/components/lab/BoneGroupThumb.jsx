import React, { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { loadSkeleton } from './skeletonBin';

const SIZE = 64;
const cache = new Map();

function drawFront(bones) {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  bones.forEach((bone) => {
    const v = bone.verts;
    for (let i = 0; i < v.length; i += 3) {
      const x = v[i];
      const z = v[i + 2];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
  });
  const pad = 4;
  const spanX = Math.max(maxX - minX, 0.001);
  const spanZ = Math.max(maxZ - minZ, 0.001);
  const scale = Math.min((SIZE - pad * 2) / spanX, (SIZE - pad * 2) / spanZ);
  const ox = (SIZE - spanX * scale) / 2;
  const oy = (SIZE - spanZ * scale) / 2;
  const px = (x) => ox + (x - minX) * scale;
  const py = (z) => oy + (maxZ - z) * scale;
  const tris = [];
  bones.forEach((bone) => {
    const v = bone.verts;
    const idx = bone.indices;
    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i] * 3;
      const b = idx[i + 1] * 3;
      const c = idx[i + 2] * 3;
      const ax = v[a];
      const ay = v[a + 1];
      const az = v[a + 2];
      const bx = v[b];
      const by = v[b + 1];
      const bz = v[b + 2];
      const cx = v[c];
      const cy = v[c + 1];
      const cz = v[c + 2];
      const nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
      const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
      const nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      if (ny >= 0) continue;
      const len = Math.hypot(nx, ny, nz) || 1;
      const lx = -0.35;
      const ly = -0.85;
      const lz = 0.4;
      const light = Math.hypot(lx, ly, lz);
      const shade = 0.42 + 0.58 * Math.max(0, (nx * lx + ny * ly + nz * lz) / (len * light));
      tris.push({
        depth: (ay + by + cy) / 3,
        shade,
        p: [px(ax), py(az), px(bx), py(bz), px(cx), py(cz)],
      });
    }
  });
  tris.sort((p, q) => q.depth - p.depth);
  tris.forEach((tri) => {
    ctx.fillStyle = `rgb(${Math.round(217 * tri.shade)},${Math.round(211 * tri.shade)},${Math.round(199 * tri.shade)})`;
    ctx.beginPath();
    ctx.moveTo(tri.p[0], tri.p[1]);
    ctx.lineTo(tri.p[2], tri.p[3]);
    ctx.lineTo(tri.p[4], tri.p[5]);
    ctx.closePath();
    ctx.fill();
  });
  return canvas.toDataURL('image/webp');
}

function thumbKey(zone, names) {
  return `${zone}:${names.join('|')}`;
}

export function groupThumb(zone, names) {
  const key = thumbKey(zone, names);
  if (cache.has(key)) return cache.get(key);
  const pending = loadSkeleton().then((parsed) => {
    const wanted = new Set(names);
    const inZone = parsed.bones.filter((bone) => bone.zone === zone && wanted.has(bone.name));
    const found = new Set(inZone.map((bone) => bone.name));
    const bones = [
      ...inZone,
      ...parsed.bones.filter((bone) => wanted.has(bone.name) && !found.has(bone.name)),
    ];
    return bones.length ? drawFront(bones) : '';
  });
  cache.set(key, pending);
  return pending;
}

export default function BoneGroupThumb({ zone, names }) {
  const [src, setSrc] = useState('');
  const key = thumbKey(zone, names);
  useEffect(() => {
    let cancel = false;
    groupThumb(zone, names).then((url) => {
      if (!cancel) setSrc(url);
    });
    return () => {
      cancel = true;
    };
  }, [zone, key, names]);
  return (
    <Box
      component="img"
      src={src || undefined}
      alt=""
      sx={{
        width: 28,
        height: 28,
        flexShrink: 0,
        objectFit: 'contain',
        alignSelf: 'center',
      }}
    />
  );
}
