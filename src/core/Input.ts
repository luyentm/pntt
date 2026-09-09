/** Nút chuột theo chuẩn MouseEvent.button */
export const MouseBtn = { Left: 0, Middle: 1, Right: 2 } as const
export type MouseBtnValue = (typeof MouseBtn)[keyof typeof MouseBtn]

/**
 * Thu thập bàn phím + chuột và quy về "action".
 * `endStep()` phải được gọi ở cuối mỗi bước fixed để xoá các trạng thái một-lần
 * (just pressed / wheel / drag), nếu không input sẽ bị đọc lặp.
 */
export class Input {
  /** Toạ độ chuột trong hệ NDC (-1..1), dùng cho raycast. */
  pointerNdcX = 0
  pointerNdcY = 0
  pointerPxX = 0
  pointerPxY = 0

  /** Cuộn chuột dồn lại trong bước này (dương = cuộn xuống). */
  wheel = 0
  /** Di chuyển chuột dồn lại trong bước này, tính bằng pixel. */
  dragX = 0
  dragY = 0

  private readonly down = new Set<string>()
  private readonly pressed = new Set<string>()
  private readonly released = new Set<string>()
  private readonly mouseDownSet = new Set<number>()
  private readonly mousePressedSet = new Set<number>()
  private readonly mouseReleasedSet = new Set<number>()
  private readonly detach: Array<() => void> = []

  constructor(private readonly el: HTMLElement) {
    this.bind(window, 'keydown', (e: KeyboardEvent) => {
      // Không chặn phím tắt hệ thống / devtools
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (!this.down.has(e.code)) this.pressed.add(e.code)
      this.down.add(e.code)
      // Space và các phím mũi tên mặc định làm trang cuộn -> chặn
      if (e.code === 'Space' || e.code.startsWith('Arrow') || e.code === 'Tab') e.preventDefault()
    })
    this.bind(window, 'keyup', (e: KeyboardEvent) => {
      this.down.delete(e.code)
      this.released.add(e.code)
    })

    this.bind(el, 'pointerdown', (e: PointerEvent) => {
      el.focus()
      if (!this.mouseDownSet.has(e.button)) this.mousePressedSet.add(e.button)
      this.mouseDownSet.add(e.button)
      this.updatePointer(e)
      // Giữ được sự kiện move/up cả khi con trỏ rời khỏi canvas (kéo xoay camera)
      el.setPointerCapture?.(e.pointerId)
    })
    this.bind(window, 'pointerup', (e: PointerEvent) => {
      this.mouseDownSet.delete(e.button)
      this.mouseReleasedSet.add(e.button)
    })
    this.bind(window, 'pointermove', (e: PointerEvent) => {
      this.dragX += e.movementX || 0
      this.dragY += e.movementY || 0
      this.updatePointer(e)
    })
    this.bind(el, 'wheel', (e: WheelEvent) => {
      this.wheel += e.deltaY
      e.preventDefault()
    }, { passive: false })
    // Chuột phải dùng để xoay camera nên phải tắt menu ngữ cảnh
    this.bind(el, 'contextmenu', (e: Event) => e.preventDefault())

    // Mất focus (alt-tab) -> nhả hết, tránh nhân vật chạy mãi một hướng
    this.bind(window, 'blur', () => this.releaseAll())

    el.tabIndex = 0
  }

  private bind<E extends Event>(
    target: EventTarget,
    type: string,
    handler: (e: E) => void,
    opts?: AddEventListenerOptions,
  ): void {
    const listener = handler as EventListener
    target.addEventListener(type, listener, opts)
    this.detach.push(() => target.removeEventListener(type, listener, opts))
  }

  private updatePointer(e: PointerEvent): void {
    const r = this.el.getBoundingClientRect()
    this.pointerPxX = e.clientX - r.left
    this.pointerPxY = e.clientY - r.top
    this.pointerNdcX = (this.pointerPxX / r.width) * 2 - 1
    this.pointerNdcY = -((this.pointerPxY / r.height) * 2 - 1)
  }

  isDown(code: string): boolean {
    return this.down.has(code)
  }

  wasPressed(code: string): boolean {
    return this.pressed.has(code)
  }

  wasReleased(code: string): boolean {
    return this.released.has(code)
  }

  mouseIsDown(button: MouseBtnValue): boolean {
    return this.mouseDownSet.has(button)
  }

  mouseWasPressed(button: MouseBtnValue): boolean {
    return this.mousePressedSet.has(button)
  }

  mouseWasReleased(button: MouseBtnValue): boolean {
    return this.mouseReleasedSet.has(button)
  }

  /** Trục di chuyển từ WASD / phím mũi tên, đã chuẩn hoá độ dài <= 1. */
  moveAxis(): { x: number; z: number } {
    let x = 0
    let z = 0
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) x -= 1
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) x += 1
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) z -= 1
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) z += 1
    const len = Math.hypot(x, z)
    if (len > 1) {
      x /= len
      z /= len
    }
    return { x, z }
  }

  /** Ô skill 1..6 vừa được bấm; trả -1 nếu không có. */
  skillPressed(): number {
    for (let i = 1; i <= 6; i++) {
      if (this.pressed.has(`Digit${i}`)) return i - 1
    }
    return -1
  }

  releaseAll(): void {
    this.down.clear()
    this.mouseDownSet.clear()
  }

  /**
   * Gọi ở cuối mỗi bước FIXED — xoá các trạng thái "vừa bấm / vừa nhả".
   * Tách khỏi endFrame() vì gameplay đọc chúng ở nhịp fixed.
   */
  endStep(): void {
    this.pressed.clear()
    this.released.clear()
    this.mousePressedSet.clear()
    this.mouseReleasedSet.clear()
  }

  /**
   * Gọi một lần ở cuối mỗi FRAME — xoá delta cuộn/kéo chuột.
   * Phải ở nhịp frame chứ không phải nhịp fixed: một frame có thể chạy 2-3 bước
   * fixed, nếu xoá ở endStep() thì cùng một cú kéo chuột sẽ bị áp nhiều lần và
   * camera xoay nhanh hơn khi máy tụt fps.
   */
  endFrame(): void {
    this.wheel = 0
    this.dragX = 0
    this.dragY = 0
  }

  dispose(): void {
    for (const off of this.detach) off()
    this.detach.length = 0
    this.releaseAll()
  }
}
