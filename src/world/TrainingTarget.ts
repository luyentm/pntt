import type { Group } from 'three'
import { buildBiaDa, buildMocNhan, type TrainingProp } from '@/art/props/training'
import type { RealmPosition } from '@/game/data/realms'
import { deriveStats, type BaseStats } from '@/game/Stats'
import { Combatant, type CombatantView } from './Combatant'

export type TargetKind = 'mocNhan' | 'biaDa'

/**
 * Chỉ số nền của bia tập.
 *
 * Phòng ngự bằng 0 và bạo kích bằng 0 là CỐ Ý: Luyện Kiếm Đài để đọc ra sức của
 * từng chiêu, mà phòng ngự thì bóp méo con số theo một đường phi tuyến và bạo
 * kích thì làm nó nhảy ngẫu nhiên. Bỏ cả hai thì số bay lên tỉ lệ thẳng với hệ
 * số công ghi trên thẻ giới thiệu — hai chỗ nói cùng một điều.
 *
 * Ngũ hành `tho` để Thiên Nhất Chân Thuỷ và Tam Diễm Phiến không tự dưng khắc
 * chế hay bị khắc chế; muốn xem tương khắc thì có bia riêng thuộc hệ khác.
 */
const TARGET_BASE: BaseStats = {
  sinhLuc: 240,
  linhLuc: 0,
  cong: 0,
  phong: 0,
  thanThuc: 0,
  toc: 0,
  bao: 0,
  baoMult: 1,
  element: 'tho',
}

/**
 * Phần hình ảnh của một bia tập.
 *
 * Không có rig, không có clip: bia không đi, không ra đòn, không có tư thế
 * đứng. Toàn bộ "hoạt cảnh" của nó là NGHIÊNG rồi rung về chỗ cũ khi trúng đòn,
 * và đổ xuống khi tan. Viết bằng một hàm mũ tắt dần trong `update` gọn hơn hẳn
 * so với dựng một bộ xương hai khớp chỉ để làm đúng chừng ấy việc.
 */
class TrainingTargetView implements CombatantView {
  /** Biên độ nghiêng còn lại, radian. Tắt dần theo hàm mũ. */
  private wobble = 0
  /** Pha dao động — chạy theo thời gian thật để rung không phụ thuộc fps. */
  private phase = 0
  /** Tiến độ đổ, 0..1. */
  private fall = 0
  private falling = false

  constructor(private readonly prop: TrainingProp) {}

  get root(): Group {
    return this.prop.root
  }

  get height(): number {
    return this.prop.height
  }

  showIdle(): void {}

  showMove(): void {}

  showAttack(): void {}

  showHurt(): void {
    // Cộng dồn có TRẦN: một chiêu nhiều nhịp gọi hàm này bốn lần trong một giây,
    // và không có trần thì bia quay tít như chong chóng thay vì rung
    this.wobble = Math.min(0.34, this.wobble + 0.16)
  }

  showDie(): void {
    this.falling = true
  }

  update(frameDt: number): void {
    const body = this.prop.body

    if (this.falling) {
      // Đổ có GIA TỐC, không đều: một vật nặng bắt đầu đổ thì càng lúc càng
      // nhanh, và cái đó mắt nhận ra ngay cả khi không nghĩ tới
      this.fall = Math.min(1, this.fall + frameDt * (0.9 + this.fall * 2.6))
      const t = this.fall
      body.rotation.x = t * (Math.PI / 2)
      body.position.y = -t * t * 0.12
      return
    }

    if (this.wobble <= 0.001) {
      if (body.rotation.z !== 0) body.rotation.z = 0
      return
    }
    this.phase += frameDt * 17
    this.wobble *= Math.exp(-6.5 * frameDt)
    body.rotation.z = Math.sin(this.phase) * this.wobble
    body.rotation.x = Math.cos(this.phase * 0.7) * this.wobble * 0.4
  }
}

/**
 * Một bia tập ở Luyện Kiếm Đài.
 *
 * Là `Combatant` phe `enemy` nên MỌI chiêu vẫn ăn vào nó đủ cả đẩy lùi, đóng
 * băng, thiêu đốt và số sát thương bay lên — tức người xem vẫn đọc được toàn bộ
 * phản hồi của một chiêu. Nhưng nó không có `Agent`, không có máy trạng thái,
 * không tìm mục tiêu: trong màn này không có một sinh vật nào.
 *
 * Máu nhân theo cảnh giới NGƯỜI THI TRIỂN chứ không cố định. Ở Nguyên Anh, công
 * của Hàn Lập gấp gần ba mươi lần lúc Luyện Khí, nên một con số cứng thì hoặc
 * bia bất tử ở đầu showreel hoặc bốc hơi trước nhịp quét thứ hai ở cuối.
 */
export class TrainingTarget {
  readonly combatant: Combatant
  private readonly prop: TrainingProp

  constructor(
    readonly kind: TargetKind,
    casterRealm: RealmPosition,
    hpScale = 1,
  ) {
    this.prop = kind === 'mocNhan' ? buildMocNhan() : buildBiaDa()
    const stats = deriveStats(TARGET_BASE, casterRealm)
    stats.maxSinhLuc = Math.round(stats.maxSinhLuc * hpScale)
    this.combatant = new Combatant(
      'enemy',
      stats,
      casterRealm,
      kind === 'mocNhan' ? 0.34 : 0.3,
      new TrainingTargetView(this.prop),
    )
    this.combatant.hp = stats.maxSinhLuc
  }

  get root(): Group {
    return this.prop.root
  }

  place(x: number, z: number, y: number, facing: number): void {
    this.combatant.place(x, z, y, facing)
  }

  /**
   * Nhịp cố định: chỉ đếm giờ và trả sát thương theo thời gian.
   *
   * KHÔNG gọi `applyTransform` mỗi bước: bia đứng yên một chỗ, và đẩy lùi của
   * nó do `knockVx` xử lý ở dưới. Đó cũng là điểm khác duy nhất so với `Agent`
   * — bia bị hất thì trượt trên đá rồi dừng, chứ không tự đi lại.
   */
  fixedUpdate(dt: number): number {
    const c = this.combatant
    const dot = c.tickTimers(dt)
    if (c.dead) return dot
    if (c.knockVx !== 0 || c.knockVz !== 0) {
      c.pos.x += c.knockVx * dt
      c.pos.z += c.knockVz * dt
      c.applyTransform()
    }
    return dot
  }

  render(frameDt: number): void {
    this.combatant.view.update(frameDt)
  }
}
