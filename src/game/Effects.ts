/**
 * Trạng thái tạm thời gắn lên combatant: khiên, làm chậm, thiêu đốt, đóng băng.
 *
 * Tách riêng khỏi stat vì bản chất khác nhau: stat là hằng số suy từ cảnh giới
 * và trang bị, còn trạng thái đến rồi đi trong lúc đánh nhau. Trộn chung thì mỗi
 * lần hết buff lại phải tính lại toàn bộ stat và rất dễ tích luỹ sai số.
 */

export type EffectKind =
  /** Hấp thụ một lượng sát thương rồi tan. */
  | 'khien'
  /** Giảm tốc độ di chuyển. */
  | 'chamLai'
  /** Mất sát thương theo thời gian. */
  | 'thieuDot'
  /** Mất sát thương theo thời gian, hệ độc. */
  | 'trungDoc'
  /** Không điều khiển được. */
  | 'dongBang'

export interface ActiveEffect {
  kind: EffectKind
  /** Thời gian còn lại, giây. */
  remaining: number
  /**
   * Ý nghĩa tuỳ loại:
   *  khien    — lượng sát thương còn hấp thụ được
   *  chamLai  — phần tốc độ bị mất, 0..1
   *  thieuDot/trungDoc — sát thương mỗi giây
   *  dongBang — không dùng
   */
  magnitude: number
  /** Ai gây ra — để tính công trạng và để hiệu ứng không tự cộng dồn vô hạn. */
  sourceId: number
  /** Dồn tích cho DoT: cộng dt vào đây, mỗi lần vượt 1 giây thì gây sát thương. */
  accumulator: number
}

/** Mỗi loại chỉ giữ MỘT thực thể — chồng lên nhau thì lấy cái mạnh hơn. */
export class EffectSet {
  private readonly list: ActiveEffect[] = []

  get all(): readonly ActiveEffect[] {
    return this.list
  }

  get size(): number {
    return this.list.length
  }

  find(kind: EffectKind): ActiveEffect | undefined {
    return this.list.find((e) => e.kind === kind)
  }

  has(kind: EffectKind): boolean {
    return this.find(kind) !== undefined
  }

  /**
   * Thêm hoặc làm mới một trạng thái.
   *
   * Quy tắc chồng: giữ MẠNH HƠN, và lấy thời gian dài hơn. Nếu cho cộng dồn thì
   * một chiêu làm chậm bắn liên tục sẽ đóng băng mục tiêu vĩnh viễn — dạng lỗi
   * cân bằng rất dễ xảy ra mà lại khó nhận ra khi chơi.
   */
  apply(kind: EffectKind, duration: number, magnitude: number, sourceId = -1): ActiveEffect {
    const existing = this.find(kind)
    if (existing) {
      existing.remaining = Math.max(existing.remaining, duration)
      existing.magnitude = Math.max(existing.magnitude, magnitude)
      existing.sourceId = sourceId
      return existing
    }
    const effect: ActiveEffect = {
      kind,
      remaining: duration,
      magnitude,
      sourceId,
      accumulator: 0,
    }
    this.list.push(effect)
    return effect
  }

  remove(kind: EffectKind): void {
    const i = this.list.findIndex((e) => e.kind === kind)
    if (i >= 0) this.list.splice(i, 1)
  }

  clear(): void {
    this.list.length = 0
  }

  /**
   * Giảm thời gian và gỡ trạng thái hết hạn.
   * Trả về tổng sát thương theo thời gian phải gây trong bước này.
   */
  tick(dt: number): number {
    let dotDamage = 0
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i] as ActiveEffect

      if (e.kind === 'thieuDot' || e.kind === 'trungDoc') {
        e.accumulator += dt
        // Gây theo NHỊP GIÂY chứ không rải mỗi frame: số sát thương bay ra phải
        // đọc được, mà 60 con số "0.4" mỗi giây thì không ai đọc nổi
        while (e.accumulator >= 1) {
          e.accumulator -= 1
          dotDamage += e.magnitude
        }
      }

      e.remaining -= dt
      if (e.remaining <= 0) this.list.splice(i, 1)
    }
    return dotDamage
  }

  /** Hệ số tốc độ di chuyển do các trạng thái gây ra. */
  speedMultiplier(): number {
    if (this.has('dongBang')) return 0
    const slow = this.find('chamLai')
    if (!slow) return 1
    return Math.max(0.15, 1 - slow.magnitude)
  }

  /** Có mất điều khiển hay không. */
  isImmobilized(): boolean {
    return this.has('dongBang')
  }

  /**
   * Trừ sát thương vào khiên trước. Trả về phần sát thương CÒN LẠI xuyên qua.
   * Khiên hết thì tự tan ngay, không đợi hết thời gian.
   */
  absorb(amount: number): number {
    const shield = this.find('khien')
    if (!shield) return amount
    if (shield.magnitude >= amount) {
      shield.magnitude -= amount
      if (shield.magnitude <= 0) this.remove('khien')
      return 0
    }
    const leftover = amount - shield.magnitude
    this.remove('khien')
    return leftover
  }
}
