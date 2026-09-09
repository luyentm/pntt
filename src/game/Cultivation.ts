import type { Rng } from '@/core/Rng'
import { itemDef } from './data/items'
import {
  MAJOR_REALMS,
  REALM,
  realmName,
  realmPower,
  tierCount,
  tuViForNextTier,
  type RealmPosition,
} from './data/realms'
import type { Inventory } from './Inventory'

/** Đan dược mở cửa cho từng đại cảnh giới. */
const BREAKTHROUGH_PILL: Record<number, string> = {
  [REALM.TRUC_CO]: 'trucCoDan',
  [REALM.KET_DAN]: 'ngungDan',
}

/** Tỉ lệ thành công cơ bản của một lần đột phá đại cảnh giới. */
const BASE_SUCCESS = 0.55
/** Mỗi lần thất bại cộng thêm bấy nhiêu vào tỉ lệ lần sau. */
const PITY_PER_FAIL = 0.18
/** Thất bại thì mất bấy nhiêu phần Tu Vi. */
const FAIL_TUVI_LOSS = 0.3

/**
 * Tu Vi hồi mỗi giây khi toạ thiền, tính theo hệ số sức mạnh cảnh giới.
 *
 * TRƯỚC ĐÂY tính theo phần trăm mốc của tầng (0.028 × mốc), và đó là một lỗi
 * thiết kế: mốc bị chia lại đúng bằng lượng hồi, nên MỌI tầng đều mất đúng 36
 * giây — kể cả ba tầng bình cảnh cuối Luyện Khí, thứ cố tình đắt gấp 2,7 lần để
 * ép người chơi đi tìm đan dược. Cả cơ chế bình cảnh bị vô hiệu, và toạ thiền
 * suông đi hết Luyện Khí trong 7 phút, nhanh hơn đánh quái 5 lần. Đường chơi
 * tối ưu thành ra là ngồi giữ F trong góc.
 *
 * Nay là lượng TUYỆT ĐỐI theo cảnh giới: vẫn có ích ở mọi cảnh giới, nhưng mốc
 * càng lớn thì càng chậm — nên bình cảnh cắn thật.
 */
const MEDITATE_PER_POWER = 1.25
/** Tiểu Bình tích linh nhũ mỗi giây. */
const LINH_NHU_RATE = 0.55
/** Dung tích Tiểu Bình. */
const LINH_NHU_CAP = 100
/**
 * Một bình linh nhũ đầy đổi được bấy nhiêu phần mốc của tầng.
 *
 * 0.35 chứ không 0.9: ở 0.9 thì mỗi 3 phút Tiểu Bình cho gần trọn một tầng, và
 * cả 13 tầng Luyện Khí đi được bằng cách để game chạy không. Tiểu Bình trong
 * truyện là một ưu thế đều đặn, không phải con đường chính.
 */
const LINH_NHU_TUVI = 0.35

export type BreakthroughBlock =
  | 'chuaDuTuVi'
  | 'thieuDanDuoc'
  | 'daToiDinh'
  | null

export interface BreakthroughCheck {
  ok: boolean
  block: BreakthroughBlock
  /** Đan dược cần, nếu thiếu. */
  needPill?: string
  /** Tỉ lệ thành công hiện tại, 0..1. */
  chance: number
}

export interface TierUpResult {
  /** Có lên tầng nhỏ nào không. */
  tiersGained: number
  /** Đã tới tầng cuối của đại cảnh giới và đang chờ đột phá. */
  atCap: boolean
}

/**
 * Tu luyện: Tu Vi, tầng, toạ thiền, Tiểu Bình, và đột phá đại cảnh giới.
 *
 * Tách hẳn khỏi Player vì đây là LUẬT, không phải điều khiển: có thể chạy và
 * kiểm tra toàn bộ vòng tu luyện mà không cần đồ hoạ hay input.
 */
export class Cultivation {
  readonly realm: RealmPosition
  tuVi = 0
  /** Số lần đột phá thất bại liên tiếp — dùng cho cơ chế thương tình (pity). */
  failStreak = 0
  /** Linh nhũ trong Tiểu Bình, 0..LINH_NHU_CAP. */
  linhNhu = 0
  /** Tổng Tu Vi đã tích luỹ cả đời — để hiển thị và cho thành tựu. */
  totalTuVi = 0

