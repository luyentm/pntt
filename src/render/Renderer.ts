import { NeutralToneMapping, PCFShadowMap, SRGBColorSpace, WebGLRenderer } from 'three'

/**
 * Bọc WebGLRenderer: lo DPR, resize, và tỉ lệ phân giải để hạ tải khi cần.
 *
 * Kích thước được đo từ CHÍNH canvas (clientWidth/clientHeight) qua ResizeObserver,
 * không phải từ window.innerWidth + event 'resize'. Lý do: canvas do CSS bố cục,
 * nên nó đổi kích thước trong nhiều trường hợp mà window không hề phát 'resize'
 * — pane bị kéo, devtools mở ra, chia đôi màn hình. Cách cũ còn có race lúc khởi
 * tạo: nếu đọc innerWidth đúng lúc pane đang resize thì sai vĩnh viễn vì sau đó
 * không có event nào để sửa.
 *
 * DPR bị chặn ở 2 — Retina 3x không đáng đổi 2/3 hiệu năng cho khác biệt gần như không thấy.
 */
export class Renderer {
  readonly gl: WebGLRenderer
  /** Hệ số phân giải (0.5..1). Hạ xuống là cách nhanh nhất để cứu fps. */
  private scale = 1
  private cssWidth = 1
  private cssHeight = 1
  private readonly onResizeCbs: Array<(w: number, h: number) => void> = []
  private readonly observer: ResizeObserver

  constructor(readonly canvas: HTMLCanvasElement) {
    this.gl = new WebGLRenderer({
      canvas,
      antialias: false, // MSAA được xử lý ở render target của EffectComposer
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
    })
    this.gl.outputColorSpace = SRGBColorSpace
    // Neutral (Khronos PBR Neutral) thay cho ACES.
    //
    // ACES nén cao sáng bằng cách kéo màu về phía trắng, nên với đồ hoạ lowpoly —
    // nơi MÀU là toàn bộ thông tin bề mặt vì không có texture — nó vừa làm nhạt
    // màu vừa khiến cỏ cháy trắng ngay khi tăng nắng. Neutral giữ sắc tới sát
    // ngưỡng, nên đẩy được tương phản mà cỏ vẫn ra cỏ.
    this.gl.toneMapping = NeutralToneMapping
    this.gl.toneMappingExposure = 1.12
    this.gl.shadowMap.enabled = true
    // PCFSoftShadowMap đã bị deprecate ở three 0.185
    this.gl.shadowMap.type = PCFShadowMap
    this.gl.setClearColor(0x0b0e12, 1)
    // EffectComposer gọi renderer.render() nhiều lần mỗi frame (RenderPass + từng
    // EffectPass). Mặc định three tự reset info ở mỗi lần gọi, nên số đọc chỉ còn
    // đúng 1 draw call của quad pass cuối. Tự quản lý reset để đếm được cả frame.
    this.gl.info.autoReset = false

    this.measure()
    this.applySize()

    this.observer = new ResizeObserver(() => {
      if (this.measure()) {
        this.applySize()
        this.notify()
      }
    })
    this.observer.observe(canvas)
  }

  /** Kích thước logic (CSS pixel) sau khi áp tỉ lệ phân giải. */
  get width(): number {
    return Math.max(1, Math.floor(this.cssWidth * this.scale))
  }

  get height(): number {
    return Math.max(1, Math.floor(this.cssHeight * this.scale))
  }

  get dpr(): number {
    return Math.min(window.devicePixelRatio || 1, 2)
  }

  get resolutionScale(): number {
    return this.scale
  }

  set resolutionScale(value: number) {
    const clamped = Math.min(1, Math.max(0.5, value))
    if (Math.abs(clamped - this.scale) < 1e-3) return
    this.scale = clamped
    this.applySize()
    this.notify()
  }

  onResize(cb: (w: number, h: number) => void): void {
    this.onResizeCbs.push(cb)
  }

  /** Trả về true nếu kích thước thực sự đổi. */
  private measure(): boolean {
    // clientWidth có thể là 0 trong frame đầu (canvas chưa vào layout) -> lùi về
    // kích thước cửa sổ để không bao giờ dựng render target 0px
    const w = this.canvas.clientWidth || window.innerWidth || 1
    const h = this.canvas.clientHeight || window.innerHeight || 1
    if (w === this.cssWidth && h === this.cssHeight) return false
    this.cssWidth = w
    this.cssHeight = h
    return true
  }

  private applySize(): void {
    this.gl.setPixelRatio(this.dpr)
    // updateStyle = false: CSS đã cho canvas phủ full viewport, để three ghi style sẽ đè lên
    this.gl.setSize(this.width, this.height, false)
  }

  private notify(): void {
    for (const cb of this.onResizeCbs) cb(this.width, this.height)
  }

  /** Gọi ở đầu mỗi frame, trước khi vẽ. */
  beginFrame(): void {
    this.gl.info.reset()
  }

  /** Số draw call của frame vừa rồi — đọc trong debug panel. */
  get drawCalls(): number {
    return this.gl.info.render.calls
  }

  get triangles(): number {
    return this.gl.info.render.triangles
  }

  dispose(): void {
    this.observer.disconnect()
    this.gl.dispose()
  }
}
