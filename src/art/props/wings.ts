import {
  BoxGeometry,
  ConeGeometry,
  Group,
  Mesh,
  Vector3,
  type BufferGeometry,
} from 'three'
import { at, mergeAll, paint } from '@/art/geo'
import { Palette } from '@/art/Palette'
import { materials } from '@/render/Materials'

/**
 * Bảng lông cánh: [dài, rộng ở gốc, góc xoè (radian), độ chúc xuống, màu].
 *
 * Năm phiến, KHÔNG đều nhau. Phiến số hai dài nhất chứ không phải phiến đầu:
 * một dãy dài đều dặn đọc ra là cái lược, còn có một phiến trội hẳn lên thì cả
 * cánh có một ĐỈNH — và mắt bám vào đỉnh đó để đọc hướng cánh đang chỉ.
 *
 * Màu đi từ lam ngọc ở phiến trong ra tím điện ở phiến ngoài, đúng cặp màu vệt
 * của chiêu (`TRAIL_PHONG_LOI`). Hai chỗ nói cùng một điều thì lúc bay, vệt và
 * cánh trông như cùng một vật chứ không phải hai hiệu ứng chồng lên nhau.
 */
const FEATHERS: ReadonlyArray<readonly [number, number, number, number, number]> = [
  [0.48, 0.085, 0.26, -0.1, 0x3fb4d8],
  [0.6, 0.078, 0.08, -0.03, 0x358fd0],
  [0.55, 0.07, -0.1, 0.05, 0x3a6ec4],
  [0.43, 0.06, -0.28, 0.14, 0x424fb0],
  [0.31, 0.05, -0.46, 0.24, 0x4a3596],
]

/**
 * Bề rộng quạt lông đã phải THU LẠI một lần.
 *
 * Bản đầu xoè từ +0,42 tới -0,56 radian, tức gần 57° cho mỗi bên và cộng cả hai
 * bên là hơn 110° — ở góc nhìn từ sau lưng thì hai cánh khép lại thành một vòng
 * gần tròn quanh người, và mắt đọc ra một cái quạt xoè chứ không phải đôi cánh.
 * Cánh chim thật hẹp hơn nhiều so với trực giác: cái nói lên "cánh" là nó CHỈ
 * VỀ MỘT HƯỚNG, không phải nó phủ được bao nhiêu độ.
 */

/**
 * Vì sao dải màu này TỐI hơn hẳn cặp màu vệt của chính chiêu.
 *
 * Bản đầu lấy đúng màu vệt (0x9FF3FF → 0x7B3BD6) đắp lên lông cánh, và kết quả
 * là hai khối TRẮNG TINH hai bên người: lông cánh là bề mặt ĐƯỢC CHIẾU SÁNG, mà
 * nắng của bộ stylized mạnh 1,95 cộng hemisphere — một màu nền đã ở mức 0xF3
 * thì nhân lên là vượt trần và mọi facet biến mất, rồi bloom trùm nốt phần còn
 * lại. Vệt đuôi thì không bị: nó vẽ bằng phép cộng và không nhận ánh sáng nào.
 *
 * Nên ở đây màu nền phải là màu SAU KHI TRỪ ánh sáng đi, tức tối hơn cái mắt
 * cần thấy khoảng một bậc rưỡi. Phần chói giao cho hai thứ tự phát sáng: khớp
 * vai và hai tia lôi, cả hai dùng `materials.glow` nên chúng bloom còn lông
 * cánh thì giữ được khối.
 */

export interface PhongLoiSi {
  /** Node gắn vào xương thân. */
  root: Group
  /**
   * Nhịp cánh.
   *
   * `power` 0 = xếp hẳn (vô hình), 1 = xoè hết và vỗ mạnh. Bên gọi lerp giá trị
   * này nên cánh mọc ra và thu lại chứ không bật/tắt.
   */
  update(t: number, power: number): void
  /** Toạ độ world của đầu cánh — VFX bám vệt vào đây. `side` là -1 hoặc 1. */
  tipWorld(side: number, out: Vector3): Vector3
}

function wingMaterial() {
  return materials.flat(0xffffff, { vertexColors: true })
}

/**
 * Một tia lôi: chuỗi đoạn ngắn gấp khúc so le, chạy dọc trục X.
 *
 * Bản đầu là MỘT thanh thẳng, và một thanh thẳng phát sáng đọc ra là "tia
 * laser" chứ không phải "sét" — cái làm mắt nhận ra sét là những khúc GÃY ĐỘT
 * NGỘT, không phải độ sáng. Bốn khúc là đủ: ba thì chưa thành nhịp, sáu thì ở
 * cỡ này các khúc nhỏ hơn một pixel và tia lại thẳng trở lại.
 *
 * Gộp thành một geometry duy nhất nên cả tia vẫn là một draw call, y như thanh
 * thẳng nó thay thế.
 */
