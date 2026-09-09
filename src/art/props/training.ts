import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
  type BufferGeometry,
} from 'three'
import { at, mergeAll, paint, spinY } from '@/art/geo'
import { Palette } from '@/art/Palette'
import { materials } from '@/render/Materials'

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

/** Một bia tập đã dựng: gốc để đặt vào thế giới, và thân để nghiêng khi trúng đòn. */
export interface TrainingProp {
  /** Node đặt vào thế giới. */
  root: Group
  /** Node xoay khi trúng đòn — tách khỏi gốc để chân vẫn cắm xuống đất. */
  body: Group
  /** Cao độ đỉnh, dùng đặt thanh máu và số sát thương. */
  height: number
}

/**
 * Mộc nhân — người gỗ luyện công.
 *
 * Thay cho quái ở Luyện Kiếm Đài. Cố tình giữ dáng NGƯỜI (thân, hai tay, một
 * đầu) chứ không phải một cái cột: hình người cho biết chiêu đang đánh vào đâu
 * — một khối trụ thì đòn chém ngang bụng và đòn giộng vào đầu trông y hệt nhau,
 * mà đó lại là thứ duy nhất bia tập cần nói.
 *
 * Nhưng KHÔNG có mặt, không mắt: thêm mắt vào là nó thành một sinh vật, và cả
 * lý do bỏ quái khỏi màn này biến mất.
 *
 * Thân tách khỏi gốc thành hai Group: đòn đánh làm thân nghiêng và rung, còn
 * chân đế vẫn cắm xuống sàn. Xoay chung một node thì cả cái đế nhấc lên khỏi
 * đá, và mắt đọc ra là một món đồ chơi bị đá đổ.
 */
export function buildMocNhan(height = 1.35): TrainingProp {
  const root = new Group()
  root.name = 'mocNhan'
  const body = new Group()
  body.name = 'mocNhan:body'
  root.add(body)

  // ── Đế đá: nằm ở GỐC, không theo thân ──
  const baseParts: BufferGeometry[] = []
  const plinth = new CylinderGeometry(height * 0.26, height * 0.31, height * 0.09, 8)
  baseParts.push(paint(at(plinth, 0, height * 0.045, 0), Palette.daDam))
  const collar = new CylinderGeometry(height * 0.15, height * 0.2, height * 0.05, 8)
  baseParts.push(paint(at(collar, 0, height * 0.108, 0), Palette.da))
  root.add(meshOf(baseParts, 'mocNhan:de'))

  // ── Thân gỗ ──
  const parts: BufferGeometry[] = []

  const post = new CylinderGeometry(height * 0.085, height * 0.1, height * 0.5, 7)
  parts.push(paint(at(post, 0, height * 0.34, 0), Palette.than))

  // Ngực: khối HỘP trên một trụ tròn. Mặt phẳng trước ngực là chỗ mắt đọc ra
  // hướng của bia, và nó cũng là mặt hứng đòn — trụ tròn thì không có hướng nào
  const chest = new BoxGeometry(height * 0.3, height * 0.28, height * 0.19)
  parts.push(paint(at(chest, 0, height * 0.72, 0), Palette.thanNhat))

  // Đai buộc ngang ngực — vệt màu duy nhất, để bia không thành một khối nâu đều
  const band = new BoxGeometry(height * 0.32, height * 0.045, height * 0.21)
  parts.push(paint(at(band, 0, height * 0.66, 0), Palette.daiLung))

  // Hai tay: chốt gỗ đâm xuyên, chìa đều hai bên
  for (const side of [-1, 1]) {
    const arm = new CylinderGeometry(height * 0.038, height * 0.034, height * 0.34, 5)
    arm.rotateZ(Math.PI / 2)
    parts.push(paint(at(arm, side * height * 0.29, height * 0.78, 0), Palette.than))
    const knob = new SphereGeometry(height * 0.048, 5, 4)
    parts.push(paint(at(knob, side * height * 0.45, height * 0.78, 0), Palette.thanNhat))
  }

  // Chốt trước ngực — cái "tay thứ ba" kinh điển của mộc nhân thung
  const stub = new CylinderGeometry(height * 0.035, height * 0.03, height * 0.2, 5)
  stub.rotateX(Math.PI / 2)
  parts.push(paint(at(stub, 0, height * 0.6, height * 0.16), Palette.than))

  // Đầu: khối tròn KHÔNG có mặt
  const head = new SphereGeometry(height * 0.115, 7, 5)
  head.scale(1, 0.92, 0.94)
  parts.push(paint(at(head, 0, height * 0.95, 0), Palette.thanNhat))

  body.add(meshOf(parts, 'mocNhan:than'))
  return { root, body, height: height * 1.05 }
}

