import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  type ColorRepresentation,
} from 'three'
import { Palette } from '@/art/Palette'
import { VfxPool, type Poolable } from './VfxPool'

interface Burst extends Poolable {
  ring: Mesh
  pillar: Mesh
  ringMat: MeshBasicMaterial
  pillarMat: MeshBasicMaterial
  radius: number
  withPillar: boolean
}

/** Vòng phẳng nằm trong mặt phẳng XZ, bán kính 1, có bề dày. */
function ringGeometry(segments = 20, thickness = 0.22): BufferGeometry {
  const positions: number[] = []
  const inner = 1 - thickness
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2
    const a1 = ((i + 1) / segments) * Math.PI * 2
    const c0 = Math.cos(a0)
    const s0 = Math.sin(a0)
    const c1 = Math.cos(a1)
    const s1 = Math.sin(a1)
    // Thứ tự đỉnh cho pháp tuyến hướng lên (+Y)
    positions.push(c0 * inner, 0, s0 * inner, c0, 0, s0, c1, 0, s1)
    positions.push(c0 * inner, 0, s0 * inner, c1, 0, s1, c1 * inner, 0, s1 * inner)
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geo.computeVertexNormals()
  return geo
}

/** Trụ đứng thóp trên, bán kính 1, cao 1 — dùng cho cột sấm và cột linh khí. */
function pillarGeometry(sides = 7): BufferGeometry {
  const positions: number[] = []
  const topScale = 0.35
  for (let i = 0; i < sides; i++) {
    const a0 = (i / sides) * Math.PI * 2
    const a1 = ((i + 1) / sides) * Math.PI * 2
    const x0 = Math.cos(a0)
    const z0 = Math.sin(a0)
    const x1 = Math.cos(a1)
    const z1 = Math.sin(a1)
    positions.push(x0, 0, z0, x0 * topScale, 1, z0 * topScale, x1, 0, z1)
    positions.push(x1, 0, z1, x0 * topScale, 1, z0 * topScale, x1 * topScale, 1, z1 * topScale)
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geo.computeVertexNormals()
  return geo
}

export interface BurstOptions {
  color?: ColorRepresentation
  life?: number
  /** Có cột sáng dựng lên hay không (sấm, đột phá cảnh giới). */
  pillar?: boolean
  pillarHeight?: number
}

/**
 * Vụ nổ dạng vùng: vòng sáng loang ra, kèm cột sáng tuỳ chọn.
 *
 * Một hiệu ứng dùng cho nhiều chiêu (sấm, băng, hoả cầu nổ, sau này là đột phá
 * cảnh giới) chỉ khác màu và tham số — thay vì viết một lớp riêng cho từng chiêu.
 */
export class AreaBurstLayer {
  readonly group = new Group()
  private readonly pool: VfxPool<Burst>

  constructor(capacity = 12) {
    this.group.name = 'vfx:areaBurst'
    const ringGeo = ringGeometry()
    const pillarGeo = pillarGeometry()

    this.pool = new VfxPool<Burst>(capacity, () => {
      // Cộng sáng, không phủ mờ.
      //
      // Cùng một lỗi đã sửa ở BreakthroughFx: phủ mờ ở opacity 0,9 biến vòng và
      // cột thành một tấm màu đặc che kín cả khung hình — thấy rõ nhất ở Thiên
      // Lôi Phù, nơi cái cột vàng che mất chính tia sét. Cộng sáng thì nó là
      // ánh sáng: nền vẫn xuyên qua và bloom bắt được thành quầng.
      const ringMat = new MeshBasicMaterial({
        color: Palette.linh,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
        blending: AdditiveBlending,
      })
      const pillarMat = new MeshBasicMaterial({
        color: Palette.loi,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
        blending: AdditiveBlending,
      })
      const ring = new Mesh(ringGeo, ringMat)
      const pillar = new Mesh(pillarGeo, pillarMat)
      ring.visible = false
      pillar.visible = false
      ring.renderOrder = 7
      pillar.renderOrder = 7
      this.group.add(ring)
      this.group.add(pillar)
      return {
        active: false,
        age: 0,
        life: 0.5,
        ring,
        pillar,
        ringMat,
        pillarMat,
        radius: 1,
        withPillar: false,
      }
    })
  }

  spawn(x: number, y: number, z: number, radius: number, options: BurstOptions = {}): void {
    const b = this.pool.acquire()
    b.life = options.life ?? 0.5
    b.radius = radius
    b.withPillar = options.pillar ?? false

    const color = options.color ?? Palette.linh
    b.ringMat.color.set(color)
    b.pillarMat.color.set(color)

    b.ring.position.set(x, y + 0.06, z)
    b.ring.scale.set(radius * 0.3, 1, radius * 0.3)
    b.ring.visible = true
    b.ringMat.opacity = 0.6

    if (b.withPillar) {
      const height = options.pillarHeight ?? radius * 3.4
      b.pillar.position.set(x, y, z)
      b.pillar.scale.set(radius * 0.5, height, radius * 0.5)
      b.pillar.visible = true
      b.pillarMat.opacity = 0.35
    } else {
      b.pillar.visible = false
      b.pillarMat.opacity = 0
    }
  }

  update(dt: number): void {
    this.pool.update(
      dt,
      (b, progress) => {
        // Vòng loang ra hết bán kính rồi mờ; nhanh lúc đầu để đọc ra là "nổ"
        const eased = 1 - (1 - progress) ** 2.2
        const s = b.radius * (0.3 + eased * 0.85)
        b.ring.scale.set(s, 1, s)
        b.ringMat.opacity = 0.6 * (1 - progress) ** 1.5

        if (b.withPillar) {
          // Cột co lại theo chiều ngang và mờ dần: đọc ra là năng lượng tan đi
          const shrink = 1 - progress * 0.55
          b.pillar.scale.x = b.radius * 0.5 * shrink
          b.pillar.scale.z = b.radius * 0.5 * shrink
          b.pillarMat.opacity = 0.35 * (1 - progress) ** 1.1
        }
      },
      (b) => {
        b.ring.visible = false
        b.pillar.visible = false
        b.ringMat.opacity = 0
        b.pillarMat.opacity = 0
      },
    )
  }

  dispose(): void {
    for (const b of this.pool.all) {
      b.ringMat.dispose()
      b.pillarMat.dispose()
    }
    const first = this.pool.all[0]
    first?.ring.geometry.dispose()
    first?.pillar.geometry.dispose()
  }
}