function boltGeometry(length: number): BufferGeometry {
  const STEPS = 4
  const seg = length / STEPS
  const parts: BufferGeometry[] = []
  let x = -length / 2
  let y = 0
  for (let i = 0; i < STEPS; i++) {
    const dy = (i % 2 === 0 ? 1 : -1) * seg * 0.34
    const len = Math.hypot(seg, dy)
    const piece = new BoxGeometry(len, 0.016, 0.016)
    piece.rotateZ(Math.atan2(dy, seg))
    piece.translate(x + seg / 2, y + dy / 2, 0)
    parts.push(piece)
    x += seg
    y += dy
  }
  return mergeAll(parts)
}

/**
 * Dựng MỘT bên cánh, mũi hướng ra +X và về sau (-Z).
 *
 * Mỗi phiến là một hộp vuốt nhọn: một `BoxGeometry` cho thân phiến và một
 * `ConeGeometry` cho mũi. Không dùng một hình nón dài cho cả phiến vì nón có
 * mặt cắt TRÒN, mà lông cánh phải BẸT — nhìn nghiêng nó gần như biến mất, và
 * chính sự chênh lệch giữa nhìn thẳng và nhìn nghiêng là thứ làm cú vỗ có lực.
 */
function buildOneWing(side: number): { group: Group; feathers: Group[]; tip: Group } {
  const group = new Group()
  group.name = side > 0 ? 'phongLoiSi:L' : 'phongLoiSi:R'
  const feathers: Group[] = []

  FEATHERS.forEach(([len, width, spread, droop, color], i) => {
    const pivot = new Group()
    pivot.name = `feather${i}`
    // Gốc phiến bám sát vai, mũi vươn ra ngoài và ra sau
    pivot.rotation.set(droop, spread * side, 0)
    group.add(pivot)

    const parts: BufferGeometry[] = []
    const shaft = new BoxGeometry(len * 0.78, width, 0.022)
    parts.push(paint(at(shaft, (side * len * 0.78) / 2, 0, 0), color))

    const tipGeo = new ConeGeometry(width * 0.52, len * 0.34, 3)
    tipGeo.rotateZ(side > 0 ? -Math.PI / 2 : Math.PI / 2)
    tipGeo.scale(1, 1, 0.42)
    parts.push(paint(at(tipGeo, side * (len * 0.78 + len * 0.17), 0, 0), color))

    // Sống lông: dải mảnh chạy dọc, màu đậm hơn — nó cho phiến một hướng, nếu
    // không thì mỗi phiến chỉ là một mảnh màu phẳng
    const rib = new BoxGeometry(len * 0.9, width * 0.22, 0.03)
    parts.push(paint(at(rib, (side * len * 0.9) / 2, 0, 0.004), Palette.dauCungDam))

    const mesh = new Mesh(mergeAll(parts), wingMaterial())
    mesh.castShadow = false
    pivot.add(mesh)
    feathers.push(pivot)
  })

  // Khớp vai cánh — hạt sáng nhỏ che chỗ năm phiến chụm lại.
  //
  // NHỎ và mờ hơn hẳn bản đầu (0,05 × 0,13 ở độ mờ 0,72). Ở cỡ đó, hai cái nón
  // glow hai bên vai bloom thành hai tam giác trắng to hơn cả cánh — chúng che
  // mất đúng thứ chúng sinh ra để nối vào. Vật phát sáng trong cảnh này phải
  // luôn là ĐIỂM NHẤN nhỏ nhất khung hình, không phải khối lớn nhất.
  const shoulder = new Mesh(
    new ConeGeometry(0.028, 0.075, 5),
    materials.glow(0x9ff3ff, 0.5),
  )
  shoulder.rotation.z = side > 0 ? -Math.PI / 2 : Math.PI / 2
  shoulder.position.x = side * 0.04
  group.add(shoulder)

  // Node rỗng ở đầu phiến dài nhất — chỗ VFX lấy toạ độ để thả vệt
  const tip = new Group()
  tip.name = 'tip'
  const [longest, , spread] = FEATHERS[1] as readonly [number, number, number, number, number]
  tip.position.set(side * longest * Math.cos(spread), 0, -longest * Math.sin(Math.abs(spread)))
  feathers[1]?.add(tip)

  return { group, feathers, tip }
}

