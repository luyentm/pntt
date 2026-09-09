import {
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  OctahedronGeometry,
  Quaternion,
  Vector3,
  type Scene,
} from 'three'
import type { Rng } from '@/core/Rng'
import { itemDef } from '@/game/data/items'
import type { HeightField } from './Terrain'

interface Pickup {
  active: boolean
  id: string
  count: number
  x: number
  y: number
  z: number
  /** Vận tốc lúc bật ra khỏi xác quái. */
  vx: number
  vy: number
  vz: number
  grounded: boolean
  age: number
  spin: number
  /** Đang bị hút về phía người chơi. */
  homing: boolean
}

const GRAVITY = -16
/** Bán kính bắt đầu hút vật phẩm về phía người chơi. */
const MAGNET_RADIUS = 2.6
/** Bán kính thực sự nhận vật phẩm. */
const COLLECT_RADIUS = 0.6
const MAGNET_SPEED = 9
/** Vật phẩm tự biến mất sau bấy nhiêu giây nếu không ai lấy. */
const LIFETIME = 45

/**
 * Vật phẩm rơi trên đất.
 *
 * Hút về phía người chơi khi đến gần thay vì đòi bấm nút: trong lúc đánh nhau
 * người chơi không rảnh để đi nhặt từng thứ, mà nhặt bằng cách chạy qua thì lại
 * hay bỏ sót. Hút tự động giải quyết cả hai.
 *
 * Toàn bộ nằm trong MỘT InstancedMesh có `instanceColor`, nên mỗi vật phẩm có
 * màu riêng theo loại mà vẫn chỉ tốn một draw call.
 */
export class PickupSystem {
  readonly group = new Group()
  private readonly mesh: InstancedMesh
  private readonly items: Pickup[] = []
  private readonly matrix = new Matrix4()
  private readonly position = new Vector3()
  private readonly quaternion = new Quaternion()
  private readonly scale = new Vector3()
  private readonly axis = new Vector3(0.3, 1, 0.15).normalize()
  private readonly color = new Color()

  /** Được gọi khi người chơi nhận vật phẩm. Scene gán vào. */
  onCollect?: (id: string, count: number) => void

  constructor(scene: Scene, capacity = 120) {
    this.group.name = 'pickups'
    const geometry = new OctahedronGeometry(0.14, 0)
    const material = new MeshLambertMaterial({ flatShading: true })
    this.mesh = new InstancedMesh(geometry, material, capacity)
    this.mesh.instanceMatrix.setUsage(35048) // DynamicDrawUsage
    this.mesh.frustumCulled = false
    this.mesh.castShadow = false
    this.mesh.count = capacity
    // instanceColor cho mỗi vật phẩm một màu riêng trong cùng một draw call
    this.mesh.instanceColor = null
    this.group.add(this.mesh)
    scene.add(this.group)

    for (let i = 0; i < capacity; i++) {
      this.items.push({
        active: false,
        id: '',
        count: 0,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        grounded: false,
        age: 0,
        spin: 0,
        homing: false,
      })
    }
    this.hideAll()
  }

  get activeCount(): number {
    let n = 0
    for (const it of this.items) if (it.active) n++
    return n
  }

  private hideAll(): void {
    this.scale.setScalar(0)
    this.position.set(0, -999, 0)
    this.quaternion.identity()
    this.matrix.compose(this.position, this.quaternion, this.scale)
    for (let i = 0; i < this.items.length; i++) {
      this.mesh.setMatrixAt(i, this.matrix)
      this.mesh.setColorAt(i, this.color.set(0xffffff))
    }
    this.mesh.instanceMatrix.needsUpdate = true
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true
  }

