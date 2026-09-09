import {
  BoxGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  OctahedronGeometry,
  Quaternion,
  TetrahedronGeometry,
  Vector3,
  type BufferGeometry,
} from 'three'
import type { Rng } from '@/core/Rng'

/**
 * Ba dáng hạt.
 *
 * - `shard`: tứ diện — mảnh vỡ, đá, băng nứt.
 * - `spark`: hộp thuôn dài, XOAY THEO VẬN TỐC — tia lửa, vệt khí. Chính việc
 *   xoay theo vận tốc làm nó đọc ra là tốc độ; một khối vuông bay nhanh vẫn chỉ
 *   là một khối vuông.
 * - `mote`: bát diện nhỏ — đốm linh khí lơ lửng.
 */
export type ParticleShape = 'shard' | 'spark' | 'mote'

export type EmitPattern =
  /** Toả đều mọi hướng. */
  | 'sphere'
  /** Toả lên nửa trên — vụ nổ trên mặt đất. */
  | 'dome'
  /** Chụm theo một hướng, trong nửa góc `arc`. */
  | 'cone'
  /** Bắn ra từ một vòng bán kính `radius`, hướng ra ngoài. */
  | 'ring'
  /**
   * Sinh trên một vỏ cầu bán kính `radius` rồi bay VÀO tâm.
   *
   * Đây là dáng "tụ khí": nó là thứ làm một chiêu có cảm giác đang được DỰNG
   * LÊN thay vì bật ra từ không khí. Không có nó thì mọi pháp thuật đều bắt đầu
   * đột ngột và mất hết sức nặng.
   */
  | 'implode'

export interface EmitOptions {
  count?: number
  shape?: ParticleShape
  color?: number
  /** Có thì mỗi hạt lấy ngẫu nhiên giữa hai màu — đám hạt có sắc độ, không phẳng. */
  color2?: number
  /** Khoảng tốc độ [min, max]. */
  speed?: [number, number]
  size?: [number, number]
  life?: [number, number]
  gravity?: number
  /** Hệ số cản mỗi giây; 0 = không cản. */
  drag?: number
  spin?: number
  pattern?: EmitPattern
  dirX?: number
  dirZ?: number
  /** Nửa góc của `cone`, radian. */
  arc?: number
  /** Bán kính cho `ring` và `implode`. */
  radius?: number
  /** Vận tốc cộng thêm theo phương lên. */
  lift?: number
  /** `shrink` thu nhỏ dần; `pop` phình lên rồi tắt nhanh. */
  fade?: 'shrink' | 'pop'
}

const SHAPES: readonly ParticleShape[] = ['shard', 'spark', 'mote']

function geometryFor(shape: ParticleShape): BufferGeometry {
  switch (shape) {
    case 'spark':
      // Thuôn theo +Y để quaternion xoay từ trục Y sang hướng vận tốc
      return new BoxGeometry(0.16, 1, 0.16)
    case 'mote':
      return new OctahedronGeometry(0.6, 0)
    default:
      return new TetrahedronGeometry(1, 0)
  }
}

/** Một nhóm hạt cùng dáng, gói trong một InstancedMesh. */
class ShapeBatch {
  readonly mesh: InstancedMesh
  readonly capacity: number

  readonly x: Float32Array
  readonly y: Float32Array
  readonly z: Float32Array
  readonly vx: Float32Array
  readonly vy: Float32Array
  readonly vz: Float32Array
  readonly age: Float32Array
  readonly life: Float32Array
  readonly size: Float32Array
  readonly gravity: Float32Array
  readonly drag: Float32Array
  readonly spin: Float32Array
  readonly axisX: Float32Array
  readonly axisY: Float32Array
  readonly axisZ: Float32Array
  /** 0 = shrink, 1 = pop. */
  readonly fade: Uint8Array
  readonly alive: Uint8Array
  /** Con trỏ vòng để tìm ô rảnh nhanh, không quét lại từ đầu mỗi lần. */
  cursor = 0

