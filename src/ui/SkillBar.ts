import type { EventBus } from '@/core/EventBus'
import type { GameEvents } from '@/core/events'
import { realmName, type RealmPosition } from '@/game/data/realms'
import { SKILLS } from '@/game/data/skills'
import type { SkillCaster } from '@/world/SkillCaster'

interface SlotEls {
  root: HTMLDivElement
  cooldown: HTMLDivElement
  label: HTMLSpanElement
}

/**
 * Thanh pháp thuật: 6 ô, hiện hồi chiêu, giá linh lực, và ô nào CHƯA MỞ.
 *
 * Hiện luôn cả ô chưa mở kèm cảnh giới cần thiết, thay vì ẩn đi: người chơi phải
 * thấy trước mình sẽ được gì khi đột phá — đó chính là động lực tu luyện, mà ẩn
 * đi thì phần thưởng thành ra một điều ngạc nhiên mà không ai chờ đợi.
 */
export class SkillBar {
  private readonly root: HTMLDivElement
  private readonly slots: SlotEls[] = []
  private readonly toast: HTMLDivElement
  private toastTimer = 0
  private readonly unsubscribe: Array<() => void> = []

  constructor(container: HTMLElement, bus: EventBus<GameEvents>) {
    this.root = document.createElement('div')
    this.root.className = 'skillbar'
    container.appendChild(this.root)

    SKILLS.forEach((def, i) => {
      const slot = document.createElement('div')
      slot.className = 'skill'
      slot.innerHTML = `
        <div class="skill-cd" data-role="cd"></div>
        <div class="skill-glyph">${def.glyph}</div>
        <div class="skill-key">${i + 1}</div>
        <div class="skill-cost">${def.linhLucCost}</div>
        <span class="skill-tip" data-role="label"></span>
      `
      this.root.appendChild(slot)
      this.slots.push({
        root: slot,
        cooldown: slot.querySelector('[data-role="cd"]') as HTMLDivElement,
        label: slot.querySelector('[data-role="label"]') as HTMLSpanElement,
      })
    })

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

  update(dt: number, caster: SkillCaster, realm: RealmPosition, linhLuc: number): void {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt
      if (this.toastTimer <= 0) this.toast.classList.remove('is-visible')
    }

    SKILLS.forEach((def, i) => {
      const el = this.slots[i]
      if (!el) return

      const unlocked = caster.isUnlocked(i, realm)
      const cdFraction = caster.cooldownFraction(i)
      const affordable = linhLuc >= def.linhLucCost

      el.root.classList.toggle('is-locked', !unlocked)
      el.root.classList.toggle('is-cooling', cdFraction > 0)
      el.root.classList.toggle('is-poor', unlocked && cdFraction === 0 && !affordable)
      el.root.classList.toggle('is-active', caster.activeSlot === i)

      // Lớp phủ hồi chiêu quét từ dưới lên — đọc được tiến độ bằng mắt ngoại vi
      el.cooldown.style.height = `${(cdFraction * 100).toFixed(1)}%`

      el.label.textContent = unlocked
        ? def.name
        : `${def.name} — cần ${realmName(def.requiredRealm)}`
    })
  }

  dispose(): void {
    for (const off of this.unsubscribe) off()
    this.root.remove()
    this.toast.remove()
  }
}
