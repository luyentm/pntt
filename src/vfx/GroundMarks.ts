import {
  CircleGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  type ColorRepresentation,
} from 'three'
import { Palette } from '@/art/Palette'
import { VfxPool, type Poolable } from './VfxPool'

interface Mark extends Poolable {
  mesh: Mesh
  material: MeshBasicMaterial
  radius: number
  peak: number
}

/**
 * Vết còn lại trên mặt đất sau một pháp vực: vệt cháy, mảng băng.
 *
 * Tồn tại vì một chiêu diện rộng mà không để lại gì thì nó chỉ là một tia sáng
 * loé qua — người chơi không có bằng chứng nào rằng chỗ đó vừa bị đánh. Vết
 * nằm lại vài giây làm sân đấu mang dấu của trận đánh.
 *
 * Đĩa phẳng nằm ngang, KHÔNG dùng decal chiếu: địa hình chỗ này gần như phẳng
 * nên một đĩa nghiêng theo mặt đất đọc ra không khác gì decal thật, mà không
 * cần thêm một pass render nào.
 */
export class GroundMarkLayer {
  readonly group = new Group()
  private readonly pool: VfxPool<Mark>

  constructor(capacity = 14) {
    this.group.name = 'vfx:groundMarks'
    const geometry = new CircleGeometry(1, 18)
    geometry.rotateX(-Math.PI / 2)

    this.pool = new VfxPool<Mark>(capacity, () => {
      const material = new MeshBasicMaterial({
        color: Palette.hoa,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      })
      const mesh = new Mesh(geometry, material)
      mesh.visible = false
      // Dưới mọi hiệu ứng khác nhưng trên mặt đất
      mesh.renderOrder = 4
      this.group.add(mesh)
      return { active: false, age: 0, life: 1, mesh, material, radius: 1, peak: 0.4 }
    })
  }

  spawn(
    x: number,
    y: number,
    z: number,
    radius: number,
    options: { color?: ColorRepresentation; life?: number; opacity?: number } = {},
  ): void {
    const m = this.pool.acquire()
    m.life = options.life ?? 2.6
    m.radius = radius
    m.peak = options.opacity ?? 0.34
    m.material.color.set(options.color ?? Palette.hoa)
    // Nhấc lên 0.04 để không bị z-fight với mặt đất
    m.mesh.position.set(x, y + 0.04, z)
    m.mesh.scale.set(radius, 1, radius)
    m.mesh.visible = true
    m.material.opacity = m.peak
  }

  update(dt: number): void {
    this.pool.update(
      dt,
      (m, progress) => {
        // Hiện gần như ngay rồi mờ CHẬM: vết cháy không loang ra, nó nhạt dần
        const fadeIn = Math.min(1, progress * 12)
        m.material.opacity = m.peak * fadeIn * (1 - progress) ** 1.6
      },
      (m) => {
        m.mesh.visible = false
        m.material.opacity = 0
      },
    )
  }

  dispose(): void {
    for (const m of this.pool.all) m.material.dispose()
    this.pool.all[0]?.mesh.geometry.dispose()
    this.group.removeFromParent()
  }
}
