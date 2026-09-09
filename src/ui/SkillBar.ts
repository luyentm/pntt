import type { EventBus } from '@/core/EventBus'
import type { GameEvents } from '@/core/events'
import { nextForSlot, slotKeyLabel, SLOT_COUNT } from '@/game/Loadout'
import { realmName, type RealmPosition } from '@/game/data/realms'
import type { SkillDef } from '@/game/data/skills'
import type { SkillCaster } from '@/world/SkillCaster'

interface SlotEls {
  root: HTMLDivElement
  cooldown: HTMLDivElement
  glyph: HTMLDivElement
  cost: HTMLDivElement
  label: HTMLSpanElement
}

/**
 * Thanh pháp thuật: một ô mỗi phím, hiện hồi chiêu, giá linh lực, và ô nào CHƯA MỞ.
 *
 * Mười ô CỐ ĐỊNH, không phải một ô cho mỗi chiêu trong bảng: bảng có 17 chiêu
 * còn hàng phím chỉ có mười. Ô nào giữ chiêu nào là việc của `Loadout`, và ô
 * trống thì hiện chiêu SẼ tới cùng cảnh giới cần thiết — người chơi phải thấy
 * trước mình được gì khi đột phá, vì đó chính là động lực tu luyện; ẩn đi thì
 * phần thưởng thành một điều ngạc nhiên mà không ai chờ đợi.
 *
 * Nội dung ô (chữ, giá, tên) được ghi lại mỗi lần ĐỔI, không phải mỗi khung:
 * cùng một ô đổi chiêu khi đột phá, nên nó không dựng một lần lúc khởi tạo được
 * nữa — mà ghi DOM 60 lần mỗi giây cho mười ô thì phí không có lý do.
 */
export class SkillBar {
  private readonly root: HTMLDivElement
  private readonly slots: SlotEls[] = []
  private readonly shown: Array<string | null> = new Array(SLOT_COUNT).fill(null)
  private readonly toast: HTMLDivElement
  private toastTimer = 0
  private readonly unsubscribe: Array<() => void> = []

  constructor(container: HTMLElement, bus: EventBus<GameEvents>) {
    this.root = document.createElement('div')
    this.root.className = 'skillbar'
    container.appendChild(this.root)

    for (let i = 0; i < SLOT_COUNT; i++) {
      const slot = document.createElement('div')
      slot.className = 'skill'
      slot.innerHTML = `
        <div class="skill-cd" data-role="cd"></div>
        <div class="skill-glyph" data-role="glyph"></div>
        <div class="skill-key">${slotKeyLabel(i)}</div>
        <div class="skill-cost" data-role="cost"></div>
        <span class="skill-tip" data-role="label"></span>
      `
      this.root.appendChild(slot)
      this.slots.push({
        root: slot,
        cooldown: slot.querySelector('[data-role="cd"]') as HTMLDivElement,
        glyph: slot.querySelector('[data-role="glyph"]') as HTMLDivElement,
        cost: slot.querySelector('[data-role="cost"]') as HTMLDivElement,
        label: slot.querySelector('[data-role="label"]') as HTMLSpanElement,
      })
    }

    this.toast = document.createElement('div')
    this.toast.className = 'skill-toast'
    container.appendChild(this.toast)

    this.unsubscribe.push(
      bus.on('skill:failed', ({ reason }) => this.showToast(reason)),
      bus.on('toast', ({ text }) => this.showToast(text)),
    )
  }

  private showToast(text: string): void {
    this.toast.textContent = text
    this.toast.classList.add('is-visible')
    this.toastTimer = 1.8
  }

  update(
    dt: number,
    caster: SkillCaster,
    realm: RealmPosition,
    linhLuc: number,
    loadout: ReadonlyArray<SkillDef | null>,
  ): void {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt
      if (this.toastTimer <= 0) this.toast.classList.remove('is-visible')
    }

    for (let i = 0; i < SLOT_COUNT; i++) {
      const el = this.slots[i]
      if (!el) continue
      const def = loadout[i] ?? null
      // Ô chưa mở: hiện chiêu sắp tới ở dạng mờ, kèm cảnh giới phải đạt
      const preview = def ? null : nextForSlot(i, realm)
      const show = def ?? preview

      // Chỉ ghi DOM khi chiêu trong ô thật sự đổi
      const key = show ? show.id : ''
      if (this.shown[i] !== key) {
        this.shown[i] = key
        el.glyph.textContent = show?.glyph ?? ''
        el.cost.textContent = show ? String(show.linhLucCost) : ''
        el.label.textContent = !show
          ? ''
          : def
            ? def.name
            : `${show.name} — cần ${realmName(show.requiredRealm)}`
      }

      const cdFraction = def ? caster.cooldownFraction(def.id) : 0
      const affordable = def ? linhLuc >= def.linhLucCost : false

      el.root.classList.toggle('is-empty', !show)
      el.root.classList.toggle('is-locked', !def)
      el.root.classList.toggle('is-cooling', cdFraction > 0)
      el.root.classList.toggle('is-poor', !!def && cdFraction === 0 && !affordable)
      el.root.classList.toggle('is-active', !!def && caster.activeId === def.id)

      // Lớp phủ hồi chiêu quét từ dưới lên — đọc được tiến độ bằng mắt ngoại vi
      el.cooldown.style.height = `${(cdFraction * 100).toFixed(1)}%`
    }
  }

  dispose(): void {
    for (const off of this.unsubscribe) off()
    this.root.remove()
    this.toast.remove()
  }
}
