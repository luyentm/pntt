import type { EventBus } from '@/core/EventBus'
import type { GameEvents } from '@/core/events'
import { realmOrdinal, type RealmPosition } from '@/game/data/realms'
import { SKILLS, type SkillDef } from '@/game/data/skills'
import { isHostile, type Combatant } from './Combatant'
import type { CombatWorld } from './CombatWorld'
import type { ProjectileSystem } from './Projectile'
import type { SwordStorm } from './SwordStorm'

export interface CastContext {
  world: CombatWorld
  projectiles: ProjectileSystem
  /** Đàn kiếm bay — chỉ chiêu `kiemVu` dùng tới. */
  swords: SwordStorm
  /** Điểm ngắm trên mặt đất — pháp vực đặt tại đây. */
  cursorX: number
  cursorZ: number
  /**
   * Hướng lướt của Phong Độn Thuật. Bỏ trống thì lướt theo hướng đang nhìn.
   *
   * Cần tách khỏi hướng nhìn vì ở chế độ tự ngắm, hướng nhìn LUÔN chỉ vào con
   * quái — mà Phong Độn Thuật là nút NÉ ĐÒN. Lướt thẳng vào con vừa vung đòn
   * thì nó thành nút tự sát, đúng lúc người chơi bấm nó để thoát.
   */
  dashDirX?: number
  dashDirZ?: number
}

export type CastPhase = 'none' | 'dan' | 'hoi'

export interface DashState {
  active: boolean
  vx: number
  vz: number
  remaining: number
}

/**
 * Thi triển pháp thuật cho một combatant.
 *
 * Tách khỏi Player vì hai lý do: quái tướng và đệ tử đồng môn ở M7 cũng cần thi
 * triển pháp thuật, và tách ra thì luật (tốn linh lực, hồi chiêu, cổng cảnh giới)
 * nằm một chỗ duy nhất thay vì rải trong mã điều khiển.
 */
export class SkillCaster {
  phase: CastPhase = 'none'
  /** Chỉ số ô đang thi triển, -1 nếu không. */
  activeSlot = -1

  readonly dash: DashState = { active: false, vx: 0, vz: 0, remaining: 0 }

  private phaseTimer = 0
  private readonly cooldowns = new Float32Array(SKILLS.length)
  private readonly aoeBuffer: Combatant[] = []
  private pendingCursorX = 0
  private pendingCursorZ = 0

  constructor(
    private readonly owner: Combatant,
    private readonly bus: EventBus<GameEvents>,
  ) {}

  get isCasting(): boolean {
    return this.phase !== 'none'
  }

  /** Chiêu đang thi triển, để bên gọi biết còn bao nhiêu phần tốc độ di chuyển. */
  get activeSkill(): SkillDef | null {
    return this.activeSlot >= 0 ? (SKILLS[this.activeSlot] as SkillDef) : null
  }

  cooldownLeft(slot: number): number {
    return this.cooldowns[slot] ?? 0
  }

  cooldownFraction(slot: number): number {
    const def = SKILLS[slot]
    if (!def) return 0
    return Math.max(0, Math.min(1, (this.cooldowns[slot] ?? 0) / def.cooldown))
  }

  /** Đã đủ cảnh giới để dùng ô này chưa. */
  isUnlocked(slot: number, realm: RealmPosition): boolean {
    const def = SKILLS[slot]
    if (!def) return false
    return realmOrdinal(realm) >= realmOrdinal(def.requiredRealm)
  }

  /**
   * Thử thi triển. Trả về lý do thất bại để UI nói cho người chơi biết — im lặng
   * không làm gì là cách nhanh nhất khiến người chơi tưởng game bị treo.
   */
  tryCast(
    slot: number,
    realm: RealmPosition,
    linhLuc: number,
    ctx: CastContext,
  ): { ok: true; cost: number } | { ok: false; reason: string } {
    const def = SKILLS[slot]
    if (!def) return { ok: false, reason: 'Không có pháp thuật ở ô này' }
    if (this.phase !== 'none') return { ok: false, reason: 'Đang thi triển' }
    if (this.owner.immobilized) return { ok: false, reason: 'Không thi triển được' }
    if (!this.isUnlocked(slot, realm)) {
      return { ok: false, reason: `Chưa đủ cảnh giới để dùng ${def.name}` }
    }
    if ((this.cooldowns[slot] ?? 0) > 0) {
      return { ok: false, reason: `${def.name} đang hồi` }
    }
    if (linhLuc < def.linhLucCost) return { ok: false, reason: 'Không đủ linh lực' }

    this.activeSlot = slot
    this.phase = 'dan'
    this.phaseTimer = def.castTime
    this.cooldowns[slot] = def.cooldown
    // Chốt điểm ngắm ngay lúc bấm, không đọc lại lúc chiêu phát.
    // Nếu đọc lại thì người chơi rê chuột trong lúc dẫn khí sẽ làm chiêu "đi
    // theo chuột", và cảm giác điều khiển trở nên trơn tuột không có sức nặng.
    this.pendingCursorX = ctx.cursorX
    this.pendingCursorZ = ctx.cursorZ

    this.bus.emit('skill:cast', { id: def.id, slot, side: this.owner.side })
    return { ok: true, cost: def.linhLucCost }
  }

