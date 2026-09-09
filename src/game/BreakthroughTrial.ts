import type { Rng } from '@/core/Rng'

export interface TrialZone {
  /** Vị trí bắt đầu và kết thúc trên thanh, 0..1. */
  start: number
  end: number
  hit: boolean
}

export interface TrialOutcome {
  /** Cộng thêm vào tỉ lệ đột phá, 0..~0.3. */
  bonus: number
  hits: number
  total: number
  /** Bị khí nghịch áp đảo — chỉ mất phần thưởng, KHÔNG làm đột phá thất bại. */
  overwhelmed: boolean
}

/** Số nhịp phải dẫn thành công. */
const ZONE_COUNT = 5
/** Tốc độ con trỏ ban đầu (vòng/giây). */
const BASE_SPEED = 0.62
/** Mỗi nhịp thành công thì con trỏ nhanh thêm bấy nhiêu. */
const SPEED_PER_HIT = 0.16
/** Khí nghịch cộng thêm mỗi lần bấm trượt. */
const BACKLASH_PER_MISS = 0.26
/** Cộng tối đa vào tỉ lệ đột phá nếu dẫn khí hoàn hảo. */
const MAX_BONUS = 0.28

/**
 * Màn thử "dẫn khí" khi đột phá đại cảnh giới.
 *
 * Con trỏ quét qua lại trên một thanh; người chơi bấm khi nó nằm trong vùng
 * sáng. Mỗi nhịp trúng làm con trỏ nhanh hơn, mỗi lần bấm trượt cộng khí nghịch.
 *
 * Cố ý CHỈ CỘNG THÊM vào tỉ lệ, không thay thế phép roll:
 *  - Người chơi giỏi được thưởng, nhưng cơ chế thương tình (pity) vẫn bảo đảm
 *    không ai bị kẹt cứng vì tay chậm.
 *  - Ngược lại, nếu kỹ năng quyết định hoàn toàn thì "đột phá" biến thành một
 *    trò bấm nhịp, mất hẳn cảm giác đây là một cơ duyên có phần vận may.
 * Và khí nghịch áp đảo chỉ MẤT PHẦN THƯỞNG, không làm đột phá thất bại —
 * thất bại đã có phép roll lo, chồng thêm một cách thất bại nữa là quá nặng.
 */
export class BreakthroughTrial {
  active = false
  /** Vị trí con trỏ, 0..1. */
  cursor = 0
  direction: 1 | -1 = 1
  speed = BASE_SPEED
  zones: TrialZone[] = []
  /** Khí nghịch tích luỹ, 0..1. */
  backlash = 0
  hits = 0

  /** Chặn bấm giữ: phải nhả rồi bấm lại mới tính nhịp mới. */
  private consumedPress = false

  start(rng: Rng): void {
    this.active = true
    this.cursor = 0
    this.direction = 1
    this.speed = BASE_SPEED
    this.backlash = 0
    this.hits = 0
    this.consumedPress = false
    this.zones = []

    // Rải các vùng sáng, thu nhỏ dần: nhịp sau khó hơn nhịp trước.
    //
    // Mỗi vùng được đặt trong Ô RIÊNG của nó thay vì rải tự do trên cả thanh:
    // rải tự do thì hai vùng chồng lên nhau, và khi đó một chỗ trên thanh phải
    // bấm hai lần mới xong — người chơi đọc ra là "bấm trúng mà game không
    // nhận". Đặt theo ô vẫn còn ngẫu nhiên, mà không bao giờ chồng.
    const lo = 0.06
    const hi = 0.94
    const slot = (hi - lo) / ZONE_COUNT
    for (let i = 0; i < ZONE_COUNT; i++) {
      const width = Math.min(slot * 0.9, 0.16 - i * 0.018)
      const slotStart = lo + slot * i
      const start = rng.float(slotStart, slotStart + slot - width)
      this.zones.push({ start, end: start + width, hit: false })
    }
  }

  get progress(): number {
    return this.hits / ZONE_COUNT
  }

  /** Vùng chưa dẫn nào đang chứa con trỏ. */
  activeZone(): TrialZone | null {
    for (const z of this.zones) {
      if (!z.hit && this.cursor >= z.start && this.cursor <= z.end) return z
    }
    return null
  }

  /**
   * Một bước mô phỏng.
   * @param pressed đang bấm nút dẫn khí hay không
   * @returns kết quả nếu màn thử đã kết thúc, null nếu còn tiếp
   */
  update(dt: number, pressed: boolean): TrialOutcome | null {
    if (!this.active) return null

    this.cursor += this.direction * this.speed * dt
    if (this.cursor >= 1) {
      this.cursor = 1
      this.direction = -1
    } else if (this.cursor <= 0) {
      this.cursor = 0
      this.direction = 1
    }

    if (!pressed) {
      this.consumedPress = false
    } else if (!this.consumedPress) {
      this.consumedPress = true
      const zone = this.activeZone()
      if (zone) {
        zone.hit = true
        this.hits++
        this.speed += SPEED_PER_HIT
      } else {
        this.backlash = Math.min(1, this.backlash + BACKLASH_PER_MISS)
      }
    }

    if (this.hits >= ZONE_COUNT) return this.finish(false)
    if (this.backlash >= 1) return this.finish(true)
    return null
  }

  /** Kết thúc sớm (người chơi bỏ, hoặc bị đánh gián đoạn). */
  abort(): TrialOutcome {
    return this.finish(false)
  }

  private finish(overwhelmed: boolean): TrialOutcome {
    this.active = false
    const ratio = this.hits / ZONE_COUNT
    // Khí nghịch làm giảm phần thưởng chứ không xoá sạch: người chơi bấm trượt
    // vài nhịp vẫn phải thấy công sức của mình được tính
    const penalty = overwhelmed ? 0.5 : 1 - this.backlash * 0.5
    return {
      bonus: Math.max(0, MAX_BONUS * ratio * penalty),
      hits: this.hits,
      total: ZONE_COUNT,
      overwhelmed,
    }
  }
}

export const TRIAL_ZONE_COUNT = ZONE_COUNT
export const TRIAL_MAX_BONUS = MAX_BONUS
