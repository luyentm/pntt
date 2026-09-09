import type { BreakthroughTrial } from '@/game/BreakthroughTrial'

/**
 * Lớp phủ của màn thử dẫn khí.
 *
 * Con trỏ chạy bằng `transform: translateX` trên MỘT phần tử duy nhất, không
 * ghi lại `left` hay dựng lại DOM: đây là thứ duy nhất trong game cập nhật mỗi
 * frame trên DOM, nên nó phải chỉ chạm vào compositor, không gây reflow.
 *
 * Phần tử được dịch là một lớp bọc RỘNG BẰNG CẢ THANH, kim chỉ nằm bên trong nó.
 * Nhờ vậy `translateX(70%)` nghĩa là 70% chiều dài thanh — nếu dịch thẳng chính
 * cái kim thì phần trăm sẽ tính theo bề rộng của kim và con trỏ gần như không
 * nhích.
 */
export class TrialOverlay {
  private readonly root: HTMLDivElement
  private readonly track: HTMLDivElement
  private readonly cursor: HTMLDivElement
  private readonly backlash: HTMLDivElement
  private readonly progress: HTMLDivElement
  private readonly title: HTMLDivElement
  private zoneEls: HTMLDivElement[] = []
  private trial: BreakthroughTrial | null = null
  private lastHits = -1

  constructor(container: HTMLElement) {
    this.root = document.createElement('div')
    this.root.className = 'trial'
    this.root.innerHTML = `
      <div class="trial-title" data-role="title"></div>
      <div class="trial-track" data-role="track">
        <div class="trial-cursor" data-role="cursor"><i class="trial-needle"></i></div>
      </div>
      <div class="trial-meters">
        <div class="trial-meter trial-meter--progress">
          <div class="trial-meter-fill" data-role="progress"></div>
          <span>Dẫn khí</span>
        </div>
        <div class="trial-meter trial-meter--backlash">
          <div class="trial-meter-fill" data-role="backlash"></div>
          <span>Khí nghịch</span>
        </div>
      </div>
      <div class="trial-hint">Bấm <b>SPACE</b> khi con trỏ đi vào vùng sáng · mỗi nhịp trúng con trỏ nhanh hơn</div>
    `
    container.appendChild(this.root)
    this.track = this.pick('track')
    this.cursor = this.pick('cursor')
    this.backlash = this.pick('backlash')
    this.progress = this.pick('progress')
    this.title = this.pick('title')
  }

  private pick<T extends HTMLElement>(role: string): T {
    const el = this.root.querySelector(`[data-role="${role}"]`)
    if (!el) throw new Error(`TrialOverlay: thiếu data-role="${role}"`)
    return el as T
  }

  get isOpen(): boolean {
    return this.trial !== null
  }

  open(trial: BreakthroughTrial, targetRealm: string): void {
    this.trial = trial
    this.lastHits = -1
    this.title.textContent = `Dẫn khí đột phá — ${targetRealm}`

    for (const el of this.zoneEls) el.remove()
    this.zoneEls = trial.zones.map((z) => {
      const el = document.createElement('div')
      el.className = 'trial-zone'
      el.style.left = `${z.start * 100}%`
      el.style.width = `${(z.end - z.start) * 100}%`
      this.track.appendChild(el)
      return el
    })

    this.root.classList.add('is-open')
    this.update()
  }

  /** Gọi mỗi frame khi đang mở. */
  update(): void {
    const trial = this.trial
    if (!trial) return
    this.cursor.style.transform = `translateX(${(trial.cursor * 100).toFixed(2)}%)`
    this.backlash.style.width = `${(trial.backlash * 100).toFixed(1)}%`

    // Vùng đã dẫn thành công chỉ đổi khi hits đổi — không ghi lại class mỗi frame
    if (trial.hits !== this.lastHits) {
      this.lastHits = trial.hits
      this.progress.style.width = `${(trial.progress * 100).toFixed(1)}%`
      for (let i = 0; i < this.zoneEls.length; i++) {
        const zone = trial.zones[i]
        if (zone) (this.zoneEls[i] as HTMLDivElement).classList.toggle('is-hit', zone.hit)
      }
    }
  }

  close(): void {
    this.trial = null
    this.root.classList.remove('is-open')
  }

  dispose(): void {
    this.root.remove()
  }
}
