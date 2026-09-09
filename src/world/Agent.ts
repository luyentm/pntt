import { buildBeast, beastRadius } from '@/art/buildBeast'
import { buildChibi, chibiRadius } from '@/art/buildChibi'
import type { Rng } from '@/core/Rng'
import type { BossPhase, UnitDef } from '@/game/data/units'
import { deriveStats } from '@/game/Stats'
import { Combatant, isHostile, type Side } from './Combatant'
import type { CollisionWorld } from './Collision'
import type { CombatWorld } from './CombatWorld'
import type { ProjectileSystem } from './Projectile'
import type { HeightField } from './Terrain'
import { BeastView, ChibiView } from './views'

export type AgentState = 'idle' | 'chase' | 'circle' | 'windup' | 'recover'

export interface AgentContext {
  world: CombatWorld
  collision: CollisionWorld
  ground: HeightField
  rng: Rng
  /** Cần cho đơn vị đánh xa (ma đạo tán tu). */
  projectiles: ProjectileSystem
  /** Tướng vừa vào phase mới — màn nghe để gọi tay sai và báo UI. */
  onBossPhase?: (agent: Agent, phase: BossPhase, index: number) => void
}

const TURN_RATE = 7
const ACCEL = 16
const DECEL = 20
/** Bán kính lảng vảng quanh điểm sinh khi chưa phát hiện mục tiêu. */
const WANDER_RADIUS = 5

/** Nội suy góc theo đường ngắn nhất, có giới hạn bước. */
function turnToward(from: number, to: number, maxStep: number): number {
  let d = to - from
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  if (Math.abs(d) <= maxStep) return to
  return from + Math.sign(d) * maxStep
}

/**
 * Quái: máy trạng thái + lái theo hướng (steering).
 *
 * Cố tình tự viết thay vì dùng thư viện AI. Ba lý do cụ thể:
 *  - Tách đàn (separation) chạy trên CÙNG chỉ mục không gian đã có sẵn cho
 *    hitbox, nên không phải nuôi cấu trúc thứ hai và đồng bộ vị trí qua lại.
 *  - Thư viện AI dùng Math.random() bên trong (wander, chọn vùng), làm mất tính
 *    xác định mà cả game được thiết kế quanh (Rng có seed + fixed timestep).
 *  - Điểm mạnh riêng của chúng là tìm đường trên navmesh, thứ đấu trường mở
 *    này không cần.
 */
export class Agent {
  readonly combatant: Combatant
  state: AgentState = 'idle'
  /** Phase hiện tại của tướng; -1 nếu đây không phải tướng. */
  phaseIndex = -1
  /**
   * Con này có thuộc một đợt của chế độ thủ trận hay không.
   *
   * Chỉ quái có cờ này mới tính vào điều kiện "dẹp xong đợt". Quái nền và quái
   * sinh bằng bảng debug thì không — nếu tính hết thì một con yêu thử lang thang
   * ở rìa bản đồ sẽ khoá cứng cả đợt, và người chơi phải đi lùng nó khắp map.
   */
  waveTag = false

  private vx = 0
  private vz = 0
  private speed = 0
  private attackTimer = 0
  private cooldown = 0
  private swingResolved = false
  /** Chiều vờn quanh mục tiêu: +1 hoặc -1. */
  private circleDir = 1
  private wanderAngle = 0
  private wanderTimer = 0
  private slamTimer = 0
  /**
   * Điểm neo khi chưa có mục tiêu. KHÔNG readonly.
   *
   * Với quái đây là điểm sinh, nên chúng lảng vảng tại chỗ. Với đệ tử đồng môn
   * thì màn cập nhật điểm này theo người chơi mỗi bước — nhờ vậy "đi theo chủ"
   * không cần thêm một trạng thái nào vào máy trạng thái, nó chính là hành vi
   * lảng vảng quanh nhà với cái nhà biết đi.
   */
  private homeX: number
  private homeZ: number
  private readonly hitBuffer: Combatant[] = []

