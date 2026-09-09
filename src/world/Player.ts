import { MathUtils, Vector3 } from 'three'
import { buildChibi, chibiRadius, type Chibi } from '@/art/buildChibi'
import type { Input } from '@/core/Input'
import { MouseBtn } from '@/core/Input'
import {
  ATTACK_STEPS,
  COMBO_CHAIN_WINDOW,
  HAN_LAP_BASE,
  HAN_LAP_LOOK,
  START_REALM,
  type AttackStep,
} from '@/game/data/player'
import type { RealmPosition } from '@/game/data/realms'
import { deriveStats } from '@/game/Stats'
import type { IsoCamera } from '@/render/IsoCamera'
import type { CollisionWorld } from './Collision'
import { Combatant } from './Combatant'
import type { CombatWorld } from './CombatWorld'
import type { HeightField } from './Terrain'
import { ChibiView } from './views'

/** Tốc độ chạy mặc định (world unit / giây) — lấy từ chỉ số nền. */
const WALK_MULTIPLIER = 0.42
const ACCEL = 26
const DECEL = 34
/** Rad/giây. Đủ nhanh để thấy nhạy, đủ chậm để cú quay người còn đọc được. */
const TURN_RATE = 13
/** Quay nhanh hơn nhiều khi ra đòn, để đòn đánh đi đúng hướng con trỏ. */
const ATTACK_TURN_RATE = 26

/**
 * Hỗ trợ ngắm: lúc bắt đầu đòn, nếu có địch trong tầm và nằm trong nửa góc này
 * so với hướng đang ngắm, thì tự chỉnh hướng vào nó.
 *
 * Cần thiết vì ngắm hoàn toàn theo con trỏ rất dễ trượt: người chơi đang bấm
 * WASD chạy thì tay chuột không theo kịp, và một đòn chém trượt vì lệch 10 độ
 * đọc ra là "game không nhận input" chứ không phải "mình ngắm sai".
 * Vẫn giữ nửa góc HẸP (60 độ) để việc quay người và chọn mục tiêu còn ý nghĩa.
 */
const AIM_ASSIST_ARC = Math.PI / 3
/** Nhân vào tầm đòn để tìm mục tiêu hỗ trợ ngắm. */
const AIM_ASSIST_REACH = 1.7

/** Giới hạn mềm của bản đồ — không cho đi mãi vào trong sương. */
const WORLD_RADIUS = 70

type AttackPhase = 'none' | 'windup' | 'recover'

/** Nội suy góc theo đường ngắn nhất, có giới hạn bước. */
function turnToward(from: number, to: number, maxStep: number): number {
  let d = to - from
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  if (Math.abs(d) <= maxStep) return to
  return from + Math.sign(d) * maxStep
}

export class Player {
  readonly chibi: Chibi
  readonly combatant: Combatant
  realm: RealmPosition = { ...START_REALM }

  private ground: HeightField | null = null
  private vx = 0
  private vz = 0
  private speed = 0

  /** Linh lực hiện tại. Chưa tiêu vào đâu tới M4, nhưng đã hồi để HUD nói thật. */
  linhLuc = 0

  private phase: AttackPhase = 'none'
  private comboStep = 0
  private phaseTimer = 0
  private chainTimer = 0
  private queuedAttack = false

  private readonly forward = new Vector3()
  private readonly right = new Vector3()
  private readonly aimPoint = new Vector3()
  private readonly hitBuffer: Combatant[] = []

  constructor() {
    this.chibi = buildChibi({
      name: 'HanLap',
      height: 1,
      detail: 'full',
      ...HAN_LAP_LOOK,
    })
    const stats = deriveStats(HAN_LAP_BASE, this.realm)
    this.combatant = new Combatant(
      'player',
      stats,
      this.realm,
      chibiRadius(1),
      new ChibiView(this.chibi),
    )
    this.combatant.view.showIdle()
    this.linhLuc = stats.maxLinhLuc
  }