/**
 * Phong Lôi Sí — đôi cánh phong lôi.
 *
 * Thân pháp mạnh nhất Hàn Lập có ở Nguyên Anh, và là chiêu DUY NHẤT trong bảng
 * mọc thêm hình lên người thi triển. Vì thế nó không thể chỉ là một cái vệt
 * sáng: người xem phải nhìn ra đôi cánh trước khi nhìn ra cú lướt.
 *
 * ## Ba quyết định về cách vỗ
 *
 * **Từng phiến LỆCH PHA nhau.** Cả năm phiến vỗ cùng nhịp thì cánh cứng như một
 * tấm ván bản lề. Lệch mỗi phiến một chút thì cú vỗ chạy từ trong ra ngoài
 * thành một làn sóng — đó là toàn bộ khác biệt giữa "cánh" và "cái quạt giấy".
 *
 * **Vỗ quanh trục Z là chính, trục Y là phụ.** Z là nâng lên hạ xuống (cái mắt
 * đọc là "đang bay"); Y là quét trước sau, và để nó lớn thì cánh trông như đang
 * bơi chứ không phải đang bay.
 *
 * **`power` nhân vào cả GÓC XOÈ lẫn TỈ LỆ.** Chỉ thu tỉ lệ thì lúc cánh nhỏ nó
 * vẫn xoè hết cỡ, nhìn ra một đôi cánh tí hon gắn trên lưng; thu cả góc xoè thì
 * nó cụp lại về sát lưng rồi mới biến mất — đọc ra là cánh đang xếp.
 */
export function buildPhongLoiSi(): PhongLoiSi {
  const root = new Group()
  root.name = 'phongLoiSi'
  root.visible = false

  const left = buildOneWing(1)
  const right = buildOneWing(-1)
  root.add(left.group, right.group)

  // Hai vệt lôi vắt ngang giữa hai cánh — thứ duy nhất nói "lôi", vì bản thân
  // lông cánh chỉ nói "phong"
  // Đặt RA SAU LƯNG (z âm): ở giữa hai bả vai thì thân người che kín chúng ở
  // mọi góc nhìn từ phía trước, tức chúng chỉ tồn tại trong mã nguồn.
  const arcs: Mesh[] = []
  for (let i = 0; i < 2; i++) {
    const arc = new Mesh(boltGeometry(0.62), materials.glow(Palette.loi, 0.85))
    arc.position.set(0, 0.12 - i * 0.22, -0.2 - i * 0.06)
    arc.rotation.z = i === 0 ? 0.26 : -0.34
    root.add(arc)
    arcs.push(arc)
  }

  const wings = [left, right]

  return {
    root,

    update(t: number, power: number): void {
      root.visible = power > 0.01
      if (!root.visible) return

      // Nhịp vỗ NHANH DẦN theo power: cánh vừa mọc thì đập chậm, mọc đủ thì đập
      // gấp. Một tần số cố định làm khoảnh khắc cánh hiện ra mất hết sức nặng.
      const beat = t * (9 + power * 5)

      for (const wing of wings) {
        const side = wing === left ? 1 : -1
        wing.group.scale.setScalar(0.35 + power * 0.65)

        wing.feathers.forEach((pivot, i) => {
          const [, , spread, droop] = FEATHERS[i] as readonly [
            number,
            number,
            number,
            number,
            number,
          ]
          // Phiến ngoài trễ hơn phiến trong — làn sóng chạy từ vai ra mũi cánh
          const phase = beat - i * 0.42
          const flap = Math.sin(phase) * (0.34 + i * 0.05) * power
          pivot.rotation.z = side * (flap + 0.12 * power)
          pivot.rotation.y = spread * side * power + Math.sin(phase * 0.5) * 0.06 * side
          pivot.rotation.x = droop * power + Math.cos(phase) * 0.05
        })
      }

      // Vệt lôi nhấp nháy lệch nhịp với cánh, và co giãn theo power
      arcs.forEach((arc, i) => {
        const flick = 0.5 + 0.5 * Math.sin(beat * 2.7 + i * 2.1)
        arc.scale.set(power * (0.6 + flick * 0.6), 1, 1)
        arc.rotation.y = Math.sin(beat * 0.8 + i) * 0.3
      })
    },

    tipWorld(side: number, out: Vector3): Vector3 {
      const wing = side > 0 ? left : right
      return wing.tip.getWorldPosition(out)
    },
  }
}
