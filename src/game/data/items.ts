import { Palette } from '@/art/Palette'

export type ItemKind =
  /** Linh thảo — nguyên liệu luyện đan. */
  | 'linhThao'
  /** Đan dược — dùng được ngay. */
  | 'danDuoc'
  /** Linh thạch — tiền và nguồn Tu Vi. */
  | 'linhThach'
  /** Nguyên liệu khác (yêu đan, da thú...). */
  | 'vatLieu'

export type ItemUse =
  | { type: 'tuVi'; amount: number }
  | { type: 'hoiSinhLuc'; amount: number }
  | { type: 'hoiLinhLuc'; amount: number }
  /** Cho phép đột phá lên một đại cảnh giới cụ thể. */
  | { type: 'dotPha'; toMajor: number }
  | { type: 'khongDung' }

export interface ItemDef {
  readonly id: string
  readonly name: string
  readonly kind: ItemKind
  readonly desc: string
  /** Màu hiển thị của vật phẩm rơi trên đất và trong túi. */
  readonly color: number
  /** Bậc phẩm 1..5 — quyết định màu viền trong túi đồ. */
  readonly tier: number
  readonly use: ItemUse
  /** Số lượng tối đa mỗi ô. */
  readonly stack: number
}

/**
 * Bảng vật phẩm. Tên và công dụng lấy đúng theo Phàm Nhân Tu Tiên.
 * Thêm vật phẩm = thêm một entry, không sửa hệ thống nào.
 */
export const ITEMS: Record<string, ItemDef> = {
  // ---------- Linh thạch ----------
  linhThachHa: {
    id: 'linhThachHa',
    name: 'Hạ phẩm linh thạch',
    kind: 'linhThach',
    desc: 'Đơn vị tiền tệ của giới tu tiên. Hấp thu trực tiếp cũng tăng được Tu Vi.',
    color: Palette.linh,
    tier: 1,
    use: { type: 'tuVi', amount: 30 },
    stack: 9999,
  },

  // ---------- Linh thảo ----------
  thanhNguyenThao: {
    id: 'thanhNguyenThao',
    name: 'Thanh Nguyên thảo',
    kind: 'linhThao',
    desc: 'Linh thảo phổ thông, nguyên liệu chính của Hồi Khí Đan.',
    color: Palette.moc,
    tier: 1,
    use: { type: 'khongDung' },
    stack: 99,
  },
  huyetLinhChi: {
    id: 'huyetLinhChi',
    name: 'Huyết Linh chi',
    kind: 'linhThao',
    desc: 'Nấm linh mọc nơi có yêu khí. Nguyên liệu của Bích Linh Đan.',
    color: Palette.maHuyet,
    tier: 2,
    use: { type: 'khongDung' },
    stack: 99,
  },
  tinhNguyetHoa: {
    id: 'tinhNguyetHoa',
    name: 'Tinh Nguyệt hoa',
    kind: 'linhThao',
    desc: 'Hoa nở dưới trăng, chứa linh khí thuần khiết. Cần cho Trúc Cơ Đan.',
    color: Palette.than_thuc,
    tier: 3,
    use: { type: 'khongDung' },
    stack: 99,
  },
  camLinhCan: {
    id: 'camLinhCan',
    name: 'Cẩm Linh căn',
    kind: 'linhThao',
    desc: 'Rễ linh mộc trăm năm. Nguyên liệu cốt lõi của Ngưng Đan.',
    color: Palette.kim,
    tier: 4,
    use: { type: 'khongDung' },
    stack: 99,
  },

  // ---------- Vật liệu ----------
  yeuDan: {
    id: 'yeuDan',
    name: 'Yêu đan',
    kind: 'vatLieu',
    desc: 'Nội đan của yêu thú. Vừa luyện đan được, vừa hấp thu tăng Tu Vi.',
    color: Palette.doc,
    tier: 2,
    use: { type: 'tuVi', amount: 90 },
    stack: 99,
  },

  // ---------- Đan dược ----------
  hoiKhiDan: {
    id: 'hoiKhiDan',
    name: 'Hồi Khí Đan',
    kind: 'danDuoc',
    desc: 'Hồi phục linh lực tức thì.',
    color: Palette.thuy,
    tier: 1,
    use: { type: 'hoiLinhLuc', amount: 60 },
    stack: 20,
  },
  bichLinhDan: {
    id: 'bichLinhDan',
    name: 'Bích Linh Đan',
    kind: 'danDuoc',
    desc: 'Hồi phục sinh lực, chữa được cả nội thương.',
    color: Palette.moc,
    tier: 2,
    use: { type: 'hoiSinhLuc', amount: 120 },
    stack: 20,
  },
  tuViDan: {
    id: 'tuViDan',
    name: 'Tụ Khí Đan',
    kind: 'danDuoc',
    desc: 'Tăng Tu Vi trực tiếp. Cách nhanh nhất để qua bình cảnh Luyện Khí.',
    color: Palette.linhDam,
    tier: 2,
    // 900 chứ không 180: ba tầng bình cảnh cuối Luyện Khí cần 1962/2787/3957 Tu
    // Vi, nên ở 180 thì phải hơn hai chục viên cho MỘT tầng — và đan dược không
    // còn là câu trả lời cho bình cảnh, chỉ là một thứ nhặt được rồi quên.
    use: { type: 'tuVi', amount: 900 },
    stack: 20,
  },
  trucCoDan: {
    id: 'trucCoDan',
    name: 'Trúc Cơ Đan',
    kind: 'danDuoc',
    desc: 'Đan dược duy nhất mở được cửa Trúc Cơ. Không có nó thì Luyện Khí là tận cùng.',
    color: Palette.kim,
    tier: 4,
    use: { type: 'dotPha', toMajor: 2 },
    stack: 10,
  },
  ngungDan: {
    id: 'ngungDan',
    name: 'Ngưng Đan',
    kind: 'danDuoc',
    desc: 'Kết tụ kim đan trong đan điền, mở cửa Kết Đan kỳ.',
    color: Palette.hoa,
    tier: 5,
    use: { type: 'dotPha', toMajor: 3 },
    stack: 10,
  },
}

export type ItemId = keyof typeof ITEMS

export function itemDef(id: string): ItemDef {
  const def = ITEMS[id]
  if (!def) throw new Error(`Không có vật phẩm với id "${id}"`)
  return def
}

/** Màu viền theo bậc phẩm — người chơi nhận ra đồ tốt bằng màu, không cần đọc. */
export const TIER_COLORS: readonly number[] = [
  0x8d8d8d, // 0 không dùng
  0xb9c0c8, // 1 phàm phẩm
  0x6fae8f, // 2 hạ phẩm
  0x5b8fc7, // 3 trung phẩm
  0xd9b154, // 4 thượng phẩm
  0xb06fd0, // 5 cực phẩm
]
