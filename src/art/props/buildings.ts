import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  type BufferGeometry,
} from 'three'
import { at, mergeAll, paint } from '@/art/geo'
import { Palette } from '@/art/Palette'
import { materials } from '@/render/Materials'

/** Số đốt của mỗi mái dốc. 5 là đủ để đường cong đọc ra ở khoảng cách iso. */
const ROOF_SEGMENTS = 5

export interface HallParams {
  width: number
  depth: number
  /** Chiều cao thân nhà, chưa tính mái. */
  height: number
  /** Có mái hiên nhỏ trên cửa hay không. */
  porch?: boolean
  /** Có tầng gác nhỏ phía sau hay không. */
  upper?: boolean
}

/**
 * Một đốt mái: hộp dài theo +Z, nghiêng theo đoạn (dz, dy) và đặt ở trung điểm.
 *
 * Xoay quanh +X một góc θ thì +Z thành (0, −sinθ, cosθ). Muốn +Z trùng với
 * (dy, dz) đã chuẩn hoá thì −sinθ = dy/len và cosθ = dz/len, tức
 * θ = atan2(−dy, dz). Ghi lại vì dấu trừ đó rất dễ đặt sai và kết quả là mái
 * gập ngược lên trời.
 */
function roofSegment(
  width: number,
  thickness: number,
  z0: number,
  y0: number,
  z1: number,
  y1: number,
  color: number,
): BufferGeometry {
  const dz = z1 - z0
  const dy = y1 - y0
  const len = Math.hypot(dz, dy)
  const box = new BoxGeometry(width, thickness, len * 1.06)
  box.rotateX(Math.atan2(-dy, dz))
  return paint(at(box, 0, (y0 + y1) / 2, (z0 + z1) / 2), color)
}

/**
 * Mặt cắt mái kiểu Trung Hoa: dốc gắt ở sống nóc, thoải dần, rồi VỂNH LÊN ở diềm.
 *
 * @param u 0 ở sống nóc, 1 ở đầu diềm.
 * @returns độ hạ so với sống nóc (dương = thấp hơn).
 */
function roofProfile(u: number, drop: number, upturn: number): number {
  // u^1.45 cho mặt cắt LÕM — dốc gắt trên, thoải dưới. Dùng u tuyến tính thì ra
  // mái nhà kho, mất hẳn nét kiến trúc.
  const fall = drop * u ** 1.45
  // Đoạn vểnh chỉ ở 22% cuối, bình phương nên nó bẻ lên nhanh ở đúng đầu diềm
  const lift = u > 0.78 ? upturn * ((u - 0.78) / 0.22) ** 2 : 0
  return fall - lift
}

/** Một mái dốc: đủ đốt để thành đường cong, kèm diềm và đầu ngói. */
function slopeParts(
  width: number,
  run: number,
  ridgeY: number,
  drop: number,
  upturn: number,
  dir: 1 | -1,
): BufferGeometry[] {
  const parts: BufferGeometry[] = []

  for (let i = 0; i < ROOF_SEGMENTS; i++) {
    const u0 = i / ROOF_SEGMENTS
    const u1 = (i + 1) / ROOF_SEGMENTS
    const z0 = dir * run * u0
    const z1 = dir * run * u1
    const y0 = ridgeY - roofProfile(u0, drop, upturn)
    const y1 = ridgeY - roofProfile(u1, drop, upturn)
    // Đốt so le hai tông: ở khoảng cách iso thì từng viên ngói không đọc được,
    // nhưng các HÀNG ngói thì có — và so le màu là cách rẻ nhất để có hàng
    const color = i % 2 === 0 ? Palette.ngoi : Palette.ngoiDam
    parts.push(roofSegment(width, 0.13, z0, y0, z1, y1, color))
  }

  // Diềm mái: tấm dày ở mép ngoài, màu nhạt — nó là thứ tạo bóng đổ dưới hiên
  const eaveY = ridgeY - roofProfile(1, drop, upturn)
  const eave = new BoxGeometry(width + 0.1, 0.2, 0.28)
  parts.push(paint(at(eave, 0, eaveY + 0.02, dir * (run + 0.1)), Palette.diemMai))

  // Đầu ngói: các gờ dọc ở mép diềm. Đây là chi tiết đọc rõ nhất ở cỡ này.
  const tileCount = Math.max(3, Math.round(width / 0.42))
  for (let i = 0; i < tileCount; i++) {
    const t = (i + 0.5) / tileCount - 0.5
    const tile = new CylinderGeometry(0.075, 0.075, 0.26, 5, 1, false, 0, Math.PI)
    tile.rotateX(Math.PI / 2)
    parts.push(paint(at(tile, t * width, eaveY + 0.11, dir * (run + 0.08)), Palette.ngoiNhat))
  }

  return parts
}

