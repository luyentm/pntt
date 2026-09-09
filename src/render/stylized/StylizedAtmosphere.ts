import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PCFShadowMap,
  PointLight,
  SRGBColorSpace,
  Vector2,
  Vector3,
  VSMShadowMap,
  type Material,
  type PerspectiveCamera,
  type Scene,
  type WebGLRenderer,
} from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { TUNE } from './tune'

/** Vị trí một đèn điểm lạnh ở góc tàn tích. */
export interface CoolLightSpot {
  x: number
  y: number
  z: number
}

export interface StylizedOptions {
  /** Các góc tàn tích cần rọi đèn xanh lục lam. */
  coolSpots?: readonly CoolLightSpot[]
}

/**
 * Bộ môi trường stylized/fantasy: ánh sáng + sương mù + hậu kỳ.
 *
 * Ba tông màu làm nên phong cách:
 *  - VÀNG CAM là nắng (`DirectionalLight`) — nó vẽ ra các vệt nắng.
 *  - XANH LAM là bóng đổ (`HemisphereLight` màu trời) và sương mù (`FogExp2`).
 *  - ĐỎ/CAM là điểm nhấn quanh nhân vật (`PointLight` ấm).
 *
 * Điểm cần hiểu rõ nhất: **bóng đổ không có màu riêng.** Không có tham số nào
 * tên là "màu bóng". Vùng bóng chỉ là vùng KHÔNG nhận được nắng, nên màu nó
 * hoàn toàn do ánh sáng môi trường quyết định. Muốn bóng ám xanh dương thì phải
 * làm `hemisphere.skyColor` xanh dương — đó là lý do tham số đó được đánh dấu
 * là quan trọng nhất trong `tune.ts`.
 *
 * Mọi con số nằm trong `tune.ts`. Lớp này chỉ dựng và cập nhật.
 *
 * ## Dùng
 * ```ts
 * const atmo = new StylizedAtmosphere(renderer, scene, camera, {
 *   coolSpots: [{ x: -9, y: 1.5, z: -7 }, { x: 9, y: 1.5, z: 6 }],
 * })
 * atmo.setSize(width, height)
 * // trong vòng lặp:
 * atmo.update(dt, player.x, player.y, player.z)
 * atmo.render(dt)
 * ```
 */
export class StylizedAtmosphere {
  readonly hemisphere: HemisphereLight
  readonly sun: DirectionalLight
  readonly coolLights: PointLight[] = []
  readonly warmLight: PointLight
  readonly fog: FogExp2
  readonly composer: EffectComposer
  readonly bloom: UnrealBloomPass

  /** Hướng tới mặt trời, đã chuẩn hoá. */
  readonly sunDir = new Vector3()

  private readonly sunOffset = new Vector3()
  private readonly savedMaterials = new Map<Mesh, Material | Material[]>()
  private readonly ownedObjects: Array<HemisphereLight | DirectionalLight | PointLight> = []

