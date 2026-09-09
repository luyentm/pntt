import type { Rng } from '@/core/Rng'

export interface DropEntry {
  readonly id: string
  /** Xác suất rơi, 0..1. */
  readonly chance: number
  readonly min: number
  readonly max: number
}

export interface DropTable {
  /** Tu Vi nhận được khi hạ con này. */
  readonly tuVi: number
  readonly entries: readonly DropEntry[]
}

/**
 * Bảng rơi vật phẩm theo loại quái.
 *
 * Tu Vi là phần thưởng CHẮC CHẮN, vật phẩm là phần thưởng may rủi. Nếu để cả hai
 * đều may rủi thì có những lượt đánh mãi mà không tiến bộ gì, và người chơi mất
 * cảm giác đang tu luyện.
 */
export const DROPS: Record<string, DropTable> = {
  yeuThu: {
    tuVi: 9,
    entries: [
      { id: 'linhThachHa', chance: 0.4, min: 1, max: 3 },
      { id: 'thanhNguyenThao', chance: 0.22, min: 1, max: 1 },
      { id: 'yeuDan', chance: 0.05, min: 1, max: 1 },
    ],
  },
  hacLang: {
    tuVi: 26,
    entries: [
      { id: 'linhThachHa', chance: 0.62, min: 2, max: 6 },
      { id: 'thanhNguyenThao', chance: 0.3, min: 1, max: 2 },
      { id: 'huyetLinhChi', chance: 0.16, min: 1, max: 1 },
      { id: 'yeuDan', chance: 0.18, min: 1, max: 1 },
      { id: 'tinhNguyetHoa', chance: 0.04, min: 1, max: 1 },
    ],
  },
}

export interface RolledDrop {
  id: string
  count: number
}

/** Quay bảng rơi. Dùng Rng có seed nên kết quả tái lập được và test được. */
export function rollDrops(tableId: string, rng: Rng): RolledDrop[] {
  const table = DROPS[tableId]
  if (!table) return []
  const out: RolledDrop[] = []
  for (const entry of table.entries) {
    if (!rng.chance(entry.chance)) continue
    out.push({ id: entry.id, count: rng.int(entry.min, entry.max) })
  }
  return out
}

export function tuViReward(tableId: string): number {
  return DROPS[tableId]?.tuVi ?? 0
}
