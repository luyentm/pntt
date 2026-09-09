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

  fps = 0
  /** Số bước fixed đã chạy kể từ khi start — tiện cho debug và hiệu ứng theo nhịp. */
  ticks = 0

  private acc = 0
  private lastMs = 0
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
