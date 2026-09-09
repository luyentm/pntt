import type { ShadowMapType, ToneMapping } from 'three'
import type { Game } from '@/core/Game'
import { StylizedAtmosphere } from './StylizedAtmosphere'
import { TUNE } from './tune'

export { StylizedAtmosphere } from './StylizedAtmosphere'
export { TUNE } from './tune'

/**
 * Bật/tắt bộ môi trường stylized trên một `Game` đang chạy.
 *
 * Tồn tại để SO SÁNH được hai phong cách trên cùng một cảnh. Chỉnh số trong
 * `tune.ts` rồi tải lại trang là thấy ngay, không phải dựng lại cảnh.
 *
 * Khi bật thì bộ mặc định bị tắt hết — nếu để cả hai thì mọi thứ nhận sáng hai
 * lần và không con số nào của `tune.ts` còn nghĩa gì.
 */
export class StylizedToggle {
  private atmosphere: StylizedAtmosphere | null = null
  /**
   * Vị trí đèn lạnh của lần bật gần nhất.
   *
   * Nhớ lại để bật/tắt từ bảng debug không cần biết bố cục sân: `main` bật bộ
   * này lúc khởi động với các cột đá của màn, và bảng debug chỉ cần gọi
   * `enable()` là ra đúng cảnh đó.
   */
  private lastSpots: ReadonlyArray<{ x: number; y: number; z: number }> | undefined
  private shadows = true
  private postFx = true
  private saved: {
    fog: typeof Game.prototype.three.fog
    background: typeof Game.prototype.three.background
    toneMapping: ToneMapping
    exposure: number
    shadowType: ShadowMapType
    hemiIntensity: number
    sunIntensity: number
    rimIntensity: number
  } | null = null

  constructor(private readonly game: Game) {}

  get active(): boolean {
    return this.atmosphere !== null
  }

  /** Bộ đang chạy, để bảng debug gắn slider vào. `null` khi đang tắt. */
  get current(): StylizedAtmosphere | null {
    return this.atmosphere
  }

  enable(coolSpots?: ReadonlyArray<{ x: number; y: number; z: number }>): void {
    if (this.atmosphere) return
    if (coolSpots) this.lastSpots = coolSpots
    const g = this.game

    this.saved = {
      fog: g.three.fog,
      background: g.three.background,
      toneMapping: g.renderer.gl.toneMapping,
      exposure: g.renderer.gl.toneMappingExposure,
      shadowType: g.renderer.gl.shadowMap.type,
      hemiIntensity: g.lighting.hemi.intensity,
      sunIntensity: g.lighting.sun.intensity,
      rimIntensity: g.lighting.rim.intensity,
    }

    // Tắt bộ đèn mặc định thay vì tháo khỏi scene: tháo ra rồi gắn lại làm
    // three phải biên dịch lại toàn bộ shader của cảnh, và mỗi lần bật/tắt là
    // một cú đứng máy nửa giây
    g.lighting.hemi.intensity = 0
    g.lighting.sun.intensity = 0
    g.lighting.rim.intensity = 0
    // Vòm trời gradient phải ẩn: bộ stylized dùng `scene.background` một màu
    // khớp với sương mù, và cái vòm sẽ che mất nó
    g.sky.mesh.visible = false

    this.atmosphere = new StylizedAtmosphere(g.renderer.gl, g.three, g.camera.camera, {
      coolSpots: this.lastSpots,
    })
    this.atmosphere.attach()
    this.atmosphere.setSize(g.renderer.width, g.renderer.height)
    this.applyQuality()
    g.renderOverride = (dt) => this.atmosphere?.render(dt)
  }

  /**
   * Bóng đổ và hậu xử lý theo bảng Cài đặt.
   *
   * Phải nối lại vì bộ này có ĐÈN VÀ CHUỖI PASS RIÊNG: `lighting.shadowsEnabled`
   * chỉ tắt bóng của nắng mặc định, còn `composer.enabled` thì vô nghĩa khi
   * `renderOverride` đã thay cả đường vẽ. Không nối thì bật bộ stylized làm hai
   * công tắc trong Cài đặt im lặng mất tác dụng — kiểu hỏng tệ nhất cho một
   * công tắc, vì người chơi không có cách nào biết.
   *
   * Giữ giá trị ngay cả khi đang tắt, để lần bật sau vẫn đúng cài đặt.
   */
  set shadowsEnabled(value: boolean) {
    this.shadows = value
    this.applyQuality()
  }

  get shadowsEnabled(): boolean {
    return this.shadows
  }

  set postFxEnabled(value: boolean) {
    this.postFx = value
    this.applyQuality()
  }

  get postFxEnabled(): boolean {
    return this.postFx
  }

  private applyQuality(): void {
    const atmo = this.atmosphere
    if (!atmo) return
    atmo.sun.castShadow = this.shadows
    // Tắt hậu xử lý = tắt BLOOM, không phải bỏ cả chuỗi pass: `OutputPass` mới
    // là thứ áp tone mapping, bỏ nó thì ảnh ra nhạt sai màu
    atmo.bloom.enabled = this.postFx
  }

  disable(): void {
    const atmo = this.atmosphere
    const saved = this.saved
    if (!atmo || !saved) return
    const g = this.game

    g.renderOverride = null
    atmo.dispose()
    this.atmosphere = null

    g.three.fog = saved.fog
    g.three.background = saved.background
    g.renderer.gl.toneMapping = saved.toneMapping
    g.renderer.gl.toneMappingExposure = saved.exposure
    g.renderer.gl.shadowMap.type = saved.shadowType
    g.lighting.hemi.intensity = saved.hemiIntensity
    g.lighting.sun.intensity = saved.sunIntensity
    g.lighting.rim.intensity = saved.rimIntensity
    g.sky.mesh.visible = true
    this.saved = null
  }

  toggle(coolSpots?: ReadonlyArray<{ x: number; y: number; z: number }>): void {
    if (this.active) this.disable()
    else this.enable(coolSpots)
  }

  /** Nhịp mỗi khung. Không làm gì khi đang tắt. */
  update(dt: number, focusX: number, focusY: number, focusZ: number): void {
    this.atmosphere?.update(dt, focusX, focusY, focusZ)
  }

  setSize(width: number, height: number): void {
    this.atmosphere?.setSize(width, height)
  }

  /** Bảng số đang dùng — tiện cho bảng debug. */
  get tune(): typeof TUNE {
    return TUNE
  }
}
