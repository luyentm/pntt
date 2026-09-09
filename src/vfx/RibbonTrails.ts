import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  type ColorRepresentation,
  type PerspectiveCamera,
} from 'three'
import { Palette } from '@/art/Palette'

/**
 * Số vệt tối đa cùng tồn tại.
 *
 * Rộng vì dải ribbon giờ là phương tiện chính của MỌI hiệu ứng, không chỉ vệt
 * đuôi: Thanh Trúc Phong Vân Kiếm một mình đã cần 33 ô, cộng vệt người chơi,
 * cả đàn phi hành khí (tới ~12 ô), và mỗi cú đánh trúng / vụ nổ / pháp vực lại
 * bắn ra một chùm 4–10 nan hoa. Hồ chật thì `pick()` bắt đầu cắt vệt ĐANG BÁM —
 * mà cắt vệt đang bám thì nó mất đột ngột giữa đường, chứ không tan.
 *
 * Con số này ĐO ĐƯỢC, không chọn bừa, và đã phải nâng hai lần:
 *
 *  - 64 → 128 khi đàn kiếm còn 33 thanh. Lúc nặng nhất — 33 kiếm + vệt chạy +
 *    hai vụ nổ + một pháp vực — đếm được 96 vệt cùng sống, tức đã bão hoà hạn
 *    mức cũ và các nét một lần bắt đầu bị cắt sớm.
 *  - 128 → 192 khi đàn kiếm lên đủ 72 thanh (xem `SWORD_CAPACITY`). Đo ở Luyện
 *    Kiếm Đài đúng lúc PHÁT LẠI chiêu: 128/128 ô đang sống, trong đó 56 ô là vệt
 *    của lượt trước đang tan. Phát lại thả cả 72 chỗ ngồi rồi lập tức xin 72 chỗ
 *    mới, nên nhu cầu tức thời chạm 144 — vượt hạn mức, và `pick()` phải cắt.
 *    `pick()` luôn hy sinh vệt ĐANG TAN trước nên thứ tự là đúng, nhưng cắt một
 *    vệt đang tan vẫn đọc ra là nó biến mất chứ không phải nó tan.
 *
 * Chi phí của việc để rộng gần bằng không: hình học được cấp sẵn toàn bộ, và ô
 * không dùng bị gộp về một điểm nên tam giác của nó có diện tích 0 — GPU không
 * tô pixel nào, chỉ chạy đỉnh. 192 ô là 6912 đỉnh và 6528 tam giác, trên một
 * khung Luyện Kiếm Đài đo được 41.804 tam giác / 234 draw call.
 */
export const TRAIL_CAPACITY = 192
/** Số điểm xương sống của một vệt. Nhiều hơn = vệt dài và mượt hơn, tốn hơn. */
export const TRAIL_SEGMENTS = 18

const CAPACITY = TRAIL_CAPACITY
const SEGMENTS = TRAIL_SEGMENTS
const VERTS_PER_TRAIL = SEGMENTS * 2

/**
 * Một vệt.
 *
 * `spine` xếp ĐẦU TRƯỚC: điểm 0 là chỗ vật thể đang ở, điểm cuối là chỗ vệt tan.
 * Nhờ vậy chỉ số điểm cũng chính là "tuổi" của nó, nên gradient màu, độ mờ và
 * bề rộng đều suy được từ chỉ số mà không cần lưu thêm gì.
 */
interface Trail {
  active: boolean
  /** Đã thả: không nhận điểm mới nữa, đang tan dần. */
  released: boolean
  /** Đếm thế hệ — chống dùng lại handle của một vệt đã bị thu hồi. */
  gen: number
  /** Thời gian kể từ lúc thả. */
  fadeAge: number
  /** Tổng thời gian sống, dùng để chọn vệt cũ nhất khi hết chỗ. */
  age: number
  fade: number
  width: number
  opacity: number
  step: number
  /** Số điểm xương sống vệt này được dùng, 2..SEGMENTS. */
  points: number
  head: Color
  tail: Color
  /** Số điểm xương sống đã ghi (≤ SEGMENTS). */
  count: number
  spine: Float32Array
}

