/**
 * Khung chung của các bảng (Tu Luyện, Túi Đồ, Luyện Đan).
 *
 * Ba bảng dùng cùng một khung chứ không tự vẽ riêng: chúng phải đóng/mở như
 * nhau, đứng cùng một chỗ và không bao giờ mở hai cái cùng lúc — mà cách rẻ
 * nhất để bảo đảm những điều đó là chỉ có một chỗ định nghĩa chúng.
 */
export abstract class Panel {
  readonly root: HTMLDivElement
  protected readonly body: HTMLDivElement
  private opened = false

  constructor(container: HTMLElement, title: string, hint: string, extraClass = '') {
    this.root = document.createElement('div')
    this.root.className = `panel ${extraClass}`.trim()
    this.root.innerHTML = `
      <div class="panel-head">
        <span class="panel-title"></span>
        <span class="panel-hint"></span>
      </div>
      <div class="panel-body"></div>
    `
    const titleEl = this.root.querySelector('.panel-title') as HTMLSpanElement
    const hintEl = this.root.querySelector('.panel-hint') as HTMLSpanElement
    titleEl.textContent = title
    hintEl.textContent = hint
    this.body = this.root.querySelector('.panel-body') as HTMLDivElement
    container.appendChild(this.root)
  }

  get isOpen(): boolean {
    return this.opened
  }

  show(): void {
    if (this.opened) return
    this.opened = true
    this.root.classList.add('is-open')
    this.refresh()
  }

  hide(): void {
    if (!this.opened) return
    this.opened = false
    this.root.classList.remove('is-open')
  }

  toggle(): void {
    if (this.opened) this.hide()
    else this.show()
  }

  /** Vẽ lại nội dung từ trạng thái game. Chỉ được gọi khi bảng đang mở. */
  abstract refresh(): void

  /** Gọi mỗi frame. Bảng đang đóng thì không làm gì. */
  tick(dt: number): void {
    if (!this.opened) return
    this.onTick(dt)
  }

  protected onTick(_dt: number): void {}

  /** Tạo một nút bấm đã gắn sẵn handler. */
  protected button(label: string, onClick: () => void, className = ''): HTMLButtonElement {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = `panel-btn ${className}`.trim()
    btn.textContent = label
    btn.addEventListener('click', onClick)
    return btn
  }

  dispose(): void {
    this.root.remove()
  }
}
