import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  SphereGeometry,
  TorusGeometry,
  type BufferGeometry,
} from 'three'
import { at, mergeAll, paint, spinY } from '@/art/geo'
import { Palette } from '@/art/Palette'
import { materials } from '@/render/Materials'
import { bambooSwordGeometry } from './swords'

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

/**
 * Mô hình trưng bày của một pháp bảo.
 *
 * Dựng ở tỉ lệ TRƯNG BÀY (cao khoảng 1 unit), không phải tỉ lệ trong trận: ở
 * Đồ Giám vật đứng một mình trên bệ xoay và người xem nhìn kỹ nó, còn trong
 * trận nó là một đốm bay qua trong ba phần mười giây. Hai chỗ đó cần hai kích
 * thước khác nhau, và dùng chung một hàm thì hoặc pháp bảo trong Đồ Giám bé như
 * hạt đậu, hoặc phi kiếm trong trận to bằng nửa nhân vật.
 */

/**
 * Tam Diễm Phiến — quạt ba nan lửa.
 *
 * Ba nan XOÈ RA từ một trục, mỗi nan một sắc lửa (đỏ than → cam → vàng): trong
 * nguyên tác quạt một cái ra hoả, hai cái ra phong hoả, ba cái thì lửa không
 * tắt được — nên ba tầng màu chính là ba tầng công dụng, đọc được ngay từ hình.
 */
export function buildTamDiemPhien(): Group {
  const group = new Group()
  group.name = 'tamDiemPhien'

  const parts: BufferGeometry[] = []

  // Trục quạt và tay cầm
  const handle = new CylinderGeometry(0.045, 0.055, 0.42, 6)
  parts.push(paint(at(handle, 0, -0.21, 0), Palette.than))
  const pommel = new SphereGeometry(0.062, 6, 5)
  parts.push(paint(at(pommel, 0, -0.44, 0), Palette.kim))
  const rivet = new CylinderGeometry(0.05, 0.05, 0.07, 6)
  rivet.rotateX(Math.PI / 2)
  parts.push(paint(at(rivet, 0, 0, 0), Palette.kim))

  // Bảy nan xương xoè thành nửa vòng, ba tầng màu chồng lên
  const SPAN = Math.PI * 0.82
  for (let i = 0; i < 7; i++) {
    const a = -SPAN / 2 + (i / 6) * SPAN
    const rib = new BoxGeometry(0.028, 0.78, 0.022)
    rib.translate(0, 0.39, 0)
    rib.rotateZ(-a)
    parts.push(paint(rib, Palette.than))
  }

  // Ba dải mặt quạt: bán kính lớn dần, màu nguội dần từ trong ra ngoài
  const bands: ReadonlyArray<[number, number, number]> = [
    [0.2, 0.42, Palette.vang],
    [0.42, 0.62, Palette.luaDan],
    [0.62, 0.8, Palette.hoa],
  ]
  for (const [inner, outer, color] of bands) {
    for (let i = 0; i < 12; i++) {
      const a = -SPAN / 2 + ((i + 0.5) / 12) * SPAN
      const seg = new BoxGeometry(((outer - inner) * SPAN) / 12 + 0.03, outer - inner, 0.012)
      const mid = (inner + outer) / 2
      seg.translate(0, mid, 0)
      seg.rotateZ(-a)
      // Cắt bớt bề rộng ở gần trục để dải không chồng lên nhau thành khối đặc
      parts.push(paint(seg, color))
    }
  }

  group.add(meshOf(parts, 'tamDiemPhien:mesh'))

  // Ngọn lửa ở đầu ba nan ngoài cùng — mesh riêng vì cần material glow
  for (const side of [-1, 0, 1]) {
    const a = (side * SPAN) / 2.6
    const flame = new Mesh(new ConeGeometry(0.06, 0.19, 5), materials.glow(Palette.luaDan))
    flame.position.set(-Math.sin(a) * 0.86, Math.cos(a) * 0.86, 0)
    flame.rotation.z = -a
    group.add(flame)
  }
  return group
}

/**
 * Ngũ Hành Trận Kỳ — một lá trận kỳ cắm trên đất.
 *
 * Năm lá trong chiêu, nhưng Đồ Giám trưng MỘT: năm lá xếp cạnh nhau ở tỉ lệ
 * trưng bày thì mỗi lá chỉ còn vài pixel, và người xem không thấy được thứ đáng
 * thấy — hoa văn trên mặt cờ.
 */