  get pos(): { x: number; z: number } {
    return this.combatant.pos
  }

  get y(): number {
    return this.combatant.y
  }

  get radius(): number {
    return this.combatant.radius
  }

  get isAttacking(): boolean {
    return this.phase !== 'none'
  }

  /** Gắn nguồn cao độ. Phải gọi trước spawn(). */
  setGround(ground: HeightField): void {
    this.ground = ground
  }

  private groundHeight(x: number, z: number): number {
    return this.ground ? this.ground.heightAt(x, z) : 0
  }

  /** Cập nhật stat sau khi đột phá cảnh giới (M5). */
  refreshStats(): void {
    const hpRatio = this.combatant.hp / Math.max(1, this.combatant.stats.maxSinhLuc)
    const mpRatio = this.linhLuc / Math.max(1, this.combatant.stats.maxLinhLuc)
    this.combatant.stats = deriveStats(HAN_LAP_BASE, this.realm)
    this.combatant.realm = this.realm
    // Giữ TỈ LỆ chứ không giữ con số: đột phá mà máu vẫn 30/1200 thì vô nghĩa
    this.combatant.hp = Math.max(1, Math.round(this.combatant.stats.maxSinhLuc * hpRatio))
    this.linhLuc = Math.round(this.combatant.stats.maxLinhLuc * mpRatio)
  }

  /** Hồi sinh đầy máu tại chỗ chỉ định. */
  revive(x: number, z: number, facing = 0): void {
    this.combatant.dead = false
    this.combatant.deadFor = 0
    this.combatant.hp = this.combatant.stats.maxSinhLuc
    this.linhLuc = this.combatant.stats.maxLinhLuc
    this.combatant.stagger = 0
    this.combatant.invuln = 1.2
    this.combatant.knockVx = 0
    this.combatant.knockVz = 0
    this.spawn(x, z, facing)
    this.combatant.view.showIdle()
  }

  spawn(x: number, z: number, facing = 0): void {
    this.combatant.place(x, z, this.groundHeight(x, z), facing)
    this.vx = 0
    this.vz = 0
    this.speed = 0
    this.phase = 'none'
    this.comboStep = 0
    this.chainTimer = 0
    this.queuedAttack = false
  }

  /** Nhịp fixed 60Hz. */
  fixedUpdate(
    dt: number,
    input: Input,
    camera: IsoCamera,
    collision: CollisionWorld,
    world: CombatWorld,
  ): void {
    const me = this.combatant
    me.tickTimers(dt)

    // Trường Xuân Công: hồi linh lực liên tục. Trong truyện đây chính là ưu thế
    // lớn nhất của công pháp này — tu luyện và hồi phục nhanh hơn người khác.
    this.linhLuc = Math.min(me.stats.maxLinhLuc, this.linhLuc + me.stats.maxLinhLuc * 0.035 * dt)

    if (me.dead) {
      this.applyMotion(dt, 0, 0, collision)
      return
    }

    // Ghi nhận lệnh đánh và GIỮ LẠI, không bỏ.
    // Người chơi luôn bấm hơi sớm; nếu bỏ lệnh bấm trong lúc đang hồi đòn thì
    // combo hay bị "rơi nhát" và cảm giác điều khiển thành ì.
    //
    // GIỮ cũng đánh, không chỉ BẤM. Hai lý do:
    //  - Đó là điều người chơi ARPG mong đợi: giữ chuột là chém liên tục.
    //  - Nếu chỉ nhận lúc bấm thì hành vi không nhất quán: khi cửa sổ mất rồi
    //    lấy lại focus, `releaseAll()` xoá trạng thái phím nên sự kiện auto-repeat
    //    tiếp theo bị tính là một lần bấm mới và đòn tự phát. Nhận cả trạng thái
    //    giữ thì hai đường đi cho ra cùng một kết quả.
    const attackPressed = input.mouseWasPressed(MouseBtn.Left) || input.wasPressed('KeyJ')
    const attackHeld = input.mouseIsDown(MouseBtn.Left) || input.isDown('KeyJ')
    if (attackPressed || (attackHeld && this.phase === 'none')) {
      this.queuedAttack = true
    }

    if (me.stagger > 0) {
      // Trúng đòn thì đòn đang ra bị huỷ
      this.phase = 'none'
      this.chainTimer = 0
      this.applyMotion(dt, 0, 0, collision)
      this.combatant.view.showMove(this.speed)
      return
    }

    this.updateAim(input, camera, dt)
    this.updateAttack(dt, world)
    this.updateMovement(dt, input, camera, collision)

    if (this.phase === 'none') this.combatant.view.showMove(this.speed)
  }

