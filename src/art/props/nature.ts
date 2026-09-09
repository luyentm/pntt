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
    const sub = new DodecahedronGeometry(radius * rng.float(0.28, 0.42), 0)
    const p = rng.onCircle()
    // Đặt sát vào trong (0.5 thay vì 0.8) để cả cụm nằm gọn dưới bán kính va chạm
    // 0.9·radius — nếu đá con chìa ra ngoài thì nhân vật sẽ lún vào phần hình học
    // mà bộ va chạm không biết tới
    parts.push(paint(at(sub, p.x * radius * 0.5, radius * 0.12, p.z * radius * 0.5), Palette.da))
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

/**
 * Sàn đá của luyện võ trường — PHẲNG và sát mặt đất.
 *
 * Cố tình không làm đài cao: một cái đài dày 0.5 unit tạo ra bậc mà nhân vật cao
 * 1.1 unit phải leo, và xử lý bậc đó đòi cả hệ thống độ cao/leo trèo. Sàn đá dán
 * xuống đất cho đúng cảm giác sơn môn mà không phát sinh gì.
 */
export function buildStoneFloor(radius = 6): Mesh {
  const parts: BufferGeometry[] = []

  // Ba đĩa lồng nhau, và THỨ TỰ ĐỘ CAO là điều duy nhất quan trọng ở đây:
  // cylinder có mặt trên KÍN, nên đĩa nào cao hơn sẽ che toàn bộ đĩa thấp hơn
  // nằm trong bán kính của nó — không chỉ hiện ra ở phần rìa như trực giác mách.
  // Vì vậy đĩa càng RỘNG thì phải càng THẤP.
  //   vành (rộng nhất, thấp nhất) < tấm sàn < vòng tâm (hẹp nhất, cao nhất)
  const rim = new CylinderGeometry(radius * 1.06, radius * 1.06, 0.05, 14)
  parts.push(paint(at(rim, 0, 0.012, 0), Palette.daDam))

  const slab = new CylinderGeometry(radius, radius, 0.06, 14)
  parts.push(paint(at(slab, 0, 0.022, 0), Palette.daNhat))

  // Vòng tròn giữa — tâm luyện võ, cũng là mốc để người chơi định vị
  const inner = new CylinderGeometry(radius * 0.34, radius * 0.34, 0.05, 12)
  parts.push(paint(at(inner, 0, 0.031, 0), Palette.da))

  const mesh = meshOf(parts, 'stoneFloor')
  mesh.castShadow = false // sàn phẳng sát đất, bóng của nó không đáng một lần vẽ
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
