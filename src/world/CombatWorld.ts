import type { EventBus } from '@/core/EventBus'
import type { GameEvents } from '@/core/events'
import type { Rng } from '@/core/Rng'
import { computeDamage, type DamageResult } from '@/game/Stats'
import { Combatant, isHostile, type Side } from './Combatant'

/** Kích thước ô của chỉ mục không gian động. */
const CELL = 2.5
const KEY_OFFSET = 4096
const KEY_STRIDE = 8192

function cellKey(cx: number, cz: number): number {
  return (cx + KEY_OFFSET) * KEY_STRIDE + (cz + KEY_OFFSET)
}

/** Bao lâu sau khi chết thì xác biến mất. */
export const CORPSE_LIFETIME = 6

/**
 * Sổ đăng ký combatant + chỉ mục không gian + xử lý sát thương.
 *
 * Chỉ mục được DỰNG LẠI mỗi bước fixed thay vì cập nhật tại chỗ: với dưới vài
 * trăm thực thể thì clear + insert rẻ hơn việc theo dõi ô cũ/ô mới, và không có
 * chỗ nào để trạng thái bị lệch.
 */
export class CombatWorld {
  readonly all: Combatant[] = []

  private readonly cells = new Map<number, Combatant[]>()
  private readonly scratch: Combatant[] = []

  constructor(
    private readonly bus: EventBus<GameEvents>,
    private readonly rng: Rng,
  ) {}

  add(c: Combatant): Combatant {
    this.all.push(c)
    return c
  }

  remove(c: Combatant): void {
    const i = this.all.indexOf(c)
    if (i >= 0) this.all.splice(i, 1)
  }

  /** Dọn xác đã hết thời gian. Trả về danh sách bị xoá để scene tháo khỏi scene graph. */
  reapCorpses(): Combatant[] {
    const removed: Combatant[] = []
    for (let i = this.all.length - 1; i >= 0; i--) {
      const c = this.all[i] as Combatant
      // Người chơi không bao giờ bị dọn — chết là chuyển sang trạng thái thua
      if (c.dead && c.side !== 'player' && c.deadFor > CORPSE_LIFETIME) {
        this.all.splice(i, 1)
        removed.push(c)
      }
    }
    return removed
  }

  /** Dựng lại chỉ mục. Gọi một lần ở đầu mỗi bước fixed. */
  rebuildIndex(): void {
    this.cells.clear()
    for (const c of this.all) {
      if (c.dead) continue
      const key = cellKey(Math.floor(c.pos.x / CELL), Math.floor(c.pos.z / CELL))
      let list = this.cells.get(key)
      if (!list) {
        list = []
        this.cells.set(key, list)
      }
      list.push(c)
    }
  }

  /** Các combatant còn sống trong hình tròn. Ghi vào `out`, trả về số lượng. */
  queryCircle(
    x: number,
    z: number,
    radius: number,
    out: Combatant[],
    filter?: (c: Combatant) => boolean,
  ): number {
    let n = 0
    const minX = Math.floor((x - radius) / CELL)
    const maxX = Math.floor((x + radius) / CELL)
    const minZ = Math.floor((z - radius) / CELL)
    const maxZ = Math.floor((z + radius) / CELL)

    for (let cx = minX; cx <= maxX; cx++) {
      for (let cz = minZ; cz <= maxZ; cz++) {
        const list = this.cells.get(cellKey(cx, cz))
        if (!list) continue
        for (const c of list) {
          if (filter && !filter(c)) continue
          const dx = c.pos.x - x
          const dz = c.pos.z - z
          const reach = radius + c.radius
          if (dx * dx + dz * dz <= reach * reach) out[n++] = c
        }
      }
    }
    return n
  }