  /** Trong lúc ra đòn thì quay theo con trỏ chuột — ngắm bằng chuột như ARPG. */
  private updateAim(input: Input, camera: IsoCamera, dt: number): void {
    if (this.phase !== 'windup') return
    const me = this.combatant
    if (!camera.screenToGround(input.pointerNdcX, input.pointerNdcY, this.aimPoint, me.y)) return
    const dx = this.aimPoint.x - me.pos.x
    const dz = this.aimPoint.z - me.pos.z
    if (Math.hypot(dx, dz) < 0.25) return
    me.facing = turnToward(me.facing, Math.atan2(dx, dz), ATTACK_TURN_RATE * dt)
  }

  private currentStep(): AttackStep {
    return ATTACK_STEPS[Math.min(this.comboStep, ATTACK_STEPS.length - 1)] as AttackStep
  }

  private updateAttack(dt: number, world: CombatWorld): void {
    if (this.chainTimer > 0) this.chainTimer = Math.max(0, this.chainTimer - dt)

    if (this.phase === 'none') {
      if (this.queuedAttack) {
        this.queuedAttack = false
        // Còn trong cửa sổ nối thì sang nhát tiếp, hết thì về nhát 1
        this.comboStep = this.chainTimer > 0 ? (this.comboStep + 1) % ATTACK_STEPS.length : 0
        this.beginStep(world)
      }
      return
    }

    this.phaseTimer -= dt

    if (this.phase === 'windup' && this.phaseTimer <= 0) {
      this.resolveSwing(world)
      this.phase = 'recover'
      this.phaseTimer = this.currentStep().recover
      this.chainTimer = COMBO_CHAIN_WINDOW
      return
    }

    if (this.phase === 'recover' && this.phaseTimer <= 0) {
      this.phase = 'none'
      if (this.queuedAttack) {
        this.queuedAttack = false
        this.comboStep = this.chainTimer > 0 ? (this.comboStep + 1) % ATTACK_STEPS.length : 0
        this.beginStep(world)
      }
    }
  }

  private beginStep(world: CombatWorld): void {
    const step = this.currentStep()
    this.phase = 'windup'
    this.phaseTimer = step.windup
    this.applyAimAssist(world, step)
    this.combatant.view.showAttack(this.comboStep)
  }

  /** Chỉnh hướng vào địch gần nhất nếu nó đã nằm trong góc ngắm. */
  private applyAimAssist(world: CombatWorld, step: AttackStep): void {
    const me = this.combatant
    const reach = (step.range + me.radius) * AIM_ASSIST_REACH
    const foe = world.nearestHostile(me, reach)
    if (!foe) return

    const dx = foe.pos.x - me.pos.x
    const dz = foe.pos.z - me.pos.z
    const dist = Math.hypot(dx, dz)
    if (dist < 1e-4) return

    const desired = Math.atan2(dx, dz)
    let delta = desired - me.facing
    while (delta > Math.PI) delta -= Math.PI * 2
    while (delta < -Math.PI) delta += Math.PI * 2
    // Ngoài góc hỗ trợ thì tôn trọng hướng người chơi đang ngắm
    if (Math.abs(delta) > AIM_ASSIST_ARC) return

    me.facing = desired
  }

