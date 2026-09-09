import type { BossDef } from '@/game/data/units'

/**
 * Thanh máu tướng ở đỉnh màn hình, có vạch chia phase.
 *
 * Vạch chia đặt đúng mốc `atHp` của từng phase, nên người chơi THẤY TRƯỚC được
 * lúc nào boss sẽ đổi bài. Ẩn mốc đi thì mỗi lần boss vào phase mới sẽ chỉ là
 * một điều bất ngờ khó chịu, còn hiện ra thì nó thành một cái hẹn — và người
 * chơi biết dồn sát thương hay giữ chiêu.
 */
export class BossBar {
  private readonly root: HTMLDivElement
  private readonly fill: HTMLDivElement
  private readonly title: HTMLSpanElement
  private readonly phaseLabel: HTMLSpanElement
  private readonly hpText: HTMLSpanElement
  private readonly ticks: HTMLDivElement
  private lastHp = -1
  private lastPhase = -1

  constructor(container: HTMLElement) {
    this.root = document.createElement('div')
    this.root.className = 'bossbar'
    this.root.innerHTML = `
      <div class="bossbar-head">
        <span class="bossbar-title" data-role="title"></span>
        <span class="bossbar-phase" data-role="phase"></span>
      </div>
      <div class="bossbar-track">
        <div class="bossbar-fill" data-role="fill"></div>
        <div class="bossbar-ticks" data-role="ticks"></div>
        <span class="bossbar-hp" data-role="hp"></span>
      </div>
    `
    container.appendChild(this.root)
    this.fill = this.pick('fill')
    this.title = this.pick('title')
    this.phaseLabel = this.pick('phase')
    this.hpText = this.pick('hp')
    this.ticks = this.pick('ticks')
  }

  private pick<T extends HTMLElement>(role: string): T {
    const el = this.root.querySelector(`[data-role="${role}"]`)
    if (!el) throw new Error(`BossBar: thiếu data-role="${role}"`)
    return el as T
  }

  get isVisible(): boolean {
    return this.root.classList.contains('is-open')
  }

  show(boss: BossDef): void {
    this.title.textContent = boss.title
    this.lastHp = -1
    this.lastPhase = -1
    // Vạch chia dựng MỘT LẦN lúc hiện, không mỗi frame
    this.ticks.innerHTML = boss.phases
      .filter((p) => p.atHp < 1)
      .map((p) => `<i style="left:${(p.atHp * 100).toFixed(1)}%"></i>`)
      .join('')
    this.root.classList.add('is-open')
  }

  hide(): void {
    this.root.classList.remove('is-open')
  }

  /** Gọi mỗi frame khi đang hiện. Tự bỏ qua nếu số không đổi. */
  update(hp: number, maxHp: number, phaseIndex: number, phaseName: string): void {
    const rounded = Math.ceil(hp)
    if (rounded !== this.lastHp) {
      this.lastHp = rounded
      const frac = Math.max(0, Math.min(1, hp / Math.max(1, maxHp)))
      this.fill.style.width = `${(frac * 100).toFixed(2)}%`
      this.hpText.textContent = `${rounded} / ${Math.ceil(maxHp)}`
    }
    if (phaseIndex !== this.lastPhase) {
      this.lastPhase = phaseIndex
      this.phaseLabel.textContent = phaseName
      // Nháy một nhịp khi đổi phase: người chơi đang nhìn boss, không nhìn chữ
      this.root.classList.remove('is-phasing')
      void this.root.offsetWidth
      this.root.classList.add('is-phasing')
    }
  }

  dispose(): void {
    this.root.remove()
  }
}
