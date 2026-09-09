import { FPS_CAP_CHOICES, type Settings } from '@/game/Settings'

export type MenuScreen = 'main' | 'pause' | 'settings' | 'none'

export interface MenuActions {
  /** Tiếp tục từ bản lưu (chỉ có ở menu chính khi có save). */
  continueSave(): void
  /** Bắt đầu lượt mới — xoá bản lưu. */
  newGame(): void
  /** Đóng menu tạm dừng, chơi tiếp. */
  resume(): void
  /** Lưu rồi về menu chính. */
  saveAndQuit(): void
  /** Người chơi đổi một mục cài đặt. */
  changeSettings(patch: Partial<Settings>): void
}

/**
 * Menu chính, menu tạm dừng và bảng cài đặt.
 *
 * Ba màn trong MỘT lớp vì chúng dùng chung khung, chung nút, và bảng cài đặt
 * phải mở được từ cả hai menu kia. Tách ra thì phải viết thêm luật "mở cài đặt
 * từ đâu thì Quay lại đi về đâu" ở hai nơi.
 *
 * Thế giới vẫn được VẼ phía sau menu (game chỉ tạm dừng mô phỏng, không dừng
 * render): một màn hình đen ở menu chính sẽ che mất thứ duy nhất bán được trò
 * chơi này — chính cái sơn môn.
 */
export class Menu {
  private readonly root: HTMLDivElement
  private readonly body: HTMLDivElement
  private readonly title: HTMLDivElement
  private readonly sub: HTMLDivElement
  private screen: MenuScreen = 'none'
  /** Mở cài đặt từ màn nào, để nút Quay lại về đúng chỗ. */
  private settingsFrom: MenuScreen = 'main'
  private saveInfo: string | null = null
  private settings: Settings

  constructor(
    container: HTMLElement,
    settings: Settings,
    private readonly actions: MenuActions,
  ) {
    this.settings = { ...settings }
    this.root = document.createElement('div')
    this.root.className = 'menu'
    this.root.innerHTML = `
      <div class="menu-card">
        <div class="menu-title" data-role="title"></div>
        <div class="menu-sub" data-role="sub"></div>
        <div class="menu-body" data-role="body"></div>
      </div>
    `
    container.appendChild(this.root)
    this.title = this.pick('title')
    this.sub = this.pick('sub')
    this.body = this.pick('body')
  }

  private pick<T extends HTMLElement>(role: string): T {
    const el = this.root.querySelector(`[data-role="${role}"]`)
    if (!el) throw new Error(`Menu: thiếu data-role="${role}"`)
    return el as T
  }

  /** Máy chỉ có cảm ứng, không có con trỏ chuột thật. */
  static isTouchOnly(): boolean {
    return (
      typeof matchMedia === 'function' &&
      matchMedia('(hover: none) and (pointer: coarse)').matches
    )
  }

  get isOpen(): boolean {
    return this.screen !== 'none'
  }

  get current(): MenuScreen {
    return this.screen
  }

  /** Mô tả bản lưu để hiện ở menu chính. `null` = chưa có bản lưu. */
  setSaveInfo(info: string | null): void {
    this.saveInfo = info
    if (this.screen === 'main') this.render()
  }

  syncSettings(settings: Settings): void {
    this.settings = { ...settings }
    if (this.screen === 'settings') this.render()
  }

  show(screen: MenuScreen): void {
    this.screen = screen
    if (screen === 'none') {
      this.root.classList.remove('is-open')
      return
    }
    this.root.classList.add('is-open')
    this.render()
  }

  openSettings(from: MenuScreen): void {
    this.settingsFrom = from
    this.show('settings')
  }

  close(): void {
    this.show('none')
  }

  private button(label: string, onClick: () => void, primary = false): HTMLButtonElement {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = `menu-btn${primary ? ' menu-btn--primary' : ''}`
    b.textContent = label
    b.addEventListener('click', onClick)
    return b
  }