  constructor(
    renderer: WebGLRenderer,
    private readonly scene: Scene,
    camera: PerspectiveCamera,
    options: StylizedOptions = {},
  ) {
    // ── 1. RENDERER ────────────────────────────────────────────────────────
    renderer.outputColorSpace = SRGBColorSpace
    renderer.toneMapping = ACESFilmicToneMapping
    renderer.toneMappingExposure = TUNE.renderer.exposure
    renderer.shadowMap.enabled = true
    // KHÔNG dùng PCFSoftShadowMap, dù hằng số đó vẫn tồn tại và gán được.
    //
    // three 0.185 hạ cấp nó LÚC CHẠY: `WebGLShadowMap.render()` kiểm tra, in một
    // cảnh báo rồi tự đặt lại thành `PCFShadowMap` ngay khung hình đầu tiên. Tôi
    // đã đặt nó, đọc lại và thấy giá trị đã bị đổi về 1 — nên "bóng đổ mềm" theo
    // đường đó là không thể có trong bản three này.
    //
    // `VSMShadowMap` là đường bóng mềm thật còn lại: nó tôn trọng `shadow.radius`
    // và `shadow.blurSamples`. Xem `tune.shadowKind` để đổi sang `'pcf'` nếu VSM
    // gây rỉ sáng ở cảnh của bạn.
    renderer.shadowMap.type =
      TUNE.renderer.shadowKind === 'vsm' ? VSMShadowMap : PCFShadowMap

    // ── 2. ÁNH SÁNG ───────────────────────────────────────────────────────
    this.hemisphere = new HemisphereLight(
      TUNE.hemisphere.skyColor,
      TUNE.hemisphere.groundColor,
      TUNE.hemisphere.intensity,
    )
    this.add(this.hemisphere)

    this.sun = new DirectionalLight(TUNE.sun.color, TUNE.sun.intensity)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(TUNE.renderer.shadowMapSize, TUNE.renderer.shadowMapSize)
    this.sun.shadow.bias = TUNE.sun.shadowBias
    this.sun.shadow.normalBias = TUNE.sun.shadowNormalBias
    this.sun.shadow.radius = TUNE.sun.shadowRadius
    this.sun.shadow.blurSamples = TUNE.renderer.shadowBlurSamples
    this.applyShadowFrustum()
    this.add(this.sun)
    // `sun.target` phải nằm trong scene, nếu không three không cập nhật ma trận
    // của nó và khung bóng đứng yên ở gốc toạ độ bất kể ta đặt target ở đâu
    this.scene.add(this.sun.target)

    const d = TUNE.sun.direction
    this.sunDir.set(d.x, d.y, d.z).normalize()

    for (const spot of options.coolSpots ?? []) {
      const light = new PointLight(
        TUNE.points.coolColor,
        TUNE.points.coolIntensity,
        TUNE.points.coolDistance,
        2, // decay 2 = nghịch đảo bình phương, đúng vật lý
      )
      light.position.set(spot.x, spot.y, spot.z)
      this.coolLights.push(light)
      this.add(light)
    }

    this.warmLight = new PointLight(
      TUNE.points.warmColor,
      TUNE.points.warmIntensity,
      TUNE.points.warmDistance,
      2,
    )
    this.add(this.warmLight)

    // ── 3. SƯƠNG MÙ VÀ NỀN ────────────────────────────────────────────────
    // Cùng MỘT màu. Lệch nhau thì đường chân trời hiện thành một vệt rõ.
    this.fog = new FogExp2(TUNE.fog.color, TUNE.fog.density)

    // ── 4. HẬU KỲ ─────────────────────────────────────────────────────────
    this.composer = new EffectComposer(renderer)
    this.composer.addPass(new RenderPass(scene, camera))

    this.bloom = new UnrealBloomPass(
      new Vector2(1, 1), // cỡ thật do setSize() đặt
      TUNE.bloom.strength,
      TUNE.bloom.radius,
      TUNE.bloom.threshold,
    )
    this.composer.addPass(this.bloom)

    // `OutputPass` BẮT BUỘC phải là pass cuối.
    //
    // `EffectComposer` render vào một target HalfFloat TUYẾN TÍNH, và trong
    // chuỗi pass thì three không tự áp tone mapping. `OutputPass` mới là thứ
    // đọc `renderer.toneMapping` + `renderer.outputColorSpace` và áp chúng.
    // Thiếu nó thì ACESFilmicToneMapping ở trên hoàn toàn KHÔNG có tác dụng và
    // ảnh ra nhạt sai màu — đây là lỗi phổ biến nhất của đúng chuỗi này.
    this.composer.addPass(new OutputPass())
  }

  private add(light: HemisphereLight | DirectionalLight | PointLight): void {
    this.scene.add(light)
    this.ownedObjects.push(light)
  }

  private applyShadowFrustum(): void {
    const cam = this.sun.shadow.camera
    const e = TUNE.sun.shadowExtent
    cam.left = -e
    cam.right = e
    cam.top = e
    cam.bottom = -e
    cam.near = 0.5
    // Phải phủ hết đường từ vị trí đèn tới mặt đất. Đèn được đặt cách
    // `shadowExtent * 2.2` theo hướng nắng, nên `far` phải lớn hơn thế.
    cam.far = e * 5
    cam.updateProjectionMatrix()
  }

  /** Bật sương mù và nền. Gọi khi muốn dùng bộ này. */
  attach(): void {
    this.scene.fog = this.fog
    this.scene.background = new Color(TUNE.fog.color)
  }

  /** Phải gọi mỗi lần khung hình đổi kích thước. */
  setSize(width: number, height: number): void {
    this.composer.setSize(width, height)
    this.bloom.setSize(width, height)
  }