  constructor(start: RealmPosition) {
    this.realm = { ...start }
  }

  get name(): string {
    return realmName(this.realm)
  }

  /** Tu Vi cần để lên tầng kế tiếp. Infinity nghĩa là phải đột phá. */
  get tuViNeeded(): number {
    return tuViForNextTier(this.realm)
  }

  /** Đang ở tầng cuối của đại cảnh giới, chỉ còn đường đột phá. */
  get atCap(): boolean {
    return this.realm.tier >= tierCount(this.realm.major) - 1
  }

  /** Tiến độ tầng hiện tại, 0..1. Ở đỉnh thì luôn 1. */
  get tierProgress(): number {
    if (this.atCap) return 1
    const needed = this.tuViNeeded
    return Math.max(0, Math.min(1, this.tuVi / needed))
  }

  get linhNhuFraction(): number {
    return this.linhNhu / LINH_NHU_CAP
  }

  /**
   * Cộng Tu Vi, tự lên tầng nếu đủ.
   *
   * Tu Vi vượt mốc được GIỮ LẠI cho tầng sau chứ không bỏ: một cú giết boss cho
   * nhiều Tu Vi thì phải lên được nhiều tầng, không thì người chơi mất phần thưởng
   * mà không hiểu vì sao.
   */
  gainTuVi(amount: number): TierUpResult {
    if (amount <= 0 || this.atCap) {
      // Ở đỉnh thì Tu Vi vẫn nhận nhưng bị chặn ở mốc, để thanh luôn đầy
      if (this.atCap && amount > 0) this.totalTuVi += amount
      return { tiersGained: 0, atCap: this.atCap }
    }

    this.tuVi += amount
    this.totalTuVi += amount

    let gained = 0
    while (!this.atCap && this.tuVi >= this.tuViNeeded) {
      this.tuVi -= this.tuViNeeded
      this.realm.tier++
      gained++
    }
    if (this.atCap) this.tuVi = 0

    return { tiersGained: gained, atCap: this.atCap }
  }

  /** Tu Vi thu được mỗi giây khi toạ thiền, ở cảnh giới hiện tại. */
  get meditateRate(): number {
    return MEDITATE_PER_POWER * realmPower(this.realm)
  }

  /** Toạ thiền: tăng Tu Vi chậm và đều. Gọi mỗi bước fixed khi đang thiền. */
  meditate(dt: number): TierUpResult {
    if (this.atCap) return { tiersGained: 0, atCap: true }
    return this.gainTuVi(this.meditateRate * dt)
  }

  /** Tiểu Bình tự tích linh nhũ theo thời gian, kể cả khi đang đánh nhau. */
  tickLinhNhu(dt: number): void {
    this.linhNhu = Math.min(LINH_NHU_CAP, this.linhNhu + LINH_NHU_RATE * dt)
  }

  /**
   * Uống hết linh nhũ trong Tiểu Bình để lấy Tu Vi.
   * Trả về lượng Tu Vi nhận được, 0 nếu bình rỗng.
   */
  drinkLinhNhu(): number {
    if (this.linhNhu < 1) return 0
    // Quy theo MỐC CỦA TẦNG hiện tại chứ không phải một con số cố định: nếu cố
    // định thì Tiểu Bình vô dụng ở tầng cao, mà trong truyện nó có ích suốt
    const needed = Number.isFinite(this.tuViNeeded) ? this.tuViNeeded : 0
    const amount = needed > 0 ? (this.linhNhu / LINH_NHU_CAP) * needed * LINH_NHU_TUVI : 0
    this.linhNhu = 0
    if (amount > 0) this.gainTuVi(amount)
    return Math.round(amount)
  }

  /** Đan dược cần để đột phá lên đại cảnh giới kế tiếp. */
  requiredPill(): string | null {
    return BREAKTHROUGH_PILL[this.realm.major + 1] ?? null
  }

  /**
   * Tỉ lệ thành công hiện tại, đã tính thương tình và phần thưởng từ màn thử
   * dẫn khí. Trần 0.97 chứ không 1: vẫn phải còn chỗ cho vận may, vì đột phá
   * trong truyện là cơ duyên chứ không phải một phép tính.
   */
  successChance(trialBonus = 0): number {
    return Math.min(0.97, BASE_SUCCESS + this.failStreak * PITY_PER_FAIL + Math.max(0, trialBonus))
  }