export function buildTranKy(): Group {
  const group = new Group()
  group.name = 'tranKy'

  const parts: BufferGeometry[] = []
  const pole = new CylinderGeometry(0.022, 0.028, 1.1, 6)
  parts.push(paint(at(pole, 0, 0.55, 0), Palette.than))
  const spike = new ConeGeometry(0.035, 0.14, 5)
  spike.rotateX(Math.PI)
  parts.push(paint(at(spike, 0, -0.05, 0), Palette.kim))
  const finial = new SphereGeometry(0.045, 6, 5)
  parts.push(paint(at(finial, 0, 1.13, 0), Palette.kim))

  // Mặt cờ: ba tấm lệch nhau một chút để đọc ra là VẢI đang bay, không phải
  // một tấm ván. Lệch theo cả Z và góc xoay, vì lệch một trục thì nó chỉ ra
  // một cái bậc thang.
  const cloth: ReadonlyArray<[number, number, number, number]> = [
    [0.16, 0.86, 0.0, Palette.aoMaDao],
    [0.15, 0.78, 0.05, Palette.dauCung],
    [0.14, 0.7, -0.04, Palette.dauCungDam],
  ]
  cloth.forEach(([w, y, tilt, color], i) => {
    const flag = new BoxGeometry(0.44, w, 0.014)
    flag.rotateZ(tilt)
    parts.push(paint(at(flag, 0.24, y, i * 0.012), color))
  })

  // Hoa văn ngũ hành: năm chấm trên mặt cờ
  for (let i = 0; i < 5; i++) {
    const dot = new BoxGeometry(0.05, 0.05, 0.01)
    const colors = [Palette.kim, Palette.moc, Palette.thuy, Palette.hoa, Palette.tho]
    parts.push(paint(at(dot, 0.1 + i * 0.07, 0.86, 0.04), colors[i] as number))
  }

  group.add(meshOf(parts, 'tranKy:mesh'))
  return group
}

/**
 * Thiên Lôi Trúc — gốc trúc kim lôi, NGUYÊN LIỆU luyện Thanh Trúc Phong Vân Kiếm.
 *
 * Không phải một chiêu thức, và đó chính là điều đáng nói: sáu gốc trúc vạn niên
 * này là thứ Hàn Lập nuôi bằng nước lục trong Chưởng Thiên Bình suốt hai mươi
 * năm, rồi mới có 72 thanh phi kiếm. Một entry của Đồ Giám, không phải một ô
 * trên thanh pháp thuật.
 */
export function buildThienLoiTruc(): Group {
  const group = new Group()
  group.name = 'thienLoiTruc'

  const parts: BufferGeometry[] = []
  // Ba gốc cao thấp khác nhau — một gốc đơn độc trông như một cây gậy
  const stalks: ReadonlyArray<[number, number, number]> = [
    [0, 1.25, 0.052],
    [-0.19, 0.98, 0.044],
    [0.17, 1.1, 0.046],
  ]
  for (const [x, height, r] of stalks) {
    const nodes = Math.round(height / 0.24)
    for (let i = 0; i < nodes; i++) {
      const segH = height / nodes
      const seg = new CylinderGeometry(r, r * 1.04, segH * 0.86, 7)
      parts.push(paint(at(seg, x, segH * (i + 0.5), 0), Palette.tre))
      // Đốt trúc ánh kim — đây là chỗ "kim lôi" hiện ra, và cũng là thứ tách nó
      // khỏi bụi trúc thường ở rìa bản đồ
      const knot = new CylinderGeometry(r * 1.22, r * 1.22, segH * 0.1, 7)
      parts.push(paint(at(knot, x, segH * (i + 1), 0), Palette.kim))
    }
    // Lá: hai phiến chéo ở ngọn
    for (const side of [-1, 1]) {
      const leaf = new BoxGeometry(0.3, 0.014, 0.07)
      leaf.rotateZ(side * 0.42)
      parts.push(paint(at(leaf, x + side * 0.15, height - 0.06, 0.02), Palette.laTungNhat))
    }
  }

  // Đất và đá dưới gốc — không có thì ba cây trúc lơ lửng
  const soil = new CylinderGeometry(0.36, 0.42, 0.1, 10)
  parts.push(paint(at(soil, 0, 0.05, 0), Palette.datDam))

  group.add(meshOf(parts, 'thienLoiTruc:mesh'))

  // Tia lôi vấn quanh thân — vòng nhỏ phát sáng, xếp lệch cao độ
  for (let i = 0; i < 3; i++) {
    const ring = new Mesh(new TorusGeometry(0.11, 0.012, 3, 10), materials.glow(Palette.loi))
    ring.rotation.x = Math.PI / 2
    ring.rotation.z = i * 0.7
    ring.position.set(0, 0.42 + i * 0.3, 0)
    group.add(ring)
  }
  return group
}