  constructor(
    readonly def: UnitDef,
    x: number,
    z: number,
    ground: HeightField,
    rng: Rng,
    /**
     * Phe. Cùng một máy trạng thái chạy cho cả ma đạo và đệ tử Thất Huyền Môn:
     * mọi chỗ chọn mục tiêu đều đi qua `isHostile`, nên đổi phe là đủ để một
     * con quái thành đồng đội — không có nhánh `if` nào cho riêng đồng minh.
     */
    side: Side = 'enemy',
  ) {
    const stats = deriveStats(def.base, def.realm)

    let view
    let radius
    if (def.look.rig === 'beast') {
      const beast = buildBeast({
        name: def.id,
        shape: def.look.shape,
        height: def.scale,
        fur: def.look.fur,
        furDark: def.look.furDark,
        belly: def.look.belly,
        eye: def.look.eye,
        nose: def.look.nose,
      })
      view = new BeastView(beast)
      radius = beastRadius(def.scale)
    } else {
      const chibi = buildChibi({
        name: def.id,
        height: def.scale,
        detail: 'simple',
        robe: def.look.robe,
        robeDark: def.look.robeDark,
        trim: def.look.trim,
        sash: def.look.sash,
        skin: def.look.skin,
        hair: def.look.hair,
        boot: def.look.boot,
        eye: def.look.eye,
      })
      view = new ChibiView(chibi)
      radius = chibiRadius(def.scale)
    }

    this.combatant = new Combatant(side, stats, def.realm, radius, view)
    this.homeX = x
    this.homeZ = z
    this.circleDir = rng.chance(0.5) ? 1 : -1
    this.wanderAngle = rng.float(0, Math.PI * 2)
    this.wanderTimer = rng.float(0, 2.5)

    this.combatant.place(x, z, ground.heightAt(x, z), rng.float(0, Math.PI * 2))
    view.showIdle()
  }

  /** Phase hiện tại, hoặc null nếu không phải tướng. */
  get phase(): BossPhase | null {
    const boss = this.def.boss
    if (!boss || this.phaseIndex < 0) return null
    return boss.phases[this.phaseIndex] ?? null
  }

  get isBoss(): boolean {
    return this.def.boss !== undefined
  }

  /**
   * Cập nhật phase theo sinh lực còn lại.
   *
   * Phase chỉ đi MỘT CHIỀU (`idx > phaseIndex`). Nếu cho lùi thì một lần hồi
   * máu sẽ khiến boss vào lại phase cũ và gọi thêm một lượt tay sai nữa — sân
   * đấu đầy quái mà người chơi không hiểu vì sao.
   */
  private updatePhase(dt: number, ctx: AgentContext): void {
    const boss = this.def.boss
    if (!boss) return

    const frac = this.combatant.hp / Math.max(1, this.combatant.stats.maxSinhLuc)
    let idx = 0
    for (let i = 0; i < boss.phases.length; i++) {
      if (frac <= (boss.phases[i] as BossPhase).atHp) idx = i
    }
    if (idx > this.phaseIndex) {
      this.phaseIndex = idx
      const entered = boss.phases[idx] as BossPhase
      // Nửa nhịp đầu tiên: vào phase là nổ đòn quét ngay thì người chơi không
      // kịp đọc chuyện gì vừa xảy ra
      this.slamTimer = entered.slam ? entered.slam.interval * 0.5 : 0
      ctx.onBossPhase?.(this, entered, idx)
    }

    const slam = this.phase?.slam
    if (!slam) return
    this.slamTimer -= dt
    if (this.slamTimer > 0) return
    this.slamTimer = slam.interval
    this.doSlam(ctx, slam)
  }

  /** Đòn quét vòng quanh mình — không cần ngắm, buộc người chơi phải giãn ra. */
  private doSlam(ctx: AgentContext, slam: NonNullable<BossPhase['slam']>): void {
    const me = this.combatant
    const count = ctx.world.queryCircle(
      me.pos.x,
      me.pos.z,
      slam.radius,
      this.hitBuffer,
      (c) => c.alive && isHostile(me.side, c.side),
    )
    for (let i = 0; i < count; i++) {
      const victim = this.hitBuffer[i] as Combatant
      victim.invuln = 0
      ctx.world.strike(me, victim, slam.mult, { knockback: slam.knockback, stagger: 0.4 })
    }
    ctx.world.bus.emit('skill:area', {
      x: me.pos.x,
      y: me.y,
      z: me.pos.z,
      radius: slam.radius,
      element: me.stats.element,
      skillId: 'bossSlam',
    })
    ctx.world.bus.emit('camera:shake', { magnitude: 0.3, duration: 0.28 })
  }

  /** Dời điểm neo. Đệ tử đồng môn dùng để đi theo người chơi. */
  setHome(x: number, z: number): void {
    this.homeX = x
    this.homeZ = z
  }

  fixedUpdate(dt: number, ctx: AgentContext): void {
    const me = this.combatant
    const dot = me.tickTimers(dt)
    if (dot > 0) ctx.world.applyDirectDamage(me, dot, me.effects.has('thieuDot') ? 'thieuDot' : 'trungDoc')

    if (me.dead) {
      // Xác vẫn bị đẩy lùi cho nốt đà, rồi nằm im
      this.applyMotion(dt, 0, 0, ctx)
      return
    }

    if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - dt)
    if (this.def.boss) this.updatePhase(dt, ctx)