/**
 * Bia đá khắc chữ — mục tiêu tầm xa.
 *
 * Khác mộc nhân ở chỗ nó CAO và DẸT, nên từ góc iso nó đọc ra là một tấm chắn
 * chứ không phải một người. Đó là cả lý do có hai loại bia: pháp vực và đòn
 * xuyên cần thứ để chặn lại, còn cận chiến cần thứ có dáng người.
 */
export function buildBiaDa(height = 1.9): TrainingProp {
  const root = new Group()
  root.name = 'biaDa'
  const body = new Group()
  body.name = 'biaDa:body'
  root.add(body)

  const baseParts: BufferGeometry[] = []
  const plinth = new BoxGeometry(height * 0.42, height * 0.09, height * 0.28)
  baseParts.push(paint(at(plinth, 0, height * 0.045, 0), Palette.daDam))
  root.add(meshOf(baseParts, 'biaDa:de'))

  const parts: BufferGeometry[] = []
  const slab = new BoxGeometry(height * 0.34, height * 0.78, height * 0.1)
  parts.push(paint(at(slab, 0, height * 0.47, 0), Palette.daNhat))

  // Chóp bo tròn — bia vuông góc trông như một viên gạch dựng đứng
  const crown = new CylinderGeometry(height * 0.17, height * 0.17, height * 0.1, 8, 1, false, 0, Math.PI)
  crown.rotateX(-Math.PI / 2)
  parts.push(paint(at(spinY(crown, Math.PI), 0, height * 0.86, 0), Palette.daNhat))

  // Ba vạch khắc: gợi chữ mà không cần texture, và cho bia một mặt TRƯỚC
  for (let i = 0; i < 3; i++) {
    const glyph = new BoxGeometry(height * 0.15, height * 0.035, height * 0.02)
    parts.push(paint(at(glyph, 0, height * (0.66 - i * 0.15), height * 0.055), Palette.da))
  }

  body.add(meshOf(parts, 'biaDa:than'))
  return { root, body, height: height * 0.95 }
}

/**
 * Luyện Kiếm Đài — đài đá tròn, nơi diễn thần thông.
 *
 * Bốn vòng đồng tâm và tám nan hoa chia đài thành tám cung. Không phải trang
 * trí: sân trống hoàn toàn thì mắt không có mốc nào để đo khoảng cách, nên
 * người xem không đọc ra được bán kính 3 của đàn kiếm khác bán kính 5,2 của
 * Thái Ất Thanh Sơn ở chỗ nào. Vòng khắc chính là cái thước đó.
 *
 * Thứ tự độ cao là điều duy nhất phải cẩn thận: cylinder có mặt trên KÍN nên
 * đĩa nào cao hơn che toàn bộ đĩa thấp hơn nằm trong bán kính của nó — không
 * chỉ ở phần rìa như trực giác mách. Vậy nên đĩa càng RỘNG thì phải càng THẤP.
 */
