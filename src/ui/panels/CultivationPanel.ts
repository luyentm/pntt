import type { Cultivation } from '@/game/Cultivation'
import { itemDef } from '@/game/data/items'
import { MAJOR_REALMS, PLAYABLE_MAJOR_CAP, majorRealm, realmPower, tierCount } from '@/game/data/realms'
import type { Inventory } from '@/game/Inventory'
import type { CombatStats } from '@/game/Stats'
import { Panel } from './Panel'

/** Những gì bảng cần từ game. Giữ hẹp để bảng không phụ thuộc vào cả Player. */
export interface CultivationHost {
  readonly cultivation: Cultivation
  readonly inventory: Inventory
  readonly stats: CombatStats
  /** Bắt đầu màn thử dẫn khí. Bảng không tự đột phá — nó chỉ xin. */
  requestBreakthrough(): void
  /** Uống hết Tiểu Bình. Trả về Tu Vi nhận được. */
  drinkLinhNhu(): number
}

const STAT_ROWS: ReadonlyArray<[keyof CombatStats, string]> = [
  ['maxSinhLuc', 'Sinh Lực'],
  ['maxLinhLuc', 'Linh Lực'],
  ['cong', 'Công'],
  ['phong', 'Phòng'],
  ['thanThuc', 'Thần Thức'],
  ['toc', 'Tốc'],
]

/**
 * Bảng Tu Luyện — nơi người chơi thấy toàn bộ con đường của mình.
 *
 * Cố tình hiện CẢ thang cảnh giới, kể cả những bậc chưa tới: mục tiêu dài hạn
 * phải nhìn thấy được, nếu không thì việc cày Tu Vi ở Luyện Khí tầng 5 chẳng
 * hướng về đâu cả.
 */
export class CultivationPanel extends Panel {
  private readonly host: CultivationHost
  private refreshTimer = 0

  constructor(container: HTMLElement, host: CultivationHost) {
    super(container, 'Tu Luyện', 'C — đóng · F giữ để toạ thiền', 'panel--cultivation')
    this.host = host
  }

  protected override onTick(dt: number): void {
    // Tu Vi và Tiểu Bình chạy liên tục, nhưng 4 lần/giây là đủ để mắt thấy nó
    // đang tăng — vẽ lại 60 lần/giây chỉ để đổi hai con số là phí
    this.refreshTimer -= dt
    if (this.refreshTimer > 0) return
    this.refreshTimer = 0.25
    this.refresh()
  }

  refresh(): void {
    const { cultivation: c, inventory, stats } = this.host
    const check = c.canBreakthrough(inventory)
    const pill = c.requiredPill()
    const nextMajor = c.realm.major + 1
    const atTop = nextMajor > PLAYABLE_MAJOR_CAP

    const tuViLine = c.atCap
      ? 'Đã tới đỉnh — chỉ còn đường đột phá'
      : `${Math.floor(c.tuVi)} / ${Math.ceil(c.tuViNeeded)}`

    this.body.innerHTML = `
      <div class="cul-now">
        <div class="cul-realm">${c.name}</div>
        <div class="cul-sub">tầng ${c.realm.tier + 1} / ${tierCount(c.realm.major)}
          · hệ số sức mạnh ×${realmPower(c.realm).toFixed(1)}</div>
      </div>

      <div class="cul-meter">
        <div class="cul-meter-head"><span>Tu Vi</span><span>${tuViLine}</span></div>
        <div class="cul-track"><div class="cul-fill${c.atCap ? ' is-full' : ''}"
          style="width:${(c.tierProgress * 100).toFixed(1)}%"></div></div>
      </div>

      <div class="cul-meter">
        <div class="cul-meter-head"><span>Tiểu Bình linh nhũ</span>
          <span>${Math.round(c.linhNhuFraction * 100)}%</span></div>
        <div class="cul-track"><div class="cul-fill cul-fill--binh"
          style="width:${(c.linhNhuFraction * 100).toFixed(1)}%"></div></div>
      </div>
      <div data-role="drink"></div>

      <div class="cul-stats">
        ${STAT_ROWS.map(
          ([key, label]) =>
            `<div class="cul-stat"><span>${label}</span><b>${fmt(stats[key] as number)}</b></div>`,
        ).join('')}
      </div>

      <div class="cul-break">
        <div class="cul-break-head">Đột phá đại cảnh giới</div>
        ${
          atTop
            ? `<div class="cul-note">Đã tới cảnh giới cao nhất của bản demo.</div>`
            : `
        <div class="cul-break-target">→ ${majorRealm(nextMajor).name}</div>
        <div class="cul-req">
          <span>Tu Vi đầy</span>
          <b class="${c.atCap ? 'is-ok' : 'is-bad'}">${c.atCap ? 'đủ' : 'chưa đủ'}</b>
        </div>
        ${
          pill
            ? `<div class="cul-req">
                 <span>${itemDef(pill).name}</span>
                 <b class="${inventory.has(pill) ? 'is-ok' : 'is-bad'}">${inventory.count(pill)} / 1</b>
               </div>`
            : ''
        }
        <div class="cul-req">
          <span>Tỉ lệ thành công</span>
          <b>${Math.round(check.chance * 100)}%</b>
        </div>
        ${
          c.failStreak > 0
            ? `<div class="cul-note">Đã thất bại ${c.failStreak} lần — tỉ lệ lần này đã được cộng thêm.</div>`
            : ''
        }
        <div class="cul-note">Vượt màn dẫn khí sẽ cộng thêm tối đa 28% vào tỉ lệ.</div>
        <div data-role="break"></div>`
        }
      </div>

      <div class="cul-ladder">
        ${MAJOR_REALMS.filter((_, i) => i <= PLAYABLE_MAJOR_CAP)
          .map((r, i) => {
            const state = i < c.realm.major ? 'is-done' : i === c.realm.major ? 'is-here' : ''
            return `<div class="cul-rung ${state}"><i></i><span>${r.name}</span></div>`
          })
          .join('')}
      </div>
    `

    const drinkSlot = this.body.querySelector('[data-role="drink"]')
    if (drinkSlot) {
      const canDrink = c.linhNhu >= 1 && !c.atCap
      const btn = this.button(
        c.atCap ? 'Ở đỉnh — linh nhũ không dùng được' : 'Uống linh nhũ (G)',
        () => {
          this.host.drinkLinhNhu()
          this.refresh()
        },
      )
      btn.disabled = !canDrink
      drinkSlot.appendChild(btn)
    }

    const breakSlot = this.body.querySelector('[data-role="break"]')
    if (breakSlot) {
      const btn = this.button(
        check.ok ? 'Đột phá (B)' : blockText(check.block),
        () => this.host.requestBreakthrough(),
        'panel-btn--primary',
      )
      btn.disabled = !check.ok
      breakSlot.appendChild(btn)
    }
  }
}

function blockText(block: string | null): string {
  switch (block) {
    case 'chuaDuTuVi':
      return 'Chưa đủ Tu Vi'
    case 'thieuDanDuoc':
      return 'Thiếu đan dược'
    case 'daToiDinh':
      return 'Đã tới đỉnh'
    default:
      return 'Chưa đủ điều kiện'
  }
}

function fmt(n: number): string {
  return n >= 100 ? String(Math.round(n)) : n.toFixed(1)
}