export interface TrailOptions {
  /** Màu ở ĐẦU vệt — chỗ vật thể đang ở. Mặc định vàng kim. */
  head?: ColorRepresentation
  /** Màu ở ĐUÔI vệt — chỗ nó tan. Mặc định lam lục linh khí. */
  tail?: ColorRepresentation
  /** Nửa bề rộng ở đầu vệt, world unit. */
  width?: number
  /** Độ chói lúc đầy, 0..1. */
  opacity?: number
  /** Thời gian tan sau khi thả, giây. */
  fade?: number
  /**
   * Khoảng cách tối thiểu giữa hai điểm xương sống, world unit.
   *
   * Cùng với `points`, đây là cái quyết định vệt DÀI bao nhiêu. Để quá nhỏ thì
   * đứng yên lắc nhẹ cũng đủ đẩy hết điểm cũ ra và vệt teo về một cục ngay dưới
   * chân.
   *
   * Nó là giãn cách TỐI THIỂU, không phải giãn cách thật. Vật thể đi nhanh hơn
   * `step` trong một khung thì khung nào cũng chốt, và giãn cách thật hoá thành
   * quãng-đi-một-khung — tức là chiều dài vệt phụ thuộc fps. Nên với vật thể đi
   * nhanh, hãy đặt `step` ≥ quãng nó đi trong một khung ở 60fps; lúc đó ở fps
   * cao hơn nó chỉ chốt thưa hơn và chiều dài giữ nguyên.
   */
  step?: number
  /**
   * Số điểm xương sống vệt này được dùng, 2..`TRAIL_SEGMENTS`. Mặc định dùng hết.
   *
   * Đây là cách làm vệt NGẮN đúng đắn. Hạ `step` thì KHÔNG ngắn được vệt của
   * vật thể đi nhanh, vì `step` chỉ là giãn cách tối thiểu (xem trên) — 33 kiếm
   * trúc quay 0,26 unit mỗi khung, nên dù đặt `step` 0,13 thì vệt vẫn dài
   * 16 × 0,26 = 4,2 unit và ba vòng kiếm khép lại thành ba vòng tròn liền.
   */
  points?: number
}

/** Handle rỗng — `feed`/`release` với nó là không làm gì. */
export const NO_TRAIL = 0

/**
 * Vệt đuôi dạng dải (ribbon) bám theo chuyển động.
 *
 * ## Vì sao một mesh cho tất cả
 *
 * `SlashArcLayer` cho mỗi vệt một `Mesh` + `Material` riêng vì nó cần alpha
 * riêng để mờ dần độc lập, và hồ chỉ 10 phần tử. Cách đó không dùng lại được ở
 * đây: vệt bám theo chuyển động thì mỗi ĐIỂM trên vệt phải có độ mờ và bề rộng
 * khác nhau, không phải mỗi vệt. Nên toàn bộ 28 vệt nằm trong MỘT
 * `BufferGeometry` với màu theo đỉnh dạng RGBA, và cả lớp tốn đúng một draw
 * call. Alpha theo đỉnh chỉ hoạt động khi thuộc tính `color` có `itemSize === 4`
 * — three bật `USE_COLOR_ALPHA` dựa vào đúng điều kiện đó.
 *
 * ## Vì sao dải phải quay theo camera
 *
 * Bề rộng của dải được dựng theo `cross(tiếp tuyến, hướng nhìn)`, nên mặt dải
 * luôn hướng về camera. Nếu cố định trục bề rộng (ví dụ luôn theo +Y) thì ở góc
 * iso xoay được, vệt sẽ biến thành một đường chỉ khi camera nhìn dọc theo trục
 * đó — mà camera game này xoay được 360°.
 *
 * `side: DoubleSide` là bắt buộc, không phải cho chắc: chiều quấn của tam giác
 * đảo khi tiếp tuyến đổi phía so với camera, và `FrontSide` sẽ cull đúng những
 * đoạn đó — ra một vệt đứt quãng nham nhở.
 */
export class RibbonTrailLayer {
  readonly group = new Group()
  private readonly trails: Trail[] = []
  private readonly geometry = new BufferGeometry()
  private readonly material: MeshBasicMaterial
  private readonly mesh: Mesh
  private readonly positions: Float32Array
  private readonly colors: Float32Array
  private readonly posAttr: BufferAttribute
  private readonly colAttr: BufferAttribute
  private generation = 1
  /** Bộ đệm cho `strokePath`, tránh cấp phát mỗi lần gọi. */
  private readonly pathBuffer = new Float32Array(SEGMENTS * 3)

