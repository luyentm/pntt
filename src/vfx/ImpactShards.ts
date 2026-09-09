import {
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  Quaternion,
  TetrahedronGeometry,
  Vector3,
  type ColorRepresentation,
} from 'three'
import type { Rng } from '@/core/Rng'

interface Shard {
  active: boolean
  age: number
  life: number
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  spinAxis: Vector3
  spinSpeed: number
  size: number
}

const GRAVITY = -14

/**
 * Mảnh vỡ bay ra khi trúng đòn.
 *
 * Dùng khối tứ diện có mặt cắt, KHÔNG dùng hạt sprite mờ: cả game là lowpoly có
 * facet, nên hiệu ứng cũng phải là khối có facet mới cùng chất. Đây cũng là lý do
 * không dùng thư viện particle — chúng sinh ra sprite, sai chất ngay từ gốc.
 *
 * Toàn bộ nằm trong MỘT InstancedMesh nên hàng trăm mảnh vẫn là một draw call.
 * Tàn lụi bằng cách THU NHỎ chứ không giảm alpha: instance không có alpha riêng,
 * mà thu nhỏ lại còn đúng cảm giác mảnh vỡ tan ra hơn là mờ đi.
 */
export class ImpactShardLayer {
  readonly group = new Group()
  private readonly mesh: InstancedMesh
  private readonly shards: Shard[] = []
  private readonly matrix = new Matrix4()
  private readonly position = new Vector3()
  private readonly quaternion = new Quaternion()
  private readonly scale = new Vector3()
  private readonly color = new Color()

  constructor(capacity = 220) {
    this.group.name = 'vfx:shards'
    const geometry = new TetrahedronGeometry(1, 0)
    const material = new MeshLambertMaterial({ flatShading: true, vertexColors: false })
    this.mesh = new InstancedMesh(geometry, material, capacity)
    this.mesh.instanceMatrix.setUsage(35048) // DynamicDrawUsage
    this.mesh.frustumCulled = false
    this.mesh.castShadow = false
    this.mesh.count = capacity
    // instanceColor cho phép mỗi vụ nổ một màu (huyết, kim quang, băng...)
    this.mesh.instanceColor = null
    this.group.add(this.mesh)

    for (let i = 0; i < capacity; i++) {
      this.shards.push({
        active: false,
        age: 0,
        life: 0.5,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        spinAxis: new Vector3(0, 1, 0),
        spinSpeed: 0,
        size: 0.05,
      })
    }
    this.hideAll()
  }

  private hideAll(): void {
    this.scale.setScalar(0)
    this.position.set(0, -999, 0)
    this.quaternion.identity()
    this.matrix.compose(this.position, this.quaternion, this.scale)
    for (let i = 0; i < this.shards.length; i++) this.mesh.setMatrixAt(i, this.matrix)
    this.mesh.instanceMatrix.needsUpdate = true
  }

  burst(
    x: number,
    y: number,
    z: number,
    rng: Rng,
    options: { count?: number; color?: ColorRepresentation; speed?: number; size?: number } = {},
  ): void {
    const count = options.count ?? 9
    const speed = options.speed ?? 4.2
    const size = options.size ?? 0.055
    this.color.set(options.color ?? 0xffffff)

    let spawned = 0
    for (const s of this.shards) {
      if (spawned >= count) break
      if (s.active) continue
      spawned++

      const dir = rng.onCircle()
      const up = rng.float(0.5, 1.5)
      const mag = speed * rng.float(0.55, 1.25)

      s.active = true
      s.age = 0
      s.life = rng.float(0.36, 0.68)
      s.x = x
      s.y = y
      s.z = z
      s.vx = dir.x * mag
      s.vy = up * mag * 0.75
      s.vz = dir.z * mag
      s.spinAxis.set(rng.spread(1), rng.spread(1), rng.spread(1)).normalize()
      s.spinSpeed = rng.float(6, 18) * (rng.chance(0.5) ? 1 : -1)
      s.size = size * rng.float(0.65, 1.4)
    }
  }

  update(dt: number): void {
    let dirty = false
    for (let i = 0; i < this.shards.length; i++) {
      const s = this.shards[i] as Shard
      if (!s.active) continue

      s.age += dt
      if (s.age >= s.life) {
        s.active = false
        this.scale.setScalar(0)
        this.position.set(0, -999, 0)
        this.quaternion.identity()
        this.matrix.compose(this.position, this.quaternion, this.scale)
        this.mesh.setMatrixAt(i, this.matrix)
        dirty = true
        continue
      }

      s.vy += GRAVITY * dt
      s.x += s.vx * dt
      s.y += s.vy * dt
      s.z += s.vz * dt

      const progress = s.age / s.life
      this.position.set(s.x, s.y, s.z)
      this.quaternion.setFromAxisAngle(s.spinAxis, s.spinSpeed * s.age)
      this.scale.setScalar(s.size * (1 - progress) ** 0.7)
      this.matrix.compose(this.position, this.quaternion, this.scale)
      this.mesh.setMatrixAt(i, this.matrix)
      dirty = true
    }
    if (dirty) this.mesh.instanceMatrix.needsUpdate = true
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    ;(this.mesh.material as MeshLambertMaterial).dispose()
  }
}
