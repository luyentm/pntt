import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  SphereGeometry,
  TorusGeometry,
  type BufferGeometry,
} from 'three'
import { at, mergeAll, paint, spinY } from '@/art/geo'
import { Palette } from '@/art/Palette'
import type { Rng } from '@/core/Rng'
import { materials } from '@/render/Materials'

/** Material dùng chung cho mọi kiến trúc đã gộp vertex-color. */
function stoneMaterial() {
  return materials.flat(0xffffff, { vertexColors: true })
}

function meshOf(parts: BufferGeometry[], name: string, castShadow = true): Mesh {
  const mesh = new Mesh(mergeAll(parts), stoneMaterial())
  mesh.name = name
  mesh.castShadow = castShadow
  mesh.receiveShadow = true
  return mesh
}

/** Cột đá sơn môn, có viên linh châu phát sáng trên đỉnh. */
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

  // Linh châu: material glow (toneMapped = false) nên vượt ngưỡng luminance của bloom
  const orb = new Mesh(new SphereGeometry(height * 0.075, 8, 6), materials.glow(Palette.linh))
  orb.position.y = height * 1.12
  orb.name = 'linhChau'
  group.add(orb)

  return group
}

/**
 * Đèn đá — thắp bằng linh hoả.
 *
 * Cấu trúc kinh điển của đèn đá: bệ, thân, hộp đèn, mái, chóp. Tách phần lõi
 * sáng ra mesh riêng vì nó cần material glow (toneMapped = false) để bloom bắt được.
 */
export function buildStoneLantern(height = 1.5): Group {
  const group = new Group()
  group.name = 'stoneLantern'

  const parts: BufferGeometry[] = []
  const base = new CylinderGeometry(height * 0.15, height * 0.19, height * 0.1, 6)
  parts.push(paint(at(base, 0, height * 0.05, 0), Palette.daDam))

  const shaft = new CylinderGeometry(height * 0.06, height * 0.08, height * 0.42, 6)
  parts.push(paint(at(shaft, 0, height * 0.31, 0), Palette.da))

  const tray = new CylinderGeometry(height * 0.15, height * 0.11, height * 0.06, 6)
  parts.push(paint(at(tray, 0, height * 0.55, 0), Palette.daNhat))

  // Hộp đèn: 4 trụ ở góc, chừa 4 khe hở cho ánh sáng lọt ra
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    const post = new BoxGeometry(height * 0.035, height * 0.17, height * 0.035)
    parts.push(
      paint(at(post, Math.cos(a) * height * 0.1, height * 0.67, Math.sin(a) * height * 0.1), Palette.da),
    )
  }

  const roof = new CylinderGeometry(height * 0.04, height * 0.21, height * 0.13, 6)
  parts.push(paint(at(roof, 0, height * 0.82, 0), Palette.daDam))

  const finial = new SphereGeometry(height * 0.045, 6, 4)
  parts.push(paint(at(finial, 0, height * 0.91, 0), Palette.daNhat))

  group.add(meshOf(parts, 'lanternStone'))

  const flame = new Mesh(
    new SphereGeometry(height * 0.07, 6, 5),
    materials.glow(Palette.nangSom),
  )
  flame.scale.set(1, 1.35, 1)
  flame.position.y = height * 0.67
  flame.name = 'linhHoa'
  group.add(flame)

  return group
}

/**
 * Cổng phái (kiểu tam quan / bài phường).
 * Đây là prop định danh cả bản đồ: thấy cổng là biết đang ở cửa sơn môn.
 */
