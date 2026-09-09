import { Vector3, type PerspectiveCamera } from 'three'
import type { Combatant } from '@/world/Combatant'

interface BarSlot {
  el: HTMLDivElement
  fill: HTMLDivElement
  owner: Combatant | null
}

/** Thanh máu tự ẩn sau bấy nhiêu giây không bị đánh. */
const IDLE_HIDE = 4
/** Ngoài khoảng này thì không hiện, cho đỡ rối mắt. */
const MAX_DISTANCE = 30

/**
 * Thanh máu nổi trên đầu quái, dựng bằng DOM.
 *
 * Chọn DOM chứ không phải quad billboard trong scene vì hai lý do: không tốn
 * draw call nào (CSS transform do compositor lo), và không phải xử lý việc quad
 * luôn phải quay mặt về camera.
 *
 * Chỉ hiện thanh của con ĐÃ BỊ ĐÁNH và còn gần. Hiện hết mọi con biến màn hình
 * thành một rừng thanh màu và làm mất luôn thông tin quan trọng nhất — con nào
 * đang sắp chết.
 */
export class WorldBars {
  private readonly root: HTMLDivElement
  private readonly slots: BarSlot[] = []
  private readonly ndc = new Vector3()
  /** Thời điểm (theo đồng hồ tích luỹ) mỗi combatant bị đánh lần cuối. */
  private readonly lastHit = new WeakMap<Combatant, number>()
  private clock = 0

  constructor(container: HTMLElement, capacity = 28) {
    this.root = document.createElement('div')
    this.root.className = 'world-bars'
    container.appendChild(this.root)

    for (let i = 0; i < capacity; i++) {
      const el = document.createElement('div')
      el.className = 'wbar'
      el.style.display = 'none'
      const fill = document.createElement('div')
      fill.className = 'wbar-fill'
      el.appendChild(fill)
      this.root.appendChild(el)
      this.slots.push({ el, fill, owner: null })
    }
  }

  /** Gọi khi một combatant trúng đòn, để thanh máu của nó hiện lên. */
  notifyHit(target: Combatant): void {
    this.lastHit.set(target, this.clock)
  }

  update(
    dt: number,
    combatants: readonly Combatant[],
    camera: PerspectiveCamera,
    width: number,
    height: number,
  ): void {
    this.clock += dt

    let slot = 0
    for (const c of combatants) {
      if (slot >= this.slots.length) break
      if (c.dead || c.side === 'player') continue

      const hitAt = this.lastHit.get(c)
      if (hitAt === undefined) continue
      if (this.clock - hitAt > IDLE_HIDE) continue

      const dx = c.pos.x - camera.position.x
      const dy = c.y - camera.position.y
      const dz = c.pos.z - camera.position.z
      if (dx * dx + dy * dy + dz * dz > MAX_DISTANCE * MAX_DISTANCE) continue

      // Đặt ngay trên đỉnh đầu
      this.ndc.set(c.pos.x, c.y + c.view.height * 1.28, c.pos.z).project(camera)
      if (this.ndc.z > 1) continue

      const s = this.slots[slot++] as BarSlot
      s.owner = c
      const sx = (this.ndc.x * 0.5 + 0.5) * width
      const sy = (-this.ndc.y * 0.5 + 0.5) * height

      s.el.style.display = 'block'
      s.el.style.transform = `translate(-50%, -50%) translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`
      s.fill.style.width = `${(c.hpFraction * 100).toFixed(1)}%`
      // Đổi màu theo mức máu: người chơi đọc được "con nào sắp chết" bằng màu
      // nhanh hơn bằng độ dài thanh
      s.fill.style.background =
        c.hpFraction > 0.5 ? 'var(--luc)' : c.hpFraction > 0.22 ? 'var(--kim)' : 'var(--huyet)'
    }

    for (let i = slot; i < this.slots.length; i++) {
      const s = this.slots[i] as BarSlot
      if (s.owner || s.el.style.display !== 'none') {
        s.el.style.display = 'none'
        s.owner = null
      }
    }
  }

  dispose(): void {
    this.root.remove()
  }
}
