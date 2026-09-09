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

/** Số vòng shockwave loang ra, lệch pha nhau. */
const RING_COUNT = 3
/** Thời gian tụ khí trước khi cột sáng nổ lên. */
const CHARGE = 0.75
/** Thời gian cột sáng và các vòng tồn tại sau lúc nổ. */
const BURST = 2.1

/** Vòng phẳng có bề dày, bán kính 1, pháp tuyến +Y. */
function ringGeometry(segments = 32, thickness = 0.13): BufferGeometry {
  const positions: number[] = []
  const inner = 1 - thickness
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2
    const a1 = ((i + 1) / segments) * Math.PI * 2
    const c0 = Math.cos(a0)
    const s0 = Math.sin(a0)
    const c1 = Math.cos(a1)
    const s1 = Math.sin(a1)
    positions.push(c0 * inner, 0, s0 * inner, c0, 0, s0, c1, 0, s1)
    positions.push(c0 * inner, 0, s0 * inner, c1, 0, s1, c1 * inner, 0, s1 * inner)
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geo.computeVertexNormals()
  return geo
}

/**
 * Cột sáng nhiều đốt: bán kính 1, cao 1, thóp dần lên đỉnh theo từng đốt.
 *
 * Chia đốt chứ không một khối thóp trơn: mặt cắt giữa các đốt bắt sáng khác
 * nhau nên cột đọc ra là "khí trụ" có kết cấu — đúng chất lowpoly. Một hình
 * nón trơn ở kích cỡ này nhìn ra ngay là một cái nón.
 */
