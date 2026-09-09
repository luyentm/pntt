import type { EventBus } from '@/core/EventBus'
import type { GameEvents } from '@/core/events'
import { realmOrdinal, type RealmPosition } from '@/game/data/realms'
import { SKILLS, soKiemTruc, type SkillAction, type SkillDef } from '@/game/data/skills'
import { isHostile, type Combatant } from './Combatant'
import type { CombatWorld } from './CombatWorld'
import type { ProjectileSystem } from './Projectile'
import type { SwordStorm } from './SwordStorm'

/** Tra chiêu theo id trong thời gian hằng số — `tryCast` chạy mỗi lần bấm phím. */
const SKILL_BY_ID = new Map<string, SkillDef>(SKILLS.map((s) => [s.id, s]))

type AreaAction = Extract<SkillAction, { type: 'phapVuc' }>

export interface CastContext {
  world: CombatWorld
  projectiles: ProjectileSystem
  /** Đàn kiếm bay — chỉ chiêu `kiemVu` dùng tới. */
  swords: SwordStorm
  /** Điểm ngắm trên mặt đất — pháp vực đặt tại đây. */
  cursorX: number
  cursorZ: number
  /**
   * Hướng lướt của thân pháp. Bỏ trống thì lướt theo hướng đang nhìn.
   *
   * Cần tách khỏi hướng nhìn vì ở chế độ tự ngắm, hướng nhìn LUÔN chỉ vào con
   * quái — mà thân pháp là nút NÉ ĐÒN. Lướt thẳng vào con vừa vung đòn thì nó
   * thành nút tự sát, đúng lúc người chơi bấm nó để thoát.
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

/** Một nhịp bùng còn nợ của pháp vực nhiều nhịp. */
interface PendingPulse {
  def: SkillDef
  action: AreaAction
  cx: number
  cz: number
  /** Còn bao nhiêu nhịp nữa. */
  left: number
  /** Còn bao lâu tới nhịp kế. */
  timer: number
}

/**
 * Thi triển pháp thuật cho một combatant.
 *
 * Tách khỏi Player vì hai lý do: quái tướng và đệ tử đồng môn ở M7 cũng cần thi
 * triển pháp thuật, và tách ra thì luật (tốn linh lực, hồi chiêu, cổng cảnh giới)
 * nằm một chỗ duy nhất thay vì rải trong mã điều khiển.
 *
 * MỌI thứ ở đây khoá theo `id` của chiêu, không theo chỉ số ô. Trước đây khoá
 * theo chỉ số mảng `SKILLS`, và cái giá là một dòng cảnh báo trong bảng pháp
 * thuật: "thêm vào CUỐI mảng, không chèn giữa" — chèn giữa là đổi hết phím bấm
 * của mọi chiêu phía sau, mà không có gì báo lỗi. Với 17 chiêu chia bốn cảnh
 * giới thì luật đó không giữ nổi nữa: một chiêu Trúc Cơ mới phải nằm cạnh các
 * chiêu Trúc Cơ khác thì bảng mới đọc được, chứ không phải nằm ở cuối cùng.
 */
export class SkillCaster {
  phase: CastPhase = 'none'
  /** Id chiêu đang thi triển, `null` nếu không. */
  activeId: string | null = null

  readonly dash: DashState = { active: false, vx: 0, vz: 0, remaining: 0 }

  /** Bỏ qua giá linh lực. Dùng cho chế độ trình diễn. */
  freeCast = false

  /**
   * Không tính hồi chiêu chút nào. Dùng cho chế độ trình diễn.
   *
   * Chế độ đó để XEM chiêu, nên chờ hồi 40 giây của Thái Ất Thanh Sơn Quyết là
   * chờ vô nghĩa — cùng lý do mà linh lực ở đó luôn đầy.
   *
   * Không sợ chiêu chồng lên nhau: cổng `phase !== 'none'` vẫn chặn chiêu mới
   * trong lúc còn dẫn khí hoặc thu thế, và nhịp của showreel do bảng trình diễn
   * quyết định, chưa bao giờ do hồi chiêu.
   */
  noCooldown = false

  private phaseTimer = 0
  private readonly cooldowns = new Map<string, number>()
  private readonly aoeBuffer: Combatant[] = []
  private pendingCursorX = 0
  private pendingCursorZ = 0
  /** Cảnh giới lúc bấm — đàn kiếm đọc nó để biết ngự nổi bao nhiêu thanh. */
  private pendingRealm: RealmPosition = { major: 0, tier: 0 }
  /**
   * Những nhịp bùng còn nợ.
   *
   * Cần vì Tam Diễm Phiến quạt ba lần và Thiên Nhất Chân Thuỷ dội hai đợt: gộp
   * chúng thành một vụ nổ to thì tên chiêu nói một đằng còn hình nói một nẻo.
   * Danh sách chứ không phải một ô: hai chiêu nhiều nhịp có thể chồng thời gian
   * lên nhau, và một ô thì chiêu sau nuốt mất nhịp còn nợ của chiêu trước.
   */
  private readonly pending: PendingPulse[] = []

