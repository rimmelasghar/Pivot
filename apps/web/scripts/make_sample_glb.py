"""Generate public/samples/pivot-block.glb: a box with one colour per face and a
cone on the front (+Z), so it is easy to see which way the model points.

Run: python scripts/make_sample_glb.py (standard library only).
"""

import json
import math
import struct
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "public" / "samples" / "pivot-block.glb"

FACES = [  # normal, up, colour
    ((1, 0, 0), (0, 1, 0), (0.90, 0.30, 0.30)),
    ((-1, 0, 0), (0, 1, 0), (0.30, 0.75, 0.90)),
    ((0, 1, 0), (0, 0, -1), (0.95, 0.85, 0.35)),
    ((0, -1, 0), (0, 0, 1), (0.35, 0.35, 0.40)),
    ((0, 0, 1), (0, 1, 0), (0.40, 0.85, 0.50)),
    ((0, 0, -1), (0, 1, 0), (0.70, 0.50, 0.90)),
]
SIZE = (1.6, 0.4, 1.0)  # phone-like slab: wide, thin, deep


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def normalize(v):
    n = math.sqrt(sum(c * c for c in v))
    return tuple(c / n for c in v)


def build():
    pos, nrm, col, idx = [], [], [], []
    half = [s / 2 for s in SIZE]

    for n, up, colour in FACES:
        right = cross(up, n)
        base = len(pos)
        for du, dv in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            p = tuple((n[i] + right[i] * du + up[i] * dv) * half[i] for i in range(3))
            pos.append(p)
            nrm.append(n)
            col.append(colour)
        idx += [base, base + 1, base + 2, base, base + 2, base + 3]

    # Cone pointing along +Z from the front face.
    segments, radius, length, z0 = 24, 0.22, 0.45, half[2]
    tip = (0.0, 0.0, z0 + length)
    for i in range(segments):
        a0 = 2 * math.pi * i / segments
        a1 = 2 * math.pi * (i + 1) / segments
        p0 = (radius * math.cos(a0), radius * math.sin(a0), z0)
        p1 = (radius * math.cos(a1), radius * math.sin(a1), z0)
        e1 = tuple(p1[k] - p0[k] for k in range(3))
        e2 = tuple(tip[k] - p0[k] for k in range(3))
        n = normalize(cross(e1, e2))
        base = len(pos)
        pos += [p0, p1, tip]
        nrm += [n, n, n]
        col += [(1.0, 1.0, 1.0)] * 3
        idx += [base, base + 1, base + 2]
    return pos, nrm, col, idx


def write(path: Path) -> None:
    pos, nrm, col, idx = build()
    blob = b"".join(struct.pack("<3f", *v) for v in pos)
    blob += b"".join(struct.pack("<3f", *v) for v in nrm)
    blob += b"".join(struct.pack("<3f", *v) for v in col)
    idx_offset = len(blob)
    blob += b"".join(struct.pack("<H", i) for i in idx)
    blob += b"\0" * (-len(blob) % 4)

    n = len(pos)
    stride = n * 12
    lo = [min(p[i] for p in pos) for i in range(3)]
    hi = [max(p[i] for p in pos) for i in range(3)]
    gltf = {
        "asset": {"version": "2.0", "generator": "pivot make_sample_glb.py"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": "PivotBlock"}],
        "meshes": [
            {
                "primitives": [
                    {
                        "attributes": {"POSITION": 0, "NORMAL": 1, "COLOR_0": 2},
                        "indices": 3,
                        "material": 0,
                    }
                ]
            }
        ],
        "materials": [
            {"pbrMetallicRoughness": {"metallicFactor": 0.1, "roughnessFactor": 0.5}}
        ],
        "buffers": [{"byteLength": len(blob)}],
        "bufferViews": [
            {"buffer": 0, "byteOffset": 0, "byteLength": stride, "target": 34962},
            {"buffer": 0, "byteOffset": stride, "byteLength": stride, "target": 34962},
            {"buffer": 0, "byteOffset": 2 * stride, "byteLength": stride, "target": 34962},
            {"buffer": 0, "byteOffset": idx_offset, "byteLength": len(idx) * 2, "target": 34963},
        ],
        "accessors": [
            {"bufferView": 0, "componentType": 5126, "count": n, "type": "VEC3", "min": lo, "max": hi},
            {"bufferView": 1, "componentType": 5126, "count": n, "type": "VEC3"},
            {"bufferView": 2, "componentType": 5126, "count": n, "type": "VEC3"},
            {"bufferView": 3, "componentType": 5123, "count": len(idx), "type": "SCALAR"},
        ],
    }
    js = json.dumps(gltf, separators=(",", ":")).encode()
    js += b" " * (-len(js) % 4)
    total = 12 + 8 + len(js) + 8 + len(blob)
    data = struct.pack("<4sII", b"glTF", 2, total)
    data += struct.pack("<I4s", len(js), b"JSON") + js
    data += struct.pack("<I4s", len(blob), b"BIN\0") + blob
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    print(f"wrote {path} ({len(data)} bytes)")


if __name__ == "__main__":
    write(OUT)
