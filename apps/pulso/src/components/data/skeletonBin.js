const ZONES = ['cabeza', 'pecho', 'abdomen', 'brazos', 'piernas'];

export function parseSkeleton(buffer) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  if (String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) !== 'SKEL') {
    throw new Error('esqueleto inválido');
  }
  const version = view.getUint16(4, true);
  const scale = version >= 2 ? 0.1 : 1;
  const frontSign = view.getInt16(6, true);
  const count = view.getUint16(8, true);
  let o = 10;
  const bones = [];
  for (let n = 0; n < count; n += 1) {
    const nameLen = view.getUint16(o, true);
    o += 2;
    const name = new TextDecoder().decode(bytes.subarray(o, o + nameLen));
    o += nameLen;
    const zone = ZONES[bytes[o]];
    o += 1;
    o += 4;
    const vCount = view.getUint16(o, true);
    o += 2;
    const verts = new Float32Array(vCount * 3);
    for (let i = 0; i < vCount; i += 1) {
      verts[i * 3] = view.getInt16(o, true) * scale;
      verts[i * 3 + 1] = view.getInt16(o + 2, true) * scale;
      verts[i * 3 + 2] = view.getInt16(o + 4, true) * scale;
      o += 6;
    }
    const iCount = view.getUint32(o, true);
    o += 4;
    const indices = new Uint16Array(iCount);
    for (let i = 0; i < iCount; i += 1) {
      indices[i] = view.getUint16(o, true);
      o += 2;
    }
    bones.push({ name, zone, verts, indices });
  }
  return { frontSign, bones };
}

let loaded;
export function loadSkeleton() {
  if (!loaded) {
    loaded = fetch('/bones/skeleton.bin?v=2')
      .then((res) => {
        if (!res.ok) throw new Error('no se pudo cargar el esqueleto');
        return res.arrayBuffer();
      })
      .then(parseSkeleton);
  }
  return loaded;
}