/**
 * Chưởng Thiên Bình — cái bình xanh bí ẩn.
 *
 * Vật quan trọng nhất đời Hàn Lập và cũng là vật KHÔNG đánh nhau: nước lục
 * trong bình thúc linh thảo chín sớm hàng chục lần. Cả bộ pháp bảo về sau đều
 * mọc ra từ nó, nên nó phải có mặt trong Đồ Giám dù không có ô nào trên thanh
 * pháp thuật.
 */
export function buildChuongThienBinh(): Group {
  const group = new Group()
  group.name = 'chuongThienBinh'

  const parts: BufferGeometry[] = []
  const body = new SphereGeometry(0.34, 9, 7)
  body.scale(1, 1.12, 1)
  parts.push(paint(at(body, 0, 0.42, 0), Palette.linhDam))

  const shoulder = new CylinderGeometry(0.15, 0.28, 0.16, 9)
  parts.push(paint(at(shoulder, 0, 0.76, 0), Palette.linhDam))
  const neck = new CylinderGeometry(0.09, 0.12, 0.16, 8)
  parts.push(paint(at(neck, 0, 0.9, 0), Palette.moc))
  const lip = new CylinderGeometry(0.12, 0.1, 0.05, 8)
  parts.push(paint(at(lip, 0, 1, 0), Palette.kim))

  const foot = new CylinderGeometry(0.2, 0.24, 0.07, 9)
  parts.push(paint(at(foot, 0, 0.06, 0), Palette.laTung))

  // Bốn vòng khắc quanh bụng bình
  for (let i = 0; i < 4; i++) {
    const band = new TorusGeometry(0.33 - i * 0.015, 0.012, 3, 12)
    band.rotateX(Math.PI / 2)
    parts.push(paint(at(band, 0, 0.28 + i * 0.14, 0), Palette.laTung))
  }

  group.add(meshOf(parts, 'chuongThienBinh:mesh'))

  // Giọt nước lục lơ lửng trên miệng bình — thứ duy nhất phát sáng
  const drop = new Mesh(new IcosahedronGeometry(0.075, 0), materials.glow(Palette.linh))
  drop.position.y = 1.22
  drop.name = 'chuongThienBinh:luc'
  group.add(drop)
  return group
}

/**
 * Thực Kim Trùng — một con trùng ăn kim khí, phóng to để nhìn rõ.
 *
 * Trong trận nó là một đám bụi vàng lướt qua; ở đây nó phải là một CON VẬT, vì
 * đó mới là thứ giải thích tại sao chiêu này gặm mòn thay vì nổ.
 */
export function buildThucKimTrung(): Group {
  const group = new Group()
  group.name = 'thucKimTrung'

  const parts: BufferGeometry[] = []
  // Thân ba đốt, thon dần
  const segs: ReadonlyArray<[number, number, number]> = [
    [-0.3, 0.2, Palette.kim],
    [0, 0.24, Palette.vang],
    [0.32, 0.19, Palette.kim],
  ]
  for (const [z, r, color] of segs) {
    const seg = new SphereGeometry(r, 7, 5)
    seg.scale(0.85, 0.72, 1.05)
    parts.push(paint(at(seg, 0, 0.24, z), color))
  }

  // Càng: hai lưỡi kìm chìa ra trước — đây là chỗ đọc ra "nó cắn thủng pháp khí"
  for (const side of [-1, 1]) {
    const claw = new ConeGeometry(0.05, 0.28, 4)
    claw.rotateX(Math.PI / 2)
    claw.rotateY(side * 0.34)
    parts.push(paint(at(claw, side * 0.09, 0.25, 0.62), Palette.daNhat))
  }

  // Sáu chân
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const leg = new CylinderGeometry(0.018, 0.014, 0.24, 4)
      leg.rotateZ(side * 0.85)
      parts.push(paint(at(leg, side * 0.2, 0.14, -0.24 + i * 0.28), Palette.than))
    }
  }

  // Cánh cứng gập trên lưng
  for (const side of [-1, 1]) {
    const wing = new BoxGeometry(0.16, 0.03, 0.42)
    wing.rotateZ(side * 0.2)
    parts.push(paint(at(wing, side * 0.1, 0.4, 0.02), Palette.doc))
  }

  group.add(meshOf(parts, 'thucKimTrung:mesh'))

  // Hai mắt phát sáng
  for (const side of [-1, 1]) {
    const eye = new Mesh(new SphereGeometry(0.038, 5, 4), materials.glow(Palette.hoa))
    eye.position.set(side * 0.1, 0.3, 0.44)
    group.add(eye)
  }
  return group
}