export function buildLuyenKiemDai(radius = 13): Mesh {
  const parts: BufferGeometry[] = []

  const rim = new CylinderGeometry(radius * 1.04, radius * 1.07, 0.34, 32)
  parts.push(paint(at(rim, 0, -0.16, 0), Palette.daDam))

  const slab = new CylinderGeometry(radius, radius, 0.3, 32)
  parts.push(paint(at(slab, 0, -0.13, 0), Palette.themDa))

  // Ba vòng khắc, mỗi vòng một sắc đá — thước đo bán kính của người xem
  const rings: ReadonlyArray<[number, number]> = [
    [0.72, Palette.daNhat],
    [0.46, Palette.da],
    [0.2, Palette.daNhat],
  ]
  rings.forEach(([frac, color], i) => {
    const ring = new CylinderGeometry(radius * frac, radius * frac, 0.05, 28)
    parts.push(paint(at(ring, 0, 0.028 + i * 0.004, 0), color))
  })

  // Tám nan hoa từ tâm ra vành — chia đài thành tám cung đều
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    const spoke = new BoxGeometry(radius * 0.94, 0.04, 0.1)
    parts.push(paint(at(spinY(spoke, -a), 0, 0.026, 0), Palette.da))
  }

  // Tâm đài — chỗ Hàn Lập đứng
  const core = new CylinderGeometry(radius * 0.09, radius * 0.09, 0.05, 16)
  parts.push(paint(at(core, 0, 0.046, 0), Palette.themDa))

  const mesh = new Mesh(mergeAll(parts), propMaterial())
  mesh.name = 'luyenKiemDai'
  // Đài dày 0.3 nên nó CÓ đổ bóng thật, khác với sàn đá dán xuống đất
  mesh.castShadow = false
  mesh.receiveShadow = true
  return mesh
}

/**
 * Vòng linh quang đánh dấu chỗ đặt bia — phát sáng, nằm sát mặt đài.
 *
 * Có để lúc bia bị đánh tan vẫn còn thấy chỗ nó vừa đứng, nên người xem đọc
 * được "chiêu vừa quét sạch vòng trong" thay vì "sân tự nhiên trống đi".
 */
export function buildTargetSocket(radius = 0.42): Mesh {
  const geo = new RingGeometry(radius * 0.78, radius, 14)
  geo.rotateX(-Math.PI / 2)
  const mesh = new Mesh(geo, materials.glow(Palette.linhDam, 0.3))
  mesh.name = 'targetSocket'
  mesh.renderOrder = 4
  return mesh
}

/**
 * Vòng đá lơ lửng quanh đài — dấu hiệu "đây không phải mặt đất thường".
 *
 * Luyện Kiếm Đài trong bản trình diễn không nằm trong sơn môn: nó là một chỗ
 * riêng, không quái, không nhặt đồ, không đợt sóng. Vành đá bay là cách nói
 * điều đó bằng hình mà không cần một dòng chữ nào.
 */
export function buildFloatingRing(radius = 15.5, count = 10): Group {
  const group = new Group()
  group.name = 'floatingRing'
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2
    const parts: BufferGeometry[] = []
    const slab = new BoxGeometry(1.5, 0.28, 0.9)
    parts.push(paint(slab, Palette.daDam))
    const cap = new BoxGeometry(1.1, 0.1, 0.62)
    parts.push(paint(at(cap, 0, 0.18, 0), Palette.da))
    const mesh = meshOf(parts, `floatSlab${i}`)
    mesh.position.set(Math.cos(a) * radius, 0.6 + Math.sin(i * 1.7) * 0.42, Math.sin(a) * radius)
    mesh.rotation.y = -a
    mesh.rotation.z = Math.sin(i * 2.3) * 0.09
    group.add(mesh)
  }
  return group
}

/**
 * Vòng linh khí ở rìa đài — một torus mảnh phát sáng.
 *
 * Đặt ở rìa chứ không ở tâm: ở tâm thì nó nằm ngay dưới chân nhân vật và tranh
 * chỗ với mọi hiệu ứng dưới chân, mà đó là chỗ đắt nhất trên màn hình.
 */
export function buildTerraceHalo(radius = 13.4): Mesh {
  const geo = new TorusGeometry(radius, 0.075, 4, 48)
  geo.rotateX(Math.PI / 2)
  const mesh = new Mesh(geo, materials.glow(Palette.linh, 0.42))
  mesh.name = 'terraceHalo'
  mesh.position.y = 0.06
  return mesh
}