  private render(): void {
    this.body.innerHTML = ''
    switch (this.screen) {
      case 'main':
        this.renderMain()
        return
      case 'pause':
        this.renderPause()
        return
      case 'settings':
        this.renderSettings()
        return
      default:
        return
    }
  }

  private renderMain(): void {
    this.title.textContent = 'Phàm Nhân Tu Tiên'
    this.sub.textContent = 'Thất Huyền Môn — luyện võ trường'

    if (this.saveInfo) {
      this.body.appendChild(this.button('Tiếp tục', () => this.actions.continueSave(), true))
      const info = document.createElement('div')
      info.className = 'menu-note'
      info.textContent = this.saveInfo
      this.body.appendChild(info)
    }
    this.body.appendChild(
      this.button(
        this.saveInfo ? 'Bắt đầu lượt mới' : 'Bắt đầu',
        () => {
          // Có bản lưu thì hỏi lại một bước: nút này xoá sạch tiến độ, mà nó
          // nằm ngay dưới "Tiếp tục" nên rất dễ bấm nhầm
          if (this.saveInfo) this.renderConfirmWipe()
          else this.actions.newGame()
        },
        !this.saveInfo,
      ),
    )
    this.body.appendChild(this.button('Cài đặt', () => this.openSettings('main')))

    const hint = document.createElement('div')
    hint.className = 'menu-note menu-note--dim'
    hint.textContent = 'WASD di chuyển · chuột trái đánh · 1…7 pháp thuật · Esc tạm dừng'
    this.body.appendChild(hint)

    // Nói thẳng trên máy chỉ có cảm ứng. Bản này chưa có điều khiển cảm ứng
    // (plan để dành), và một URL công khai thì sẽ có người mở bằng điện thoại —
    // để họ tự loay hoay với màn hình không phản hồi là tệ hơn nhiều so với một
    // dòng chữ nói rõ.
    if (Menu.isTouchOnly()) {
      const touch = document.createElement('div')
      touch.className = 'menu-note'
      touch.style.color = 'rgba(196, 84, 63, 0.9)'
      touch.textContent = 'Bản này cần bàn phím và chuột — chưa có điều khiển cảm ứng.'
      this.body.appendChild(touch)
    }
  }

  /** Bước hỏi lại trước khi xoá tiến độ. */
  private renderConfirmWipe(): void {
    this.body.innerHTML = ''
    const note = document.createElement('div')
    note.className = 'menu-note'
    note.textContent = `Xoá tiến độ đang có? (${this.saveInfo ?? ''})`
    this.body.appendChild(note)

    const row = document.createElement('div')
    row.className = 'menu-row'
    row.appendChild(this.button('Xoá và bắt đầu lại', () => this.actions.newGame()))
    row.appendChild(this.button('Thôi', () => this.render(), true))
    this.body.appendChild(row)
  }

  private renderPause(): void {
    this.title.textContent = 'Tạm dừng'
    this.sub.textContent = ''
    this.body.appendChild(this.button('Chơi tiếp', () => this.actions.resume(), true))
    this.body.appendChild(this.button('Cài đặt', () => this.openSettings('pause')))
    this.body.appendChild(this.button('Lưu và về menu', () => this.actions.saveAndQuit()))
  }