  private resolveSwing(world: CombatWorld): void {
    const me = this.combatant
    const step = this.currentStep()
    const radius = step.range + me.radius
    world.announceSwing(me, me.facing, radius)
    const count = world.queryCone(me, me.facing, step.arc, radius, this.hitBuffer)
    for (let i = 0; i < count; i++) {
      const victim = this.hitBuffer[i] as Combatant
      world.strike(me, victim, step.mult, {
        knockback: step.knockback,
        stagger: step.stagger,
      })
    }
  }

  private updateMovement(
    dt: number,
    input: Input,
    camera: IsoCamera,
    collision: CollisionWorld,
  ): void {
    const axis = input.moveAxis()

    // Hướng đi tính theo GÓC CAMERA, không theo trục thế giới: người chơi xoay
    // camera thì "W" phải luôn là "đi lên phía trên màn hình"
    camera.forwardOnGround(this.forward)
    camera.rightOnGround(this.right)
    let dx = this.right.x * axis.x + this.forward.x * -axis.z
    let dz = this.right.z * axis.x + this.forward.z * -axis.z

    const inputLen = Math.hypot(dx, dz)
    const walking = input.isDown('ShiftLeft') || input.isDown('ShiftRight')
    // Ra đòn thì chậm lại chứ KHÔNG đứng hẳn: đứng hẳn làm combat cứng như
    // xem phim, còn chậm lại vẫn giữ được sức nặng của đòn đánh
    const attackScale = this.phase === 'none' ? 1 : this.currentStep().moveScale
    const base = this.combatant.stats.toc * (walking ? WALK_MULTIPLIER : 1)
    const targetSpeed = inputLen > 1e-4 ? base * attackScale : 0

    if (inputLen > 1e-4) {
      dx /= inputLen
      dz /= inputLen
      const k = 1 - Math.exp(-ACCEL * dt)
      this.vx += (dx * targetSpeed - this.vx) * k
      this.vz += (dz * targetSpeed - this.vz) * k
      // Chỉ quay theo hướng đi khi KHÔNG ra đòn — lúc ra đòn thì con trỏ quyết định
      if (this.phase !== 'windup') {
        this.combatant.facing = turnToward(
          this.combatant.facing,
          Math.atan2(dx, dz),
          TURN_RATE * dt,
        )
      }
    } else {
      const k = 1 - Math.exp(-DECEL * dt)
      this.vx -= this.vx * k
      this.vz -= this.vz * k
    }

    this.applyMotion(dt, this.vx, this.vz, collision)
  }

  private applyMotion(dt: number, vx: number, vz: number, collision: CollisionWorld): void {
    const me = this.combatant
    if (vx === 0 && vz === 0) {
      const k = 1 - Math.exp(-DECEL * dt)
      this.vx -= this.vx * k
      this.vz -= this.vz * k
    }

    me.pos.x += (this.vx + me.knockVx) * dt
    me.pos.z += (this.vz + me.knockVz) * dt

    collision.resolve(me.pos, me.radius)

    const distFromCenter = Math.hypot(me.pos.x, me.pos.z)
    if (distFromCenter > WORLD_RADIUS) {
      const s = WORLD_RADIUS / distFromCenter
      me.pos.x *= s
      me.pos.z *= s
    }

    // Tốc độ THỰC TẾ sau va chạm, không phải tốc độ mong muốn: khi bị chặn bởi
    // tảng đá thì nhân vật phải đứng yên chứ không được chạy tại chỗ
    this.speed = MathUtils.clamp(Math.hypot(this.vx, this.vz), 0, 99)
    me.y = this.groundHeight(me.pos.x, me.pos.z)
    me.applyTransform()
  }

  /** Nhịp frame: chỉ animation, để chuyển động mượt hơn 60Hz. */
  render(frameDt: number): void {
    this.combatant.view.update(frameDt)
  }
}
