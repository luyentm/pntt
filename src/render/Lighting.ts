import { DirectionalLight, HemisphereLight, Vector3, type Scene } from 'three'
import { Palette } from '@/art/Palette'

/**
 * Ánh sáng ba nguồn: nắng chính (có bóng) + ánh môi trường trời/đất + đèn viền.
 *
 * Chỉ MỘT nguồn đổ bóng, và khung shadow bám sát nhân vật — đó là cách giữ bóng
 * nét mà không cần cascade: vùng cần bóng luôn chỉ là mấy chục mét quanh người chơi.
 *
 * ## Vì sao ba nguồn, và vì sao tỉ lệ như thế này
 *
 * Bản đầu chỉ có hemisphere 0.85 + nắng 1.75, và cảnh nhìn ra "nhạt nhoà": cỏ, đá
 * và cột đều nằm trong CÙNG MỘT dải xám-lục hẹp, bóng gần như không thấy, và không
 * có gì tách nhân vật khỏi nền.
 *
 * Nguyên nhân là hemisphere quá mạnh. Nó rọi từ cả trên và dưới nên không có mặt
 * nào thật sự nằm trong tối — mọi khối mất hết chiều, và đổ bóng chỉ còn là một
 * vệt xám nhạt. Ở đây hemisphere hạ về 0.38 và nắng lên 1.95.
 *
 * Các con số này dò bằng MẮT trong game (nhóm "Ánh sáng" của bảng debug), không
 * tính ra. Thử 2.35 trước thì cỏ và nhân vật cháy trắng; thử hemisphere 0.44 thì
 * bóng bị lấp lại. Khoảng dùng được hẹp hơn tôi tưởng, và cách duy nhất để tìm
 * là xem từng khung hình.
 *
 * Hai màu của hemisphere cố tình ĐỐI NHAU về nhiệt độ: trời xanh lạnh, đất nâu ấm.
 * Nhờ vậy mặt hướng lên và mặt hướng xuống khác nhau cả về màu, không chỉ về độ
 * sáng — đó là thứ làm khối lowpoly có chất liệu thay vì trông như nhựa xám.
 *
 * Đèn viền là nguồn quan trọng nhất về mặt cảm giác "tu tiên": nó rọi từ phía sau
 * và thấp, màu linh khí, nên nhân vật và quái luôn có một đường sáng lạnh ở rìa
 * tách khỏi hậu cảnh. Không đổ bóng nên gần như miễn phí.
 */
export class Lighting {
  readonly hemi: HemisphereLight
  readonly sun: DirectionalLight
  /** Đèn viền linh khí — không đổ bóng, chỉ để tách bóng ngoài khỏi nền. */
  readonly rim: DirectionalLight

  /**
   * Hướng từ tâm cảnh tới mặt trời.
   *
   * Hạ thấp còn ~31° so với 51° của bản đầu: nắng chếch cho bóng DÀI, và bóng dài
   * là thứ nói cho mắt biết mặt đất có hướng. Nắng gần đỉnh đầu thì mọi vật chỉ có
   * một vệt bóng bé xíu ngay dưới chân, và cảnh phẳng lì.
   */
  readonly sunDir = new Vector3(-0.52, 0.6, 0.42).normalize()
  /** Hướng tới đèn viền: gần như đối diện nắng theo mặt phẳng ngang, và thấp. */
  readonly rimDir = new Vector3(0.58, 0.26, -0.5).normalize()
  /** Nửa chiều rộng khung bóng, tính bằng world unit. */
  shadowExtent = 22

  private readonly sunOffset = new Vector3()

  constructor(scene: Scene) {
    this.hemi = new HemisphereLight(Palette.troiSang, Palette.datDoi, 0.46)
    scene.add(this.hemi)

    this.rim = new DirectionalLight(Palette.vienLinh, 0.32)
    this.rim.castShadow = false
    this.rim.position.copy(this.rimDir).multiplyScalar(60)
    scene.add(this.rim)

    this.sun = new DirectionalLight(Palette.nangKim, 1.95)
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