  constructor(shape: ParticleShape, capacity: number, material: MeshLambertMaterial) {
    this.capacity = capacity
    this.mesh = new InstancedMesh(geometryFor(shape), material, capacity)
    this.mesh.instanceMatrix.setUsage(35048) // DynamicDrawUsage
    this.mesh.frustumCulled = false
    this.mesh.castShadow = false
    this.mesh.count = capacity
    this.mesh.name = `vfx:particles:${shape}`

    const f = (): Float32Array => new Float32Array(capacity)
    this.x = f()
    this.y = f()
    this.z = f()
    this.vx = f()
    this.vy = f()
    this.vz = f()
    this.age = f()
    this.life = f()
    this.size = f()
    this.gravity = f()
    this.drag = f()
    this.spin = f()
    this.axisX = f()
    this.axisY = f()
    this.axisZ = f()
    this.fade = new Uint8Array(capacity)
    this.alive = new Uint8Array(capacity)
  }

  /** Ô rảnh kế tiếp, hoặc ô già nhất nếu đã cạn. */
  take(): number {
    for (let n = 0; n < this.capacity; n++) {
      const i = (this.cursor + n) % this.capacity
      if (this.alive[i] === 0) {
        this.cursor = (i + 1) % this.capacity
        return i
      }
    }
    // Cạn hồ: giành lại ô đã chạy được nhiều phần đời nhất
    let worst = 0
    let worstRatio = -1
    for (let i = 0; i < this.capacity; i++) {
      const r = (this.age[i] as number) / Math.max(1e-4, this.life[i] as number)
      if (r > worstRatio) {
        worstRatio = r
        worst = i
      }
    }
    return worst
  }
}

/**
 * Lớp hạt dùng chung cho toàn bộ hiệu ứng.
 *
 * Vì sao TỰ VIẾT chứ không dùng thư viện particle: thư viện sinh ra sprite mờ,
 * còn cả game này là lowpoly có mặt cắt — hạt cũng phải là khối có facet mới
 * cùng chất. Đây là quyết định đã ghi từ đầu project và vẫn đúng.
 *
 * Vì sao dùng MẢNG TYPED thay vì mảng object như `ImpactShardLayer`: ở đây có
 * ba dáng × 256 hạt và mỗi hạt có 15 trường. Với số lượng đó thì mảng typed vừa
 * gọn hơn trong bộ nhớ vừa không tạo ra 768 object cho GC phải theo dõi.
 *
 * Mỗi dáng một `InstancedMesh` → cả lớp hạt tốn đúng 3 draw call.
 */
export class ParticleLayer {
  readonly group = new Group()
  private readonly batches = new Map<ParticleShape, ShapeBatch>()
  private readonly matrix = new Matrix4()
  private readonly position = new Vector3()
  private readonly quaternion = new Quaternion()
  private readonly scale = new Vector3()
  private readonly up = new Vector3(0, 1, 0)
  private readonly dir = new Vector3()
  private readonly color = new Color()
  private readonly colorB = new Color()

  constructor(capacityPerShape = 256) {
    this.group.name = 'vfx:particles'
    const material = new MeshLambertMaterial({ flatShading: true })
    for (const shape of SHAPES) {
      const batch = new ShapeBatch(shape, capacityPerShape, material)
      this.batches.set(shape, batch)
      this.group.add(batch.mesh)
      this.hideAll(batch)
    }
  }

  get activeCount(): number {
    let n = 0
    for (const batch of this.batches.values()) {
      for (let i = 0; i < batch.capacity; i++) if (batch.alive[i] === 1) n++
    }
    return n
  }

  private hideAll(batch: ShapeBatch): void {
    this.scale.setScalar(0)
    this.position.set(0, -999, 0)
    this.quaternion.identity()
    this.matrix.compose(this.position, this.quaternion, this.scale)
    for (let i = 0; i < batch.capacity; i++) {
      batch.mesh.setMatrixAt(i, this.matrix)
      batch.mesh.setColorAt(i, this.color.set(0xffffff))
    }
    batch.mesh.instanceMatrix.needsUpdate = true
    if (batch.mesh.instanceColor) batch.mesh.instanceColor.needsUpdate = true
  }