/** Sống nóc kèm hai đầu bịt hình trụ — nét trên cùng của bóng ngoài. */
function ridgeParts(width: number, ridgeY: number): BufferGeometry[] {
  const parts: BufferGeometry[] = []
  const ridge = new BoxGeometry(width * 0.98, 0.2, 0.34)
  parts.push(paint(at(ridge, 0, ridgeY + 0.12, 0), Palette.ngoiNhat))
  const band = new BoxGeometry(width * 0.98, 0.09, 0.42)
  parts.push(paint(at(band, 0, ridgeY + 0.02, 0), Palette.diemMai))

  for (const side of [-1, 1]) {
    const cap = new CylinderGeometry(0.19, 0.19, 0.3, 6)
    cap.rotateZ(Math.PI / 2)
    parts.push(paint(at(cap, side * width * 0.5, ridgeY + 0.16, 0), Palette.dauCung))
    // Đuôi vểnh ở hai đầu sống nóc
    const tail = new BoxGeometry(0.34, 0.12, 0.24)
    tail.rotateZ(side * -0.5)
    parts.push(paint(at(tail, side * (width * 0.5 + 0.2), ridgeY + 0.3, 0), Palette.ngoiNhat))
  }
  return parts
}

/**
 * Nhà của Thất Huyền Môn.
 *
 * Toàn bộ sinh bằng code từ khối cơ bản + vertex color, như mọi prop khác — không
 * một file model nào. Bảng màu lấy theo kiến trúc Trung Hoa: ngói lưu ly xanh
 * lục, cột sơn đỏ, vách hồng đất, đấu củng sơn lam.
 *
 * Thứ tự ưu tiên chi tiết được chọn theo những gì ĐỌC ĐƯỢC ở góc iso khoảng
 * 20 unit: mái cong có đầu vểnh trước, rồi đến cột đỏ và đấu củng lam, rồi mới
 * tới cửa và cửa sổ. Hoa văn trên vách thì không làm — ở cỡ đó nó không chiếm
 * nổi một pixel.
 */