  constructor(
    private readonly owner: Combatant,
    private readonly bus: EventBus<GameEvents>,
  ) {}

  get isCasting(): boolean {
    return this.phase !== 'none'
  }

  /** Chiêu đang thi triển, để bên gọi biết còn bao nhiêu phần tốc độ di chuyển. */
  get activeSkill(): SkillDef | null {
    return this.activeId ? (SKILL_BY_ID.get(this.activeId) ?? null) : null
  }

  cooldownLeft(id: string): number {
    return this.cooldowns.get(id) ?? 0
  }

  cooldownFraction(id: string): number {
    const left = this.cooldowns.get(id) ?? 0
    const def = SKILL_BY_ID.get(id)
    if (left <= 0 || !def) return 0
    return Math.max(0, Math.min(1, left / def.cooldown))
  }

  /** Đã đủ cảnh giới để dùng chiêu này chưa. */
  isUnlocked(id: string, realm: RealmPosition): boolean {
    const def = SKILL_BY_ID.get(id)
    if (!def) return false
    return realmOrdinal(realm) >= realmOrdinal(def.requiredRealm)
  }

  /**
   * Thử thi triển. Trả về lý do thất bại để UI nói cho người chơi biết — im lặng
   * không làm gì là cách nhanh nhất khiến người chơi tưởng game bị treo.
   */
  tryCast(
    id: string,
    realm: RealmPosition,
    linhLuc: number,
    ctx: CastContext,
  ): { ok: true; cost: number } | { ok: false; reason: string } {
    const def = SKILL_BY_ID.get(id)
    if (!def) return { ok: false, reason: 'Không có pháp thuật ở ô này' }
    if (this.phase !== 'none') return { ok: false, reason: 'Đang thi triển' }
    if (this.owner.immobilized) return { ok: false, reason: 'Không thi triển được' }
    if (!this.isUnlocked(id, realm)) {
      return { ok: false, reason: `Chưa đủ cảnh giới để dùng ${def.name}` }
    }
    if ((this.cooldowns.get(id) ?? 0) > 0) {
      return { ok: false, reason: `${def.name} đang hồi` }
    }
    if (!this.freeCast && linhLuc < def.linhLucCost) {
      return { ok: false, reason: 'Không đủ linh lực' }
    }

    this.activeId = id
    this.phase = 'dan'
    this.phaseTimer = def.castTime
    if (!this.noCooldown) this.cooldowns.set(id, def.cooldown)
    // Chốt điểm ngắm ngay lúc bấm, không đọc lại lúc chiêu phát.
    // Nếu đọc lại thì người chơi rê chuột trong lúc dẫn khí sẽ làm chiêu "đi
    // theo chuột", và cảm giác điều khiển trở nên trơn tuột không có sức nặng.
    this.pendingCursorX = ctx.cursorX
    this.pendingCursorZ = ctx.cursorZ
    this.pendingRealm = { major: realm.major, tier: realm.tier }

    this.bus.emit('skill:cast', {
      id: def.id,
      side: this.owner.side,
      x: this.owner.pos.x,
      y: this.owner.y,
      z: this.owner.pos.z,
      element: def.element,
      castTime: def.castTime,
    })
    return { ok: true, cost: this.freeCast ? 0 : def.linhLucCost }
  }

  /**
   * Hệ số pháp lực của Đại Diễn Quyết, 1 khi không có.
   *
   * Ở đây chứ không trong `computeDamage`: nó không nhân vào sát thương của một
   * ĐÒN, nó nhân vào những thứ pháp thuật DỰNG RA — khiên và đàn kiếm. Nhân vào
   * công thức sát thương thì nó trùng vai với Giá Y Thần Công và hai chiêu mất
   * hết khác biệt.
   */
  private phapLucMult(): number {
    return 1 + (this.owner.effects.find('daiDien')?.magnitude ?? 0)
  }

  fixedUpdate(dt: number, ctx: CastContext): void {
    for (const [id, left] of this.cooldowns) {
      const next = left - dt
      if (next <= 0) this.cooldowns.delete(id)
      else this.cooldowns.set(id, next)
    }

    // Nhịp bùng còn nợ chạy ĐỘC LẬP với pha thi triển: Tam Diễm Phiến quạt hết
    // ba lần trong 1,3 giây, còn thu thế chỉ 0,45 giây — buộc chúng vào pha thì
    // hai nhịp cuối biến mất đúng lúc người chơi đã đi tiếp.
    this.tickPulses(dt, ctx.world)

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
      this.activeId = null
      return
    }

