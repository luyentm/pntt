import type { EventBus } from '@/core/EventBus'
import type { GameEvents } from '@/core/events'
import { realmName, type RealmPosition } from '@/game/data/realms'

/**
 * HUD của người chơi: sinh lực, linh lực, cảnh giới.
 *
 * Toàn bộ là DOM. Vẽ chữ tiếng Việt có dấu trong canvas rất tệ, còn DOM cho
 * layout/font/animation miễn phí và luôn nét ở mọi DPR.
 */
export class Hud {
  private readonly root: HTMLDivElement
  private readonly hpFill: HTMLDivElement
  private readonly hpText: HTMLSpanElement
  private readonly mpFill: HTMLDivElement
  private readonly mpText: HTMLSpanElement
  private readonly realmLabel: HTMLDivElement
  private readonly unsubscribe: Array<() => void> = []

  constructor(container: HTMLElement, bus: EventBus<GameEvents>) {
    this.root = document.createElement('div')
    this.root.className = 'hud'
    this.root.innerHTML = `
      <div class="hud-realm" data-role="realm">Phàm nhân</div>
      <div class="hud-bars">
        <div class="hud-bar hud-bar--hp">
          <div class="hud-bar-fill" data-role="hp"></div>
          <span class="hud-bar-label"><b>Sinh Lực</b> <span data-role="hp-text">0 / 0</span></span>
        </div>
        <div class="hud-bar hud-bar--mp">
          <div class="hud-bar-fill" data-role="mp"></div>
          <span class="hud-bar-label"><b>Linh Lực</b> <span data-role="mp-text">0 / 0</span></span>
        </div>
      </div>
    `
    container.appendChild(this.root)

    this.hpFill = this.pick('hp')
    this.mpFill = this.pick('mp')
    this.realmLabel = this.pick('realm')
    this.hpText = this.pick('hp-text')
    this.mpText = this.pick('mp-text')

    this.unsubscribe.push(
      bus.on('player:vitals', ({ sinhLuc, maxSinhLuc, linhLuc, maxLinhLuc }) => {
        this.setVitals(sinhLuc, maxSinhLuc, linhLuc, maxLinhLuc)
      }),
    )
  }

  private pick<T extends HTMLElement>(role: string): T {
    const el = this.root.querySelector(`[data-role="${role}"]`)
    if (!el) throw new Error(`Hud: thiếu phần tử data-role="${role}"`)
    return el as T
  }

  setVitals(sinhLuc: number, maxSinhLuc: number, linhLuc: number, maxLinhLuc: number): void {
    const hp = Math.max(0, Math.min(1, sinhLuc / Math.max(1, maxSinhLuc)))
    const mp = Math.max(0, Math.min(1, linhLuc / Math.max(1, maxLinhLuc)))
    this.hpFill.style.width = `${(hp * 100).toFixed(1)}%`
    this.mpFill.style.width = `${(mp * 100).toFixed(1)}%`
    this.hpText.textContent = `${Math.ceil(sinhLuc)} / ${maxSinhLuc}`
    this.mpText.textContent = `${Math.ceil(linhLuc)} / ${maxLinhLuc}`
    // Máu thấp thì thanh nhấp nháy — cảnh báo bằng chuyển động, người chơi
    // đang tập trung đánh nhau sẽ không kịp đọc số
    this.hpFill.classList.toggle('is-critical', hp < 0.28)
  }

  setRealm(realm: RealmPosition): void {
    this.realmLabel.textContent = realmName(realm)
  }

  dispose(): void {
    for (const off of this.unsubscribe) off()
    this.root.remove()
  }
}
