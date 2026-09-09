import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Loop } from '../Loop'

/**
 * Bộ điều khiển rAF giả: mình tự quyết định khung hình tới lúc nào.
 * Cần vì toàn bộ điều muốn kiểm ở đây là "khung nào được vẽ, khung nào bị bỏ",
 * mà điều đó chỉ quan sát được khi kiểm soát được mốc thời gian.
 */
class FakeRaf {
  private cb: ((t: number) => void) | null = null
  now = 0

  install(): void {
    vi.stubGlobal('requestAnimationFrame', (fn: (t: number) => void) => {
      this.cb = fn
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', () => {
      this.cb = null
    })
    vi.stubGlobal('performance', { now: () => this.now })
  }

  /** Chạy `frames` khung, mỗi khung cách nhau `intervalMs`. */
  run(frames: number, intervalMs: number): void {
    for (let i = 0; i < frames; i++) {
      this.now += intervalMs
      const cb = this.cb
      if (!cb) return
      this.cb = null
      cb(this.now)
    }
  }
}

/** Màn 120Hz: 8,333ms một khung. Màn 60Hz: 16,667ms. */
const HZ120 = 1000 / 120
const HZ60 = 1000 / 60

function makeLoop(): { loop: Loop; raf: FakeRaf; counts: { fixed: number; render: number } } {
  const raf = new FakeRaf()
  raf.install()
  const counts = { fixed: 0, render: 0 }
  const loop = new Loop({
    fixed: () => counts.fixed++,
    render: () => counts.render++,
  })
  return { loop, raf, counts }
}

describe('Loop — giới hạn fps', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('mặc định khoá 60fps', () => {
    const { loop } = makeLoop()
    expect(loop.fpsCap).toBe(60)
  })

  it('trên màn 120Hz, khoá 60 thì chỉ vẽ một nửa số khung', () => {
    const { loop, raf, counts } = makeLoop()
    loop.fpsCap = 60
    loop.start()
    raf.run(240, HZ120) // 2 giây của màn 120Hz
    loop.stop()

    // Bỏ đúng một khung xen một khung -> khoảng 120 lần vẽ trong 2 giây
    expect(counts.render).toBeGreaterThanOrEqual(115)
    expect(counts.render).toBeLessThanOrEqual(125)
  })

  it('không khoá thì vẽ đủ mọi khung của màn hình', () => {
    const { loop, raf, counts } = makeLoop()
    loop.fpsCap = 0
    loop.start()
    raf.run(240, HZ120)
    loop.stop()
    expect(counts.render).toBe(240)
  })

  it('khoá fps KHÔNG đổi số bước mô phỏng — combat vẫn 60Hz', () => {
    // Đây là điều quan trọng nhất: nếu khoá fps làm đổi số bước fixed thì nó
    // đã đổi luôn kết quả combat, và tính xác định của cả game mất nghĩa
    const capped = makeLoop()
    capped.loop.fpsCap = 60
    capped.loop.start()
    capped.raf.run(240, HZ120)
    capped.loop.stop()
    vi.unstubAllGlobals()

    const uncapped = makeLoop()
    uncapped.loop.fpsCap = 0
    uncapped.loop.start()
    uncapped.raf.run(240, HZ120)
    uncapped.loop.stop()

    expect(capped.counts.fixed).toBe(uncapped.counts.fixed)
    // 2 giây ở 60Hz = 120 bước (±1 vì 240 × 8,3333ms còn thiếu 0,01ms của giây
    // thứ hai — sai số dấu phẩy động của accumulator, không phải lỗi logic)
    expect(capped.counts.fixed).toBeGreaterThanOrEqual(119)
    expect(capped.counts.fixed).toBeLessThanOrEqual(120)
  })

  it('trên màn 60Hz, khoá 60 KHÔNG được tụt xuống 30fps', () => {
    // Chính là lý do phải có dung sai: khung tới ở 16,5ms thay vì 16,67ms mà bị
    // bỏ thì khoá 60 lại cho ra 30fps giật
    const { loop, raf, counts } = makeLoop()
    loop.fpsCap = 60
    loop.start()
    raf.run(120, HZ60 - 0.2) // 60Hz có nhiễu, mỗi khung sớm 0,2ms
    loop.stop()
    expect(counts.render).toBeGreaterThanOrEqual(115)
  })

  it('sau một lần đứng máy thì không vẽ dồn để trả nợ', () => {
    const { loop, raf, counts } = makeLoop()
    loop.fpsCap = 60
    loop.start()
    raf.run(4, HZ120)
    const before = counts.render

    // Đứng máy 1 giây rồi trở lại nhịp 120Hz
    raf.run(1, 1000)
    raf.run(12, HZ120)
    loop.stop()

    // 1 khung của cú đứng máy + khoảng 6 khung của 12 khung sau đó.
    // Nếu cộng dồn nợ thì con số này sẽ nhảy vọt vì vòng lặp vẽ liên tiếp.
    expect(counts.render - before).toBeLessThanOrEqual(8)
  })
})