  private renderSettings(): void {
    this.title.textContent = 'Cài đặt'
    this.sub.textContent = 'Đổi là áp dụng ngay, và được ghi nhớ cho lần sau'

    this.body.appendChild(
      this.toggle('Tự ngắm', this.settings.autoAim, (v) =>
        this.actions.changeSettings({ autoAim: v }),
      ),
    )
    const aimNote = document.createElement('div')
    aimNote.className = 'menu-note menu-note--dim'
    aimNote.textContent = 'Tắt tự ngắm thì đòn đánh và pháp thuật đi theo con trỏ chuột.'
    this.body.appendChild(aimNote)

    this.body.appendChild(
      this.slider('Tỉ lệ phân giải', this.settings.resolutionScale, 0.5, 1, 0.05, (v) => {
        this.actions.changeSettings({ resolutionScale: v })
      }, (v) => `${Math.round(v * 100)}%`),
    )
    this.body.appendChild(
      this.slider('Âm lượng', this.settings.sfxVolume, 0, 1, 0.05, (v) => {
        this.actions.changeSettings({ sfxVolume: v })
      }, (v) => `${Math.round(v * 100)}%`),
    )
    this.body.appendChild(
      this.choice('Giới hạn fps', FPS_CAP_CHOICES, this.settings.fpsCap, (v) => v === 0 ? 'Không khoá' : `${v}`, (v) => {
        this.actions.changeSettings({ fpsCap: v })
      }),
    )
    this.body.appendChild(
      this.toggle('Đổ bóng', this.settings.shadows, (v) => this.actions.changeSettings({ shadows: v })),
    )
    this.body.appendChild(
      this.toggle('Hậu xử lý (viền + bloom)', this.settings.postFx, (v) =>
        this.actions.changeSettings({ postFx: v }),
      ),
    )

    const note = document.createElement('div')
    note.className = 'menu-note menu-note--dim'
    note.textContent =
      'Máy nóng hoặc quạt ồn: hạ tỉ lệ phân giải và tắt hậu xử lý trước — chúng tốn nhất.'
    this.body.appendChild(note)

    this.body.appendChild(this.button('Quay lại', () => this.show(this.settingsFrom), true))
  }

  private row(label: string): { row: HTMLDivElement; value: HTMLSpanElement } {
    const row = document.createElement('div')
    row.className = 'menu-setting'
    row.innerHTML = `<span class="menu-setting-label"></span><span class="menu-setting-value"></span>`
    ;(row.querySelector('.menu-setting-label') as HTMLSpanElement).textContent = label
    return { row, value: row.querySelector('.menu-setting-value') as HTMLSpanElement }
  }

  private slider(
    label: string,
    value: number,
    min: number,
    max: number,
    step: number,
    onChange: (v: number) => void,
    format: (v: number) => string,
  ): HTMLDivElement {
    const { row, value: valueEl } = this.row(label)
    valueEl.textContent = format(value)
    const input = document.createElement('input')
    input.type = 'range'
    input.className = 'menu-range'
    input.min = String(min)
    input.max = String(max)
    input.step = String(step)
    input.value = String(value)
    input.addEventListener('input', () => {
      const v = Number(input.value)
      valueEl.textContent = format(v)
      onChange(v)
    })
    row.appendChild(input)
    return row
  }

  private toggle(label: string, value: boolean, onChange: (v: boolean) => void): HTMLDivElement {
    const { row, value: valueEl } = this.row(label)
    const btn = this.button(value ? 'Bật' : 'Tắt', () => {
      value = !value
      btn.textContent = value ? 'Bật' : 'Tắt'
      btn.classList.toggle('is-on', value)
      valueEl.textContent = ''
      onChange(value)
    })
    btn.classList.add('menu-btn--small')
    btn.classList.toggle('is-on', value)
    row.appendChild(btn)
    return row
  }

  private choice<T>(
    label: string,
    options: readonly T[],
    value: T,
    format: (v: T) => string,
    onChange: (v: T) => void,
  ): HTMLDivElement {
    const { row } = this.row(label)
    const group = document.createElement('div')
    group.className = 'menu-choices'
    for (const option of options) {
      const btn = this.button(format(option), () => {
        for (const child of group.children) child.classList.remove('is-on')
        btn.classList.add('is-on')
        onChange(option)
      })
      btn.classList.add('menu-btn--small')
      if (option === value) btn.classList.add('is-on')
      group.appendChild(btn)
    }
    row.appendChild(group)
    return row
  }

  dispose(): void {
    this.root.remove()
  }
}