export function buildSectHall(params: HallParams): Group {
  const group = new Group()
  group.name = 'sectHall'
  const parts: BufferGeometry[] = []

  const { width, depth, height } = params
  const halfW = width / 2
  const halfD = depth / 2

  // --- Móng đá ---
  //
  // Cao và rộng hơn thân nhà. Nó vừa là bậc thềm trong ảnh mẫu, vừa che khe hở
  // khi nhà đặt trên địa hình gợn — đó là lý do thật để nó dày như vậy.
  const plinth = new BoxGeometry(width + 0.7, 0.46, depth + 0.7)
  parts.push(paint(at(plinth, 0, 0.23, 0), Palette.themDa))
  const plinthTop = new BoxGeometry(width + 0.4, 0.1, depth + 0.4)
  parts.push(paint(at(plinthTop, 0, 0.5, 0), Palette.daNhat))

  const baseY = 0.55

  // --- Vách ---
  const wall = new BoxGeometry(width - 0.5, height, depth - 0.5)
  parts.push(paint(at(wall, 0, baseY + height / 2, 0), Palette.vach))
  // Chân tường tối hơn: một dải đậm ở dưới làm nhà "đứng" trên móng
  const skirt = new BoxGeometry(width - 0.42, height * 0.18, depth - 0.42)
  parts.push(paint(at(skirt, 0, baseY + height * 0.09, 0), Palette.vachDam))

  // --- Cột góc sơn đỏ ---
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const post = new BoxGeometry(0.3, height + 0.12, 0.3)
      parts.push(paint(at(post, sx * halfW * 0.94, baseY + (height + 0.12) / 2, sz * halfD * 0.94), Palette.cotDo))
    }
  }
  // Thanh ngang trên đầu cột
  for (const sz of [-1, 1]) {
    const beam = new BoxGeometry(width + 0.1, 0.22, 0.26)
    parts.push(paint(at(beam, 0, baseY + height + 0.04, sz * halfD * 0.94), Palette.cotDoDam))
  }

  // --- Đấu củng sơn lam dưới mái ---
  const bracketCount = Math.max(3, Math.round(width / 0.9))
  for (let i = 0; i < bracketCount; i++) {
    const t = (i + 0.5) / bracketCount - 0.5
    for (const sz of [-1, 1]) {
      const bracket = new BoxGeometry(0.3, 0.26, 0.34)
      parts.push(paint(at(bracket, t * width, baseY + height + 0.24, sz * (halfD + 0.06)), Palette.dauCung))
      const shadow = new BoxGeometry(0.34, 0.09, 0.2)
      parts.push(paint(at(shadow, t * width, baseY + height + 0.1, sz * (halfD + 0.12)), Palette.dauCungDam))
    }
  }

  // --- Cửa chính ở mặt +Z ---
  const doorW = Math.min(1.3, width * 0.34)
  const doorH = Math.min(1.6, height * 0.62)
  const doorFrame = new BoxGeometry(doorW + 0.34, doorH + 0.24, 0.16)
  parts.push(paint(at(doorFrame, 0, baseY + doorH / 2, halfD - 0.2), Palette.cotDo))
  const door = new BoxGeometry(doorW, doorH, 0.12)
  parts.push(paint(at(door, 0, baseY + doorH / 2, halfD - 0.16), Palette.cuaGo))
  const knocker = new BoxGeometry(0.16, 0.16, 0.08)
  parts.push(paint(at(knocker, 0, baseY + doorH * 0.56, halfD - 0.1), Palette.kim))
  // Bậc thềm trước cửa
  for (let i = 0; i < 2; i++) {
    const step = new BoxGeometry(doorW + 0.5 - i * 0.16, 0.14, 0.3)
    parts.push(paint(at(step, 0, 0.5 - i * 0.14, halfD + 0.22 + i * 0.26), Palette.themDa))
  }

  // --- Cửa sổ hai bên cửa, và trên hai mặt hông ---
  const windowY = baseY + height * 0.62
  const windowSize = Math.min(0.78, width * 0.2)
  const windowSpots: Array<[number, number, number]> = [
    [-width * 0.3, windowY, halfD - 0.18],
    [width * 0.3, windowY, halfD - 0.18],
  ]
  for (const [wx, wy, wz] of windowSpots) {
    const frame = new BoxGeometry(windowSize + 0.16, windowSize + 0.16, 0.12)
    parts.push(paint(at(frame, wx, wy, wz), Palette.cotDo))
    const pane = new BoxGeometry(windowSize, windowSize, 0.08)
    // Giấy cửa sổ dùng material phát sáng riêng nên nó rực lên trong tối — xem
    // dưới, phần glowParts
    parts.push(paint(at(pane, wx, wy, wz + 0.03), Palette.vachDam))
  }

  // --- Mái ---
  const ridgeY = baseY + height + 0.5
  const run = halfD + 0.62
  const roofW = width + 0.85
  const drop = Math.max(0.8, height * 0.42)
  const upturn = drop * 0.3

  parts.push(...slopeParts(roofW, run, ridgeY, drop, upturn, 1))
  parts.push(...slopeParts(roofW, run, ridgeY, drop, upturn, -1))
  parts.push(...ridgeParts(roofW, ridgeY))

  // --- Mái hiên nhỏ trên cửa ---
  if (params.porch !== false) {
    const porchY = baseY + doorH + 0.5
    const porchRun = 0.62
    const porchW = doorW + 1.5
    parts.push(...slopeParts(porchW, porchRun, porchY, 0.34, 0.14, 1))
    // Hai cột hiên
    for (const sx of [-1, 1]) {
      const post = new BoxGeometry(0.18, porchY - 0.5, 0.18)
      parts.push(paint(at(post, sx * porchW * 0.42, 0.5 + (porchY - 0.5) / 2, halfD + porchRun * 0.72), Palette.cotDo))
    }
  }

  // --- Tầng gác nhỏ phía sau ---
  if (params.upper) {
    const upH = height * 0.6
    const upW = width * 0.64
    const upD = depth * 0.58
    const upY = baseY + height + 0.18
    const upRidgeY = upY + upH + 0.4
    const backZ = -halfD * 0.28

    // Dựng tầng gác ở gốc TOẠ ĐỘ RIÊNG rồi dịch cả khối về sau một lượt.
    // `slopeParts` và `ridgeParts` đều đặt hình quanh z = 0, nên nếu chỉ dịch
    // riêng cái hộp thân thì mái tầng gác nằm lệch hẳn ra trước — mất một lúc
    // mới thấy vì từ trên nhìn xuống nó vẫn "có mái".
    const upperParts: BufferGeometry[] = []
    upperParts.push(paint(new BoxGeometry(upW, upH, upD), Palette.vach))
    for (const part of upperParts) part.translate(0, upY + upH / 2, 0)

    const upperRoof: BufferGeometry[] = [
      ...slopeParts(upW + 0.65, upD / 2 + 0.45, upRidgeY, upH * 0.48, upH * 0.16, 1),
      ...slopeParts(upW + 0.65, upD / 2 + 0.45, upRidgeY, upH * 0.48, upH * 0.16, -1),
      ...ridgeParts(upW + 0.65, upRidgeY),
    ]

    for (const part of [...upperParts, ...upperRoof]) part.translate(0, 0, backZ)
    parts.push(...upperParts, ...upperRoof)
  }

  const body = new Mesh(mergeAll(parts), materials.flat(0xffffff, { vertexColors: true }))
  body.name = 'hallBody'
  body.castShadow = true
  body.receiveShadow = true
  group.add(body)

  // --- Giấy cửa sổ phát sáng ---
  //
  // Mesh RIÊNG với material glow, không gộp vào thân: nó phải bỏ qua tone mapping
  // để bloom bắt được, mà material của thân thì nhận sáng bình thường. Hai yêu
  // cầu đó không thể ở cùng một material.
  const glowParts: BufferGeometry[] = []
  for (const [wx, wy, wz] of windowSpots) {
    const pane = new BoxGeometry(windowSize * 0.82, windowSize * 0.82, 0.06)
    glowParts.push(paint(at(pane, wx, wy, wz + 0.07), Palette.cuaSo))
  }
  const glow = new Mesh(mergeAll(glowParts), materials.glow(0xffffff, 1, { vertexColors: true }))
  glow.name = 'hallWindows'
  group.add(glow)

  return group
}
