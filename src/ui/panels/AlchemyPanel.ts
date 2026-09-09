import { canCraft, craftChance } from '@/game/Alchemy'
import { itemDef } from '@/game/data/items'
import { realmName, realmOrdinal, type RealmPosition } from '@/game/data/realms'
import { RECIPES } from '@/game/data/recipes'
import type { Inventory } from '@/game/Inventory'
import { Panel } from './Panel'

export interface AlchemyHost {
  readonly inventory: Inventory
  readonly realm: RealmPosition
  readonly thanThuc: number
  readonly linhLuc: number
  /** Luyện một lô. Chủ nhà lo trừ linh lực, quay Rng và báo kết quả. */
  craftRecipe(id: string): void
}

/**
 * Bảng Luyện Đan.
 *
 * Hiện cả công thức CHƯA mở, có ghi rõ cần cảnh giới nào: Trúc Cơ Đan và Ngưng
 * Đan là mục tiêu dài hạn của cả bản demo, nên người chơi phải thấy chúng và
 * thấy mình còn thiếu gì ngay từ Luyện Khí tầng 1.
 */
export class AlchemyPanel extends Panel {
  private readonly host: AlchemyHost

  constructor(container: HTMLElement, host: AlchemyHost) {
    super(container, 'Luyện Đan', 'K — đóng', 'panel--alchemy')
    this.host = host
  }

  refresh(): void {
    const { inventory, realm, thanThuc, linhLuc } = this.host
    this.body.innerHTML = ''

    const head = document.createElement('div')
    head.className = 'cul-note'
    head.textContent = `Thần Thức ${Math.round(thanThuc)} — tỉ lệ luyện thành công lên theo Thần Thức.`
    this.body.appendChild(head)

    for (const recipe of RECIPES) {
      const out = itemDef(recipe.output)
      const locked = realmOrdinal(realm) < realmOrdinal(recipe.requiredRealm)
      const check = locked
        ? null
        : canCraft(recipe, inventory, realm, thanThuc, linhLuc)
      const chance = craftChance(recipe, thanThuc)

      const card = document.createElement('div')
      card.className = `alc-card${locked ? ' is-locked' : ''}`
      card.innerHTML = `
        <div class="alc-head">
          <span class="alc-name">${out.name}${recipe.outputCount > 1 ? ` ×${recipe.outputCount}` : ''}</span>
          <span class="alc-chance">${locked ? realmName(recipe.requiredRealm) : `${Math.round(chance * 100)}%`}</span>
        </div>
        <div class="alc-needs">
          ${recipe.needs
            .map((need) => {
              const have = inventory.count(need.id)
              const ok = have >= need.count
              return `<span class="alc-need ${ok ? 'is-ok' : 'is-bad'}">${
                itemDef(need.id).name
              } ${have}/${need.count}</span>`
            })
            .join('')}
          <span class="alc-need ${linhLuc >= recipe.linhLucCost ? 'is-ok' : 'is-bad'}">Linh Lực ${
            recipe.linhLucCost
          }</span>
        </div>
        <div data-role="act"></div>
      `
      const act = card.querySelector('[data-role="act"]') as HTMLDivElement
      if (!locked) {
        const btn = this.button(
          check?.ok ? 'Luyện' : craftBlockText(check?.block ?? null),
          () => {
            this.host.craftRecipe(recipe.id)
            this.refresh()
          },
        )
        btn.disabled = !check?.ok
        act.appendChild(btn)
      }
      this.body.appendChild(card)
    }
  }
}

function craftBlockText(block: string | null): string {
  switch (block) {
    case 'thieuNguyenLieu':
      return 'Thiếu nguyên liệu'
    case 'thieuLinhLuc':
      return 'Thiếu linh lực'
    case 'chuaDuCanhGioi':
      return 'Chưa đủ cảnh giới'
    default:
      return 'Không luyện được'
  }
}
