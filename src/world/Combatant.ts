import type { Group } from 'three'
import type { RealmPosition } from '@/game/data/realms'
import { EffectSet } from '@/game/Effects'
import type { CombatStats } from '@/game/Stats'

let nextCombatantId = 1

export type Side = 'player' | 'ally' | 'enemy'

/** Hai bên có thù với nhau hay không. */
export function isHostile(a: Side, b: Side): boolean {
  if (a === 'enemy') return b !== 'enemy'
  return b === 'enemy'
}

/**
 * Phần hình ảnh của một combatant.
 *
 * Trừu tượng hoá để logic chiến đấu không cần biết đối tượng là người chibi hay
 * thú bốn chân — hai loại có rig và clip hoàn toàn khác nhau nhưng cùng trả lời
 * được "hãy diễn cảnh đang chạy" hay "hãy diễn cảnh trúng đòn".
 */
export interface CombatantView {
  readonly root: Group
  /** Cao độ đỉnh đầu so với chân — dùng để đặt thanh máu và số sát thương. */
  readonly height: number
  showIdle(): void
  showMove(speed: number): void
  showAttack(comboStep: number): void
  showHurt(): void
  showDie(): void
  /** Nhịp frame. */
  update(frameDt: number): void
}

/**
 * Bất cứ thứ gì có thể đánh và bị đánh.
 *
 * Cố tình KHÔNG dùng ECS: các thực thể ở đây đều là những "hồ" đồng dạng
 * (quái, đồng môn, người chơi) chứ không phải tập hợp component thay đổi bất
 * thường, nên một lớp có kiểu rõ ràng đọc và gỡ lỗi dễ hơn hẳn một world ECS.
 */
export class Combatant {
  /** Id duy nhất — dùng để quy nguồn cho trạng thái và tránh tự cộng dồn. */
  readonly id = nextCombatantId++
  /** Khiên, làm chậm, thiêu đốt... */
  readonly effects = new EffectSet()

  /** Vị trí trên mặt phẳng. Object riêng để truyền thẳng vào CollisionWorld.resolve. */
  readonly pos = { x: 0, z: 0 }
  y = 0
  facing = 0

  hp: number
  dead = false
  /** Thời gian chết đã trôi qua — dùng để dọn xác sau khi diễn xong. */
  deadFor = 0

  /** Còn choáng bao lâu; trong lúc choáng không điều khiển được. */
  stagger = 0
  /**
   * Miễn thương còn lại. Cần thiết vì hitbox hình quạt được truy vấn ở đúng một
   * frame, nhưng nhiều nguồn sát thương (đòn + phi kiếm + độc) có thể trúng cùng
   * lúc; không có nó thì một mục tiêu bị trừ máu nhiều lần cho một đòn.
   */
  invuln = 0

  /** Vận tốc đẩy lùi, giảm dần. Tách khỏi vận tốc tự chủ để lúc choáng vẫn bị đẩy. */
  knockVx = 0
  knockVz = 0

  constructor(
    readonly side: Side,
    public stats: CombatStats,
    public realm: RealmPosition,
    public radius: number,
    readonly view: CombatantView,
  ) {
    this.hp = stats.maxSinhLuc
  }

  get alive(): boolean {
    return !this.dead
  }

  get hpFraction(): number {
    return Math.max(0, Math.min(1, this.hp / Math.max(1, this.stats.maxSinhLuc)))
  }

  /** Tâm thân — mốc đặt số sát thương và hiệu ứng trúng đòn. */
  centerY(): number {
    return this.y + this.view.height * 0.55
  }

  place(x: number, z: number, y: number, facing: number): void {
    this.pos.x = x
    this.pos.z = z
    this.y = y
    this.facing = facing
    this.applyTransform()
  }

  applyTransform(): void {
    this.view.root.position.set(this.pos.x, this.y, this.pos.z)
    this.view.root.rotation.y = this.facing
  }

  /** Áp lực đẩy lùi. Cộng dồn để nhiều đòn liên tiếp đẩy mạnh hơn. */
  addKnockback(dirX: number, dirZ: number, force: number): void {
    const len = Math.hypot(dirX, dirZ)
    if (len < 1e-5) return
    this.knockVx += (dirX / len) * force
    this.knockVz += (dirZ / len) * force
  }

  /** Tốc độ di chuyển sau khi tính trạng thái (làm chậm, đóng băng). */
  effectiveSpeed(): number {
    return this.stats.toc * this.effects.speedMultiplier()
  }

  /** Mất điều khiển vì choáng hoặc bị đóng băng. */
  get immobilized(): boolean {
    return this.stagger > 0 || this.effects.isImmobilized()
  }

  /**
   * Giảm dần đẩy lùi và các bộ đếm. Gọi mỗi bước fixed.
   * Trả về sát thương theo thời gian cần gây trong bước này (0 nếu không có).
   */
  tickTimers(dt: number): number {
    if (this.stagger > 0) this.stagger = Math.max(0, this.stagger - dt)
    if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - dt)
    if (this.dead) this.deadFor += dt

    // Tắt dần theo hàm mũ: đẩy lùi mạnh lúc đầu rồi dịu nhanh, đúng cảm giác
    // "bị hẫng một nhịp" thay vì trượt dài
    const damp = Math.exp(-11 * dt)
    this.knockVx *= damp
    this.knockVz *= damp
    if (Math.abs(this.knockVx) < 0.01) this.knockVx = 0
    if (Math.abs(this.knockVz) < 0.01) this.knockVz = 0

    // Xác không còn chịu trạng thái nào nữa
    if (this.dead) {
      this.effects.clear()
      return 0
    }
    return this.effects.tick(dt)
  }

  get root(): Group {
    return this.view.root
  }
}
