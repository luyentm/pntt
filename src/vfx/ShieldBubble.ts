import { Group, IcosahedronGeometry, Mesh, MeshBasicMaterial } from 'three'
import { Palette } from '@/art/Palette'

/**
 * Khiên Kim Quang Thuẫn: vỏ đa diện bọc quanh nhân vật.
 *
 * Dùng khối đa diện có facet chứ không phải cầu trơn, và vẽ ở chế độ wireframe-ish
 * bằng cách chồng hai lớp: một lớp mặt mờ và một lớp viền. Ở phong cách lowpoly
 * thì các mặt phẳng nhìn thấy được chính là thứ nói lên "đây là pháp thuật",
 * cầu trơn trong suốt sẽ trông như bong bóng nước.
 *
 * Chỉ MỘT bản duy nhất, bám theo người chơi — không cần hồ đối tượng.
 */
export class ShieldBubble {
  readonly group = new Group()
  private readonly shell: Mesh
  private readonly edges: Mesh
  private readonly shellMat: MeshBasicMaterial
  private readonly edgeMat: MeshBasicMaterial
  private time = 0

  constructor() {
    this.group.name = 'vfx:shield'
    this.group.visible = false

    const geometry = new IcosahedronGeometry(1, 1)

    this.shellMat = new MeshBasicMaterial({
      color: Palette.kim,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      toneMapped: false,
    })
    this.edgeMat = new MeshBasicMaterial({
      color: Palette.kim,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      wireframe: true,
      toneMapped: false,
    })

    this.shell = new Mesh(geometry, this.shellMat)
    this.edges = new Mesh(geometry, this.edgeMat)
    this.shell.renderOrder = 9
    this.edges.renderOrder = 10
    this.group.add(this.shell)
    this.group.add(this.edges)
  }

  /**
   * @param strength 0..1 — còn bao nhiêu phần khiên. Khiên yếu thì mờ và co lại,
   * nên người chơi biết mình sắp mất che chắn mà không cần đọc số.
   */
  update(
    dt: number,
    visible: boolean,
    x: number,
    y: number,
    z: number,
    radius: number,
    strength: number,
  ): void {
    this.group.visible = visible
    if (!visible) return

    this.time += dt
    this.group.position.set(x, y + radius * 0.82, z)
    // Xoay chậm hai lớp lệch nhau -> các mặt lấp lánh không theo chu kỳ rõ rệt
    this.shell.rotation.set(this.time * 0.35, this.time * 0.5, 0)
    this.edges.rotation.set(-this.time * 0.28, this.time * 0.42, this.time * 0.1)

    const s = radius * (0.86 + strength * 0.2)
    this.shell.scale.setScalar(s)
    this.edges.scale.setScalar(s * 1.008)

    const pulse = 0.82 + Math.sin(this.time * 5) * 0.18
    // Mặt phải RẤT mờ, chỉ còn viền là rõ: khiên là thứ bao quanh nhân vật, nếu
    // mặt đủ đậm để nhìn thấy thì nó che mất chính nhân vật
    this.shellMat.opacity = 0.09 * strength * pulse
    this.edgeMat.opacity = (0.18 + 0.34 * strength) * pulse
  }

  dispose(): void {
    this.shell.geometry.dispose()
    this.shellMat.dispose()
    this.edgeMat.dispose()
    this.group.removeFromParent()
  }
}