export function buildSectGate(width = 6, height = 5): Group {
  const group = new Group()
  group.name = 'sectGate'

  const parts: BufferGeometry[] = []
  const halfW = width / 2

  for (const side of [-1, 1]) {
    const plinth = new BoxGeometry(0.9, 0.42, 0.9)
    parts.push(paint(at(plinth, side * halfW, 0.21, 0), Palette.daDam))

    const pillar = new CylinderGeometry(0.26, 0.31, height * 0.82, 8)
    parts.push(paint(at(pillar, side * halfW, 0.42 + height * 0.41, 0), Palette.than))

    // Đấu củng đỡ mái
    const bracket = new BoxGeometry(0.66, 0.15, 0.46)
    parts.push(paint(at(bracket, side * halfW, height * 0.83, 0), Palette.thanNhat))
  }

  // Thanh ngang trên và dưới
  const lintel = new BoxGeometry(width + 1.1, 0.28, 0.4)
  parts.push(paint(at(lintel, 0, height * 0.88, 0), Palette.than))

  const lowerBeam = new BoxGeometry(width - 0.2, 0.18, 0.28)
  parts.push(paint(at(lowerBeam, 0, height * 0.63, 0), Palette.thanNhat))

  // Biển đề tên phái — treo giữa hai thanh ngang
  const plaque = new BoxGeometry(width * 0.5, height * 0.2, 0.14)
  parts.push(paint(at(plaque, 0, height * 0.755, 0.22), Palette.daiLung))
  const plaqueTrim = new BoxGeometry(width * 0.55, height * 0.24, 0.09)
  parts.push(paint(at(plaqueTrim, 0, height * 0.755, 0.17), Palette.kim))

  // Mái: HAI TẤM DỐC chụm vào một sống nóc, không phải một tấm hộp phẳng.
  //
  // Một hộp phẳng nằm ngang đọc ra là "tấm ván xanh", không phải mái. Chỉ cần
  // nghiêng hai tấm chụm lại là silhouette lập tức ra kiến trúc Trung Hoa — và
  // đây là prop định danh cả bản đồ nên chi tiết đó đáng làm.
  const eaveY = height * 0.99
  const roofW = width + 1.5

  for (const dir of [-1, 1]) {
    const slope = new BoxGeometry(roofW, 0.15, 1.05)
    slope.rotateX(dir * 0.44)
    parts.push(paint(at(slope, 0, eaveY + 0.1, dir * 0.4), Palette.laTung))
  }

  const ridge = new BoxGeometry(roofW * 0.66, 0.16, 0.34)
  parts.push(paint(at(ridge, 0, eaveY + 0.3, 0), Palette.laTungNhat))

  // Đầu mái vểnh lên — nét nhận biết rõ nhất của mái đình Trung Hoa
  for (const side of [-1, 1]) {
    const tip = new BoxGeometry(0.66, 0.14, 0.92)
    tip.rotateZ(side * -0.46)
    parts.push(paint(at(tip, side * (roofW * 0.5 + 0.12), eaveY + 0.26, 0), Palette.laTung))
  }

  group.add(meshOf(parts, 'gateBody'))
  return group
}

/**
 * Đài luyện đan — bệ đá với đỉnh đồng ba chân.
 * Sẽ là nơi mở bảng luyện đan ở M6, nên đặt ngay từ M2 để bố cục map không phải sửa.
 */
export function buildAlchemyAltar(): Group {
  const group = new Group()
  group.name = 'alchemyAltar'

  const parts: BufferGeometry[] = []

  const dais = new CylinderGeometry(1.5, 1.62, 0.24, 10)
  parts.push(paint(at(dais, 0, 0.12, 0), Palette.daDam))
  const daisTop = new CylinderGeometry(1.36, 1.36, 0.1, 10)
  parts.push(paint(at(daisTop, 0, 0.27, 0), Palette.daNhat))

  // Ba chân đỉnh
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2
    const leg = new CylinderGeometry(0.075, 0.055, 0.34, 5)
    parts.push(paint(at(leg, Math.cos(a) * 0.33, 0.49, Math.sin(a) * 0.33), Palette.kim))
  }

  const belly = new SphereGeometry(0.52, 9, 6, 0, Math.PI * 2, Math.PI * 0.32, Math.PI * 0.68)
  parts.push(paint(at(belly, 0, 0.98, 0), Palette.kim))

  const rimGeo = new TorusGeometry(0.5, 0.055, 5, 12)
  rimGeo.rotateX(Math.PI / 2)
  parts.push(paint(at(rimGeo, 0, 1.0, 0), Palette.daiLung))

  // Hai tai đỉnh
  for (const side of [-1, 1]) {
    const ear = new TorusGeometry(0.11, 0.035, 4, 8)
    parts.push(paint(at(spinY(ear, Math.PI / 2), side * 0.52, 1.06, 0), Palette.daiLung))
  }

  group.add(meshOf(parts, 'altarBody'))

  // Đan hoả trong đỉnh
  const fire = new Mesh(new SphereGeometry(0.34, 7, 5), materials.glow(Palette.hoa))
  fire.scale.set(1, 0.7, 1)
  fire.position.y = 1.0
  fire.name = 'danHoa'
  group.add(fire)

  return group
}
