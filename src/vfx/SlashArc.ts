import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  type ColorRepresentation,
} from 'three'
import { Palette } from '@/art/Palette'
import { VfxPool, type Poolable } from './VfxPool'

interface Slash extends Poolable {
  mesh: Mesh
  material: MeshBasicMaterial
  baseScale: number
  spin: number
}

/**
 * Cung tròn dạng dải, nằm trong mặt phẳng XZ, dày ở giữa và thóp về hai đầu.
 *
 * Thóp hai đầu là chi tiết quan trọng: một dải đều bề dày đọc ra là "cái quạt",
 * còn dải thóp đầu đọc ra là "vết chém" — chính hình dáng nói lên chuyển động.
 */
function buildArcGeometry(halfAngle: number, segments = 14): BufferGeometry {
  const inner = 0.42
  const outer = 1
  const positions: number[] = []

  for (let i = 0; i < segments; i++) {
    const t0 = i / segments
    const t1 = (i + 1) / segments
    const a0 = -halfAngle + t0 * halfAngle * 2
    const a1 = -halfAngle + t1 * halfAngle * 2

    // Bề dày theo hình sin: 0 ở hai đầu, lớn nhất ở giữa
    const w0 = Math.sin(t0 * Math.PI)
    const w1 = Math.sin(t1 * Math.PI)
    const r0i = outer - (outer - inner) * w0
    const r1i = outer - (outer - inner) * w1

    const x0o = Math.sin(a0) * outer
    const z0o = Math.cos(a0) * outer
    const x1o = Math.sin(a1) * outer
    const z1o = Math.cos(a1) * outer
    const x0i = Math.sin(a0) * r0i
    const z0i = Math.cos(a0) * r0i
    const x1i = Math.sin(a1) * r1i
    const z1i = Math.cos(a1) * r1i

    // Hai tam giác cho mỗi đoạn, thứ tự đỉnh cho pháp tuyến hướng lên (+Y)
    positions.push(x0i, 0, z0i, x0o, 0, z0o, x1o, 0, z1o)
    positions.push(x0i, 0, z0i, x1o, 0, z1o, x1i, 0, z1i)
  }

  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geo.computeVertexNormals()
  return geo
}

export interface SlashOptions {
  color?: ColorRepresentation
  halfAngle?: number
  life?: number
}

/**
 * Vệt chém. Mỗi bản có material RIÊNG vì cần alpha riêng để mờ dần độc lập;
 * hồ chỉ 10 phần tử nên tối đa 10 material, đổi lại được điều khiển từng vệt.
 */
export class SlashArcLayer {
  readonly group = new Group()
  private readonly pool: VfxPool<Slash>

  constructor(capacity = 10) {
    this.group.name = 'vfx:slash'
    const geometry = buildArcGeometry(1)

    this.pool = new VfxPool<Slash>(capacity, () => {
      const material = new MeshBasicMaterial({
        color: Palette.linh,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false, // giữ nguyên độ chói để bloom bắt được
      })
      const mesh = new Mesh(geometry, material)
      mesh.visible = false
      mesh.renderOrder = 8
      this.group.add(mesh)
      return { active: false, age: 0, life: 0.2, mesh, material, baseScale: 1, spin: 0 }
    })
  }

  /**
   * @param facing  hướng nhân vật đang nhìn (radian)
   * @param radius  bán kính đòn đánh, vệt sẽ được scale theo
   */
  spawn(
    x: number,
    y: number,
    z: number,
    facing: number,
    radius: number,
    options: SlashOptions = {},
  ): void {
    const s = this.pool.acquire()
    s.life = options.life ?? 0.19
    s.baseScale = radius
    s.material.color.set(options.color ?? Palette.linh)
    s.mesh.position.set(x, y, z)
    // Nghiêng nhẹ khỏi mặt phẳng ngang để vệt chém không dán bệt xuống đất
    s.mesh.rotation.set(-0.32, facing, 0)
    s.mesh.scale.setScalar(radius * 0.82)
    s.mesh.visible = true
    s.material.opacity = 0.95
  }

  update(dt: number): void {
    this.pool.update(
      dt,
      (s, progress) => {
        // Nở nhanh rồi mờ dần: đọc ra là "quét qua" chứ không phải "hiện ra"
        const grow = 0.82 + progress * 0.34
        s.mesh.scale.setScalar(s.baseScale * grow)
        s.material.opacity = 0.95 * (1 - progress) ** 1.6
      },
      (s) => {
        s.mesh.visible = false
        s.material.opacity = 0
      },
    )
  }

  dispose(): void {
    for (const s of this.pool.all) {
      s.material.dispose()
    }
    const first = this.pool.all[0]
    first?.mesh.geometry.dispose()
  }
}