  /**
   * Cập nhật mỗi khung.
   *
   * @param focus điểm cần bóng nét — thường là nhân vật. Khung bóng đi theo nó,
   *   nên `shadowExtent` chỉ cần phủ vài chục unit quanh người chơi thay vì cả
   *   bản đồ. Đó là cách giữ bóng nét mà không cần cascade shadow map.
   */
  update(_dt: number, focusX: number, focusY: number, focusZ: number): void {
    this.sun.target.position.set(focusX, focusY, focusZ)
    this.sunOffset.copy(this.sunDir).multiplyScalar(TUNE.sun.shadowExtent * 2.2)
    this.sun.position.set(
      focusX + this.sunOffset.x,
      focusY + this.sunOffset.y,
      focusZ + this.sunOffset.z,
    )
    // Đèn ấm bám theo nhân vật để luôn có tương phản đỏ/xanh ở chỗ đang nhìn
    this.warmLight.position.set(focusX, focusY + TUNE.points.warmHeight, focusZ)
  }

  render(dt: number): void {
    this.composer.render(dt)
  }

  // ── 5. VẬT LIỆU ─────────────────────────────────────────────────────────

  /**
   * Cấu hình một `MeshStandardMaterial` cho phong cách này.
   *
   * `roughness` cao + `metalness` gần 0. Hai lý do cụ thể:
   *  - `roughness` thấp cho ra highlight bóng loáng, đọc ra là nhựa hoặc kim
   *    khí và phá ngay chất vẽ tay.
   *  - `metalness` trên 0 làm vật thể lấy màu từ môi trường phản chiếu. Không
   *    có `envMap` thì môi trường là màu đen, nên vật KIM LOẠI hoá thành VẬT
   *    ĐEN. Đây là cái bẫy hay gặp nhất khi chuyển sang PBR.
   */
  static configureSurface(material: MeshStandardMaterial): MeshStandardMaterial {
    material.roughness = TUNE.material.roughness
    material.metalness = TUNE.material.metalness
    material.flatShading = true // giữ mặt cắt lowpoly
    material.needsUpdate = true
    return material
  }

  /**
   * Làm một chi tiết phát sáng: rune trên đá, cầu phép, mắt quái.
   *
   * `emissiveIntensity` phải LỚN HƠN 1 để vượt ngưỡng bloom sau tone mapping —
   * ở 1.0 thì màu emissive chỉ làm vật sáng hơn một chút mà không loé ra ngoài
   * viền, và bloom không bắt được gì.
   *
   * Lưu ý: `emissive` KHÔNG rọi sáng vật khác. Nó chỉ làm chính vật đó sáng.
   * Muốn rune thật sự soi lên vách đá bên cạnh thì phải kèm một `PointLight`
   * nhỏ cùng màu ở đúng chỗ đó.
   */
  static makeEmissive(
    material: MeshStandardMaterial,
    hex: number,
    intensity = TUNE.material.emissiveIntensity,
  ): MeshStandardMaterial {
    material.emissive = new Color(hex)
    material.emissiveIntensity = intensity
    material.toneMapped = true
    material.needsUpdate = true
    return material
  }

  /**
   * Đổi mọi vật liệu trong scene sang `MeshStandardMaterial`, giữ nguyên màu và
   * vertex color. Lưu lại vật liệu cũ để `restoreMaterials()` trả về được.
   *
   * Có hàm này để so sánh được HAI phong cách trên cùng một cảnh mà không phải
   * sửa mã dựng prop — nếu không thì mỗi lần muốn thử lại phải build lại.
   */
  convertMaterials(): void {
    this.scene.traverse((object) => {
      if (!(object instanceof Mesh)) return
      const current = object.material
      if (Array.isArray(current)) return
      if (current instanceof MeshStandardMaterial) return
      // Vật liệu phát sáng (MeshBasicMaterial cho VFX) phải giữ nguyên: chuyển
      // sang Standard là chúng bắt đầu nhận sáng và tắt ngóm trong tối
      const src = current as Material & {
        color?: Color
        vertexColors?: boolean
        transparent?: boolean
        opacity?: number
      }
      if (src.transparent === true) return

      this.savedMaterials.set(object, current)
      const next = new MeshStandardMaterial({
        color: src.color ? src.color.clone() : new Color(0xffffff),
        vertexColors: src.vertexColors ?? false,
      })
      StylizedAtmosphere.configureSurface(next)
      object.material = next
    })
  }

  restoreMaterials(): void {
    for (const [mesh, material] of this.savedMaterials) {
      const replaced = mesh.material
      mesh.material = material
      if (!Array.isArray(replaced)) replaced.dispose()
    }
    this.savedMaterials.clear()
  }

  dispose(): void {
    this.restoreMaterials()
    for (const light of this.ownedObjects) this.scene.remove(light)
    this.scene.remove(this.sun.target)
    this.ownedObjects.length = 0
    this.composer.dispose()
  }
}
