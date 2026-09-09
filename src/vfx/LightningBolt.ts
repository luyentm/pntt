import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  AdditiveBlending,
  type ColorRepresentation,
} from 'three'
import { Palette } from '@/art/Palette'
import type { Rng } from '@/core/Rng'

/** Số đốt của tia chính. */
const SEGMENTS = 9
/** Số nhánh con. */
const BRANCHES = 3
/** Đỉnh mỗi đốt: 2 tam giác = 6 đỉnh, mỗi đỉnh 3 float. */
const FLOATS_PER_SEGMENT = 6 * 3

/**
 * Tia sét gấp khúc, dựng lại geometry mỗi lần giáng.
 *
 * Vì sao dựng lại chứ không dùng một mesh cố định: cái làm tia sét ra sét chính
 * là đường gấp khúc NGẪU NHIÊN — dùng lại đúng một hình thì lần giáng thứ hai
 * người chơi nhận ra ngay và nó thành một cái sticker. Chi phí là ghi lại một
 * `Float32Array` cấp phát sẵn, không cấp phát mới, nên rẻ.
 *
 * Mỗi đốt là một dải hai tam giác luôn hướng theo trục X của thế giới. Ở góc iso
 * cố định thì dải phẳng đọc ra không khác gì một ống tròn, mà rẻ hơn nhiều.
 */
export class LightningBolt {
  readonly group = new Group()

  private readonly mesh: Mesh
  private readonly material: MeshBasicMaterial
  private readonly positions: Float32Array
  private readonly geometry: BufferGeometry
  private age = 0
  private life = 0
  private active = false

  constructor() {
    this.group.name = 'vfx:lightning'
    const total = (SEGMENTS + BRANCHES * 3) * FLOATS_PER_SEGMENT
    this.positions = new Float32Array(total)
    this.geometry = new BufferGeometry()
    this.geometry.setAttribute('position', new BufferAttribute(this.positions, 3))
    this.material = new MeshBasicMaterial({
      color: Palette.loi,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
      blending: AdditiveBlending,
      side: 2, // DoubleSide — dải phẳng phải thấy được từ cả hai phía
    })
    this.mesh = new Mesh(this.geometry, this.material)
    this.mesh.visible = false
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 9
    this.group.add(this.mesh)
  }

  get isPlaying(): boolean {
    return this.active
  }

  /** Giáng một tia từ trên trời xuống điểm (x, y, z). */
  strike(
    x: number,
    y: number,
    z: number,
    rng: Rng,
    options: { height?: number; width?: number; life?: number; color?: ColorRepresentation } = {},
  ): void {
    const height = options.height ?? 16
    const width = options.width ?? 0.16
    this.life = options.life ?? 0.26
    this.age = 0
    this.active = true
    this.material.color.set(options.color ?? Palette.loi)
    this.material.opacity = 1
    this.mesh.visible = true

    let cursor = 0
    // Tia chính: đi từ trên xuống, lệch ngang ngẫu nhiên, càng gần đất càng ít lệch
    let px = x
    let pz = z
    let py = y + height
    for (let i = 0; i < SEGMENTS; i++) {
      const t = (i + 1) / SEGMENTS
      const spread = (1 - t) * 1.5 + 0.1
      const nx = x + rng.spread(spread)
      const nz = z + rng.spread(spread)
      const ny = y + height * (1 - t)
      cursor = this.writeSegment(cursor, px, py, pz, nx, ny, nz, width * (0.6 + (1 - t) * 0.8))
      px = nx
      py = ny
      pz = nz
    }

    // Nhánh con: tách ra từ một điểm giữa rồi chĩa xuống-ngang
    for (let b = 0; b < BRANCHES; b++) {
      const t0 = rng.float(0.25, 0.8)
      let bx = x + rng.spread((1 - t0) * 1.4)
      let bz = z + rng.spread((1 - t0) * 1.4)
      let by = y + height * (1 - t0)
      const dirX = rng.spread(1)
      const dirZ = rng.spread(1)
      for (let i = 0; i < 3; i++) {
        const nx = bx + dirX * rng.float(0.3, 0.9)
        const nz = bz + dirZ * rng.float(0.3, 0.9)
        const ny = by - rng.float(0.6, 1.6)
        cursor = this.writeSegment(cursor, bx, by, bz, nx, ny, nz, width * 0.45)
        bx = nx
        by = ny
        bz = nz
      }
    }

    // Đốt còn lại thu về một điểm để không vẽ tam giác rác
    while (cursor < this.positions.length) this.positions[cursor++] = 0

    this.geometry.attributes.position!.needsUpdate = true
    this.geometry.computeBoundingSphere()
  }

  /** Ghi một dải hai tam giác nối (x0,y0,z0) tới (x1,y1,z1), bề rộng `w`. */
  private writeSegment(
    at: number,
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    w: number,
  ): number {
    const p = this.positions
    let i = at
    // Dải mở ra theo trục X thế giới
    p[i++] = x0 - w
    p[i++] = y0
    p[i++] = z0
    p[i++] = x0 + w
    p[i++] = y0
    p[i++] = z0
    p[i++] = x1 + w
    p[i++] = y1
    p[i++] = z1

    p[i++] = x0 - w
    p[i++] = y0
    p[i++] = z0
    p[i++] = x1 + w
    p[i++] = y1
    p[i++] = z1
    p[i++] = x1 - w
    p[i++] = y1
    p[i++] = z1
    return i
  }

  update(dt: number): void {
    if (!this.active) return
    this.age += dt
    const t = this.age / this.life
    if (t >= 1) {
      this.active = false
      this.mesh.visible = false
      this.material.opacity = 0
      return
    }
    // Nhấp nháy hai nhịp rồi tắt — sét không tắt đều, nó giật
    const flicker = t < 0.55 ? (Math.sin(t * 34) * 0.3 + 0.7) : 1
    this.material.opacity = flicker * (1 - t) ** 1.4
  }

  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
    this.group.removeFromParent()
  }
}
