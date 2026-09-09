import {
  BoxGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type Scene,
} from 'three'
import { at, mergeAll, paint } from '@/art/geo'
import { Palette } from '@/art/Palette'
import type { Rng } from '@/core/Rng'
import { materials } from '@/render/Materials'
import type { HeightField } from './Terrain'

interface CrowdUnit {
  x: number
  z: number
  /** Hướng mặt, radian. */
  facing: number
  /** Khoảng cách hiện tại tới điểm giao tranh của cặp. */
  reach: number
  /** Pha riêng để cả hàng không nhấp nhô cùng nhịp. */
  phase: number
  /** Nhịp lao vào rồi lùi ra, vòng/giây. */
  rate: number
  /** Chiều cao ngẫu nhiên nhẹ để hàng quân không phẳng như răng lược. */
  scale: number
  y: number
}

export interface CrowdSide {
  robe: number
  trim: number
  skin: number
}

/**
 * Hình người tối giản cho lớp hậu cảnh: thân, đầu, một lát vũ khí.
 *
 * Cố ý THÔ. Ở khoảng cách 35–55 unit thì chi tiết mặt và tay áo không chiếm nổi
 * một pixel, nên mọi tam giác thêm vào chỉ là tam giác bị bỏ đi — trong khi
 * dáng người và màu áo thì đọc được ngay. Khoảng 40 tam giác mỗi hình.
 */
function figureGeometry(side: CrowdSide): BufferGeometry {
  const parts: BufferGeometry[] = []
  parts.push(paint(at(new BoxGeometry(0.3, 0.46, 0.2), 0, 0.3, 0), side.robe))
  parts.push(paint(at(new BoxGeometry(0.34, 0.08, 0.22), 0, 0.5, 0), side.trim))
  parts.push(paint(at(new BoxGeometry(0.26, 0.24, 0.24), 0, 0.66, 0), side.skin))
  // Vũ khí chếch lên: đường chéo trong bóng ngoài là thứ làm hàng quân đọc ra
  // là "đang đánh nhau" chứ không phải "đang xếp hàng".
  // Dày 0.1 chứ không 0.05: ở khoảng cách 35 unit thì 0.05 unit không chiếm nổi
  // một pixel, nên cái lát mỏng đó vừa vô hình vừa vẫn tốn tam giác.
  const blade = new BoxGeometry(0.1, 0.62, 0.1)
  blade.rotateX(-0.7)
  parts.push(paint(at(blade, 0.2, 0.58, 0.12), Palette.daNhat))
  return mergeAll(parts)
}

/** Khoảng cách giữa hai người của một cặp giao tranh. */
const CLASH_GAP = 0.95

/**
 * Lớp quân hậu cảnh của "đại chiến".
 *
 * KHÔNG có AI, KHÔNG va chạm, KHÔNG gây sát thương — đây thuần là hình ảnh.
 * Lý do tách hẳn khỏi `Agent`: cảm giác đại chiến đến từ SỐ LƯỢNG nhìn thấy,
 * còn chiến đấu thật thì chỉ cần vài chục đơn vị quanh người chơi. Nuôi 200
 * `Agent` đầy đủ để chúng đánh nhau ở nơi người chơi không tới được là trả giá
 * mô phỏng cho một thứ không ai tương tác.
 *
 * Mỗi phe một `InstancedMesh` → toàn bộ đám đông tốn đúng 2 draw call.
 */
export class Crowd {
  readonly group = new Group()
  private readonly meshes: InstancedMesh[] = []
  private readonly units: CrowdUnit[][] = []
  private readonly matrix = new Matrix4()
  private readonly position = new Vector3()
  private readonly quaternion = new Quaternion()
  private readonly scale = new Vector3()
  private readonly up = new Vector3(0, 1, 0)
  private age = 0

  constructor(scene: Scene, sides: readonly [CrowdSide, CrowdSide], perSide = 60) {
    this.group.name = 'crowd'
    const material = materials.flat(0xffffff, { vertexColors: true })
    for (const side of sides) {
      const mesh = new InstancedMesh(figureGeometry(side), material, perSide)
      mesh.instanceMatrix.setUsage(35048) // DynamicDrawUsage
      mesh.frustumCulled = false
      mesh.castShadow = false
      mesh.count = 0
      this.group.add(mesh)
      this.meshes.push(mesh)
      this.units.push([])
    }
    scene.add(this.group)
  }

