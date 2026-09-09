import { DirectionalLight, HemisphereLight, Vector3, type Scene } from 'three'
import { Palette } from '@/art/Palette'

/**
 * Ánh sáng: 1 hemisphere (ánh sáng môi trường trời/đất) + 1 directional làm mặt trời có bóng.
 *
 * Chỉ một nguồn đổ bóng duy nhất, và khung shadow bám sát nhân vật — đó là cách giữ
 * bóng nét mà không cần cascade: vùng cần bóng luôn chỉ là mấy chục mét quanh người chơi.
 */
export class Lighting {
  readonly hemi: HemisphereLight
  readonly sun: DirectionalLight

  /** Hướng từ tâm cảnh tới mặt trời. */
  readonly sunDir = new Vector3(-0.45, 0.78, 0.44).normalize()
  /** Nửa chiều rộng khung bóng, tính bằng world unit. */
  shadowExtent = 22

  private readonly sunOffset = new Vector3()

  constructor(scene: Scene) {
    this.hemi = new HemisphereLight(Palette.troiChanTroi, Palette.dat, 0.85)
    scene.add(this.hemi)

    this.sun = new DirectionalLight(Palette.nangSom, 1.75)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    // Bias: chống bóng răng cưa (acne) trên mặt phẳng lớn mà không tách bóng khỏi chân vật
    this.sun.shadow.bias = -0.0006
    this.sun.shadow.normalBias = 0.035
    scene.add(this.sun)
    scene.add(this.sun.target)

    this.applyShadowFrustum()
  }

  set shadowsEnabled(value: boolean) {
    this.sun.castShadow = value
  }

  get shadowsEnabled(): boolean {
    return this.sun.castShadow
  }

  setShadowExtent(extent: number): void {
    this.shadowExtent = extent
    this.applyShadowFrustum()
  }

  private applyShadowFrustum(): void {
    const cam = this.sun.shadow.camera
    const e = this.shadowExtent
    cam.left = -e
    cam.right = e
    cam.top = e
    cam.bottom = -e
    cam.near = 1
    cam.far = e * 4.5
    cam.updateProjectionMatrix()
  }

  /** Giữ mặt trời và khung bóng đi theo điểm ngắm của camera. */
  update(focusX: number, focusY: number, focusZ: number): void {
    this.sun.target.position.set(focusX, focusY, focusZ)
    this.sunOffset.copy(this.sunDir).multiplyScalar(this.shadowExtent * 2.1)
    this.sun.position.set(focusX + this.sunOffset.x, focusY + this.sunOffset.y, focusZ + this.sunOffset.z)
  }
}
