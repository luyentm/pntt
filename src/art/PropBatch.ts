import { InstancedMesh, Matrix4, Quaternion, Vector3, type BufferGeometry, type Material } from 'three'

interface Placement {
  x: number
  y: number
  z: number
  rotY: number
  scale: number
  scaleY: number
}

/**
 * Gộp nhiều bản của cùng một prop vào MỘT `InstancedMesh`.
 *
 * Đổi lại: mọi bản dùng chung một geometry, nên biến thể chỉ còn nằm ở tỉ lệ và
 * góc xoay. Bù lại thì 90 cây tùng tốn 1 draw call thay vì 90 — và cách bù cho
 * sự đơn điệu là dựng vài BIẾN THỂ geometry rồi mỗi biến thể một batch: 3 batch
 * cho 90 cây vẫn là 3 draw call.
 */
export class PropBatch {
  private readonly placements: Placement[] = []
  private readonly matrix = new Matrix4()
  private readonly position = new Vector3()
  private readonly quaternion = new Quaternion()
  private readonly scaleVec = new Vector3()
  private readonly axisY = new Vector3(0, 1, 0)

  constructor(
    private readonly geometry: BufferGeometry,
    private readonly material: Material,
    private readonly name: string,
  ) {}

  get count(): number {
    return this.placements.length
  }

  add(x: number, y: number, z: number, rotY = 0, scale = 1, scaleY = scale): this {
    this.placements.push({ x, y, z, rotY, scale, scaleY })
    return this
  }

  /** Trả về null nếu không có bản nào — để scene bỏ qua thay vì thêm mesh rỗng. */
  build(): InstancedMesh | null {
    const n = this.placements.length
    if (n === 0) return null

    const mesh = new InstancedMesh(this.geometry, this.material, n)
    mesh.name = this.name
    mesh.castShadow = true
    mesh.receiveShadow = false

    for (let i = 0; i < n; i++) {
      const p = this.placements[i] as Placement
      this.position.set(p.x, p.y, p.z)
      this.quaternion.setFromAxisAngle(this.axisY, p.rotY)
      this.scaleVec.set(p.scale, p.scaleY, p.scale)
      this.matrix.compose(this.position, this.quaternion, this.scaleVec)
      mesh.setMatrixAt(i, this.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
    // Prop tĩnh, ma trận không đổi sau khi dựng
    mesh.frustumCulled = true
    mesh.computeBoundingSphere()

    this.placements.length = 0
    return mesh
  }
}
