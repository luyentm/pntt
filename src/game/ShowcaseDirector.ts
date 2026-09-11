import type { RealmPosition } from './data/realms'
import { SHOWCASE, type ShowcaseStep } from './data/showcase'

/** Những gì bộ trình diễn YÊU CẦU màn làm. Nó không tự làm gì cả. */
export interface ShowcaseActions {
  /** Thi triển theo ID chiêu, không theo ô — mười ô không chứa nổi mười bảy chiêu. */
  cast(id: string): void
  melee(): void
  setFlight(on: boolean): void
  setMeditate(on: boolean): void
  breakthroughFx(): void
  /** Dựng lại mộc nhân và bia đá. */
  refreshTargets(): void
  /**
   * Đặt cảnh giới cho bước sắp diễn.
   *
   * Bắt buộc phải có, không phải chuyện trang trí: số kiếm trúc, độ dày khiên
   * và sức gặm của đàn trùng đều suy từ cảnh giới, nên diễn một chiêu Nguyên
   * Anh ở thân Kết Đan là nói sai về chính chiêu đó.
   */
  setRealm(realm: RealmPosition): void
  /**
   * Bù đầy sinh lực và linh lực. Gọi trước MỖI nhịp diễn.
   *
   * Trước mỗi nhịp chứ không chỉ lúc đổi bước, vì bước giờ lặp vô hạn: Giá Y
   * Thần Công đốt 18% máu mỗi lần thi triển và ngự kiếm phi hành đốt 2,2% linh
   * lực mỗi giây, nên xem một bước vài phút là nhân vật kiệt quệ rồi rơi khỏi
   * kiếm — người xem đọc ra là một cái lỗi chứ không phải cái giá của chiêu.
   * Bù ngay TRƯỚC nhịp thì cú tụt vẫn thấy rõ đúng lúc chiêu ra.
   */
  restore(): void
  /** Bước mới được chọn — UI hiện tên và chú thích. */
  announce(step: ShowcaseStep, index: number, total: number): void
}

/** Chờ bao lâu sau khi hiện chú thích rồi mới diễn. */
const READ_DELAY = 0.9

/**
 * Nhịp lặp của một bước, giây.
 *
 * Bước tự khai `repeatEvery` thì theo nhịp đó; không khai thì lặp lại sau đúng
 * `duration` — con số vốn đã nói "xem chừng này là đủ một lượt".
 */
export function loopBeat(step: ShowcaseStep): number {
  return step.repeatEvery ?? step.duration
}

/**
 * Bộ điều phối Luyện Kiếm Đài.
 *
 * Giữ ĐÚNG MỘT bước và lặp nó mãi. Trước đây nó là một showreel tự chạy hết cả
 * hai mươi hai bước rồi quay vòng, và điều đó hỏng đúng cái việc người ta mở
 * màn này ra để làm: muốn xem kỹ Thanh Trúc Phong Vân Kiếm thì có chín giây,
 * hết chín giây là nó lôi sang chiêu khác dù đang xem dở. Xem một chiêu là việc
 * NGẮM — phải lặp tới khi người xem chán, không phải tới khi đồng hồ hết.
 *
 * Thuần logic, cùng khuôn với `WaveDirector`: nó không cầm scene, không cầm
 * three, chỉ đếm thời gian và gọi yêu cầu qua `ShowcaseActions`. Nhờ vậy chạy
 * được cả kịch bản trong test mà không cần đồ hoạ.
 *
 * Có `READ_DELAY` trước nhịp đầu vì đây là chế độ để XEM: chữ và chiêu nổ ra
 * cùng lúc thì mắt bị chia hai chỗ và không đọc được cái nào.
 */
export class ShowcaseDirector {
  /** Bước đang lặp, 0-based. `-1` là chưa chọn gì — khi đó màn đứng yên. */
  index = -1
  /** Thời gian còn lại tới nhịp diễn kế tiếp. */
  timer = 0

  get current(): ShowcaseStep | null {
    return SHOWCASE[this.index] ?? null
  }

  get total(): number {
    return SHOWCASE.length
  }

  /** Nhịp lặp của bước đang chọn, giây. 0 khi chưa chọn bước nào. */
  get beat(): number {
    const step = this.current
    return step ? loopBeat(step) : 0
  }

  /** Chọn một bước và lặp nó. Đây là lối vào duy nhất của mọi cách đổi bước. */
  select(index: number, actions: ShowcaseActions): void {
    this.leave(actions)
    this.index = Math.max(0, Math.min(this.total - 1, index))
    this.enter(actions)
  }

  next(actions: ShowcaseActions): void {
    this.select(this.index < 0 ? 0 : (this.index + 1) % this.total, actions)
  }

  prev(actions: ShowcaseActions): void {
    this.select(this.index < 0 ? this.total - 1 : (this.index - 1 + this.total) % this.total, actions)
  }

  fixedUpdate(dt: number, actions: ShowcaseActions): void {
    const step = this.current
    if (!step) return

    this.timer -= dt
    if (this.timer > 0) return
    // Nhịp kế tiếp đặt trước khi diễn: `perform` có thể gọi ngược vào màn, và
    // màn không nên thấy một bộ điều phối đang ở giữa chừng trạng thái
    this.timer = loopBeat(step)
    actions.restore()
    this.perform(step, actions)
  }

  /** Vào một bước: đặt cảnh giới, đặt lại đồng hồ, dựng bia, báo UI. */
  private enter(actions: ShowcaseActions): void {
    const step = this.current
    if (!step) return
    this.timer = READ_DELAY
    // Cảnh giới TRƯỚC khi dựng bia: máu của bia suy từ cảnh giới người chơi,
    // nên dựng trước rồi mới nâng cảnh giới thì cả vòng bia mỏng đi một bậc và
    // chúng chết ngay nhịp quét đầu tiên
    actions.setRealm(step.realm)
    if (step.refreshTargets) actions.refreshTargets()
    actions.announce(step, this.index, this.total)
  }

  /**
   * Ra khỏi bước: tắt những trạng thái KÉO DÀI.
   *
   * Bắt buộc phải có. Bay và toạ thiền là trạng thái bật/tắt, không phải một
   * cú nổ — không tắt khi rời bước thì nhân vật vẫn đang lơ lửng trong lúc màn
   * diễn Thiên Lôi Phù, và bước sau đọc ra là một cái lỗi.
   */
  private leave(actions: ShowcaseActions): void {
    const step = this.current
    if (!step) return
    if (step.action.kind === 'flight') actions.setFlight(false)
    if (step.action.kind === 'meditate') actions.setMeditate(false)
  }

  private perform(step: ShowcaseStep, actions: ShowcaseActions): void {
    switch (step.action.kind) {
      case 'skill':
        actions.cast(step.action.id)
        return
      case 'melee':
        actions.melee()
        return
      // Hai trạng thái bật/tắt dưới đây không sợ gọi lại mỗi nhịp: `setFlying`
      // và `setMeditating` đều thoát sớm khi đã đúng trạng thái. Gọi lại còn
      // là thứ DỰNG chúng dậy sau khi bị choáng hay bị ngắt.
      case 'flight':
        actions.setFlight(true)
        return
      case 'meditate':
        actions.setMeditate(true)
        return
      case 'breakthrough':
        actions.breakthroughFx()
        return
    }
  }

  reset(): void {
    this.index = -1
    this.timer = 0
  }
}