  fixedUpdate(dt: number, ctx: CastContext): void {
    for (let i = 0; i < this.cooldowns.length; i++) {
      if ((this.cooldowns[i] ?? 0) > 0) {
        this.cooldowns[i] = Math.max(0, (this.cooldowns[i] as number) - dt)
      }
    }

    if (this.dash.active) {
      this.dash.remaining -= dt
      if (this.dash.remaining <= 0) {
        this.dash.active = false
        this.dash.vx = 0
        this.dash.vz = 0
      }
    }

    if (this.phase === 'none') return

    // Bị choáng/đóng băng giữa lúc dẫn khí thì chiêu bị phá — nhưng hồi chiêu
    // vẫn tính, vì nếu không thì bị đánh gián đoạn lại thành có lợi
    if (this.owner.immobilized) {
      this.phase = 'none'
      this.activeSlot = -1
      return
    }

    this.phaseTimer -= dt
    if (this.phaseTimer > 0) return

    const def = this.activeSkill
    if (!def) {
      this.phase = 'none'
      this.activeSlot = -1
      return
    }

    if (this.phase === 'dan') {
      this.execute(def, ctx)
      this.phase = 'hoi'
      this.phaseTimer = def.recover
      return
    }

    this.phase = 'none'
    this.activeSlot = -1
  }

  private execute(def: SkillDef, ctx: CastContext): void {
    const me = this.owner

    switch (def.action.type) {
      case 'phiHanh': {
        ctx.projectiles.fire(me, def.action.spec, Math.sin(me.facing), Math.cos(me.facing))
        break
      }

      case 'kiemVu': {
        const a = def.action
        ctx.swords.cast(me, {
          radius: a.radius,
          mult: a.mult,
          duration: a.duration,
          knockback: a.knockback,
          stagger: a.stagger,
        })
        break
      }

      case 'thanPhap': {
        const { distance, duration } = def.action
        // Ưu tiên hướng người chơi đang ĐI; không bấm phím nào thì mới theo
        // hướng đang nhìn
        const dirLen = Math.hypot(ctx.dashDirX ?? 0, ctx.dashDirZ ?? 0)
        const dirX = dirLen > 1e-4 ? (ctx.dashDirX as number) / dirLen : Math.sin(me.facing)
        const dirZ = dirLen > 1e-4 ? (ctx.dashDirZ as number) / dirLen : Math.cos(me.facing)

        this.dash.active = true
        this.dash.remaining = duration
        this.dash.vx = (dirX * distance) / duration
        this.dash.vz = (dirZ * distance) / duration
        // Miễn thương suốt cú lướt: đó chính là công dụng của Phong Độn Thuật —
        // một nút "né đòn", không phải chỉ là đi nhanh
        me.invuln = Math.max(me.invuln, duration + 0.05)
        this.bus.emit('skill:dash', {
          x: me.pos.x,
          y: me.y,
          z: me.pos.z,
          facing: Math.atan2(dirX, dirZ),
          distance,
        })
        break
      }

      case 'hoTro': {
        const { kind, duration, magnitudeFromThanThuc } = def.action
        // Độ mạnh suy từ Thần Thức nên khiên tự lên theo cảnh giới, không phải
        // một hằng số trở nên vô nghĩa ở Kết Đan
        const magnitude = Math.round(me.stats.thanThuc * magnitudeFromThanThuc)
        me.effects.apply(kind, duration, magnitude, me.id)
        this.bus.emit('skill:buff', {
          x: me.pos.x,
          y: me.y,
          z: me.pos.z,
          kind,
          magnitude,
          duration,
        })
        break
      }

      case 'phapVuc': {
        const a = def.action
        let cx = me.pos.x
        let cz = me.pos.z
        if (a.atCursor) {
          const dx = this.pendingCursorX - me.pos.x
          const dz = this.pendingCursorZ - me.pos.z
          const d = Math.hypot(dx, dz)
          // Kẹp về tầm tối đa thay vì huỷ chiêu: người chơi nhắm hơi xa thì
          // chiêu nên rơi ở xa nhất có thể, chứ không nên "mất chiêu"
          const clamped = Math.min(d, a.castRange)
          if (d > 1e-4) {
            cx = me.pos.x + (dx / d) * clamped
            cz = me.pos.z + (dz / d) * clamped
          }
        }

        // PHẢI dùng isHostile, không phải `side !== me.side`:
        // với người chơi thì 'ally' !== 'player' là true, nên phép so sánh thô
        // biến mọi pháp vực thành đánh cả đồng môn — sẽ hỏng nặng ở đại chiến.
        const count = ctx.world.queryCircle(
          cx,
          cz,
          a.radius,
          this.aoeBuffer,
          (c) => c.alive && isHostile(me.side, c.side),
        )

        // Ngũ hành của CHIÊU, không phải của người thi triển
        const savedElement = me.stats.element
        me.stats.element = a.element
        for (let i = 0; i < count; i++) {
          const victim = this.aoeBuffer[i] as Combatant
          victim.invuln = 0
          ctx.world.strike(me, victim, a.mult, {
            knockback: a.knockback,
            stagger: a.stagger,
          })
          if (a.onHit) {
            victim.effects.apply(a.onHit.kind, a.onHit.duration, a.onHit.magnitude, me.id)
          }
        }
        me.stats.element = savedElement

        this.bus.emit('skill:area', {
          x: cx,
          y: 0,
          z: cz,
          radius: a.radius,
          element: a.element,
          skillId: def.id,
        })
        break
      }
    }
  }

  reset(): void {
    this.phase = 'none'
    this.activeSlot = -1
    this.phaseTimer = 0
    this.cooldowns.fill(0)
    this.dash.active = false
    this.dash.vx = 0
    this.dash.vz = 0
    this.dash.remaining = 0
  }
}