    // Choáng hoặc bị đóng băng: mất điều khiển hoàn toàn, chỉ còn quán tính và
    // đẩy lùi. Đây là thứ làm đòn đánh của người chơi "có sức nặng".
    if (me.immobilized) {
      if (this.state === 'windup' || this.state === 'recover') this.state = 'chase'
      this.applyMotion(dt, 0, 0, ctx)
      return
    }

    const target = ctx.world.nearestHostile(me, this.def.aggroRange)

    switch (this.state) {
      case 'windup':
        this.tickWindup(dt, ctx, target)
        break
      case 'recover':
        this.attackTimer -= dt
        if (this.attackTimer <= 0) this.state = target ? 'chase' : 'idle'
        this.applyMotion(dt, 0, 0, ctx)
        break
      case 'idle':
        this.tickIdle(dt, ctx, target)
        break
      default:
        this.tickPursue(dt, ctx, target)
        break
    }

    this.combatant.view.showMove(this.speed)
  }

  private tickIdle(dt: number, ctx: AgentContext, target: Combatant | null): void {
    if (target) {
      this.state = this.def.circleDistance > 0 ? 'circle' : 'chase'
      return
    }

    this.wanderTimer -= dt
    if (this.wanderTimer <= 0) {
      this.wanderTimer = ctx.rng.float(1.8, 4.2)
      this.wanderAngle = ctx.rng.float(0, Math.PI * 2)
    }

    // Lảng vảng quanh điểm sinh, và bị kéo về nếu đi quá xa
    const me = this.combatant
    const toHomeX = this.homeX - me.pos.x
    const toHomeZ = this.homeZ - me.pos.z
    const homeDist = Math.hypot(toHomeX, toHomeZ)

    let dirX = Math.cos(this.wanderAngle)
    let dirZ = Math.sin(this.wanderAngle)
    if (homeDist > WANDER_RADIUS) {
      dirX = toHomeX / homeDist
      dirZ = toHomeZ / homeDist
    }

    // Lảng vảng chỉ đi bộ, không chạy.
    // Tốc độ lấy từ STAT ĐÃ SUY RA, không phải từ chỉ số nền: nếu đọc chỉ số nền
    // thì mọi hiệu ứng tác động lên tốc độ (Băng Phong Phù làm chậm, buff tăng
    // tốc) đều không có tác dụng gì — một lỗi im lặng rất khó phát hiện.
    this.steer(dt, dirX, dirZ, this.moveSpeed() * 0.34, ctx)
  }

  private tickPursue(dt: number, ctx: AgentContext, target: Combatant | null): void {
    if (!target) {
      this.state = 'idle'
      this.applyMotion(dt, 0, 0, ctx)
      return
    }

    const me = this.combatant
    const dx = target.pos.x - me.pos.x
    const dz = target.pos.z - me.pos.z
    const dist = Math.hypot(dx, dz)
    const reach = this.def.attackRange + target.radius + me.radius

    // Luôn hướng mặt về mục tiêu, kể cả khi đang vờn ngang
    if (dist > 1e-4) {
      me.facing = turnToward(me.facing, Math.atan2(dx, dz), TURN_RATE * dt)
    }

    if (dist <= reach && this.cooldown <= 0) {
      this.beginAttack()
      this.applyMotion(dt, 0, 0, ctx)
      return
    }

    if (dist < 1e-4) {
      this.applyMotion(dt, 0, 0, ctx)
      return
    }

    const nx = dx / dist
    const nz = dz / dist
    let dirX = nx
    let dirZ = nz

    // Vờn quanh: giữ khoảng cách rồi đi vòng, tạo cảm giác con thú đang rình.
    // Chỉ vờn khi đòn còn đang hồi — hết hồi thì lao vào ngay.
    if (this.def.circleDistance > 0 && this.cooldown > 0) {
      const ring = this.def.circleDistance
      const radial = dist - ring
      // Vector tiếp tuyến (vuông góc với hướng tới mục tiêu)
      const tx = -nz * this.circleDir
      const tz = nx * this.circleDir
      // Pha trộn: lệch khỏi vòng thì nghiêng về hướng xuyên tâm để quay lại vòng
      const pull = Math.max(-1, Math.min(1, radial / ring))
      dirX = tx * (1 - Math.abs(pull)) + nx * pull
      dirZ = tz * (1 - Math.abs(pull)) + nz * pull
      const len = Math.hypot(dirX, dirZ)
      if (len > 1e-5) {
        dirX /= len
        dirZ /= len
      }
    }

    this.steer(dt, dirX, dirZ, this.moveSpeed(), ctx)
  }

  /**
   * Tốc độ di chuyển hiện tại.
   *
   * Lấy từ STAT ĐÃ SUY RA rồi nhân hệ số phase — không đọc chỉ số nền, vì đọc
   * chỉ số nền sẽ làm mọi hiệu ứng tác động lên tốc độ im lặng mất tác dụng.
   */
  private moveSpeed(): number {
    return this.combatant.effectiveSpeed() * (this.phase?.speedMult ?? 1)
  }

  private beginAttack(): void {
    this.state = 'windup'
    this.attackTimer = this.def.attackWindup
    this.swingResolved = false
    this.cooldown = this.def.attackCooldown * (this.phase?.cooldownMult ?? 1)
    this.combatant.view.showAttack(0)
  }

  private tickWindup(dt: number, ctx: AgentContext, target: Combatant | null): void {
    const me = this.combatant

    // Vẫn quay theo mục tiêu trong lúc lấy đà, nhưng CHẬM hơn nhiều — nhờ vậy
    // người chơi né sang bên là thoát được đòn, tức là né có tác dụng thật
    if (target) {
      const dx = target.pos.x - me.pos.x
      const dz = target.pos.z - me.pos.z
      if (Math.hypot(dx, dz) > 1e-4) {
        me.facing = turnToward(me.facing, Math.atan2(dx, dz), TURN_RATE * 0.25 * dt)
      }
    }

    this.attackTimer -= dt
    if (this.attackTimer <= 0 && !this.swingResolved) {
      this.swingResolved = true
      this.resolveSwing(ctx)
      this.state = 'recover'
      this.attackTimer = this.def.attackRecover
    }
    this.applyMotion(dt, 0, 0, ctx)
  }

  private resolveSwing(ctx: AgentContext): void {
    const me = this.combatant

    // Đánh xa: phóng phi hành khí thay vì quét hình quạt. Cố ý KHÔNG gọi
    // announceSwing — vệt chém ở đây sẽ nói dối người chơi rằng vừa có một đòn
    // cận chiến, trong khi thứ đang bay tới là một lá phù.
    const ranged = this.def.ranged
    if (ranged) {
      ctx.projectiles.fire(me, ranged.spec, Math.sin(me.facing), Math.cos(me.facing))
      return
    }

    const radius = this.def.attackRange + me.radius
    ctx.world.announceSwing(me, me.facing, radius)
    const count = ctx.world.queryCone(me, me.facing, this.def.attackArc, radius, this.hitBuffer)
    const mult = this.def.attackMult * (this.phase?.damageMult ?? 1)
    const effect = this.def.attackEffect
    for (let i = 0; i < count; i++) {
      const victim = this.hitBuffer[i] as Combatant
      ctx.world.strike(me, victim, mult, {
        knockback: this.def.knockback,
        stagger: 0.22,
      })
      // Trạng thái gắn sau khi trúng, và chỉ khi còn sống: dán độc lên một cái
      // xác thì DoT sẽ tích tắc trên xác suốt lúc diễn cảnh chết
      if (effect && victim.alive) {
        victim.effects.apply(effect.kind, effect.duration, effect.magnitude, me.id)
      }
    }
  }

  /** Đặt vận tốc mong muốn theo hướng đã chọn. */
  private steer(dt: number, dirX: number, dirZ: number, maxSpeed: number, ctx: AgentContext): void {
    const k = 1 - Math.exp(-ACCEL * dt)
    this.vx += (dirX * maxSpeed - this.vx) * k
    this.vz += (dirZ * maxSpeed - this.vz) * k
    this.applyMotion(dt, this.vx, this.vz, ctx)
  }

  /** Tích hợp chuyển động: vận tốc + đẩy lùi, rồi va chạm và bám mặt đất. */
  private applyMotion(dt: number, vx: number, vz: number, ctx: AgentContext): void {
    const me = this.combatant

    if (vx === 0 && vz === 0) {
      const k = 1 - Math.exp(-DECEL * dt)
      this.vx -= this.vx * k
      this.vz -= this.vz * k
    }

    me.pos.x += (this.vx + me.knockVx) * dt
    me.pos.z += (this.vz + me.knockVz) * dt

    ctx.collision.resolve(me.pos, me.radius)
    me.y = ctx.ground.heightAt(me.pos.x, me.pos.z)

    // Tốc độ THỰC TẾ (không tính đẩy lùi) để chọn clip đi/chạy
    this.speed = Math.hypot(this.vx, this.vz)
    me.applyTransform()
  }

  /** Nhịp frame — chỉ animation. */
  render(frameDt: number): void {
    this.combatant.view.update(frameDt)
  }
}