  emit(x: number, y: number, z: number, rng: Rng, options: EmitOptions = {}): void {
    const shape = options.shape ?? 'shard'
    const batch = this.batches.get(shape)
    if (!batch) return

    const count = options.count ?? 10
    const pattern = options.pattern ?? 'dome'
    const [sMin, sMax] = options.speed ?? [2.5, 5]
    const [szMin, szMax] = options.size ?? [0.04, 0.08]
    const [lMin, lMax] = options.life ?? [0.35, 0.7]
    const gravity = options.gravity ?? -14
    const drag = options.drag ?? 0
    const spin = options.spin ?? 12
    const radius = options.radius ?? 1
    const lift = options.lift ?? 0
    const arc = options.arc ?? 0.5
    const fade = options.fade === 'pop' ? 1 : 0

    this.color.set(options.color ?? 0xffffff)
    this.colorB.set(options.color2 ?? options.color ?? 0xffffff)

    const baseAngle = Math.atan2(options.dirX ?? 0, options.dirZ ?? 1)

    for (let n = 0; n < count; n++) {
      const i = batch.take()
      const mag = rng.float(sMin, sMax)

      let px = x
      let py = y
      let pz = z
      let dx = 0
      let dy = 0
      let dz = 0

      switch (pattern) {
        case 'sphere': {
          const c = rng.onCircle()
          const upward = rng.spread(1)
          dx = c.x
          dy = upward
          dz = c.z
          break
        }
        case 'cone': {
          const a = baseAngle + rng.spread(arc)
          dx = Math.sin(a)
          dy = rng.float(-0.15, 0.45)
          dz = Math.cos(a)
          break
        }
        case 'ring': {
          const c = rng.onCircle()
          px = x + c.x * radius
          pz = z + c.z * radius
          dx = c.x
          dy = rng.float(0.1, 0.6)
          dz = c.z
          break
        }
        case 'implode': {
          const c = rng.onCircle()
          const h = rng.float(0.1, 1)
          px = x + c.x * radius
          py = y + h * radius * 0.7
          pz = z + c.z * radius
          // Bay VÀO tâm: chính dấu trừ này là cả hiệu ứng tụ khí
          dx = -c.x
          dy = -h * 0.7
          dz = -c.z
          break
        }
        default: {
          const c = rng.onCircle()
          dx = c.x
          dy = rng.float(0.45, 1.35)
          dz = c.z
          break
        }
      }

      const len = Math.hypot(dx, dy, dz) || 1
      batch.x[i] = px
      batch.y[i] = py
      batch.z[i] = pz
      batch.vx[i] = (dx / len) * mag
      batch.vy[i] = (dy / len) * mag + lift
      batch.vz[i] = (dz / len) * mag
      batch.age[i] = 0
      batch.life[i] = rng.float(lMin, lMax)
      batch.size[i] = rng.float(szMin, szMax)
      batch.gravity[i] = gravity
      batch.drag[i] = drag
      batch.spin[i] = rng.float(spin * 0.4, spin) * (rng.chance(0.5) ? 1 : -1)
      batch.axisX[i] = rng.spread(1)
      batch.axisY[i] = rng.spread(1)
      batch.axisZ[i] = rng.spread(1)
      batch.fade[i] = fade
      batch.alive[i] = 1

      // Mỗi hạt một sắc giữa hai màu — đám hạt có chiều sâu, không phẳng một tông
      this.color.set(options.color ?? 0xffffff).lerp(this.colorB, rng.float(0, 1))
      batch.mesh.setColorAt(i, this.color)
      this.writeInstance(batch, i, shape === 'spark')
    }

    batch.mesh.instanceMatrix.needsUpdate = true
    if (batch.mesh.instanceColor) batch.mesh.instanceColor.needsUpdate = true
  }

