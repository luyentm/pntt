import { SHOWCASE, type ShowcaseStep } from '@/game/data/showcase'

/**
 * Lớp phủ của chế độ trình diễn: tên chiêu đang diễn, chú thích, và danh sách
 * cả kịch bản với bước hiện tại được đánh dấu.
 *
 * Danh sách hiện HẾT chứ không chỉ bước đang diễn: người vào đây để xem Hàn Lập
 * có những gì, nên họ phải thấy được toàn bộ ngay từ đầu và nhảy tới cái mình
 * muốn xem — không phải ngồi đợi showreel đi tới.
 */
export class ShowcasePanel {
  private readonly root: HTMLDivElement
  private readonly title: HTMLDivElement
  private readonly note: HTMLDivElement
  private readonly counter: HTMLSpanElement
  private readonly state: HTMLSpanElement
  private readonly list: HTMLDivElement
  private readonly rows: HTMLButtonElement[] = []
  private active = -1

  /** Người chơi bấm vào một dòng trong danh sách. Màn gán vào. */
  onPick?: (index: number) => void

  constructor(container: HTMLElement) {
    this.root = document.createElement('div')
    this.root.className = 'showcase'
    this.root.innerHTML = `
      <div class="showcase-list" data-role="list"></div>
      <div class="showcase-card">
        <div class="showcase-meta">
          <span data-role="counter"></span>
          <span data-role="state"></span>
        </div>
        <div class="showcase-title" data-role="title"></div>
        <div class="showcase-note" data-role="note"></div>
        <div class="showcase-keys">
          <b>P</b> tự chạy / tự chơi · <b>Q</b> <b>E</b> đổi chiêu ·
          <b>1…7</b> thi triển · <b>Space</b> ngự kiếm · <b>Esc</b> về menu
        </div>
      </div>
    `
    container.appendChild(this.root)
    this.title = this.pick('title')
    this.note = this.pick('note')
    this.counter = this.pick('counter')
    this.state = this.pick('state')
    this.list = this.pick('list')

    SHOWCASE.forEach((step, i) => {
      const row = document.createElement('button')
      row.type = 'button'
      row.className = 'showcase-row'
      row.textContent = step.title
      row.addEventListener('click', () => this.onPick?.(i))
      this.list.appendChild(row)
      this.rows.push(row)
    })
  }

  private pick<T extends HTMLElement>(role: string): T {
    const el = this.root.querySelector(`[data-role="${role}"]`)
    if (!el) throw new Error(`ShowcasePanel: thiếu data-role="${role}"`)
    return el as T
  }

  show(): void {
    this.root.classList.add('is-open')
  }

  hide(): void {
    this.root.classList.remove('is-open')
  }

  get isOpen(): boolean {
    return this.root.classList.contains('is-open')
  }

  setStep(step: ShowcaseStep, index: number, total: number): void {
    this.title.textContent = step.title
    this.note.textContent = step.note
    this.counter.textContent = `${index + 1} / ${total}`
    if (index !== this.active) {
      if (this.active >= 0) this.rows[this.active]?.classList.remove('is-active')
      this.active = index
      this.rows[index]?.classList.add('is-active')
      // Nháy thẻ một nhịp khi đổi bước — mắt đang ở nhân vật, không ở chữ
      this.root.classList.remove('is-changing')
      void this.root.offsetWidth
      this.root.classList.add('is-changing')
    }
  }

  setPlaying(playing: boolean): void {
    this.state.textContent = playing ? '▶ đang tự chạy' : '❙❙ tự chơi'
    this.root.classList.toggle('is-manual', !playing)
  }

  dispose(): void {
    this.root.remove()
  }
}