function shaftGeometry(sides = 9, rings = 5): BufferGeometry {
  const positions: number[] = []
  const radiusAt = (t: number): number => 1 - t * 0.82
  for (let r = 0; r < rings; r++) {
    const t0 = r / rings
    const t1 = (r + 1) / rings
    // Đốt trên hẹp hơn đốt dưới, và mỗi đốt lệch góc nửa mặt để mặt cắt so le
    const twist = (r % 2) * (Math.PI / sides)
    const r0 = radiusAt(t0)
    const r1 = radiusAt(t1)
    for (let i = 0; i < sides; i++) {
      const a0 = (i / sides) * Math.PI * 2 + twist
      const a1 = ((i + 1) / sides) * Math.PI * 2 + twist
      const x0 = Math.cos(a0)
      const z0 = Math.sin(a0)
      const x1 = Math.cos(a1)
      const z1 = Math.sin(a1)
      positions.push(x0 * r0, t0, z0 * r0, x0 * r1, t1, z0 * r1, x1 * r0, t0, z1 * r0)
      positions.push(x1 * r0, t0, z1 * r0, x0 * r1, t1, z0 * r1, x1 * r1, t1, z1 * r1)
    }
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geo.computeVertexNormals()
  return geo
}

/**
 * Hiệu ứng đột phá đại cảnh giới.
 *
 * KHÔNG pooled và không dùng chung với AreaBurstLayer: chỉ có một người chơi
 * nên chỉ cần một bộ mesh, và quan trọng hơn — khoảnh khắc này phải trông khác
 * hẳn mọi hiệu ứng chiến đấu. Nếu tái dùng vụ nổ pháp vực thì đột phá cảnh
 * giới sẽ nhìn y như một phát Thiên Lôi Phù, mà đây phải là thứ đáng nhớ nhất
 * của cả bản demo.
 *
 * Có hai dáng đối lập:
 *  - thành công: cột kim quang phóng lên trời, ba vòng shockwave loang ra
 *  - thất bại: khí nghịch sụp vào trong, cột thấp màu huyết, vòng co lại
 */
export class BreakthroughFx {
  readonly group = new Group()

  private readonly shaft: Mesh
  private readonly shaftMat: MeshBasicMaterial
  private readonly rings: Mesh[] = []
  private readonly ringMats: MeshBasicMaterial[] = []
  /** Vòng tụ khí dưới chân trong lúc tích. */
  private readonly halo: Mesh
  private readonly haloMat: MeshBasicMaterial

  private age = 0
  private active = false
  private success = true
  /** Cao độ chân người chơi — các vòng shockwave dựa vào nó khi bay lên. */
  private y = 0
  private height = 14
  private spread = 9

  constructor() {
    this.group.name = 'vfx:breakthrough'
    const ringGeo = ringGeometry()

    this.shaftMat = new MeshBasicMaterial({
      color: Palette.kim,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
      // Cộng sáng, không phải phủ mờ. Thử phủ mờ trước: cột kim quang thành một
      // tấm ván vàng đặc che kín nhân vật — mà cả khoảnh khắc này là để NHÌN
      // nhân vật đang lên cảnh giới. Cộng sáng thì nó là ánh sáng: nền vẫn
      // xuyên qua, và bloom bắt được thành quầng.
      blending: AdditiveBlending,
    })
    this.shaft = new Mesh(shaftGeometry(), this.shaftMat)
    this.shaft.visible = false
    this.shaft.renderOrder = 8
    this.group.add(this.shaft)

    this.haloMat = new MeshBasicMaterial({
      color: Palette.linh,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
      // Cộng sáng, không phải phủ mờ. Thử phủ mờ trước: cột kim quang thành một
      // tấm ván vàng đặc che kín nhân vật — mà cả khoảnh khắc này là để NHÌN
      // nhân vật đang lên cảnh giới. Cộng sáng thì nó là ánh sáng: nền vẫn
      // xuyên qua, và bloom bắt được thành quầng.
      blending: AdditiveBlending,
    })
    this.halo = new Mesh(ringGeo, this.haloMat)
    this.halo.visible = false
    this.halo.renderOrder = 8
    this.group.add(this.halo)

    for (let i = 0; i < RING_COUNT; i++) {
      const mat = new MeshBasicMaterial({
        color: Palette.kim,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
        blending: AdditiveBlending,
      })
      const mesh = new Mesh(ringGeo, mat)
      mesh.visible = false
      mesh.renderOrder = 8
      this.group.add(mesh)
      this.rings.push(mesh)
      this.ringMats.push(mat)
    }
  }

  get isPlaying(): boolean {
    return this.active
  }

  /** Bắt đầu diễn. `success` quyết định hẳn dáng của hiệu ứng. */
  play(
    x: number,
    y: number,
    z: number,
    success: boolean,
    color: ColorRepresentation = success ? Palette.kim : Palette.maHuyet,
  ): void {
    this.active = true
    this.age = 0
    this.success = success
    this.y = y
    this.height = success ? 16 : 3.6
    this.spread = success ? 9.5 : 3.2

    this.shaftMat.color.set(color)
    this.haloMat.color.set(success ? Palette.linh : color)
    for (const mat of this.ringMats) mat.color.set(color)

    this.shaft.position.set(x, y, z)
    this.halo.position.set(x, y + 0.05, z)
    for (const ring of this.rings) ring.position.set(x, y + 0.08, z)

    this.shaft.visible = true
    this.halo.visible = true
    for (const ring of this.rings) ring.visible = true
  }

  update(dt: number): void {
    if (!this.active) return
    this.age += dt

    if (this.age < CHARGE) {
      // Tụ khí: vòng halo siết vào trong và sáng dần, cột chưa hiện
      const t = this.age / CHARGE
      const r = this.spread * 0.42 * (1 - t * 0.78)
      this.halo.scale.set(r, 1, r)
      this.haloMat.opacity = 0.18 + t * 0.42
      this.shaftMat.opacity = 0
      this.shaft.scale.set(0.001, 0.001, 0.001)
      for (const mat of this.ringMats) mat.opacity = 0
      return
    }

    const t = Math.min(1, (this.age - CHARGE) / BURST)

    // Cột: bung lên rất nhanh (0.12 đầu) rồi giữ và mờ dần
    const rise = Math.min(1, (this.age - CHARGE) / 0.12)
    const grow = 1 - (1 - rise) ** 3
    const shrink = 1 - t * 0.6
    const baseRadius = (this.success ? 0.52 : 0.34) * shrink
    this.shaft.scale.set(baseRadius, this.height * grow, baseRadius)
    this.shaftMat.opacity = 0.5 * (1 - t) ** 1.3

    // Halo tan ngay khi cột bung
    this.haloMat.opacity = 0.6 * (1 - Math.min(1, t * 3.5))
    const haloR = this.spread * 0.09 + t * this.spread * 0.5
    this.halo.scale.set(haloR, 1, haloR)

    for (let i = 0; i < this.rings.length; i++) {
      // Lệch pha để ba vòng thành một đợt sóng chứ không phải ba vòng trùng nhau
      const phase = Math.max(0, Math.min(1, t * 1.55 - i * 0.22))
      const mesh = this.rings[i] as Mesh
      const mat = this.ringMats[i] as MeshBasicMaterial
      if (phase <= 0) {
        mat.opacity = 0
        continue
      }
      const eased = 1 - (1 - phase) ** 2.4
      // Thất bại thì vòng CO VÀO thay vì loang ra — khí nghịch bị hút trở lại
      const r = this.success
        ? this.spread * (0.15 + eased * 0.95)
        : this.spread * (1 - eased * 0.85)
      mesh.scale.set(r, 1, r)
      mesh.position.y = this.y + 0.08 + (this.success ? eased * 0.9 : 0)
      mat.opacity = 0.7 * (1 - phase) ** 1.6
    }

    if (t >= 1) this.stop()
  }

  stop(): void {
    this.active = false
    this.shaft.visible = false
    this.halo.visible = false
    this.shaftMat.opacity = 0
    this.haloMat.opacity = 0
    for (let i = 0; i < this.rings.length; i++) {
      ;(this.rings[i] as Mesh).visible = false
      ;(this.ringMats[i] as MeshBasicMaterial).opacity = 0
    }
  }

  dispose(): void {
    this.shaft.geometry.dispose()
    this.halo.geometry.dispose()
    this.shaftMat.dispose()
    this.haloMat.dispose()
    for (const mat of this.ringMats) mat.dispose()
    this.group.removeFromParent()
  }
}
