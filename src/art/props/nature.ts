import {
  CylinderGeometry,
  DodecahedronGeometry,
  IcosahedronGeometry,
  Mesh,
  RingGeometry,
  type BufferGeometry,
} from 'three'
import { at, mergeAll, paint } from '@/art/geo'
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
  // Vòng MẢNH và mờ: đây là con trỏ, nó phải chỉ được chỗ đang ngắm mà không
  // giành sự chú ý với nhân vật và quái
  const geo = new RingGeometry(radius * 0.88, radius, 20)
  geo.rotateX(-Math.PI / 2)
  const mesh = new Mesh(geo, materials.glow(Palette.linh, 0.34))
  mesh.name = 'groundMarker'
  mesh.renderOrder = 5
  return mesh
}
