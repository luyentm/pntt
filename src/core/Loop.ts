export interface LoopCallbacks {
  /** Bước mô phỏng cố định 1/60s. Toàn bộ gameplay/AI/combat chạy ở đây. */
  fixed: (dt: number) => void
  /** Vẽ. `alpha` (0..1) là phần dư của accumulator, dùng để nội suy vị trí khi render. */
  render: (alpha: number, frameDt: number) => void
}

/**
 * Vòng lặp fixed-timestep + nội suy.
 * Lý do: combat và AI phải xác định (deterministic), không phụ thuộc fps của máy —
 * cùng một input phải cho cùng kết quả trên máy 30fps và 144fps.
 */
export class Loop {
  /** 60Hz */
  static readonly STEP = 1 / 60
  /** Tối đa số bước bù mỗi frame; vượt quá thì bỏ backlog để tránh "spiral of death". */
  private static readonly MAX_STEPS = 5
  /** Chặn delta khi tab bị ẩn rồi quay lại (nếu không sẽ nhảy hàng nghìn bước). */
  private static readonly MAX_FRAME = 0.25
  /**
   * Dung sai khi so mốc khung hình, tính theo phần của ngân sách.
   *
   * BẮT BUỘC phải có. `requestAnimationFrame` không bao giờ gọi đúng mốc: trên
   * màn 60Hz mà khoá 60fps, một khung tới ở 16,5ms thay vì 16,67ms sẽ bị bỏ,
   * khung sau dồn thành 33ms — tức là khoá 60 lại cho ra 30fps giật. Nới 20%
   * thì vẫn chặn được khung 8,33ms của màn 120Hz (8,33 < 13,3) mà không bỏ oan
   * khung đúng nhịp.
   */
  private static readonly CAP_TOLERANCE = 0.2

  /**
   * Giới hạn fps. 0 = không khoá (vẽ theo tần số màn hình).
   *
   * Mặc định 60 chứ không phải không khoá. Trên màn ProMotion, không khoá nghĩa
   * là 120fps: gấp đôi công GPU cho một framebuffer 6,5 MPx có MSAA 4× và hai
   * pass hậu xử lý — trên máy laptop thì đó là quạt quay, đổi lấy một khác biệt
   * mà đồ hoạ lowpoly gần như không thể hiện ra được.
   *
   * KHÔNG ảnh hưởng gameplay: mô phỏng vẫn chạy ở bước cố định 60Hz, nên khoá
   * fps chỉ bớt số lần VẼ, không đổi kết quả combat.
   */
  fpsCap = 60

  fps = 0
  /** Số bước fixed đã chạy kể từ khi start — tiện cho debug và hiệu ứng theo nhịp. */
  ticks = 0

  private acc = 0
  private lastMs = 0
  /** Mốc thời gian sớm nhất được vẽ khung tiếp theo, khi đang khoá fps. */
  private nextFrameMs = 0
  private rafId = 0
  private running = false
  private frameCount = 0
  private fpsWindow = 0

  constructor(private readonly cb: LoopCallbacks) {}

  get isRunning(): boolean {
    return this.running
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.lastMs = performance.now()
    this.nextFrameMs = this.lastMs
    this.acc = 0
    this.rafId = requestAnimationFrame(this.tick)
  }

  stop(): void {
    if (!this.running) return
    this.running = false
    cancelAnimationFrame(this.rafId)
  }

  private readonly tick = (nowMs: number): void => {
    if (!this.running) return
    this.rafId = requestAnimationFrame(this.tick)

    if (this.fpsCap > 0) {
      const budgetMs = 1000 / this.fpsCap
      if (nowMs < this.nextFrameMs - budgetMs * Loop.CAP_TOLERANCE) return
      // Neo lại theo hiện tại khi đã trễ, thay vì cộng dồn nợ: nếu không thì sau
      // một lần đứng máy, vòng lặp sẽ vẽ liên tiếp mấy khung để "trả nợ" —
      // đúng lúc máy đang yếu nhất
      this.nextFrameMs = Math.max(nowMs, this.nextFrameMs + budgetMs)
    }

    let frameDt = (nowMs - this.lastMs) / 1000
    this.lastMs = nowMs
    if (frameDt < 0) frameDt = 0
    if (frameDt > Loop.MAX_FRAME) frameDt = Loop.MAX_FRAME

    this.frameCount++
    this.fpsWindow += frameDt
    if (this.fpsWindow >= 0.5) {
      this.fps = this.frameCount / this.fpsWindow
      this.frameCount = 0
      this.fpsWindow = 0
    }

    this.acc += frameDt
    let steps = 0
    while (this.acc >= Loop.STEP && steps < Loop.MAX_STEPS) {
      this.cb.fixed(Loop.STEP)
      this.acc -= Loop.STEP
      this.ticks++
      steps++
    }
    // Máy quá chậm so với 60Hz: bỏ phần nợ thay vì tích luỹ vô hạn
    if (steps === Loop.MAX_STEPS && this.acc > Loop.STEP) this.acc = 0

    this.cb.render(this.acc / Loop.STEP, frameDt)
  }
}