  /**
   * Hitbox HÌNH QUẠT — dùng cho đòn đánh gần.
   *
   * Hình quạt chứ không phải hình tròn, vì đòn chém phải có hướng: đứng sau lưng
   * mà vẫn trúng thì combat mất hết ý nghĩa của việc quay người và né.
   * Khoan dung một chút ở bán kính: cộng cả bán kính mục tiêu nên mục tiêu to
   * bị trúng dễ hơn, đúng trực giác.
   */
  queryCone(
    attacker: Combatant,
    facing: number,
    halfAngle: number,
    radius: number,
    out: Combatant[],
  ): number {
    const fx = Math.sin(facing)
    const fz = Math.cos(facing)

    let n = 0
    const found = this.scratch
    const count = this.queryCircle(
      attacker.pos.x,
      attacker.pos.z,
      radius,
      found,
      (c) => c !== attacker && c.alive && isHostile(attacker.side, c.side),
    )

    for (let i = 0; i < count; i++) {
      const c = found[i] as Combatant
      const dx = c.pos.x - attacker.pos.x
      const dz = c.pos.z - attacker.pos.z
      const dist = Math.hypot(dx, dz)
      if (dist < 1e-4) {
        out[n++] = c
        continue
      }
      // Mục tiêu càng to thì "góc mà nó chiếm" càng rộng -> nới giới hạn góc theo
      // bán kính của nó, nếu không thì quái to đứng sát bên vẫn lọt khỏi hình quạt
      const angularRadius = Math.min(halfAngle, Math.asin(Math.min(1, c.radius / dist)))
      const cosNeeded = Math.cos(Math.min(Math.PI, halfAngle + angularRadius))
      if ((dx / dist) * fx + (dz / dist) * fz >= cosNeeded) out[n++] = c
    }
    return n
  }

  /** Mục tiêu địch gần nhất trong tầm. */
  nearestHostile(from: Combatant, radius: number): Combatant | null {
    return this.nearestHostileAt(from.pos.x, from.pos.z, from.side, radius, from)
  }

  /**
   * Địch gần nhất tính từ một TOẠ ĐỘ bất kỳ.
   * Cần cho phi hành khí truy kích: nó phải tìm từ vị trí của viên đạn, không
   * phải từ vị trí người bắn.
   */
  nearestHostileAt(
    x: number,
    z: number,
    side: Side,
    radius: number,
    exclude?: Combatant,
  ): Combatant | null {
    const from = { pos: { x, z } }
    const found = this.scratch
    const count = this.queryCircle(
      x,
      z,
      radius,
      found,
      (c) => c !== exclude && c.alive && isHostile(side, c.side),
    )
    let best: Combatant | null = null
    let bestDist = Infinity
    for (let i = 0; i < count; i++) {
      const c = found[i] as Combatant
      const d = (c.pos.x - from.pos.x) ** 2 + (c.pos.z - from.pos.z) ** 2
      if (d < bestDist) {
        bestDist = d
        best = c
      }
    }
    return best
  }

  /**
   * Thông báo một đòn vừa vung ra, dù trúng hay không.
   *
   * Đặt ở đây thay vì để Player/Enemy tự emit, vì CombatWorld là chỗ duy nhất
   * đã giữ bus — nhờ vậy các lớp điều khiển không cần biết tới hệ sự kiện.
   */
  announceSwing(attacker: Combatant, facing: number, radius: number): void {
    this.bus.emit('combat:swing', {
      x: attacker.pos.x,
      y: attacker.y,
      z: attacker.pos.z,
      facing,
      radius,
      side: attacker.side,
    })
  }

