import type { WaveDirector } from '@/game/WaveDirector'

/**
 * Lớp phủ của chế độ thủ trận: tên đợt, câu báo trước, nhắc bấm khởi trận,
 * và màn thắng / thua.
 *
 * Một lớp duy nhất cho cả bốn thứ vì chúng không bao giờ xuất hiện cùng lúc —
 * tách thành bốn component sẽ phải viết thêm luật "cái nào che cái nào".
 */
export class WaveBanner {
  private readonly root: HTMLDivElement
  private readonly title: HTMLDivElement
  private readonly sub: HTMLDivElement
  private readonly hint: HTMLDivElement
  private readonly counter: HTMLDivElement
  private bannerTimer = 0
  private lastState = ''

  constructor(container: HTMLElement) {
    this.root = document.createElement('div')
    this.root.className = 'wavebanner'
    this.root.innerHTML = `
      <div class="wave-counter" data-role="counter"></div>
      <div class="wave-card">
        <div class="wave-title" data-role="title"></div>
        <div class="wave-sub" data-role="sub"></div>
        <div class="wave-hint" data-role="hint"></div>
      </div>
    `
    container.appendChild(this.root)
    this.title = this.pick('title')
    this.sub = this.pick('sub')
    this.hint = this.pick('hint')
    this.counter = this.pick('counter')
  }

  private pick<T extends HTMLElement>(role: string): T {
    const el = this.root.querySelector(`[data-role="${role}"]`)
    if (!el) throw new Error(`WaveBanner: thiếu data-role="${role}"`)
    return el as T
  }

  /** Hiện một câu báo trong `seconds` giây rồi tự tắt. */
  flash(text: string, sub: string, seconds = 2.6, kind: 'wave' | 'good' | 'bad' = 'wave'): void {
    this.title.textContent = text
    this.sub.textContent = sub
    this.hint.textContent = ''
    this.root.dataset.kind = kind
    this.root.classList.add('is-open')
    this.root.classList.remove('is-final')
    this.bannerTimer = seconds
  }

  /** Thẻ đứng mãi (thắng / thua / chờ khởi trận) — không tự tắt. */
  hold(text: string, sub: string, hint: string, kind: 'wave' | 'good' | 'bad' = 'wave'): void {
    this.title.textContent = text
    this.sub.textContent = sub
    this.hint.textContent = hint
    this.root.dataset.kind = kind
    this.root.classList.add('is-open', 'is-final')
    this.bannerTimer = 0
  }

  hide(): void {
    this.root.classList.remove('is-open', 'is-final')
    this.bannerTimer = 0
    // Xoá luôn số đếm đợt: nó nằm ngoài thẻ nên `is-open` không che được nó, và
    // "ĐỢT 1 / 6" treo ở góc phải trong chế độ trình diễn là nói sai
    this.counter.textContent = ''
    this.lastState = ''
  }

  /**
   * Nhịp frame. Đọc trạng thái bộ điều phối và tự chọn thẻ nào phải hiện.
   *
   * Đặt việc chọn thẻ Ở ĐÂY chứ không rải trong các callback của bộ điều phối:
   * nếu rải thì mỗi lần thêm một trạng thái phải nhớ sửa đúng chỗ, còn ở đây thì
   * một trạng thái thiếu thẻ sẽ hiện ra ngay lần chơi đầu.
   */
  update(frameDt: number, director: WaveDirector, aliveEnemies: number): void {
    this.counter.textContent =
      director.state === 'victory'
        ? `Thủ trận: ${director.cleared} / ${director.total} đợt`
        : `Đợt ${Math.min(director.index + 1, director.total)} / ${director.total}` +
          (director.state === 'fighting' ? ` · còn ${aliveEnemies}` : '')

    if (director.state !== this.lastState) {
      this.lastState = director.state
      this.onStateChange(director)
    }

    if (this.bannerTimer > 0) {
      this.bannerTimer -= frameDt
      if (this.bannerTimer <= 0) this.hide()
    }
  }

  private onStateChange(director: WaveDirector): void {
    switch (director.state) {
      case 'idle':
        this.hold(
          'Thất Huyền Môn thủ trận',
          `${director.total} đợt, đợt cuối là Mặc Đại Phu`,
          'Bấm ENTER để khởi trận',
        )
        return
      case 'cleared':
        this.hold(
          `Đã dẹp ${director.cleared} / ${director.total} đợt`,
          'Toạ thiền, luyện đan, đột phá — rồi mới khởi trận tiếp',
          'Bấm ENTER để mở đợt sau',
          'good',
        )
        return
      case 'victory':
        this.hold(
          'Thủ trận thành công',
          director.deaths === 0
            ? 'Giữ được sơn môn mà không một lần trọng thương'
            : `Giữ được sơn môn sau ${director.deaths} lần trọng thương`,
          'Sơn môn Thất Huyền Môn còn nguyên',
          'good',
        )
        return
      case 'failed':
        this.hold('Trọng thương', 'Đợt này phải làm lại từ đầu', '', 'bad')
        return
      default:
        // 'announcing' và 'fighting' dùng flash() do màn gọi, không giữ thẻ
        this.hide()
    }
  }

  dispose(): void {
    this.root.remove()
  }
}