    this.phaseTimer -= dt
    if (this.phaseTimer > 0) return

    const def = this.activeSkill
    if (!def) {
      this.phase = 'none'
      this.activeId = null
      return
    }

    if (this.phase === 'dan') {
      this.execute(def, ctx)
      this.phase = 'hoi'
      this.phaseTimer = def.recover
      return
    }

    this.phase = 'none'
    this.activeId = null
  }

  private tickPulses(dt: number, world: CombatWorld): void {
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i] as PendingPulse
      p.timer -= dt
      if (p.timer > 0) continue
      this.applyArea(p.def, p.action, p.cx, p.cz, world)
      p.left -= 1
      if (p.left <= 0) this.pending.splice(i, 1)
      else p.timer = p.action.pulseInterval ?? 0.4
    }
  }

  private execute(def: SkillDef, ctx: CastContext): void {
    const me = this.owner

    switch (def.action.type) {
      case 'phiHanh': {
        const { spec, volley } = def.action
        const count = volley?.count ?? 1
        const spread = volley?.spread ?? 0
        // Quạt ĐỐI XỨNG quanh hướng nhìn: chia đều thì viên chính giữa nằm đúng
        // hướng ngắm, và người chơi ngắm vào đâu thì đòn nặng nhất rơi vào đó
        const step = count > 1 ? spread / (count - 1) : 0
        const base = me.facing - spread / 2
        for (let i = 0; i < count; i++) {
          const a = base + step * i
          ctx.projectiles.fire(me, spec, Math.sin(a), Math.cos(a))
        }
        break
      }

      case 'kiemVu': {
        const a = def.action
        // Đại Diễn Quyết mạnh thêm cả SÁT THƯƠNG và THỜI GIAN của đàn kiếm.
        // Trong nguyên tác nó là công pháp cho phép điều khiển nhiều pháp bảo
        // cùng lúc, nên chỗ nó phải hiện ra rõ nhất là bản mệnh pháp bảo.
        // Không tăng bán kính: vòng quét rộng ra thì đàn kiếm rải mỏng và người
        // chơi mất luôn khả năng lái nó bằng cách đi bộ.
        const boost = this.phapLucMult()
        ctx.swords.cast(me, {
          radius: a.radius,
          mult: a.mult * boost,
          duration: a.duration * boost,
          knockback: a.knockback,
          stagger: a.stagger,
          hitInterval: a.hitInterval,
          // Số kiếm suy từ CẢNH GIỚI, không từ Đại Diễn Quyết: thứ quyết định
          // ngự nổi bao nhiêu thanh là thần thức NỀN, còn Đại Diễn Quyết chỉ là
          // một cú bùng tạm. Cho nó thêm kiếm thì vòng kiếm dày lên rồi mỏng
          // lại giữa trận, và người chơi mất mốc để đọc cảnh giới của mình.
          count: soKiemTruc(this.pendingRealm),
        })
        break
      }

      case 'thanPhap': {
        const { distance, duration, after } = def.action
        // Ưu tiên hướng người chơi đang ĐI; không bấm phím nào thì mới theo
        // hướng đang nhìn
        const dirLen = Math.hypot(ctx.dashDirX ?? 0, ctx.dashDirZ ?? 0)
        const dirX = dirLen > 1e-4 ? (ctx.dashDirX as number) / dirLen : Math.sin(me.facing)
        const dirZ = dirLen > 1e-4 ? (ctx.dashDirZ as number) / dirLen : Math.cos(me.facing)

        this.dash.active = true
        this.dash.remaining = duration
        this.dash.vx = (dirX * distance) / duration
        this.dash.vz = (dirZ * distance) / duration
        // Miễn thương suốt cú lướt: đó chính là công dụng của thân pháp — một
        // nút "né đòn", không phải chỉ là đi nhanh
        me.invuln = Math.max(me.invuln, duration + 0.05)
        // Đuôi trạng thái là thứ phân biệt Phong Lôi Sí với Phong Độn Thuật:
        // một cái là bước nhảy, cái kia là mọc cánh rồi vẫn còn cánh
        if (after) me.effects.apply(after.kind, after.duration, after.magnitude, me.id)
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
        const a = def.action
        // Hai đường ra độ mạnh. Suy từ Thần Thức cho những thứ là một LƯỢNG
        // (khiên hấp thụ bao nhiêu sát thương) nên nó tự lên theo cảnh giới;
        // còn `magnitudeFlat` cho những thứ là một TỈ LỆ, vì nhân tỉ lệ theo
        // cảnh giới thì tới Kết Đan Giá Y Thần Công cộng 4000% sát thương.
        let magnitude =
          a.magnitudeFlat ?? Math.round(me.stats.thanThuc * (a.magnitudeFromThanThuc ?? 0))
        // Đại Diễn Quyết nhân vào MỌI thứ suy từ thần thức — đó chính là nghĩa
        // của nó trong nguyên tác: thần thức bùng lên thì pháp lực bùng theo
        if (a.magnitudeFromThanThuc) magnitude = Math.round(magnitude * this.phapLucMult())
        me.effects.apply(a.kind, a.duration, magnitude, me.id)
        // Đốt tinh huyết SAU khi trạng thái đã lên: nếu trừ trước thì một lần
        // thi triển thất bại ở dòng nào phía dưới cũng vẫn lấy mất máu
        if (a.sinhLucCostFrac) {
          me.hp = Math.max(1, me.hp - Math.round(me.stats.maxSinhLuc * a.sinhLucCostFrac))
        }
        const { kind, duration } = a
        this.bus.emit('skill:buff', {
          id: def.id,
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

        this.applyArea(def, a, cx, cz, ctx.world)

        const pulses = a.pulses ?? 1
        if (pulses > 1) {
          this.pending.push({
            def,
            action: a,
            cx,
            cz,
            left: pulses - 1,
            timer: a.pulseInterval ?? 0.4,
          })
        }
        break
      }
    }
  }

  /**
   * Một nhịp bùng của pháp vực: gây sát thương, áp trạng thái, hất hoặc hút.
   *
   * Tách khỏi `execute` vì nhịp thứ hai trở đi gọi lại chính nó từ `tickPulses`,
   * và mỗi nhịp phải TRUY VẤN LẠI vòng tròn — dùng lại danh sách mục tiêu của
   * nhịp đầu thì con quái đã chạy khỏi biển lửa vẫn tiếp tục cháy, còn con vừa
   * chạy vào thì không việc gì.
   */
  private applyArea(
    def: SkillDef,
    a: AreaAction,
    cx: number,
    cz: number,
    world: CombatWorld,
  ): void {
    const me = this.owner

    // PHẢI dùng isHostile, không phải `side !== me.side`:
    // với người chơi thì 'ally' !== 'player' là true, nên phép so sánh thô
    // biến mọi pháp vực thành đánh cả đồng môn — sẽ hỏng nặng ở đại chiến.
    const count = world.queryCircle(
      cx,
      cz,
      a.radius,
      this.aoeBuffer,
      (c) => c.alive && isHostile(me.side, c.side),
    )

    // Ngũ hành của CHIÊU, không phải của người thi triển
    const savedElement = me.stats.element
    const savedCong = me.stats.cong
    me.stats.element = a.element
    for (let i = 0; i < count; i++) {
      const victim = this.aoeBuffer[i] as Combatant
      victim.invuln = 0
      // Hất/hút tự làm ở đây chứ không nhờ `strike`: `strike` đẩy ra xa NGƯỜI
      // THI TRIỂN, mà pháp vực đặt tại con trỏ thì gốc đúng phải là TÂM VÙNG —
      // sai gốc thì một quả sấm rơi phía sau lưng địch lại hất nó về phía mình.
      // Đây cũng là chỗ số ÂM thành lực hút, thứ Nguyên Từ Thần Quang cần.
      if (a.knockback !== 0) {
        victim.addKnockback(victim.pos.x - cx, victim.pos.z - cz, a.knockback)
      }
      if (a.mult > 0) {
        world.strike(me, victim, a.mult, { knockback: 0, stagger: a.stagger })
      } else if (a.stagger > 0) {
        // Trận pháp không gây sát thương nhưng vẫn phải KHOÁ được: không có
        // nhánh này thì `mult: 0` đi qua `strike` và trận kỳ hoá thành vô hình
        victim.stagger = Math.max(victim.stagger, a.stagger)
      }
      if (a.onHit) {
        // DoT của chiêu người chơi phải suy theo công, nếu không thì con số
        // cân được ở Trúc Cơ tới Kết Đan chỉ còn là tiếng gõ cửa
        const dot = a.onHit.magnitude + savedCong * (a.onHit.magnitudeFromCong ?? 0)
        victim.effects.apply(a.onHit.kind, a.onHit.duration, Math.round(dot), me.id)
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
  }

  reset(): void {
    this.phase = 'none'
    this.activeId = null
    this.phaseTimer = 0
    this.cooldowns.clear()
    this.pending.length = 0
    this.dash.active = false
    this.dash.vx = 0
    this.dash.vz = 0
    this.dash.remaining = 0
  }
}
