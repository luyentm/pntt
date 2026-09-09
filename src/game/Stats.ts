import type { Rng } from '@/core/Rng'
import { realmGapFactor, realmPower, type RealmPosition } from './data/realms'

/** Ngũ hành. */
export const ELEMENTS = ['kim', 'moc', 'thuy', 'hoa', 'tho', 'vo'] as const
export type Element = (typeof ELEMENTS)[number]

/**
 * Ngũ hành tương khắc: Kim khắc Mộc, Mộc khắc Thổ, Thổ khắc Thuỷ,
 * Thuỷ khắc Hoả, Hoả khắc Kim. `vo` (vô thuộc tính) không khắc ai và không bị khắc.
 */
const COUNTERS: Record<Element, Element | null> = {
  kim: 'moc',
  moc: 'tho',
  tho: 'thuy',
  thuy: 'hoa',
  hoa: 'kim',
  vo: null,
}

export const ELEMENT_ADVANTAGE = 1.32
export const ELEMENT_DISADVANTAGE = 0.78

export function elementFactor(attacker: Element, defender: Element): number {
  if (attacker === 'vo' || defender === 'vo') return 1
  if (COUNTERS[attacker] === defender) return ELEMENT_ADVANTAGE
  if (COUNTERS[defender] === attacker) return ELEMENT_DISADVANTAGE
  return 1
}

/** Stat chiến đấu đã suy ra, dùng trực tiếp trong công thức. */
export interface CombatStats {
  maxSinhLuc: number
  maxLinhLuc: number
  /** Công. */
  cong: number
  /** Phòng. */
  phong: number
  /** Thần thức — sức pháp thuật và tầm phát hiện. */
  thanThuc: number
  /** Tốc — world unit / giây. */
  toc: number
  /** Tỉ lệ bạo kích, 0..1. */
  bao: number
  /** Hệ số sát thương khi bạo kích. */
  baoMult: number
  element: Element
}

/** Chỉ số nền của một loài / nhân vật, trước khi nhân theo cảnh giới. */
export interface BaseStats {
  sinhLuc: number
  linhLuc: number
  cong: number
  phong: number
  thanThuc: number
  toc: number
  bao: number
  baoMult: number
  element: Element
}

/**
 * Suy stat từ chỉ số nền + cảnh giới.
 *
 * `toc` KHÔNG nhân theo cảnh giới: nếu tốc độ di chuyển cũng tăng theo thì tới
 * Kết Đan nhân vật sẽ chạy nhanh gấp 20 lần và không màn nào chơi được nữa.
 * Sức mạnh cảnh giới thể hiện qua sát thương, sinh lực và pháp thuật mới.
 */
export function deriveStats(base: BaseStats, realm: RealmPosition): CombatStats {
  const power = realmPower(realm)
  return {
    maxSinhLuc: Math.round(base.sinhLuc * power),
    maxLinhLuc: Math.round(base.linhLuc * power),
    cong: base.cong * power,
    phong: base.phong * power,
    thanThuc: base.thanThuc * power,
    toc: base.toc,
    bao: base.bao,
    baoMult: base.baoMult,
    element: base.element,
  }
}

export interface Attacker {
  stats: CombatStats
  realm: RealmPosition
}

export interface Defender {
  stats: CombatStats
  realm: RealmPosition
}

export interface DamageResult {
  amount: number
  crit: boolean
  /** Hệ số ngũ hành đã áp — UI dùng để hiện "khắc chế". */
  elementFactor: number
  /** Hệ số chênh cảnh giới đã áp. */
  realmFactor: number
}

/** Sát thương tối thiểu của một đòn trúng — không bao giờ hiện "0". */
export const MIN_DAMAGE = 1

/**
 * Công thức sát thương.
 *
 *   cong × skillMult × ngũ_hành × bạo_kích × giảm_trừ_phòng × chênh_cảnh_giới
 *
 * Giảm trừ dùng dạng 100/(100+phòng) chứ không trừ thẳng: nhờ vậy phòng ngự luôn
 * có giá trị và không bao giờ khiến sát thương về 0 (trừ thẳng thì chỉ cần phòng
 * đủ cao là bất tử, một lỗi cân bằng kinh điển).
 */
export function computeDamage(
  attacker: Attacker,
  defender: Defender,
  skillMult: number,
  rng: Rng,
): DamageResult {
  const elem = elementFactor(attacker.stats.element, defender.stats.element)
  const realmFactor = realmGapFactor(attacker.realm.major, defender.realm.major)
  const crit = rng.chance(attacker.stats.bao)
  const critMult = crit ? attacker.stats.baoMult : 1
  const mitigation = 100 / (100 + Math.max(0, defender.stats.phong))

  const raw = attacker.stats.cong * skillMult * elem * critMult * mitigation * realmFactor

  return {
    amount: Math.max(MIN_DAMAGE, Math.round(raw)),
    crit,
    elementFactor: elem,
    realmFactor,
  }
}
