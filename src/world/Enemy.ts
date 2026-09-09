import { buildBeast, beastRadius } from '@/art/buildBeast'
import { buildChibi, chibiRadius } from '@/art/buildChibi'
import type { Rng } from '@/core/Rng'
import type { EnemyDef } from '@/game/data/enemies'
import { deriveStats } from '@/game/Stats'
import { Combatant } from './Combatant'
import type { CollisionWorld } from './Collision'
import type { CombatWorld } from './CombatWorld'
import type { HeightField } from './Terrain'
import { BeastView, ChibiView } from './views'

export type EnemyState = 'idle' | 'chase' | 'circle' | 'windup' | 'recover'

export interface EnemyContext {
  world: CombatWorld
  collision: CollisionWorld
  ground: HeightField
  rng: Rng
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
export class Enemy {
  readonly combatant: Combatant
  state: EnemyState = 'idle'

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
  private readonly homeX: number
  private readonly homeZ: number
  private readonly hitBuffer: Combatant[] = []

  constructor(
    readonly def: EnemyDef,
    x: number,
    z: number,
    ground: HeightField,
    rng: Rng,
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

    this.combatant = new Combatant('enemy', stats, def.realm, radius, view)
    this.homeX = x
    this.homeZ = z
    this.circleDir = rng.chance(0.5) ? 1 : -1
    this.wanderAngle = rng.float(0, Math.PI * 2)
    this.wanderTimer = rng.float(0, 2.5)

    this.combatant.place(x, z, ground.heightAt(x, z), rng.float(0, Math.PI * 2))
    view.showIdle()
  }

  fixedUpdate(dt: number, ctx: EnemyContext): void {
    const me = this.combatant
    me.tickTimers(dt)

    if (me.dead) {
      // Xác vẫn bị đẩy lùi cho nốt đà, rồi nằm im
      this.applyMotion(dt, 0, 0, ctx)
      return
    }

    if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - dt)

    // Choáng: mất điều khiển hoàn toàn, chỉ còn quán tính và đẩy lùi.
    // Đây là thứ làm đòn đánh của người chơi "có sức nặng" — quái phải mất nhịp.
    if (me.stagger > 0) {
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

  private tickIdle(dt: number, ctx: EnemyContext, target: Combatant | null): void {
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
    this.steer(dt, dirX, dirZ, this.combatant.stats.toc * 0.34, ctx)
  }

  private tickPursue(dt: number, ctx: EnemyContext, target: Combatant | null): void {
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

    this.steer(dt, dirX, dirZ, this.combatant.stats.toc, ctx)
  }

  private beginAttack(): void {
    this.state = 'windup'
    this.attackTimer = this.def.attackWindup
    this.swingResolved = false
    this.cooldown = this.def.attackCooldown
    this.combatant.view.showAttack(0)
  }

  private tickWindup(dt: number, ctx: EnemyContext, target: Combatant | null): void {
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

  private resolveSwing(ctx: EnemyContext): void {
    const me = this.combatant
    const radius = this.def.attackRange + me.radius
    ctx.world.announceSwing(me, me.facing, radius)
    const count = ctx.world.queryCone(me, me.facing, this.def.attackArc, radius, this.hitBuffer)
    for (let i = 0; i < count; i++) {
      const victim = this.hitBuffer[i] as Combatant
      ctx.world.strike(me, victim, this.def.attackMult, {
        knockback: this.def.knockback,
        stagger: 0.22,
      })
    }
  }

  /** Đặt vận tốc mong muốn theo hướng đã chọn. */
  private steer(dt: number, dirX: number, dirZ: number, maxSpeed: number, ctx: EnemyContext): void {
    const k = 1 - Math.exp(-ACCEL * dt)
    this.vx += (dirX * maxSpeed - this.vx) * k
    this.vz += (dirZ * maxSpeed - this.vz) * k
    this.applyMotion(dt, this.vx, this.vz, ctx)
  }

  /** Tích hợp chuyển động: vận tốc + đẩy lùi, rồi va chạm và bám mặt đất. */
  private applyMotion(dt: number, vx: number, vz: number, ctx: EnemyContext): void {
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
