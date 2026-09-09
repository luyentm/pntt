import type { EventBus } from '@/core/EventBus'
import type { GameEvents } from '@/core/events'
import type { Cultivation } from '@/game/Cultivation'
import { realmName, type RealmPosition } from '@/game/data/realms'

/**
 * HUD của người chơi: sinh lực, linh lực, cảnh giới, Tu Vi, Tiểu Bình.
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
  private readonly tuViFill: HTMLDivElement
  private readonly tuViText: HTMLSpanElement
  private readonly binhFill: HTMLDivElement
  private readonly binhText: HTMLSpanElement
  private readonly realmLabel: HTMLSpanElement
  private readonly unsubscribe: Array<() => void> = []

  /** Nhớ lần vẽ trước để không ghi DOM 60 lần/giây khi số không đổi. */
  private lastTuVi = ''
  private lastBinh = -1
  private lastRealm = ''

  constructor(container: HTMLElement, bus: EventBus<GameEvents>) {
    this.root = document.createElement('div')
    this.root.className = 'hud'
    this.root.innerHTML = `
      <div class="hud-realm"><span data-role="realm">Phàm nhân</span></div>
      <div class="hud-bars">
        <div class="hud-bar hud-bar--hp">
          <div class="hud-bar-fill" data-role="hp"></div>
          <span class="hud-bar-label"><b>Sinh Lực</b> <span data-role="hp-text">0 / 0</span></span>
        </div>
        <div class="hud-bar hud-bar--mp">
          <div class="hud-bar-fill" data-role="mp"></div>
          <span class="hud-bar-label"><b>Linh Lực</b> <span data-role="mp-text">0 / 0</span></span>
        </div>
        <div class="hud-bar hud-bar--tuvi">
          <div class="hud-bar-fill" data-role="tuvi"></div>
          <span class="hud-bar-label"><b>Tu Vi</b> <span data-role="tuvi-text">0 / 0</span></span>
        </div>
        <div class="hud-bar hud-bar--binh">
          <div class="hud-bar-fill" data-role="binh"></div>
          <span class="hud-bar-label"><b>Tiểu Bình</b> <span data-role="binh-text">0%</span></span>
        </div>
      </div>
    `
    container.appendChild(this.root)

    this.hpFill = this.pick('hp')
    this.mpFill = this.pick('mp')
    this.tuViFill = this.pick('tuvi')
    this.binhFill = this.pick('binh')
    this.realmLabel = this.pick('realm')
    this.hpText = this.pick('hp-text')
    this.mpText = this.pick('mp-text')
    this.tuViText = this.pick('tuvi-text')
    this.binhText = this.pick('binh-text')

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

  /**
   * Cập nhật phần tu luyện. Gọi được mỗi frame: tự bỏ qua khi số không đổi, nên
   * không có chuyện ghi lại layout 60 lần mỗi giây trong lúc chỉ đứng nhìn.
   */
  setCultivation(c: Cultivation): void {
    const name = c.name
    if (name !== this.lastRealm) {
      this.lastRealm = name
      this.realmLabel.textContent = name
    }

    const needed = c.tuViNeeded
    const text = c.atCap ? 'đỉnh — chờ đột phá' : `${Math.floor(c.tuVi)} / ${Math.ceil(needed)}`
    if (text !== this.lastTuVi) {
      this.lastTuVi = text
      this.tuViText.textContent = text
      this.tuViFill.style.width = `${(c.tierProgress * 100).toFixed(1)}%`
      // Ở đỉnh thì thanh Tu Vi tự phát sáng: đó là lời nhắc duy nhất rằng người
      // chơi đang có thể đột phá, mà không cần thêm một dòng chữ nhắc nào
      this.tuViFill.classList.toggle('is-full', c.atCap)
    }

    const binh = Math.round(c.linhNhuFraction * 100)
    if (binh !== this.lastBinh) {
      this.lastBinh = binh
      this.binhFill.style.width = `${binh}%`
      this.binhText.textContent = `${binh}%`
      this.binhFill.classList.toggle('is-full', binh >= 100)
    }
  }

  setRealm(realm: RealmPosition): void {
    this.lastRealm = realmName(realm)
    this.realmLabel.textContent = this.lastRealm
  }

  dispose(): void {
    for (const off of this.unsubscribe) off()
    this.root.remove()
  }
}
