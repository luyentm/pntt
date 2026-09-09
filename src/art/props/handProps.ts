import { BoxGeometry, Group, Mesh, type BufferGeometry } from 'three'
import { at, mergeAll, paint } from '@/art/geo'
import { Palette } from '@/art/Palette'
import { materials } from '@/render/Materials'
import { projectileGeometry } from '@/vfx/projectileGeometry'
import { buildTamDiemPhien, buildTranKy } from './treasures'

/**
 * Pháp bảo CẦM TRÊN TAY trong lúc thi triển.
 *
 * Khác hẳn mô hình trưng bày cùng tên trong `treasures.ts`, và khác ở đúng một
 * điều: kích thước. Bàn tay chibi rộng khoảng 0,086 unit, còn cây quạt trưng
 * bày cao 1,7 — cầm nguyên bản thì Hàn Lập vác một cây quạt to gấp rưỡi người.
 *
 * Nhưng KHÔNG dựng lại hình: mọi thứ ở đây gọi đúng hàm của bản trưng bày rồi
 * bọc vào một `Group` để thu nhỏ và xoay. Dựng bản thứ hai thì đổi màu nan quạt
 * ở Đồ Giám mà quạt trong tay vẫn màu cũ, và không có gì báo.
 *
 * Xoay ở đây tính theo hệ của XƯƠNG BÀN TAY: cánh tay buông xuôi nên trục -Y
 * của xương chỉ xuống đất, +Z chỉ ra trước mặt nhân vật.
 */

/** Một mục: dựng hình, rồi đặt tỉ lệ và góc cho vừa nắm tay. */
interface HandProp {
  build: () => Group
  scale: number
  /** Xoay trong hệ toạ độ của xương bàn tay, radian. */
  rot: readonly [number, number, number]
  /** Dịch so với tâm bàn tay. */
  pos: readonly [number, number, number]
}

/** Lá phù: một tờ giấy vàng kẹp giữa hai ngón, dựng đứng. */
function buildPhuLuc(): Group {
  const group = new Group()
  group.name = 'phuLuc:tay'
  const mesh = new Mesh(
    projectileGeometry('phuLuc'),
    materials.flat(0xffffff, { vertexColors: true }),
  )
  group.add(mesh)
  return group
}

/** Phi kiếm hạ phẩm: thanh kiếm thường, cầm ngược mũi ra trước. */
function buildPhiKiem(): Group {
  const group = new Group()
  group.name = 'phiKiem:tay'
  const mesh = new Mesh(
    projectileGeometry('kiem'),
    materials.flat(0xffffff, { vertexColors: true }),
  )
  group.add(mesh)
  return group
}

/**
 * Đàn trùng: một nhúm đốm vàng lơ lửng trên lòng bàn tay.
 *
 * Không dựng con trùng của Đồ Giám thu nhỏ: ở cỡ nắm tay thì một con trùng có
 * càng và sáu chân ra đúng một chấm nâu, còn cả đàn thì đọc được ngay. Đây là
 * chỗ duy nhất bản cầm tay KHÁC hình bản trưng bày, và nó khác vì hai bản trả
 * lời hai câu hỏi khác nhau — "con trùng đó trông thế nào" và "hắn vừa thả cái
 * gì ra".
 */
function buildDanTrung(): Group {
  const group = new Group()
  group.name = 'thucKimTrung:tay'
  const parts: BufferGeometry[] = []
  const seats: ReadonlyArray<readonly [number, number, number]> = [
    [0, 0, 0],
    [0.09, 0.05, 0.03],
    [-0.07, 0.04, -0.04],
    [0.03, 0.1, -0.06],
    [-0.05, 0.11, 0.05],
  ]
  for (const [x, y, z] of seats) {
    const bug = new BoxGeometry(0.05, 0.03, 0.07)
    parts.push(paint(at(bug, x, y, z), Palette.kim))
  }
  group.add(new Mesh(mergeAll(parts), materials.flat(0xffffff, { vertexColors: true })))
  return group
}

/**
 * Chiêu nào cầm gì.
 *
 * Chỉ những chiêu có VẬT THẬT mới có mặt ở đây. Hoả Cầu Thuật, Canh Kim Kiếm
 * Khí, Thái Ất Thanh Sơn Quyết đều là pháp lực thuần — nhét một vật vào tay
 * chúng là nói sai về chính hạng của chiêu, thứ mà thẻ giới thiệu vừa ghi rõ
 * ngay bên dưới màn hình.
 */
const HAND_PROPS: Record<string, HandProp> = {
  nguKiem: { build: buildPhiKiem, scale: 0.42, rot: [1.35, 0, 0], pos: [0, -0.02, 0.03] },
  thienLoiPhu: { build: buildPhuLuc, scale: 0.34, rot: [1.5, 0, 0.3], pos: [0, -0.03, 0.02] },
  bangPhongPhu: { build: buildPhuLuc, scale: 0.34, rot: [1.5, 0, 0.3], pos: [0, -0.03, 0.02] },
  thucKimTrung: { build: buildDanTrung, scale: 0.55, rot: [0, 0, 0], pos: [0, -0.06, 0.02] },
  // Trận kỳ cầm dốc ngược, mũi cắm chúc xuống — đúng tư thế sắp cắm xuống đất
  nguHanhTranKy: { build: buildTranKy, scale: 0.26, rot: [0.3, 0, 2.7], pos: [0, -0.05, 0.03] },
  // Quạt xoè ngang trước mặt: đây là chiêu diện rộng, và mặt quạt hướng ra
  // trước thì cú quạt đọc ra là đẩy về phía địch
  tamDiemPhien: { build: buildTamDiemPhien, scale: 0.2, rot: [1.2, 0, -0.35], pos: [0, -0.05, 0.05] },
}

export function hasHandProp(skillId: string): boolean {
  return skillId in HAND_PROPS
}

/**
 * Dựng pháp bảo cầm tay của một chiêu. Ném lỗi nếu chiêu đó không có.
 *
 * Ném chứ không trả `null`: bên gọi đã phải hỏi `hasHandProp` trước, nên tới
 * được đây mà không có mục thì đó là lỗi lập trình, không phải một trạng thái
 * hợp lệ cần xử lý.
 */
export function buildHandProp(skillId: string): Group {
  const def = HAND_PROPS[skillId]
  if (!def) throw new Error(`Không có pháp bảo cầm tay cho chiêu "${skillId}"`)
  const holder = new Group()
  holder.name = `tay:${skillId}`
  const inner = def.build()
  inner.scale.setScalar(def.scale)
  inner.rotation.set(...(def.rot as [number, number, number]))
  inner.position.set(...(def.pos as [number, number, number]))
  holder.add(inner)
  return holder
}

/** Danh sách chiêu có pháp bảo cầm tay — test đọc để kiểm id có thật. */
export const HAND_PROP_IDS: readonly string[] = Object.keys(HAND_PROPS)
