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
 * MỌI đơn vị có thể bị hạ đều phải có một entry ở đây. Thiếu một entry không
 * gây lỗi gì — `tuViReward` chỉ trả về 0 — nên con quái đó âm thầm không cho
 * thưởng gì cả. Có test đối chiếu bảng này với bảng đơn vị đúng vì lý do đó.
 *
 * Tu Vi là phần thưởng CHẮC CHẮN, vật phẩm là phần thưởng may rủi. Nếu để cả hai
 * đều may rủi thì có những lượt đánh mãi mà không tiến bộ gì, và người chơi mất
 * cảm giác đang tu luyện.
 */
export const DROPS: Record<string, DropTable> = {
  yeuThu: {
    tuVi: 22,
    entries: [
      { id: 'linhThachHa', chance: 0.4, min: 1, max: 3 },
      { id: 'thanhNguyenThao', chance: 0.22, min: 1, max: 1 },
      { id: 'yeuDan', chance: 0.05, min: 1, max: 1 },
    ],
  },
  hacLang: {
    tuVi: 62,
    entries: [
      { id: 'linhThachHa', chance: 0.62, min: 2, max: 6 },
      { id: 'thanhNguyenThao', chance: 0.3, min: 1, max: 2 },
      { id: 'huyetLinhChi', chance: 0.16, min: 1, max: 1 },
      { id: 'yeuDan', chance: 0.18, min: 1, max: 1 },
      { id: 'tinhNguyetHoa', chance: 0.04, min: 1, max: 1 },
    ],
  },

  docThu: {
    tuVi: 34,
    entries: [
      { id: 'linhThachHa', chance: 0.45, min: 1, max: 4 },
      { id: 'thanhNguyenThao', chance: 0.34, min: 1, max: 2 },
      { id: 'huyetLinhChi', chance: 0.12, min: 1, max: 1 },
      { id: 'yeuDan', chance: 0.1, min: 1, max: 1 },
    ],
  },

  maDaoTanTu: {
    tuVi: 150,
    entries: [
      { id: 'linhThachHa', chance: 0.85, min: 4, max: 12 },
      { id: 'huyetLinhChi', chance: 0.3, min: 1, max: 2 },
      { id: 'tinhNguyetHoa', chance: 0.14, min: 1, max: 1 },
      { id: 'hoiKhiDan', chance: 0.2, min: 1, max: 2 },
    ],
  },

  thietGiapThi: {
    tuVi: 190,
    entries: [
      { id: 'linhThachHa', chance: 0.9, min: 5, max: 14 },
      { id: 'yeuDan', chance: 0.4, min: 1, max: 2 },
      { id: 'huyetLinhChi', chance: 0.22, min: 1, max: 1 },
      { id: 'bichLinhDan', chance: 0.16, min: 1, max: 1 },
    ],
  },

  /** Đệ tử — chỉ dùng khi một màn về sau cho họ ở phe địch. */
  deTu: {
    tuVi: 70,
    entries: [
      { id: 'linhThachHa', chance: 0.6, min: 2, max: 8 },
      { id: 'thanhNguyenThao', chance: 0.3, min: 1, max: 2 },
    ],
  },

  /**
   * Tướng rơi CHẮC CHẮN nguyên liệu quý.
   *
   * Chắc chắn chứ không may rủi: một con tướng chỉ gặp một lần mỗi lượt chơi,
   * nên để nó rơi theo xác suất thì có người chơi hạ được tướng mà nhận đúng
   * mấy viên linh thạch — và cảm giác "vừa làm được một việc lớn" biến mất.
   */
  maDaoTrucCo: {
    tuVi: 900,
    entries: [
      { id: 'linhThachHa', chance: 1, min: 40, max: 70 },
      { id: 'tinhNguyetHoa', chance: 1, min: 2, max: 3 },
      { id: 'huyetLinhChi', chance: 1, min: 2, max: 4 },
      { id: 'camLinhCan', chance: 0.5, min: 1, max: 1 },
      { id: 'tuViDan', chance: 1, min: 1, max: 2 },
    ],
  },

  macDaiPhu: {
    tuVi: 2600,
    entries: [
      { id: 'linhThachHa', chance: 1, min: 120, max: 200 },
      { id: 'camLinhCan', chance: 1, min: 2, max: 3 },
      { id: 'tinhNguyetHoa', chance: 1, min: 3, max: 5 },
      { id: 'yeuDan', chance: 1, min: 4, max: 8 },
      { id: 'tuViDan', chance: 1, min: 2, max: 3 },
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