  /** Kiểm tra đủ điều kiện đột phá chưa. */
  canBreakthrough(inventory: Inventory, trialBonus = 0): BreakthroughCheck {
    const chance = this.successChance(trialBonus)

    if (this.realm.major >= MAJOR_REALMS.length - 1) {
      return { ok: false, block: 'daToiDinh', chance }
    }
    if (!this.atCap) {
      return { ok: false, block: 'chuaDuTuVi', chance }
    }
    const pill = this.requiredPill()
    if (pill && !inventory.has(pill)) {
      return { ok: false, block: 'thieuDanDuoc', needPill: pill, chance }
    }
    return { ok: true, block: null, chance }
  }

  /**
   * Thử đột phá. Tiêu đan dược dù thành công hay thất bại.
   *
   * Thất bại KHÔNG chết và KHÔNG tụt cảnh giới — chỉ mất Tu Vi và tăng tỉ lệ cho
   * lần sau. Đây là quyết định thiết kế có chủ ý: một cơ chế có thể xoá sạch
   * nhiều giờ chơi sẽ khiến người chơi không dám thử, và thứ đáng nhớ ở đây là
   * khoảnh khắc vượt qua, không phải nỗi sợ mất mát.
   */
  attemptBreakthrough(
    inventory: Inventory,
    rng: Rng,
    trialBonus = 0,
  ): { success: boolean; chance: number; lostTuVi: number; pillUsed: string | null } {
    const check = this.canBreakthrough(inventory, trialBonus)
    if (!check.ok) throw new Error(`Chưa đủ điều kiện đột phá: ${check.block}`)

    const pill = this.requiredPill()
    if (pill) {
      // Kiểm tra tên đan dược có thật, tránh lỗi chính tả trong bảng
      itemDef(pill)
      inventory.remove(pill, 1)
    }

    const chance = this.successChance(trialBonus)
    if (rng.chance(chance)) {
      this.realm.major++
      this.realm.tier = 0
      this.tuVi = 0
      this.failStreak = 0
      return { success: true, chance, lostTuVi: 0, pillUsed: pill }
    }

    this.failStreak++
    // Ở đỉnh thì tuVi đã là 0, nên "mất Tu Vi" thể hiện bằng việc tụt lại một
    // tầng nhỏ — vẫn là mất mát thật nhưng lấy lại được nhanh
    let lost = 0
    if (this.realm.tier > 0) {
      this.realm.tier--
      const needed = this.tuViNeeded
      lost = Math.round(needed * (1 - FAIL_TUVI_LOSS))
      this.tuVi = Math.max(0, needed - lost)
    }
    return { success: false, chance, lostTuVi: lost, pillUsed: pill }
  }

  toJSON(): { major: number; tier: number; tuVi: number; failStreak: number; linhNhu: number; totalTuVi: number } {
    return {
      major: this.realm.major,
      tier: this.realm.tier,
      tuVi: this.tuVi,
      failStreak: this.failStreak,
      linhNhu: this.linhNhu,
      totalTuVi: this.totalTuVi,
    }
  }

  /**
   * Nạp trạng thái vào CHÍNH đối tượng này.
   *
   * Cần bên cạnh `fromJSON` vì `Player.cultivation` là `readonly` và
   * `Combatant.realm` trỏ vào cùng object đó — thay bằng một instance mới sẽ để
   * combatant giữ lại tham chiếu cũ, và nhân vật đánh bằng cảnh giới của bản
   * lưu trước đó mà không có gì báo.
   */
  loadFrom(data: ReturnType<Cultivation['toJSON']>): void {
    this.realm.major = data.major
    this.realm.tier = data.tier
    this.tuVi = data.tuVi
    this.failStreak = data.failStreak
    this.linhNhu = data.linhNhu
    this.totalTuVi = data.totalTuVi
  }

  static fromJSON(data: ReturnType<Cultivation['toJSON']>): Cultivation {
    const c = new Cultivation({ major: data.major, tier: data.tier })
    c.tuVi = data.tuVi
    c.failStreak = data.failStreak
    c.linhNhu = data.linhNhu
    c.totalTuVi = data.totalTuVi
    return c
  }
}