  constructor() {
    this.group.name = 'vfx:trails'

    this.positions = new Float32Array(CAPACITY * VERTS_PER_TRAIL * 3)
    this.colors = new Float32Array(CAPACITY * VERTS_PER_TRAIL * 4)
    this.posAttr = new BufferAttribute(this.positions, 3)
    this.colAttr = new BufferAttribute(this.colors, 4)
    this.posAttr.setUsage(35048) // DynamicDrawUsage
    this.colAttr.setUsage(35048)
    this.geometry.setAttribute('position', this.posAttr)
    this.geometry.setAttribute('color', this.colAttr)

    // Chỉ số dựng MỘT LẦN: cách nối đỉnh không bao giờ đổi, chỉ toạ độ đổi
    const indices: number[] = []
    for (let t = 0; t < CAPACITY; t++) {
      const base = t * VERTS_PER_TRAIL
      for (let i = 0; i < SEGMENTS - 1; i++) {
        const a = base + i * 2
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
      }
    }
    this.geometry.setIndex(indices)

    this.material = new MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false, // giữ nguyên độ chói để bloom bắt được đầu vệt
    })

    this.mesh = new Mesh(this.geometry, this.material)
    // Toạ độ là world-space và đổi mỗi frame, nên bao lồi tự tính luôn sai
    this.mesh.frustumCulled = false
    this.mesh.castShadow = false
    this.mesh.receiveShadow = false
    this.mesh.renderOrder = 9 // trên vệt chém (8) để đầu vệt không bị lẫn
    // Đặt tên để test tra theo TÊN chứ không theo chỉ số con: chỉ số đổi ngay
    // khi thêm một mesh nữa vào lớp, và test sẽ âm thầm đo sai đối tượng
    this.mesh.name = 'vfx:trails:mesh'
    this.group.add(this.mesh)

    for (let i = 0; i < CAPACITY; i++) {
      this.trails.push({
        active: false,
        released: false,
        gen: 0,
        fadeAge: 0,
        age: 0,
        fade: 0.3,
        width: 0.1,
        opacity: 0.9,
        step: 0.16,
        points: SEGMENTS,
        head: new Color(Palette.vetVang),
        tail: new Color(Palette.vetLuc),
        count: 0,
        spine: new Float32Array(SEGMENTS * 3),
      })
    }
    this.collapseAll()
  }

  /**
   * Bắt đầu một vệt và trả về handle để `feed` mỗi frame.
   *
   * Không tự tan: phải `release` khi chủ thể ngừng chuyển động hoặc biến mất,
   * không thì nó chiếm một chỗ trong hồ vĩnh viễn.
   */
  attach(options: TrailOptions = {}): number {
    const index = this.pick()
    const t = this.trails[index]!
    t.active = true
    t.released = false
    t.gen = this.generation++
    t.fadeAge = 0
    t.age = 0
    t.count = 0
    t.head.set(options.head ?? Palette.vetVang)
    t.tail.set(options.tail ?? Palette.vetLuc)
    t.width = options.width ?? 0.11
    t.opacity = options.opacity ?? 0.85
    t.fade = options.fade ?? 0.3
    t.step = options.step ?? 0.16
    t.points = Math.max(2, Math.min(SEGMENTS, Math.round(options.points ?? SEGMENTS)))
    return this.pack(index, t.gen)
  }

  /**
   * Đẩy vị trí hiện tại của đầu vệt. Gọi mỗi frame trong lúc chủ thể còn sống.
   *
   * ## Điểm 0 là đầu SỐNG, điểm 1 mới là mốc
   *
   * Điểm 0 luôn bị ghi lại bằng vị trí hiện tại, mỗi lần gọi. Phải vậy: nếu chỉ
   * ghi điểm khi đi đủ một `step` thì đầu vệt tụt lại sau vật thể tới `step`
   * unit và trông như dải bị đứt khỏi thanh kiếm.
   *
   * Hệ quả là khoảng cách phải đo với ĐIỂM 1 — điểm đã chốt gần nhất — chứ
   * không với điểm 0. Bản đầu đo với điểm 0 và vệt không bao giờ dài ra: mốc so
   * sánh bị ghi lại cùng lúc với đầu vệt, nên phép đo luôn chỉ ra quãng đi được
   * trong MỘT khung hình (khoảng 0.07 unit ở tốc độ chạy) chứ không phải quãng
   * đi từ lần chốt trước. Nó không lỗi ầm ĩ — chỉ là vệt teo về một điểm dưới
   * chân và mắt đọc ra là "hiệu ứng không chạy".
   *
   * Điểm mới được chốt vào ĐÚNG vị trí hiện tại, nên ở khung có chốt thì điểm 1
   * trùng khít điểm 0 và đoạn đầu dải dài 0 — coi như mất một trong 18 điểm ở
   * chỗ mũi vệt. Cách chốt vị trí của khung TRƯỚC thì dùng hết 18 điểm, nhưng
   * nó làm nhịp chốt phụ thuộc fps: mốc lùi lại một khung nên điều kiện đủ bước
   * được thoả sớm hơn, và giãn cách thật hoá thành `step − quãng-đi-một-khung`.
   * Đổi một điểm ở mũi vệt để lấy chiều dài không đổi theo fps là đáng.
   */
  feed(handle: number, x: number, y: number, z: number): void {
    const t = this.resolve(handle)
    if (!t || t.released) return
    const s = t.spine

    if (t.count === 0) {
      // Điểm 0 là đầu sống, điểm 1 là mốc đầu tiên — cùng chỗ, nên khung này
      // dải còn suy biến và không thấy gì. Đúng như mong đợi: chưa đi thì chưa
      // có vệt.
      s[0] = x
      s[1] = y
      s[2] = z
      s[3] = x
      s[4] = y
      s[5] = z
      t.count = 2
      return
    }

    const dx = x - s[3]!
    const dy = y - s[4]!
    const dz = z - s[5]!
    if (dx * dx + dy * dy + dz * dz >= t.step * t.step) {
      // Đủ xa mốc thì đẩy toàn bộ các điểm đã chốt ra sau một chỗ, rồi chốt
      // điểm mới vào vị trí 1. copyWithin xử lý đúng phần chồng lấn nên không
      // cần bộ đệm tạm.
      s.copyWithin(6, 3, (SEGMENTS - 1) * 3)
      s[3] = x
      s[4] = y
      s[5] = z
      if (t.count < t.points) t.count++
    }
    s[0] = x
    s[1] = y
    s[2] = z
  }

  /** Thả vệt: nó ngừng nhận điểm mới và tan trong `fade` giây. */
  release(handle: number): void {
    const t = this.resolve(handle)
    if (!t || t.released) return
    t.released = true
    t.fadeAge = 0
  }

  /** Handle này còn trỏ tới một vệt đang nhận điểm không. */
  isLive(handle: number): boolean {
    const t = this.resolve(handle)
    return !!t && !t.released
  }

  /**
   * Vệt dùng một lần theo một đường cho trước — dùng cho cú lướt, vệt chém.
   *
   * `points` là mảng phẳng `[x,y,z, x,y,z, ...]`, phần tử đầu là ĐẦU vệt. Đường
   * được lấy mẫu lại về đúng `SEGMENTS` điểm nên truyền bao nhiêu điểm cũng được.
   */
  strokePath(points: ArrayLike<number>, count: number, options: TrailOptions = {}): void {
    if (count < 2) return
    const handle = this.attach(options)
    const t = this.resolve(handle)!
    const s = t.spine
    for (let i = 0; i < t.points; i++) {
      // Lấy mẫu lại tuyến tính: u chạy 0..1 trên đường gốc
      const u = (i / (t.points - 1)) * (count - 1)
      const i0 = Math.min(count - 1, Math.floor(u))
      const i1 = Math.min(count - 1, i0 + 1)
      const f = u - i0
      for (let k = 0; k < 3; k++) {
        const a = points[i0 * 3 + k]!
        const b = points[i1 * 3 + k]!
        s[i * 3 + k] = a + (b - a) * f
      }
    }
    t.count = t.points
    t.released = true
  }

  /** Vệt thẳng một lần từ điểm đầu tới điểm cuối. */
  strokeLine(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    options: TrailOptions = {},
  ): void {
    const p = this.pathBuffer
    p[0] = x1
    p[1] = y1
    p[2] = z1
    p[3] = x0
    p[4] = y0
    p[5] = z0
    this.strokePath(p, 2, options)
  }

  /**
   * Vệt cung một lần — vết lưỡi kiếm quét qua.
   *
   * `flip` đảo chiều quét. Combo ba nhát nên đảo chiều xen kẽ: ba nhát quét cùng
   * một phía đọc ra là ba lần lặp một động tác, đảo chiều mới ra "combo".
   */
  strokeArc(
    x: number,
    y: number,
    z: number,
    facing: number,
    radius: number,
    halfAngle: number,
    flip: boolean,
    options: TrailOptions = {},
  ): void {
    const p = this.pathBuffer
    const n = SEGMENTS
    for (let i = 0; i < n; i++) {
      // i = 0 là ĐẦU vệt, tức là chỗ lưỡi kiếm vừa tới
      const u = i / (n - 1)
      const a = facing + (flip ? -1 : 1) * (halfAngle - u * halfAngle * 2)
      // Hơi nhấc lên ở đầu cung: lưỡi kiếm đi theo đường vòng, không nằm bệt
      p[i * 3] = x + Math.sin(a) * radius
      p[i * 3 + 1] = y + Math.sin(u * Math.PI) * radius * 0.12
      p[i * 3 + 2] = z + Math.cos(a) * radius
    }
    this.strokePath(p, n, options)
  }

  /**
   * Vệt xoắn ốc đi LÊN — linh khí cuộn quanh người lúc lên tầng, đột phá, lên khiên.
   *
   * Đầu vệt ở ĐỈNH xoắn và bán kính thóp lại ở trên, nên nó đọc ra là "đang
   * cuộn lên và tụ vào" chứ không phải "đang rơi xuống và loe ra". Cùng một
   * đường xoắn mà đảo hai thứ đó là ra hiệu ứng ngược nghĩa hẳn.
   *
   * `phase` để nhiều vệt xoắn cùng lúc không trùng khít nhau.
   */
  strokeSpiral(
    x: number,
    y: number,
    z: number,
    radius: number,
    height: number,
    turns: number,
    phase: number,
    options: TrailOptions = {},
  ): void {
    const p = this.pathBuffer
    const n = SEGMENTS
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1)
      const a = phase + (1 - u) * turns * Math.PI * 2
      const r = radius * (0.35 + 0.65 * u)
      p[i * 3] = x + Math.cos(a) * r
      p[i * 3 + 1] = y + height * (1 - u)
      p[i * 3 + 2] = z + Math.sin(a) * r
    }
    this.strokePath(p, n, options)
  }

  update(dt: number, camera: PerspectiveCamera): void {
    const cx = camera.position.x
    const cy = camera.position.y
    const cz = camera.position.z
    let anyActive = false

    for (let ti = 0; ti < this.trails.length; ti++) {
      const t = this.trails[ti]!
      if (!t.active) continue
      t.age += dt

      if (t.released) {
        t.fadeAge += dt
        if (t.fadeAge >= t.fade) {
          t.active = false
          this.collapse(ti)
          continue
        }
      }
      // Chưa đủ hai điểm thì chưa có dải nào để dựng
      if (t.count < 2) {
        this.collapse(ti)
        anyActive = true
        continue
      }

      const fadeOut = t.released ? 1 - t.fadeAge / t.fade : 1
      this.writeTrail(ti, t, fadeOut, cx, cy, cz)
      anyActive = true
    }

    if (anyActive) {
      this.posAttr.needsUpdate = true
      this.colAttr.needsUpdate = true
    }
  }

  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
  }

  // ───────────────────────────────────────────────────────────────────────────

  /** Ghi toạ độ và màu của một vệt vào bộ đệm dùng chung. */
  private writeTrail(
    index: number,
    t: Trail,
    fadeOut: number,
    cx: number,
    cy: number,
    cz: number,
  ): void {
    const pos = this.positions
    const col = this.colors
    const s = t.spine
    // Các điểm ngoài `points` bị gộp hết về điểm cuối, thành tam giác diện tích
    // 0 — vệt ngắn không tốn một pixel nào cho phần nó không dùng
    const used = Math.min(t.count, t.points)
    const last = used - 1
    const base = index * VERTS_PER_TRAIL
    // Bề rộng co lại khi tan, nhưng chậm hơn độ mờ: vệt mảnh dần rồi mới mất
    const widthScale = 0.35 + 0.65 * fadeOut
    const hr = t.head.r
    const hg = t.head.g
    const hb = t.head.b
    const tr = t.tail.r
    const tg = t.tail.g
    const tb = t.tail.b

    for (let i = 0; i < SEGMENTS; i++) {
      // Các điểm chưa có dữ liệu bị gộp vào điểm cuối, thành tam giác suy biến
      // (diện tích 0) nên GPU không tô một pixel nào cho chúng
      const si = Math.min(i, last)
      const px = s[si * 3]!
      const py = s[si * 3 + 1]!
      const pz = s[si * 3 + 2]!

      // Tiếp tuyến bằng sai phân trung tâm, kẹp ở hai đầu
      const ai = Math.max(0, si - 1)
      const bi = Math.min(last, si + 1)
      let tx = s[bi * 3]! - s[ai * 3]!
      let ty = s[bi * 3 + 1]! - s[ai * 3 + 1]!
      let tz = s[bi * 3 + 2]! - s[ai * 3 + 2]!
      let tl = Math.hypot(tx, ty, tz)
      if (tl < 1e-6) {
        tx = 0
        ty = 0
        tz = 1
        tl = 1
      }
      tx /= tl
      ty /= tl
      tz /= tl

      // Hướng nhìn từ điểm này tới camera
      let vx = cx - px
      let vy = cy - py
      let vz = cz - pz
      const vl = Math.hypot(vx, vy, vz) || 1
      vx /= vl
      vy /= vl
      vz /= vl

      // Trục bề rộng = tiếp tuyến × hướng nhìn, nên mặt dải luôn quay ra camera
      let sx = ty * vz - tz * vy
      let sy = tz * vx - tx * vz
      let sz = tx * vy - ty * vx
      let sl = Math.hypot(sx, sy, sz)
      if (sl < 1e-4) {
        // Nhìn dọc theo vệt: lấy trục ngang bất kỳ vuông góc với tiếp tuyến
        sx = -tz
        sy = 0
        sz = tx
        sl = Math.hypot(sx, sy, sz) || 1
      }
      sx /= sl
      sy /= sl
      sz /= sl

      // u = 0 ở đầu vệt, 1 ở đuôi. Thóp về đuôi là thứ làm nó đọc ra "vệt" chứ
      // không phải "cái ống": mắt đọc bề rộng thu hẹp thành hướng chuyển động.
      const u = last > 0 ? Math.min(1, i / last) : 1
      const w = t.width * (1 - u) ** 0.65 * widthScale
      const o = base + i * 2
      const p0 = o * 3
      const p1 = (o + 1) * 3
      pos[p0] = px - sx * w
      pos[p0 + 1] = py - sy * w
      pos[p0 + 2] = pz - sz * w
      pos[p1] = px + sx * w
      pos[p1 + 1] = py + sy * w
      pos[p1 + 2] = pz + sz * w

      const r = hr + (tr - hr) * u
      const g = hg + (tg - hg) * u
      const b = hb + (tb - hb) * u
      const a = t.opacity * (1 - u) ** 1.4 * fadeOut
      const c0 = o * 4
      const c1 = (o + 1) * 4
      col[c0] = r
      col[c0 + 1] = g
      col[c0 + 2] = b
      col[c0 + 3] = a
      col[c1] = r
      col[c1 + 1] = g
      col[c1 + 2] = b
      col[c1 + 3] = a
    }
  }

  /** Dồn một vệt về một điểm ngoài tầm nhìn và tắt alpha. */
  private collapse(index: number): void {
    const base = index * VERTS_PER_TRAIL
    for (let i = 0; i < VERTS_PER_TRAIL; i++) {
      const p = (base + i) * 3
      this.positions[p] = 0
      this.positions[p + 1] = -999
      this.positions[p + 2] = 0
      this.colors[(base + i) * 4 + 3] = 0
    }
    this.posAttr.needsUpdate = true
    this.colAttr.needsUpdate = true
  }

  private collapseAll(): void {
    for (let i = 0; i < CAPACITY; i++) this.collapse(i)
  }

  /**
   * Chọn chỗ cho một vệt mới.
   *
   * Ưu tiên chỗ trống; hết chỗ thì lấy vệt ĐANG TAN cũ nhất — nó gần mất rồi nên
   * cắt đi ít bị để ý nhất. Chỉ khi mọi vệt đều đang bám theo chủ thể mới cắt
   * cái cũ nhất, và lúc đó vệt bị cắt sẽ mất đột ngột.
   */
  private pick(): number {
    let oldestReleased = -1
    let oldestReleasedAge = -1
    let oldest = 0
    let oldestAge = -1
    for (let i = 0; i < this.trails.length; i++) {
      const t = this.trails[i]!
      if (!t.active) return i
      if (t.released && t.fadeAge > oldestReleasedAge) {
        oldestReleasedAge = t.fadeAge
        oldestReleased = i
      }
      if (t.age > oldestAge) {
        oldestAge = t.age
        oldest = i
      }
    }
    return oldestReleased >= 0 ? oldestReleased : oldest
  }

  private pack(index: number, gen: number): number {
    return index + 1 + gen * CAPACITY
  }

  private resolve(handle: number): Trail | null {
    if (handle <= 0) return null
    const index = (handle - 1) % CAPACITY
    const gen = Math.floor((handle - 1) / CAPACITY)
    const t = this.trails[index]
    if (!t || !t.active || t.gen !== gen) return null
    return t
  }
}
