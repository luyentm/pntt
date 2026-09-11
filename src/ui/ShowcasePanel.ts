import { realmName } from '@/game/data/realms'
import {
  SHOWCASE,
  showcaseChapters,
  stepSkill,
  stepTitle,
  type ShowcaseStep,
} from '@/game/data/showcase'
import { loopBeat } from '@/game/ShowcaseDirector'
import {
  DAMAGE_BAND_LABEL,
  PHAP_BAO_RANK_LABEL,
  SKILL_ROLE_LABEL,
  skillDamage,
  type SkillDef,
} from '@/game/data/skills'

/** Thoát ký tự cho nội dung do dữ liệu cấp trước khi ghép vào innerHTML. */
function esc(text: string): string {
  return text.replace(/[&<>"]/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;',
  )
}

/** Số giây viết theo lối tiếng Việt: dấu phẩy thập phân, và bỏ phần `,0`. */
function giay(seconds: number): string {
  return seconds.toFixed(1).replace(/\.0$/, '').replace('.', ',')
}

/**
 * Một dòng số liệu sát thương đọc được bằng lời.
 *
 * Nói bằng HỆ SỐ CÔNG chứ không bằng con số tuyệt đối, vì sát thương thật còn
 * đi qua phòng ngự, ngũ hành và chênh lệch cảnh giới — một con số tuyệt đối chỉ
 * đúng với đúng một cặp đánh nhau, và sẽ nói dối ở mọi cặp còn lại.
 */
function damageLine(def: SkillDef): string {
  const d = skillDamage(def)
  if (d.tong <= 0) return 'Không gây sát thương'

  const parts: string[] = []
  if (d.soDon > 1) parts.push(`${d.moiDon.toFixed(2)}× công × ${d.soDon} đòn`)
  else parts.push(`${d.moiDon.toFixed(2)}× công`)
  if (d.theoThoiGian > 0) parts.push(`+${d.theoThoiGian.toFixed(2)}× theo thời gian`)

  const scope = d.soMucTieu === 0 ? 'diện rộng' : `tối đa ${d.soMucTieu} mục tiêu`
  return `${parts.join(' ')} = tổng ${d.tong.toFixed(2)}× · ${scope}`
}

/**
 * Lớp phủ của Luyện Kiếm Đài: thẻ giới thiệu chiêu đang diễn, và danh sách cả
 * kịch bản chia theo cảnh giới với bước hiện tại được đánh dấu.
 *
 * Thẻ nói bốn thứ, theo đúng thứ tự người xem cần: TÊN chiêu, THI TRIỂN BẰNG GÌ
 * (pháp bảo và hạng của nó), MẠNH CỠ NÀO (bậc sát thương và con số suy ra nó),
 * rồi mới tới chú thích về cách xem. Thiếu hai cái giữa thì mọi chiêu đọc ra
 * như nhau — mà trong Phàm Nhân, khoảng cách giữa một lá phù mua ngoài chợ và
 * một bản mệnh pháp bảo luyện hai mươi mốt năm mới là nội dung thật.
 *
 * Mọi con số trên thẻ đều SUY từ bảng pháp thuật, không gõ tay ở đây: chỉnh cân
 * bằng một hệ số là thẻ đổi theo, thay vì âm thầm nói sai.
 *
 * Danh sách hiện HẾT chứ không chỉ chiêu đang diễn: người vào đây để xem Hàn Lập
 * có những gì, nên họ phải thấy được toàn bộ ngay từ đầu và bấm thẳng vào cái
 * mình muốn xem. Bấm một dòng là chiêu đó lặp mãi cho tới khi đổi dòng khác —
 * danh sách này là bộ điều khiển chính của màn, không phải một mục lục.
 */
export class ShowcasePanel {
  private readonly root: HTMLDivElement
  private readonly card: HTMLDivElement
  private readonly counter: HTMLSpanElement
  private readonly state: HTMLSpanElement
  private readonly list: HTMLDivElement
  private readonly rows: HTMLButtonElement[] = []
  private active = -1

  /** Người chơi bấm vào một dòng trong danh sách. Màn gán vào. */
  onPick?: (index: number) => void

  constructor(container: HTMLElement) {
    this.root = document.createElement('div')
    this.root.className = 'showcase'
    this.root.innerHTML = `
      <div class="showcase-list" data-role="list"></div>
      <div class="showcase-card">
        <div class="showcase-meta">
          <span data-role="counter"></span>
          <span data-role="state"></span>
        </div>
        <div data-role="card"></div>
        <div class="showcase-keys">
          <b>Q</b> <b>E</b> đổi chiêu · <b>kéo chuột</b> xoay quanh nhân vật ·
          <b>lăn chuột</b> thu phóng · <b>1…0</b> tự thi triển ·
          <b>Space</b> ngự kiếm · <b>Esc</b> về menu
        </div>
      </div>
    `
    container.appendChild(this.root)
    this.card = this.pick('card')
    this.counter = this.pick('counter')
    this.state = this.pick('state')
    this.list = this.pick('list')
    this.buildList()
  }

  /**
   * Danh sách chia theo chương.
   *
   * Có tiêu đề chương chứ không phải một cột 22 dòng phẳng: cột phẳng thì người
   * xem không đọc ra được rằng bộ pháp thuật này ĐI THEO MỘT CON ĐƯỜNG, mà đó
   * chính là điều đáng nói nhất về nó.
   */
  private buildList(): void {
    for (const chapter of showcaseChapters()) {
      const head = document.createElement('div')
      head.className = 'showcase-chapter'
      head.textContent = chapter.title
      this.list.appendChild(head)

      for (let i = chapter.from; i <= chapter.to; i++) {
        const step = SHOWCASE[i] as ShowcaseStep
        const row = document.createElement('button')
        row.type = 'button'
        row.className = 'showcase-row'
        const def = stepSkill(step)
        row.innerHTML = `<b>${esc(def?.glyph ?? '·')}</b><span>${esc(stepTitle(step))}</span>`
        row.addEventListener('click', () => this.onPick?.(i))
        this.list.appendChild(row)
        this.rows[i] = row
      }
    }
  }

  private pick<T extends HTMLElement>(role: string): T {
    const el = this.root.querySelector(`[data-role="${role}"]`)
    if (!el) throw new Error(`ShowcasePanel: thiếu data-role="${role}"`)
    return el as T
  }

  show(): void {
    this.root.classList.add('is-open')
  }

  hide(): void {
    this.root.classList.remove('is-open')
  }

  get isOpen(): boolean {
    return this.root.classList.contains('is-open')
  }

  setStep(step: ShowcaseStep, index: number, total: number): void {
    this.card.innerHTML = this.cardHtml(step)
    this.counter.textContent = `${index + 1} / ${total}`
    // Nói thẳng nhịp lặp thay vì chỉ một chữ "đang lặp": người xem cần biết bao
    // lâu nữa chiêu ra lại để còn kịp xoay camera về chỗ muốn nhìn trước nhịp sau
    this.state.textContent = `↻ lặp mỗi ${giay(loopBeat(step))}s`
    if (index !== this.active) {
      if (this.active >= 0) this.rows[this.active]?.classList.remove('is-active')
      this.active = index
      const row = this.rows[index]
      row?.classList.add('is-active')
      row?.scrollIntoView({ block: 'nearest' })
      // Nháy thẻ một nhịp khi đổi bước — mắt đang ở nhân vật, không ở chữ
      this.root.classList.remove('is-changing')
      void this.root.offsetWidth
      this.root.classList.add('is-changing')
    }
  }

  private cardHtml(step: ShowcaseStep): string {
    const def = stepSkill(step)
    const title = `<div class="showcase-title">${esc(stepTitle(step))}</div>`

    if (!def) {
      // Ba bước không phải pháp thuật (combo, phi hành, toạ thiền, đột phá) chỉ
      // có tên và chú thích — dựng một thẻ số liệu rỗng cho chúng thì mỗi ô đều
      // ghi "—", và một hàng gạch ngang không nói gì cả
      return `
        ${title}
        <div class="showcase-realm">${esc(realmName(step.realm))}</div>
        <div class="showcase-note">${esc(step.note)}</div>`
    }

    const dmg = skillDamage(def)
    return `
      ${title}
      <div class="showcase-han">${esc(def.hanTu)} · ${esc(realmName(def.requiredRealm))}${
        def.banMenh ? ' · bản mệnh' : ''
      }</div>
      <div class="showcase-facts">
        <div class="showcase-fact">
          <i>Pháp bảo</i>
          <b>${esc(def.phapBao.ten)}</b>
          <u>${esc(PHAP_BAO_RANK_LABEL[def.phapBao.hang])}</u>
        </div>
        <div class="showcase-fact">
          <i>Sát thương</i>
          <b class="is-band-${def.action.type === 'hoTro' ? 'khong' : dmg.bac}">${esc(
            DAMAGE_BAND_LABEL[dmg.bac],
          )}</b>
          <u>${esc(damageLine(def))}</u>
        </div>
        <div class="showcase-fact">
          <i>Vai trò</i>
          <b>${esc(SKILL_ROLE_LABEL[def.role])}</b>
          <u>${def.linhLucCost} linh lực · hồi ${def.cooldown}s · dẫn khí ${def.castTime}s</u>
        </div>
      </div>
      <div class="showcase-lore">${esc(def.phapBao.note)} ${esc(def.nguonGoc)}</div>
      <div class="showcase-note">${esc(step.note)}</div>`
  }

  dispose(): void {
    this.root.remove()
  }
}
