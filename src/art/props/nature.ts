import {
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  RingGeometry,
  SphereGeometry,
  type BufferGeometry,
} from 'three'
import { at, mergeAll, paint, spinY } from '@/art/geo'
import { Palette } from '@/art/Palette'
import type { Rng } from '@/core/Rng'
import { materials } from '@/render/Materials'

/** Material dùng chung cho mọi prop đã gộp vertex-color. */
function propMaterial() {
  return materials.flat(0xffffff, { vertexColors: true })
}

function meshOf(parts: BufferGeometry[], name: string): Mesh {
  const mesh = new Mesh(mergeAll(parts), propMaterial())
  mesh.name = name
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

/** Tảng đá — dodecahedron bóp méo. Đúng 12 mặt, rẻ và ra chất lowpoly ngay. */
export function buildRock(rng: Rng, radius = 0.55): Mesh {
  const geo = new DodecahedronGeometry(radius, 0)
  // Bóp không đều để mỗi hòn một dáng, không bị nhìn ra là cùng một khuôn
  geo.scale(rng.float(0.8, 1.3), rng.float(0.5, 0.9), rng.float(0.8, 1.3))
  spinY(geo, rng.float(0, Math.PI * 2))
  const shade = rng.chance(0.35) ? Palette.daDam : Palette.da
  const mesh = meshOf([paint(geo, shade)], 'rock')
  // Dìm một phần xuống đất để đá trông như mọc lên, không phải đặt lên
  mesh.position.y = -radius * 0.25
  return mesh
}

/** Cụm đá lớn. */
export function buildBoulder(rng: Rng, radius = 1.4): Mesh {
  const parts: BufferGeometry[] = []
  const main = new IcosahedronGeometry(radius, 0)
  main.scale(1, rng.float(0.6, 0.85), 1)
  parts.push(paint(main, Palette.daDam))
  const count = rng.int(2, 3)
  for (let i = 0; i < count; i++) {
    const sub = new DodecahedronGeometry(radius * rng.float(0.3, 0.5), 0)
    const p = rng.onCircle()
    parts.push(paint(at(sub, p.x * radius * 0.8, radius * 0.1, p.z * radius * 0.8), Palette.da))
  }
  return meshOf(parts, 'boulder')
}

/**
 * Cây tùng — thân trụ 5 cạnh + 3 tầng nón 6 cạnh.
 * Tùng là cây đặc trưng của sơn môn tu tiên nên đây là prop chủ đạo của map.
 */
export function buildPine(rng: Rng, height = 3.4): Mesh {
  const trunkH = height * 0.3
  const parts: BufferGeometry[] = []

  const trunk = new CylinderGeometry(height * 0.045, height * 0.07, trunkH, 5)
  parts.push(paint(at(trunk, 0, trunkH * 0.5, 0), Palette.than))

  const tiers = 3
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1)
    const r = height * (0.32 - t * 0.16)
    const h = height * (0.34 - t * 0.08)
    const y = trunkH + height * (0.12 + t * 0.24)
    const cone = new ConeGeometry(r, h, 6)
    spinY(cone, rng.float(0, Math.PI))
    // Tầng trên sáng hơn: gợi ánh nắng rọi từ trên xuống mà không cần thêm đèn
    parts.push(paint(at(cone, 0, y, 0), i === tiers - 1 ? Palette.laTungNhat : Palette.laTung))
  }

  const mesh = meshOf(parts, 'pine')
  mesh.rotation.y = rng.float(0, Math.PI * 2)
  return mesh
}

/** Cột đá sơn môn, có viên linh châu phát sáng trên đỉnh (để kiểm tra bloom). */
export function buildStonePillar(rng: Rng, height = 4.2): Group {
  const group = new Group()
  group.name = 'stonePillar'

  const parts: BufferGeometry[] = []
  const shaft = new CylinderGeometry(height * 0.1, height * 0.13, height, 6)
  parts.push(paint(at(shaft, 0, height * 0.5, 0), Palette.da))

  const base = new CylinderGeometry(height * 0.19, height * 0.22, height * 0.1, 6)
  parts.push(paint(at(base, 0, height * 0.05, 0), Palette.daDam))

  const cap = new CylinderGeometry(height * 0.15, height * 0.11, height * 0.08, 6)
  parts.push(paint(at(cap, 0, height * 1.01, 0), Palette.daNhat))

  const stone = meshOf(parts, 'pillarStone')
  stone.rotation.y = rng.float(0, Math.PI * 2)
  group.add(stone)

  // Linh châu: material glow (toneMapped=false) nên vượt ngưỡng luminance của bloom
  const orb = new Mesh(new SphereGeometry(height * 0.075, 8, 6), materials.glow(Palette.linh))
  orb.position.y = height * 1.12
  orb.name = 'linhChau'
  group.add(orb)

  return group
}

/** Đài đá tròn — luyện võ trường / đài luyện đan. */
export function buildPlatform(radius = 7, height = 0.5): Mesh {
  const parts: BufferGeometry[] = []
  const base = new CylinderGeometry(radius, radius * 1.04, height, 12)
  parts.push(paint(at(base, 0, height * 0.5, 0), Palette.daDam))
  const top = new CylinderGeometry(radius * 0.94, radius * 0.94, height * 0.34, 12)
  parts.push(paint(at(top, 0, height * 1.05, 0), Palette.daNhat))

  const mesh = meshOf(parts, 'platform')
  mesh.castShadow = false // đài phẳng và sát đất, bóng của nó không đáng một lần vẽ
  return mesh
}

/** Vòng sáng đánh dấu vị trí chuột trên mặt đất. */
export function buildGroundMarker(radius = 0.6): Mesh {
  const geo = new RingGeometry(radius * 0.72, radius, 16)
  geo.rotateX(-Math.PI / 2)
  const mesh = new Mesh(geo, materials.glow(Palette.linh, 0.55))
  mesh.name = 'groundMarker'
  mesh.renderOrder = 5
  return mesh
}