  /**
   * Gây sát thương. Trả về null nếu đòn bị bỏ qua (mục tiêu đã chết hoặc đang
   * miễn thương), để bên gọi biết mà không phát hiệu ứng trúng.
   */
  strike(
    attacker: Combatant,
    target: Combatant,
    skillMult: number,
    options: { knockback?: number; stagger?: number; invuln?: number } = {},
  ): DamageResult | null {
    if (target.dead || target.invuln > 0) return null

    const result = computeDamage(attacker, target, skillMult, this.rng)

    // Khiên hấp thụ TRƯỚC khi trừ máu. Phần bị hấp thụ vẫn hiện lên như một con
    // số, nhưng màu khác — người chơi phải thấy được khiên đang làm việc, nếu
    // không thì Kim Quang Thuẫn trông như không có tác dụng gì.
    const throughShield = target.effects.absorb(result.amount)
    const absorbed = result.amount - throughShield

    target.hp -= throughShield
    target.invuln = options.invuln ?? 0.08

    const knockback = options.knockback ?? 0
    if (knockback > 0) {
      target.addKnockback(
        target.pos.x - attacker.pos.x,
        target.pos.z - attacker.pos.z,
        knockback,
      )
    }

    this.bus.emit('combat:hit', {
      x: target.pos.x,
      y: target.centerY(),
      z: target.pos.z,
      amount: result.amount,
      absorbed,
      crit: result.crit,
      elementFactor: result.elementFactor,
      realmFactor: result.realmFactor,
      targetSide: target.side,
    })

    if (target.hp <= 0) {
      target.hp = 0
      target.dead = true
      target.deadFor = 0
      target.stagger = 0
      target.view.showDie()
      this.bus.emit('combat:death', {
        side: target.side,
        x: target.pos.x,
        y: target.y,
        z: target.pos.z,
      })
    } else {
      target.stagger = Math.max(target.stagger, options.stagger ?? 0.18)
      target.view.showHurt()
    }

    return result
  }

  /**
   * Gây sát thương THUẦN, không qua công thức và không bị khiên chặn.
   * Dùng cho sát thương theo thời gian (thiêu đốt, trúng độc): lượng đã được
   * quyết định lúc áp trạng thái, tính lại theo công thức ở đây sẽ nhân đôi
   * ảnh hưởng của ngũ hành và chênh cảnh giới.
   */
  applyDirectDamage(target: Combatant, amount: number, kind: 'thieuDot' | 'trungDoc'): void {
    if (target.dead || amount <= 0) return
    target.hp -= amount
    this.bus.emit('combat:hit', {
      x: target.pos.x,
      y: target.centerY(),
      z: target.pos.z,
      amount: Math.round(amount),
      absorbed: 0,
      crit: false,
      elementFactor: 1,
      realmFactor: 1,
      targetSide: target.side,
      dot: kind,
    })
    if (target.hp <= 0) {
      target.hp = 0
      target.dead = true
      target.deadFor = 0
      target.stagger = 0
      target.effects.clear()
      target.view.showDie()
      this.bus.emit('combat:death', {
        side: target.side,
        x: target.pos.x,
        y: target.y,
        z: target.pos.z,
      })
    }
  }

  /**
   * Đẩy các combatant ra khỏi nhau.
   *
   * Đây là thứ thay cho SeparationBehavior của thư viện AI: chạy trên CÙNG chỉ
   * mục không gian đã có sẵn cho hitbox, nên không phải nuôi thêm một cấu trúc
   * thứ hai và đồng bộ vị trí qua lại mỗi frame. Không có nó thì cả đàn quái
   * chồng lên nhau thành một cột và chỉ nhìn thấy một con.
   */
  resolveCrowding(strength = 0.5): void {
    const found = this.scratch
    for (const a of this.all) {
      if (a.dead) continue
      const count = this.queryCircle(a.pos.x, a.pos.z, a.radius, found, (c) => c !== a && c.alive)
      for (let i = 0; i < count; i++) {
        const b = found[i] as Combatant
        // Mỗi cặp chỉ xử lý một lần, và chia đôi lực đẩy cho hai bên
        if (b.pos.x < a.pos.x || (b.pos.x === a.pos.x && b.pos.z <= a.pos.z)) continue

        let dx = b.pos.x - a.pos.x
        let dz = b.pos.z - a.pos.z
        const reach = a.radius + b.radius
        let dist = Math.hypot(dx, dz)
        if (dist >= reach) continue

        if (dist < 1e-5) {
          dx = 1
          dz = 0
          dist = 1
        }
        const push = (reach - dist) * strength
        const nx = (dx / dist) * push * 0.5
        const nz = (dz / dist) * push * 0.5
        a.pos.x -= nx
        a.pos.z -= nz
        b.pos.x += nx
        b.pos.z += nz
      }
    }
  }

  countAlive(side?: Side): number {
    let n = 0
    for (const c of this.all) {
      if (c.dead) continue
      if (side && c.side !== side) continue
      n++
    }
    return n
  }

  clear(): void {
    this.all.length = 0
    this.cells.clear()
  }
}
