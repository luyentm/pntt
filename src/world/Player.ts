import { MathUtils, Vector3 } from 'three'
import { IDLE, RUN, WALK } from '@/anim/clips/locomotion'
import { buildHanLap } from '@/art/characters/HanLap'
import { chibiRadius, type Chibi } from '@/art/buildChibi'
import type { Input } from '@/core/Input'
import type { IsoCamera } from '@/render/IsoCamera'
import type { CollisionWorld } from './Collision'
import type { HeightField } from './Terrain'

/** Tốc độ chạy mặc định (world unit / giây). */
const RUN_SPEED = 4.3
/** Giữ Shift để đi chậm — cần khi ngắm chiêu hoặc lách qua khe hẹp. */
const WALK_SPEED = 1.8
const ACCEL = 26
const DECEL = 34
/** Rad/giây. Đủ nhanh để thấy nhạy, đủ chậm để cú quay người còn đọc được. */
const TURN_RATE = 13

/**
 * Tốc độ mà clip được tạo cho. Dùng để chỉnh timeScale theo tốc độ thật, nhờ vậy
 * nhịp bước chân khớp với chuyển động thay vì bàn chân trượt trên đất.
 */
const WALK_CLIP_SPEED = 2.0
const RUN_CLIP_SPEED = 4.4

/** Trên ngưỡng này thì chuyển sang clip chạy. */
const RUN_THRESHOLD = 2.7
/** Dưới ngưỡng này coi như đứng yên. */
const IDLE_THRESHOLD = 0.2

/** Giới hạn mềm của bản đồ — không cho đi mãi vào trong sương. */
const WORLD_RADIUS = 70

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
  readonly radius: number
  private ground: HeightField | null = null

  /** Vị trí trên mặt phẳng. Object riêng để truyền thẳng vào CollisionWorld.resolve. */
  readonly pos = { x: 0, z: 0 }
  y = 0
  facing = 0

  private vx = 0
  private vz = 0
  private speed = 0

  private readonly forward = new Vector3()
  private readonly right = new Vector3()

  constructor() {
    this.chibi = buildHanLap()
    this.radius = chibiRadius(1)
    this.chibi.animator.play(IDLE)
  }

  /** Gắn nguồn cao độ. Phải gọi trước spawn(). */
  setGround(ground: HeightField): void {
    this.ground = ground
  }

  private groundHeight(x: number, z: number): number {
    return this.ground ? this.ground.heightAt(x, z) : 0
  }

  get height(): number {
    return this.chibi.height
  }

  spawn(x: number, z: number, facing = 0): void {
    this.pos.x = x
    this.pos.z = z
    this.y = this.groundHeight(x, z)
    this.facing = facing
    this.vx = 0
    this.vz = 0
    this.speed = 0
    this.applyTransform()
  }

  /** Nhịp fixed 60Hz: đọc input, chuyển động, va chạm. */
  fixedUpdate(dt: number, input: Input, camera: IsoCamera, collision: CollisionWorld): void {
    const axis = input.moveAxis()

    // Hướng đi tính theo GÓC CAMERA, không theo trục thế giới: người chơi xoay
    // camera thì "W" phải luôn là "đi lên phía trên màn hình"
    camera.forwardOnGround(this.forward)
    camera.rightOnGround(this.right)
    let dx = this.right.x * axis.x + this.forward.x * -axis.z
    let dz = this.right.z * axis.x + this.forward.z * -axis.z

    const inputLen = Math.hypot(dx, dz)
    const targetSpeed = inputLen > 1e-4 ? (input.isDown('ShiftLeft') || input.isDown('ShiftRight') ? WALK_SPEED : RUN_SPEED) : 0

    if (inputLen > 1e-4) {
      dx /= inputLen
      dz /= inputLen
      const tvx = dx * targetSpeed
      const tvz = dz * targetSpeed
      const k = 1 - Math.exp(-ACCEL * dt)
      this.vx += (tvx - this.vx) * k
      this.vz += (tvz - this.vz) * k
      this.facing = turnToward(this.facing, Math.atan2(dx, dz), TURN_RATE * dt)
    } else {
      const k = 1 - Math.exp(-DECEL * dt)
      this.vx -= this.vx * k
      this.vz -= this.vz * k
    }

    this.pos.x += this.vx * dt
    this.pos.z += this.vz * dt

    collision.resolve(this.pos, this.radius)

    const distFromCenter = Math.hypot(this.pos.x, this.pos.z)
    if (distFromCenter > WORLD_RADIUS) {
      const s = WORLD_RADIUS / distFromCenter
      this.pos.x *= s
      this.pos.z *= s
    }

    // Tốc độ THỰC TẾ sau va chạm, không phải tốc độ mong muốn: khi bị chặn bởi
    // tảng đá thì nhân vật phải đứng yên chứ không được chạy tại chỗ
    this.speed = Math.hypot(this.vx, this.vz)

    // Terrain.heightAt() nội suy trên đúng tam giác đang được vẽ, nên bàn chân
    // nằm CHÍNH XÁC trên mặt đất — không lún, không lơ lửng
    this.y = this.groundHeight(this.pos.x, this.pos.z)

    this.updateAnimation()
    this.applyTransform()
  }

  private updateAnimation(): void {
    const { animator } = this.chibi
    if (this.speed < IDLE_THRESHOLD) {
      animator.play(IDLE)
      animator.timeScale = 1
    } else if (this.speed < RUN_THRESHOLD) {
      animator.play(WALK)
      animator.timeScale = MathUtils.clamp(this.speed / WALK_CLIP_SPEED, 0.65, 1.7)
    } else {
      animator.play(RUN)
      animator.timeScale = MathUtils.clamp(this.speed / RUN_CLIP_SPEED, 0.7, 1.6)
    }
  }

  private applyTransform(): void {
    this.chibi.root.position.set(this.pos.x, this.y, this.pos.z)
    this.chibi.root.rotation.y = this.facing
  }

  /** Nhịp frame: chỉ animation, để chuyển động mượt hơn 60Hz. */
  render(frameDt: number): void {
    this.chibi.animator.update(frameDt)
  }
}