  /**
   * Ghi ma trận của một hạt.
   *
   * Dùng cho CẢ `emit` và `update`. Nếu chỉ ghi trong `update` thì hạt vừa sinh
   * còn giữ ma trận cũ (đã bị đẩy xuống y = -999 lúc tắt) trong đúng một khung —
   * ở 60fps thì gần như không thấy, nhưng đó là một hạt bị mất và không có lý do
   * gì để chấp nhận nó.
   */
  private writeInstance(batch: ShapeBatch, i: number, isSpark: boolean): void {
    const age = batch.age[i] as number
    const life = batch.life[i] as number
    const t = age / life
    const curve = batch.fade[i] === 1 ? Math.sin(t * Math.PI) : (1 - t) ** 0.7
    const size = (batch.size[i] as number) * curve

    this.position.set(batch.x[i] as number, batch.y[i] as number, batch.z[i] as number)

    if (isSpark) {
      // Xoay theo vận tốc và kéo dài theo tốc độ — đây là thứ làm tia lửa đọc ra
      // là TỐC ĐỘ chứ không phải một cái que đang bay
      this.dir.set(batch.vx[i] as number, batch.vy[i] as number, batch.vz[i] as number)
      const speed = this.dir.length()
      if (speed > 1e-4) {
        this.dir.divideScalar(speed)
        this.quaternion.setFromUnitVectors(this.up, this.dir)
      }
      this.scale.set(size, size * (1 + Math.min(6, speed * 0.55)), size)
    } else {
      this.dir.set(batch.axisX[i] as number, batch.axisY[i] as number, batch.axisZ[i] as number)
      if (this.dir.lengthSq() < 1e-6) this.dir.set(0, 1, 0)
      this.quaternion.setFromAxisAngle(this.dir.normalize(), (batch.spin[i] as number) * age)
      this.scale.setScalar(size)
    }

    this.matrix.compose(this.position, this.quaternion, this.scale)
    batch.mesh.setMatrixAt(i, this.matrix)
  }

  update(dt: number): void {
    for (const [shape, batch] of this.batches) {
      let dirty = false
      const isSpark = shape === 'spark'

      for (let i = 0; i < batch.capacity; i++) {
        if (batch.alive[i] === 0) continue

        const age = (batch.age[i] as number) + dt
        const life = batch.life[i] as number
        if (age >= life) {
          batch.alive[i] = 0
          this.scale.setScalar(0)
          this.position.set(0, -999, 0)
          this.quaternion.identity()
          this.matrix.compose(this.position, this.quaternion, this.scale)
          batch.mesh.setMatrixAt(i, this.matrix)
          dirty = true
          continue
        }
        batch.age[i] = age

        const d = batch.drag[i] as number
        if (d > 0) {
          const k = 1 - Math.exp(-d * dt)
          batch.vx[i] = (batch.vx[i] as number) * (1 - k)
          batch.vy[i] = (batch.vy[i] as number) * (1 - k)
          batch.vz[i] = (batch.vz[i] as number) * (1 - k)
        }
        batch.vy[i] = (batch.vy[i] as number) + (batch.gravity[i] as number) * dt
        batch.x[i] = (batch.x[i] as number) + (batch.vx[i] as number) * dt
        batch.y[i] = (batch.y[i] as number) + (batch.vy[i] as number) * dt
        batch.z[i] = (batch.z[i] as number) + (batch.vz[i] as number) * dt

        // Tàn bằng cách THU NHỎ, không giảm alpha: instance không có alpha riêng,
        // và thu nhỏ đọc ra là "tan ra" đúng hơn là "mờ đi"
        this.writeInstance(batch, i, isSpark)
        dirty = true
      }

      if (dirty) batch.mesh.instanceMatrix.needsUpdate = true
    }
  }

  clear(): void {
    for (const batch of this.batches.values()) {
      batch.alive.fill(0)
      this.hideAll(batch)
    }
  }

  dispose(): void {
    for (const batch of this.batches.values()) batch.mesh.geometry.dispose()
    const first = this.batches.get('shard')
    ;(first?.mesh.material as MeshLambertMaterial | undefined)?.dispose()
    this.group.removeFromParent()
  }
}
