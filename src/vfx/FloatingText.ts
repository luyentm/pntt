import { Vector3, type PerspectiveCamera } from 'three'

export type FloatKind = 'damage' | 'crit' | 'playerHurt' | 'heal' | 'info'

interface FloatItem {
  el: HTMLDivElement
  active: boolean
  age: number
  life: number
  x: number
  y: number
  z: number
  driftX: number
}

const CLASS_BY_KIND: Record<FloatKind, string> = {
  damage: 'ft-damage',
  crit: 'ft-crit',
  playerHurt: 'ft-player-hurt',
  heal: 'ft-heal',
  info: 'ft-info',
}

/**
 * Số sát thương bay, dựng bằng DOM chứ không phải mesh chữ trong không gian 3D.
 *
 * Vì sao không dùng thư viện chữ SDF: thư viện đó giải font bằng cách TẢI TỪ CDN
 * lúc chạy, phá vỡ nguyên tắc "không asset ngoài, chạy offline" của cả project,
 * và tiếng Việt có dấu lại là thứ phụ thuộc CDN đó nhiều nhất.
 *
 * DOM cho chữ nét căng ở mọi mức zoom, đủ dấu tiếng Việt miễn phí, và dùng lại
 * đúng lớp overlay UI đã có. Đánh đổi: số không bị vật thể che khuất — nhưng
 * game hành động nào cũng vẽ số sát thương nằm trên hết, nên đó là điều mong muốn.
 */
export class FloatingTextLayer {
  private readonly items: FloatItem[] = []
  private readonly root: HTMLDivElement
  private readonly ndc = new Vector3()

  constructor(container: HTMLElement, capacity = 40) {
    this.root = document.createElement('div')
    this.root.className = 'float-text-layer'
    container.appendChild(this.root)

    for (let i = 0; i < capacity; i++) {
      const el = document.createElement('div')
      el.className = 'float-text'
      el.style.display = 'none'
      this.root.appendChild(el)
      this.items.push({ el, active: false, age: 0, life: 0.9, x: 0, y: 0, z: 0, driftX: 0 })
    }
  }

  spawn(x: number, y: number, z: number, text: string, kind: FloatKind = 'damage'): void {
    const item = this.take()
    item.age = 0
    item.life = kind === 'crit' ? 1.15 : 0.9
    item.x = x
    item.y = y
    item.z = z
    // Lệch ngang nhẹ và xen kẽ hai chiều để nhiều số cùng lúc không xếp đè nhau
    item.driftX = ((this.items.indexOf(item) % 5) - 2) * 9
    item.el.textContent = text
    item.el.className = `float-text ${CLASS_BY_KIND[kind]}`
    item.el.style.display = 'block'
  }

  private take(): FloatItem {
    for (const it of this.items) {
      if (!it.active) {
        it.active = true
        return it
      }
    }
    // Hồ cạn: giành lại cái cũ nhất, vì số mới quan trọng hơn số đang tàn
    let oldest = this.items[0] as FloatItem
    for (const it of this.items) if (it.age > oldest.age) oldest = it
    return oldest
  }

  /** Gọi mỗi frame. `width`/`height` là kích thước CSS của canvas. */
  update(dt: number, camera: PerspectiveCamera, width: number, height: number): void {
    for (const it of this.items) {
      if (!it.active) continue
      it.age += dt
      if (it.age >= it.life) {
        it.active = false
        it.el.style.display = 'none'
        continue
      }

      const progress = it.age / it.life
      // Bay lên rồi chậm dần — đường đi kiểu ném lên, dễ đọc hơn bay thẳng đều
      const rise = 0.95 * (1 - (1 - progress) ** 2)

      this.ndc.set(it.x, it.y + rise, it.z).project(camera)
      // z > 1 nghĩa là ở sau camera
      if (this.ndc.z > 1) {
        it.el.style.display = 'none'
        continue
      }

      const sx = (this.ndc.x * 0.5 + 0.5) * width + it.driftX * progress
      const sy = (-this.ndc.y * 0.5 + 0.5) * height
      const fade = progress < 0.65 ? 1 : 1 - (progress - 0.65) / 0.35
      const pop = progress < 0.12 ? 0.7 + (progress / 0.12) * 0.45 : 1.15 - progress * 0.15

      it.el.style.display = 'block'
      it.el.style.transform = `translate(-50%, -50%) translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) scale(${pop.toFixed(3)})`
      it.el.style.opacity = fade.toFixed(3)
    }
  }

  dispose(): void {
    this.root.remove()
  }
}
