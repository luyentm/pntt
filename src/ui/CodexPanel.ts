import {
  CODEX,
  CODEX_CATEGORY_LABEL,
  codexByCategory,
  codexRealm,
  codexUnit,
  type CodexCategory,
  type CodexEntry,
} from '@/game/data/codex'
import { realmName } from '@/game/data/realms'
import {
  DAMAGE_BAND_LABEL,
  PHAP_BAO_RANK_LABEL,
  skillDamage,
  skillDef,
} from '@/game/data/skills'
import { deriveStats } from '@/game/Stats'

function esc(text: string): string {
  return text.replace(/[&<>"]/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;',
  )
}

const ORDER: readonly CodexCategory[] = ['nhanVat', 'yeuThu', 'phapBao']

/**
 * Đồ Giám: lưới thẻ, bấm một thẻ thì mở trang chi tiết bên phải và mô hình lên
 * bệ xoay ở nửa trái.
 *
 * Hai chế độ trong MỘT lớp, không phải hai lớp: chúng dùng chung khung, chung
 * nút quay lại, và trạng thái "đang xem mục nào" phải là một. Tách ra thì phải
 * viết luật đồng bộ giữa hai bên, mà đồng bộ hai bản sao của cùng một trạng
 * thái là chỗ sinh lỗi nhiều nhất trong UI.
 *
 * Ở chế độ chi tiết, lưới KHÔNG biến mất — nó co lại thành một cột hẹp bên
 * trái. Người xem Đồ Giám thường muốn so hai mục cạnh nhau, và bắt họ quay ra
 * lưới rồi vào lại chỉ để đổi mục là chỗ khó chịu nhất của mọi bảng tra.
 *
 * MỌI con số trên trang chi tiết đều SUY từ bảng đơn vị và bảng pháp thuật.
 * Không có một chỉ số nào gõ tay ở đây — Đồ Giám là chỗ người chơi tin nhất,
 * nên nó nói sai là tệ nhất.
 */
export class CodexPanel {
  private readonly root: HTMLDivElement
  private readonly grid: HTMLDivElement
  private readonly detail: HTMLDivElement
  private readonly cards = new Map<string, HTMLButtonElement>()
  private active: string | null = null

  onSelect?: (id: string) => void
  onBack?: () => void
  onClose?: () => void

  constructor(container: HTMLElement) {
    this.root = document.createElement('div')
    this.root.className = 'codex'
    this.root.innerHTML = `
      <div class="codex-head">
        <div>
          <div class="codex-title">Đồ Giám</div>
          <div class="codex-sub">Nhân vật · yêu thú · pháp bảo — bấm một mục để xem mô hình</div>
        </div>
        <button type="button" class="codex-close" data-role="close">Esc · về menu</button>
      </div>
      <div class="codex-body">
        <div class="codex-grid" data-role="grid"></div>
        <div class="codex-detail" data-role="detail"></div>
      </div>
    `
    container.appendChild(this.root)
    this.grid = this.pick('grid')
    this.detail = this.pick('detail')
    this.pick<HTMLButtonElement>('close').addEventListener('click', () => this.onClose?.())
    this.buildGrid()
  }

  private pick<T extends HTMLElement>(role: string): T {
    const el = this.root.querySelector(`[data-role="${role}"]`)
    if (!el) throw new Error(`CodexPanel: thiếu data-role="${role}"`)
    return el as T
  }

  private buildGrid(): void {
    for (const category of ORDER) {
      const entries = codexByCategory(category)
      if (entries.length === 0) continue

      const head = document.createElement('div')
      head.className = 'codex-group'
      head.innerHTML = `<span>${esc(CODEX_CATEGORY_LABEL[category])}</span><i>${entries.length}</i>`
      this.grid.appendChild(head)

      const wrap = document.createElement('div')
      wrap.className = 'codex-cards'
      for (const entry of entries) {
        const card = document.createElement('button')
        card.type = 'button'
        card.className = 'codex-card'
        const realm = codexRealm(entry)
        card.innerHTML = `
          <div class="codex-card-name">${esc(entry.name)}</div>
          ${entry.hanTu ? `<div class="codex-card-han">${esc(entry.hanTu)}</div>` : ''}
          <div class="codex-card-tag">${esc(entry.tagline)}</div>
          ${realm ? `<div class="codex-card-realm">${esc(realmName(realm))}</div>` : ''}
        `
        card.addEventListener('click', () => this.onSelect?.(entry.id))
        wrap.appendChild(card)
        this.cards.set(entry.id, card)
      }
      this.grid.appendChild(wrap)
    }
  }

  show(): void {
    this.root.classList.add('is-open')
  }

  hide(): void {
    this.root.classList.remove('is-open')
  }

  /** Mở trang chi tiết của một mục và thu lưới lại thành cột hẹp. */
  showDetail(entry: CodexEntry): void {
    if (this.active) this.cards.get(this.active)?.classList.remove('is-active')
    this.active = entry.id
    this.cards.get(entry.id)?.classList.add('is-active')
    this.root.classList.add('is-detail')
    this.detail.innerHTML = this.detailHtml(entry)
    this.detail.scrollTop = 0
    const back = this.detail.querySelector('[data-role="back"]')
    back?.addEventListener('click', () => {
      this.root.classList.remove('is-detail')
      if (this.active) this.cards.get(this.active)?.classList.remove('is-active')
      this.active = null
      this.detail.innerHTML = ''
      this.onBack?.()
    })
  }

  private detailHtml(entry: CodexEntry): string {
    const realm = codexRealm(entry)
    return `
      <button type="button" class="codex-back" data-role="back">← về lưới</button>
      <div class="codex-d-name">${esc(entry.name)}</div>
      ${entry.hanTu ? `<div class="codex-d-han">${esc(entry.hanTu)}</div>` : ''}
      ${realm ? `<div class="codex-d-realm">${esc(realmName(realm))}</div>` : ''}
      <p class="codex-d-lore">${esc(entry.lore)}</p>
      ${this.statsHtml(entry)}
      ${this.skillsHtml(entry)}
    `
  }

  /**
   * Bảng chỉ số, chỉ có ở mục lấy từ bảng đơn vị.
   *
   * Suy bằng `deriveStats` ở đúng cảnh giới của nó, không in chỉ số NỀN: chỉ số
   * nền của Mặc Đại Phu là 150 sinh lực, còn con thật ở Trúc Cơ hậu kỳ có gần
   * ba nghìn. In số nền thì bảng nói một điều đúng về dữ liệu và sai hoàn toàn
   * về thứ người chơi sẽ gặp.
   */
  private statsHtml(entry: CodexEntry): string {
    const unit = codexUnit(entry)
    if (!unit) return ''
    const s = deriveStats(unit.base, unit.realm)
    const rows: ReadonlyArray<[string, string]> = [
      ['Sinh lực', String(s.maxSinhLuc)],
      ['Công', s.cong.toFixed(1)],
      ['Phòng', s.phong.toFixed(1)],
      ['Thần thức', s.thanThuc.toFixed(1)],
      ['Tốc độ', s.toc.toFixed(1)],
      ['Ngũ hành', s.element],
      ['Tầm đánh', `${unit.attackRange} unit`],
      ['Nhịp đòn', `${unit.attackCooldown}s`],
    ]
    const boss = unit.boss
    return `
      <div class="codex-d-head">Chỉ số ở cảnh giới của nó</div>
      <div class="codex-stats">
        ${rows.map(([k, v]) => `<div><i>${esc(k)}</i><b>${esc(v)}</b></div>`).join('')}
      </div>
      ${
        boss
          ? `<div class="codex-d-head">Các phase — ${esc(boss.title)}</div>
             <ul class="codex-phases">${boss.phases
               .map(
                 (p) =>
                   `<li><b>${esc(p.name)}</b><span>vào khi máu còn ${Math.round(p.atHp * 100)}%${
                     p.summon ? ` · gọi ${p.summon.count} tay sai` : ''
                   }${p.slam ? ' · quét vòng liên tục' : ''}</span></li>`,
               )
               .join('')}</ul>`
          : ''
      }
    `
  }

  private skillsHtml(entry: CodexEntry): string {
    const ids = entry.skills ?? []
    if (ids.length === 0) return ''
    const rows = ids
      .map((id) => {
        const def = skillDef(id)
        const d = skillDamage(def)
        const band = def.action.type === 'hoTro' ? 'khong' : d.bac
        return `
          <li>
            <b>${esc(def.glyph)}</b>
            <div>
              <span class="codex-skill-name">${esc(def.name)}</span>
              <span class="codex-skill-meta">${esc(def.hanTu)} · ${esc(
                realmName(def.requiredRealm),
              )} · ${esc(PHAP_BAO_RANK_LABEL[def.phapBao.hang])}</span>
            </div>
            <em class="is-band-${band}">${esc(DAMAGE_BAND_LABEL[d.bac])}</em>
          </li>`
      })
      .join('')
    return `
      <div class="codex-d-head">Công pháp và thần thông · ${ids.length}</div>
      <ul class="codex-skills">${rows}</ul>
    `
  }

  /** Đang mở trang chi tiết hay đang ở lưới. `main` đọc để Esc lùi từng bước. */
  get isDetail(): boolean {
    return this.root.classList.contains('is-detail')
  }

  /** Lùi một bước: từ chi tiết về lưới. Trả về false nếu đã ở lưới. */
  back(): boolean {
    if (!this.isDetail) return false
    const btn = this.detail.querySelector<HTMLButtonElement>('[data-role="back"]')
    btn?.click()
    return true
  }

  get count(): number {
    return CODEX.length
  }

  dispose(): void {
    this.root.remove()
  }
}