/**
 * Thanh Trúc Phong Vân Kiếm — cụm trưng bày.
 *
 * Mười hai thanh dựng thành một vòng đứng, đúng MỘT BỘ CƠ SỞ của pháp bảo này.
 * Không dựng cả 72: ở tỉ lệ trưng bày thì 72 thanh chồng lên nhau thành một khối
 * xanh đặc, và con số ấy đã được nói bằng chữ ở thẻ mô tả rồi. Mười hai thanh
 * thì đếm được bằng mắt — mà đếm được mới là điều làm nó đáng nhìn.
 */
export function buildKiemTrucBo(): Group {
  const group = new Group()
  group.name = 'kiemTrucBo'

  // Hai vòng sáu thanh thay vì một vòng mười hai: một vòng đơn nhìn từ góc iso
  // thì sáu thanh phía sau bị sáu thanh phía trước che gần hết, nên đếm ra
  // khoảng bảy. Hai vòng lệch cao độ và lệch pha nửa bước thì thanh nào cũng có
  // một khe để lộ ra, và con số mười hai đếm được bằng mắt.
  const geo = bambooSwordGeometry()
  const material = propMaterial()
  for (let ring = 0; ring < 2; ring++) {
    const radius = 0.3 + ring * 0.12
    const y = 0.14 + ring * 0.2
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + ring * (Math.PI / 6)
      const sword = new Mesh(geo, material)
      sword.position.set(Math.cos(a) * radius, y, Math.sin(a) * radius)
      // Thứ tự Euler phải là YXZ, không phải XYZ mặc định.
      //
      // Geometry hướng mũi về +Z. Muốn mũi CHĨA LÊN và hơi ngả ra ngoài thì
      // phải ngửa quanh X trước rồi mới quay quanh Y để về chỗ ngồi — tức Y là
      // phép quay NGOÀI CÙNG. Với thứ tự XYZ mặc định thì Y nằm trong, và kết
      // quả là mười hai thanh nằm ngang xoè ra như nan hoa bánh xe.
      sword.rotation.order = 'YXZ'
      sword.rotation.set(-Math.PI / 2 + 0.3, a, 0)
      sword.scale.setScalar(0.46)
      sword.castShadow = true
      group.add(sword)
    }
  }

  const coreParts: BufferGeometry[] = []
  const base = new CylinderGeometry(0.14, 0.19, 0.06, 10)
  coreParts.push(paint(at(base, 0, 0.03, 0), Palette.daDam))
  group.add(meshOf(coreParts, 'kiemTrucBo:de'))

  const core = new Mesh(new IcosahedronGeometry(0.085, 0), materials.glow(Palette.moc))
  core.position.y = 0.3
  group.add(core)
  return group
}

/**
 * Bệ trưng bày của Đồ Giám — đài đá bát giác có vòng linh quang.
 *
 * Bát giác chứ không tròn: mặt cắt phẳng bắt sáng khác nhau nên bệ tự có khối,
 * còn một hình trụ tròn lowpoly dưới ánh sáng đều thì đọc ra là một cái đĩa
 * xám. Và nó QUAY, nên các cạnh chạy qua chính là thứ nói cho mắt biết vật đang
 * xoay chứ không phải đứng yên.
 */
export function buildCodexPedestal(radius = 1.15): Group {
  const group = new Group()
  group.name = 'codexPedestal'

  // Bệ THẤP và NGUỘI màu. Bản đầu dùng `themDa` (đá thềm, ngả kem) cho mặt bệ,
  // và dưới nắng vàng của bộ stylized nó ra một cái đĩa CAM to hơn cả vật đứng
  // trên nó — tức cái bệ giành mất chỗ của thứ nó phải tôn lên. Đá xám nguội
  // thì nó lùi hẳn về sau và mắt đi thẳng tới mô hình.
  const parts: BufferGeometry[] = []
  const plinth = new CylinderGeometry(radius * 1.12, radius * 1.24, 0.1, 8)
  parts.push(paint(at(plinth, 0, -0.38, 0), Palette.daDam))
  const waist = new CylinderGeometry(radius * 0.84, radius * 1.02, 0.2, 8)
  parts.push(paint(at(waist, 0, -0.23, 0), Palette.daDam))
  const top = new CylinderGeometry(radius, radius * 0.9, 0.1, 8)
  parts.push(paint(at(top, 0, -0.08, 0), Palette.da))

  // Tám khắc trên mặt bệ
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    const notch = new BoxGeometry(radius * 0.5, 0.03, 0.06)
    parts.push(paint(at(spinY(notch, -a), 0, -0.022, 0), Palette.daNhat))
  }

  group.add(meshOf(parts, 'codexPedestal:mesh'))

  const halo = new Mesh(new TorusGeometry(radius * 1.04, 0.022, 4, 32), materials.glow(Palette.linh, 0.45))
  halo.rotation.x = Math.PI / 2
  halo.position.y = -0.02
  group.add(halo)
  return group
}