  get total(): number {
    return this.units.reduce((n, list) => n + list.length, 0)
  }

  /**
   * Dàn trận: các cặp đối đầu rải trên một cung tròn quanh tâm.
   *
   * Đánh theo CẶP chứ không cho cả đám đi lung tung: hai hình lao vào nhau rồi
   * lùi ra đọc ra là giao tranh, còn một đám di chuyển ngẫu nhiên chỉ đọc ra là
   * một cái chợ.
   */
  layout(
    rng: Rng,
    ground: HeightField,
    options: {
      centerX?: number
      centerZ?: number
      radiusMin: number
      radiusMax: number
      arcFrom: number
      arcTo: number
      pairs: number
    },
  ): void {
    const cx = options.centerX ?? 0
    const cz = options.centerZ ?? 0
    for (const list of this.units) list.length = 0

    const capacity = this.meshes[0]?.instanceMatrix.count ?? 0
    const pairs = Math.min(options.pairs, capacity)

    for (let i = 0; i < pairs; i++) {
      const angle = rng.float(options.arcFrom, options.arcTo)
      const radius = rng.float(options.radiusMin, options.radiusMax)
      const mx = cx + Math.cos(angle) * radius
      const mz = cz + Math.sin(angle) * radius
      // Trục giao tranh vuông góc với bán kính -> hai hàng quân đối đầu nhau
      // theo phương tiếp tuyến, nhìn từ camera iso thấy được cả hai bên
      const ax = -Math.sin(angle)
      const az = Math.cos(angle)
      const phase = rng.float(0, Math.PI * 2)
      const rate = rng.float(0.5, 0.95)

      for (let s = 0; s < 2; s++) {
        const dir = s === 0 ? 1 : -1
        const x = mx + ax * CLASH_GAP * dir
        const z = mz + az * CLASH_GAP * dir
        ;(this.units[s] as CrowdUnit[]).push({
          x,
          z,
          facing: Math.atan2(-ax * dir, -az * dir),
          reach: 0,
          phase: phase + (s === 0 ? 0 : Math.PI),
          rate,
          scale: rng.float(0.9, 1.12),
          y: ground.heightAt(x, z),
        })
      }
    }

    for (let s = 0; s < this.meshes.length; s++) {
      const mesh = this.meshes[s] as InstancedMesh
      mesh.count = (this.units[s] as CrowdUnit[]).length
    }
    this.writeAll()
  }

  /** Nhịp frame. Chỉ ma trận, không có luật chơi nào ở đây. */
  update(frameDt: number): void {
    if (this.total === 0) return
    this.age += frameDt
    this.writeAll()
  }

  private writeAll(): void {
    for (let s = 0; s < this.meshes.length; s++) {
      const mesh = this.meshes[s] as InstancedMesh
      const list = this.units[s] as CrowdUnit[]
      for (let i = 0; i < list.length; i++) {
        const u = list[i] as CrowdUnit
        const t = this.age * u.rate * Math.PI * 2 + u.phase
        // Lao vào rồi lùi ra dọc theo hướng mặt
        const push = Math.max(0, Math.sin(t)) * 0.55
        const bob = Math.abs(Math.sin(t * 2)) * 0.06
        const sway = Math.sin(t) * 0.16

        this.position.set(
          u.x + Math.sin(u.facing) * push,
          u.y + bob,
          u.z + Math.cos(u.facing) * push,
        )
        this.quaternion.setFromAxisAngle(this.up, u.facing + sway)
        this.scale.setScalar(u.scale)
        this.matrix.compose(this.position, this.quaternion, this.scale)
        mesh.setMatrixAt(i, this.matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
    }
  }

  clear(): void {
    for (const list of this.units) list.length = 0
    for (const mesh of this.meshes) mesh.count = 0
  }

  dispose(): void {
    for (const mesh of this.meshes) mesh.geometry.dispose()
    this.group.removeFromParent()
  }
}
