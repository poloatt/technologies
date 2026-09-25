import React, { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { loadSkeleton } from './skeletonBin';

const SIZE = 32;
const cache = new Map();
const jobs = [];
let draining = false;
let canvas;
let ctx;

loadSkeleton();

function schedule(fn) {
  return new Promise((resolve, reject) => {
    jobs.push({ fn, resolve, reject });
    if (draining) return;
    draining = true;
    const drain = () => {
      const start = performance.now();
      while (jobs.length && performance.now() - start < 10) {
        const job = jobs.shift();
        try {
          job.resolve(job.fn());
        } catch (error) {
          job.reject(error);
        }
      }
      if (jobs.length) requestAnimationFrame(drain);
      else draining = false;
    };
    requestAnimationFrame(drain);
  });
}

function drawFront(bones) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let b = 0; b < bones.length; b += 1) {
    const v = bones[b].verts;
    for (let i = 0; i < v.length; i += 3) {
      const x = v[i];
      const z = v[i + 2];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
  }
  const pad = 2;
  const spanX = Math.max(maxX - minX, 0.001);
  const spanZ = Math.max(maxZ - minZ, 0.001);
  const scale = Math.min((SIZE - pad * 2) / spanX, (SIZE - pad * 2) / spanZ);
  const ox = (SIZE - spanX * scale) / 2;
  const oy = (SIZE - spanZ * scale) / 2;
  let triTotal = 0;
  for (let b = 0; b < bones.length; b += 1) triTotal += bones[b].indices.length / 3;
  const step = triTotal > 4000 ? Math.ceil(triTotal / 4000) : 1;
  const depth = new Float32Array(SIZE * SIZE);
  depth.fill(Infinity);
  const img = new Uint8ClampedArray(SIZE * SIZE * 4);

  const paint = (sx, sy, z, r, g, b) => {
    const x = sx | 0;
    const y = sy | 0;
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
    const p = y * SIZE + x;
    if (z >= depth[p]) return;
    depth[p] = z;
    const o = p * 4;
    img[o] = r;
    img[o + 1] = g;
    img[o + 2] = b;
    img[o + 3] = 255;
  };

  for (let b = 0; b < bones.length; b += 1) {
    const v = bones[b].verts;
    const idx = bones[b].indices;
    for (let i = 0; i < idx.length; i += 3 * step) {
      const a = idx[i] * 3;
      const c = idx[i + 1] * 3;
      const d = idx[i + 2] * 3;
      const ax = v[a];
      const ay = v[a + 1];
      const az = v[a + 2];
      const bx = v[c];
      const by = v[c + 1];
      const bz = v[c + 2];
      const cx = v[d];
      const cy = v[d + 1];
      const cz = v[d + 2];
      const nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
      const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
      const nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      if (ny >= 0) continue;
      const x0 = ox + (ax - minX) * scale;
      const y0 = oy + (maxZ - az) * scale;
      const x1 = ox + (bx - minX) * scale;
      const y1 = oy + (maxZ - bz) * scale;
      const x2 = ox + (cx - minX) * scale;
      const y2 = oy + (maxZ - cz) * scale;
      const len = Math.hypot(nx, ny, nz) || 1;
      const shade = 0.42 + 0.58 * Math.max(0, (nx * -0.35 + ny * -0.85 + nz * 0.4) / (len * 1.0037));
      const r = (217 * shade) | 0;
      const g = (211 * shade) | 0;
      const bl = (199 * shade) | 0;
      const z = (ay + by + cy) / 3;
      let minPX = x0;
      let maxPX = x0;
      let minPY = y0;
      let maxPY = y0;
      if (x1 < minPX) minPX = x1;
      if (x1 > maxPX) maxPX = x1;
      if (x2 < minPX) minPX = x2;
      if (x2 > maxPX) maxPX = x2;
      if (y1 < minPY) minPY = y1;
      if (y1 > maxPY) maxPY = y1;
      if (y2 < minPY) minPY = y2;
      if (y2 > maxPY) maxPY = y2;
      if (maxPX - minPX < 1 && maxPY - minPY < 1) {
        paint((x0 + x1 + x2) / 3, (y0 + y1 + y2) / 3, z, r, g, bl);
        continue;
      }
      const xStart = Math.max(0, minPX | 0);
      const yStart = Math.max(0, minPY | 0);
      const xEnd = Math.min(SIZE - 1, maxPX | 0);
      const yEnd = Math.min(SIZE - 1, maxPY | 0);
      const area = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
      if (area === 0) continue;
      for (let y = yStart; y <= yEnd; y += 1) {
        for (let x = xStart; x <= xEnd; x += 1) {
          const px = x + 0.5;
          const py = y + 0.5;
          const w0 = (px - x1) * (y2 - y1) - (py - y1) * (x2 - x1);
          const w1 = (px - x2) * (y0 - y2) - (py - y2) * (x0 - x2);
          const w2 = (px - x0) * (y1 - y0) - (py - y0) * (x1 - x0);
          if ((w0 >= 0 && w1 >= 0 && w2 >= 0) || (w0 <= 0 && w1 <= 0 && w2 <= 0)) {
            paint(x, y, z, r, g, bl);
          }
        }
      }
    }
  }

  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    ctx = canvas.getContext('2d');
  }
  ctx.putImageData(new ImageData(img, SIZE, SIZE), 0, 0);
  return canvas.toDataURL('image/png');
}

function thumbKey(zone, names) {
  return `${zone}:${names.join('|')}`;
}

function bonesFor(parsed, zone, names) {
  const wanted = new Set(names);
  const inZone = parsed.bones.filter((bone) => bone.zone === zone && wanted.has(bone.name));
  const found = new Set(inZone.map((bone) => bone.name));
  return [
    ...inZone,
    ...parsed.bones.filter((bone) => wanted.has(bone.name) && !found.has(bone.name)),
  ];
}

export function groupThumb(zone, names) {
  const key = thumbKey(zone, names);
  if (cache.has(key)) return cache.get(key);
  const pending = loadSkeleton().then((parsed) => schedule(() => {
    const bones = bonesFor(parsed, zone, names);
    return bones.length ? drawFront(bones) : '';
  }));
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
      sx={{
        width: 28,
        height: 28,
        flexShrink: 0,
        alignSelf: 'center',
      }}
    >
      {src ? (
        <Box
          component="img"
          src={src}
          alt=""
          sx={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />
      ) : null}
    </Box>
  );
}
