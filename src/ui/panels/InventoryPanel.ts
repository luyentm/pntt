import { itemDef, TIER_COLORS, type ItemKind } from '@/game/data/items'
import type { Inventory } from '@/game/Inventory'
import { Panel } from './Panel'

export interface InventoryHost {
  readonly inventory: Inventory
  /** Dùng một vật phẩm. Trả về mô tả kết quả, null nếu không dùng được. */
  useItem(id: string): string | null
}

const GROUPS: ReadonlyArray<[ItemKind, string]> = [
  ['danDuoc', 'Đan dược'],
  ['linhThao', 'Linh thảo'],
  ['vatLieu', 'Vật liệu'],
  ['linhThach', 'Linh thạch'],
]

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

/**
 * Bảng Túi Đồ.
 *
 * Nhóm theo LOẠI chứ không phải một lưới ô phẳng: người chơi tới đây để tìm
 * "viên đan hồi máu" hay "cái gì luyện được Trúc Cơ Đan", chứ không để đếm ô.
 * Bậc phẩm đọc bằng màu viền nên nhận ra đồ tốt không cần đọc chữ.
 */
export class InventoryPanel extends Panel {
  private readonly host: InventoryHost

  constructor(container: HTMLElement, host: InventoryHost) {
    super(container, 'Túi Đồ', 'I — đóng', 'panel--inventory')
    this.host = host
  }

  refresh(): void {
    const { inventory } = this.host
    this.body.innerHTML = ''

    if (inventory.size === 0) {
      const empty = document.createElement('div')
      empty.className = 'cul-note'
      empty.textContent = 'Túi trống. Hạ yêu thú và hắc lang để lấy linh thảo, yêu đan, linh thạch.'
      this.body.appendChild(empty)
      return
    }

    for (const [kind, label] of GROUPS) {
      const stacks = inventory.byKind(kind)
      if (stacks.length === 0) continue

      const head = document.createElement('div')
      head.className = 'inv-group'
      head.textContent = label
      this.body.appendChild(head)

      for (const stack of stacks) {
        const def = itemDef(stack.id)
        const row = document.createElement('div')
        row.className = 'inv-row'
        row.style.setProperty('--tier', hex(TIER_COLORS[def.tier] ?? TIER_COLORS[1] ?? 0xffffff))
        row.innerHTML = `
          <i class="inv-gem" style="background:${hex(def.color)}"></i>
          <div class="inv-text">
            <div class="inv-name">${def.name} <span class="inv-count">×${stack.count}</span></div>
            <div class="inv-desc">${def.desc}</div>
          </div>
          <div class="inv-act" data-role="act"></div>
        `
        const act = row.querySelector('[data-role="act"]') as HTMLDivElement
        if (def.use.type !== 'khongDung' && def.use.type !== 'dotPha') {
          act.appendChild(
            this.button('Dùng', () => {
              this.host.useItem(stack.id)
              this.refresh()
            }),
          )
        } else if (def.use.type === 'dotPha') {
          // Đan đột phá KHÔNG có nút dùng: nó bị tiêu trong lúc đột phá ở bảng
          // Tu Luyện. Cho nút "Dùng" ở đây thì người chơi sẽ bấm và tưởng mình
          // vừa làm mất viên đan quý nhất trò chơi.
          const note = document.createElement('span')
          note.className = 'inv-hint'
          note.textContent = 'dùng khi đột phá'
          act.appendChild(note)
        }
        this.body.appendChild(row)
      }
    }
  }
}
