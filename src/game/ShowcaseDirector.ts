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
  /** Bước mới bắt đầu — UI hiện tên và chú thích. */
  announce(step: ShowcaseStep, index: number, total: number): void
}

/** Chờ bao lâu sau khi hiện chú thích rồi mới diễn. */
const READ_DELAY = 0.9

/**
 * Bộ điều phối Luyện Kiếm Đài.
 *
 * Thuần logic, cùng khuôn với `WaveDirector`: nó không cầm scene, không cầm
 * three, chỉ đếm thời gian và gọi yêu cầu qua `ShowcaseActions`. Nhờ vậy chạy
 * được cả kịch bản trong test mà không cần đồ hoạ.
 *
 * Có `READ_DELAY` trước mỗi hành động vì đây là chế độ để XEM: chữ và chiêu nổ
 * ra cùng lúc thì mắt bị chia hai chỗ và không đọc được cái nào.
 */
export class ShowcaseDirector {
  /** Bước hiện tại, 0-based. */
  index = 0
  /** Đang tự chạy showreel. Tắt thì người chơi tự do thi triển. */
  playing = false
  /** Thời gian còn lại của bước. */
  timer = 0

  private beatTimer = 0
  private fired = false

  get current(): ShowcaseStep | null {
    return SHOWCASE[this.index] ?? null
  }

  get total(): number {
    return SHOWCASE.length
  }

  /** Bắt đầu showreel từ bước hiện tại. */
  start(actions: ShowcaseActions): void {
    this.playing = true
    this.enter(actions)
  }

  /** Dừng showreel, trả quyền điều khiển cho người chơi. */
  stop(actions: ShowcaseActions): void {
    this.playing = false
    this.leave(actions)
  }

  /** Đổi giữa tự chạy và tự chơi. */
  toggle(actions: ShowcaseActions): void {
    if (this.playing) this.stop(actions)
    else this.start(actions)
  }

  /** Sang bước sau. Dùng được cả khi đang dừng, để người chơi tự lật. */
  next(actions: ShowcaseActions): void {
    this.leave(actions)
    this.index = (this.index + 1) % this.total
    this.enter(actions)
  }

  prev(actions: ShowcaseActions): void {
    this.leave(actions)
    this.index = (this.index - 1 + this.total) % this.total
    this.enter(actions)
  }

  jumpTo(index: number, actions: ShowcaseActions): void {
    this.leave(actions)
    this.index = Math.max(0, Math.min(this.total - 1, index))
    this.enter(actions)
  }

  fixedUpdate(dt: number, actions: ShowcaseActions): void {
    if (!this.playing) return
    const step = this.current
    if (!step) return

    this.timer -= dt

    // Hành động chính nổ ra sau khoảng đọc chú thích
    const elapsed = step.duration - this.timer
    if (!this.fired && elapsed >= READ_DELAY) {
      this.fired = true
      this.perform(step, actions)
      this.beatTimer = step.repeatEvery ?? 0
    } else if (this.fired && step.repeatEvery) {
      this.beatTimer -= dt
      if (this.beatTimer <= 0) {
        this.beatTimer = step.repeatEvery
        this.perform(step, actions)
      }
    }

    if (this.timer <= 0) this.next(actions)
  }

  /** Vào một bước: đặt cảnh giới, đặt lại đồng hồ, dựng bia, báo UI. */
  private enter(actions: ShowcaseActions): void {
    const step = this.current
    if (!step) return
    this.timer = step.duration
    this.beatTimer = 0
    this.fired = false
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
   * cú nổ — không tắt khi rời bước thì nhân vật vẫn đang lơ lửng trong lúc
   * showreel diễn Thiên Lôi Phù, và bước sau đọc ra là một cái lỗi.
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
    this.index = 0
    this.timer = 0
    this.playing = false
    this.beatTimer = 0
    this.fired = false
  }
}