  /**
   * Bật một vật phẩm ra khỏi vị trí chỉ định, có đà nhảy nhẹ.
   *
   * Nhận `rng` chứ KHÔNG dùng Math.random(): cả game được thiết kế quanh tính
   * xác định (Rng có seed + fixed timestep) để combat tái lập và test được.
   * Một lời gọi Math.random() lẻ ở đây là đủ phá vỡ tính chất đó — đây cũng
   * chính là lý do đã loại thư viện AI dự kiến ban đầu.
   */
  spawn(
    id: string,
    count: number,
    x: number,
    y: number,
    z: number,
    rng: Rng,
    spread = 1.6,
  ): void {
    const def = itemDef(id)
    const slot = this.take()
    slot.id = id
    slot.count = count
    slot.x = x
    slot.y = y + 0.5
    slot.z = z
    // Bật lên và toả ra một chút: đống vật phẩm rơi chồng một chỗ thì không
    // đọc được là có mấy thứ
    const a = rng.float(0, Math.PI * 2)
    slot.vx = Math.cos(a) * spread
    slot.vz = Math.sin(a) * spread
    slot.vy = 3.4
    slot.grounded = false
    slot.age = 0
    slot.spin = a
    slot.homing = false

    const index = this.items.indexOf(slot)
    this.color.set(def.color)
    this.mesh.setColorAt(index, this.color)
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true
  }

  private take(): Pickup {
    for (const it of this.items) {
      if (!it.active) {
        it.active = true
        return it
      }
    }
    // Hồ cạn: giành lại cái già nhất — vật phẩm mới đáng giữ hơn vật phẩm sắp hết hạn
    let oldest = this.items[0] as Pickup
    for (const it of this.items) if (it.age > oldest.age) oldest = it
    oldest.active = true
    return oldest
  }

  fixedUpdate(dt: number, playerX: number, playerZ: number, playerY: number, ground: HeightField): void {
    let dirty = false

    for (let i = 0; i < this.items.length; i++) {
      const p = this.items[i] as Pickup
      if (!p.active) continue

      p.age += dt
      p.spin += dt * 2.4

      const dx = playerX - p.x
      const dz = playerZ - p.z
      const dist = Math.hypot(dx, dz)

      if (dist < COLLECT_RADIUS) {
        p.active = false
        this.onCollect?.(p.id, p.count)
        this.writeSlot(i, p, true)
        dirty = true
        continue
      }

      if (p.age >= LIFETIME) {
        p.active = false
        this.writeSlot(i, p, true)
        dirty = true
        continue
      }

      if (!p.homing && p.grounded && dist < MAGNET_RADIUS) p.homing = true

      if (p.homing) {
        const k = 1 - Math.exp(-10 * dt)
        p.x += (dx / Math.max(dist, 1e-4)) * MAGNET_SPEED * dt
        p.z += (dz / Math.max(dist, 1e-4)) * MAGNET_SPEED * dt
        // Bay lên ngang tầm ngực khi đang bị hút, trông như bị thu vào người
        p.y += (playerY + 0.6 - p.y) * k
      } else {
        p.vy += GRAVITY * dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.z += p.vz * dt

        const floor = ground.heightAt(p.x, p.z) + 0.18
        if (p.y <= floor) {
          p.y = floor
          p.vy = 0
          p.vx *= 0.3
          p.vz *= 0.3
          p.grounded = true
        }
      }

      this.writeSlot(i, p, false)
      dirty = true
    }

    if (dirty) this.mesh.instanceMatrix.needsUpdate = true
  }

  private writeSlot(index: number, p: Pickup, hide: boolean): void {
    if (hide) {
      this.scale.setScalar(0)
      this.position.set(0, -999, 0)
      this.quaternion.identity()
    } else {
      // Nhấp nhô nhẹ khi đã nằm đất, để mắt bắt được vật phẩm giữa cảnh tĩnh
      const bob = p.grounded && !p.homing ? Math.sin(p.age * 3.2) * 0.06 : 0
      this.position.set(p.x, p.y + bob, p.z)
      this.quaternion.setFromAxisAngle(this.axis, p.spin)
      this.scale.setScalar(1)
    }
    this.matrix.compose(this.position, this.quaternion, this.scale)
    this.mesh.setMatrixAt(index, this.matrix)
  }

  clear(): void {
    for (const p of this.items) p.active = false
    this.hideAll()
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    ;(this.mesh.material as MeshLambertMaterial).dispose()
    this.group.removeFromParent()
  }
}
