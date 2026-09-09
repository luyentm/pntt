import { REALM, type RealmPosition } from './realms'
import type { Stack } from '../Inventory'

export interface Recipe {
  readonly id: string
  readonly output: string
  readonly outputCount: number
  readonly needs: readonly Stack[]
  readonly requiredRealm: RealmPosition
  /** Tỉ lệ thành công cơ bản, 0..1. */
  readonly baseChance: number
  /** Mỗi điểm Thần Thức cộng thêm bấy nhiêu vào tỉ lệ. */
  readonly thanThucBonus: number
  readonly linhLucCost: number
}

const LK = REALM.LUYEN_KHI

/**
 * Công thức luyện đan.
 *
 * Trúc Cơ Đan và Ngưng Đan cố tình đắt và khó: chúng là CỬA duy nhất lên đại
 * cảnh giới, nên việc gom đủ nguyên liệu cho chúng chính là mục tiêu dài hạn
 * của cả bản demo.
 */
export const RECIPES: readonly Recipe[] = [
  {
    id: 'hoiKhiDan',
    output: 'hoiKhiDan',
    outputCount: 2,
    needs: [{ id: 'thanhNguyenThao', count: 2 }],
    requiredRealm: { major: LK, tier: 0 },
    baseChance: 0.86,
    thanThucBonus: 0.004,
    linhLucCost: 8,
  },
  {
    id: 'bichLinhDan',
    output: 'bichLinhDan',
    outputCount: 1,
    needs: [
      { id: 'huyetLinhChi', count: 1 },
      { id: 'thanhNguyenThao', count: 2 },
    ],
    requiredRealm: { major: LK, tier: 2 },
    baseChance: 0.74,
    thanThucBonus: 0.005,
    linhLucCost: 14,
  },
  {
    id: 'tuViDan',
    output: 'tuViDan',
    outputCount: 1,
    needs: [
      { id: 'yeuDan', count: 2 },
      { id: 'thanhNguyenThao', count: 3 },
    ],
    requiredRealm: { major: LK, tier: 4 },
    baseChance: 0.66,
    thanThucBonus: 0.005,
    linhLucCost: 20,
  },
  {
    id: 'trucCoDan',
    output: 'trucCoDan',
    outputCount: 1,
    needs: [
      { id: 'tinhNguyetHoa', count: 2 },
      { id: 'huyetLinhChi', count: 3 },
      { id: 'yeuDan', count: 4 },
      { id: 'linhThachHa', count: 60 },
    ],
    requiredRealm: { major: LK, tier: 8 },
    baseChance: 0.5,
    thanThucBonus: 0.006,
    linhLucCost: 40,
  },
  {
    id: 'ngungDan',
    output: 'ngungDan',
    outputCount: 1,
    needs: [
      { id: 'camLinhCan', count: 2 },
      { id: 'tinhNguyetHoa', count: 4 },
      { id: 'yeuDan', count: 8 },
      { id: 'linhThachHa', count: 220 },
    ],
    requiredRealm: { major: REALM.TRUC_CO, tier: 2 },
    baseChance: 0.42,
    thanThucBonus: 0.004,
    linhLucCost: 90,
  },
]

export function recipeById(id: string): Recipe {
  const r = RECIPES.find((x) => x.id === id)
  if (!r) throw new Error(`Không có công thức "${id}"`)
  return r
}
