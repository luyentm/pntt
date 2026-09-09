import { Palette } from '@/art/Palette'
import { REALM, type RealmPosition } from './realms'
import type { BaseStats } from '../Stats'

/** Chỉ số nền của Hàn Lập. Stat thật được nhân theo cảnh giới trong `deriveStats`. */
export const HAN_LAP_BASE: BaseStats = {
  sinhLuc: 55,
  linhLuc: 30,
  cong: 6.2,
  phong: 2.6,
  thanThuc: 5,
  toc: 4.3,
  bao: 0.08,
  baoMult: 1.75,
  // Hàn Lập trong truyện là ngũ hành thuộc Mộc (Trường Xuân Công là mộc thuộc tính)
  element: 'moc',
}

/** Cảnh giới lúc bắt đầu: vừa nhập môn Thất Huyền Môn. */
export const START_REALM: RealmPosition = { major: REALM.LUYEN_KHI, tier: 0 }

export interface AttackStep {
  /** Từ lúc bấm tới frame gây sát thương. */
  readonly windup: number
  /** Thời gian hồi sau frame gây sát thương. */
  readonly recover: number
  readonly mult: number
  /** Nửa góc hình quạt (radian). */
  readonly arc: number
  readonly range: number
  readonly knockback: number
  readonly stagger: number
  /** Còn bao nhiêu phần tốc độ di chuyển trong lúc ra đòn. */
  readonly moveScale: number
}

/**
 * Combo 3 nhát của Thanh Nguyên Kiếm Quyết.
 *
 * Nhát cuối cố tình CHẬM và MẠNH: đó là thứ tạo nhịp cho combat — người chơi
 * phải chọn giữa an toàn (dừng ở nhát 2) và sát thương (dốc vào nhát 3 rồi hở
 * sườn). Ba nhát giống nhau thì chỉ còn là bấm chuột liên tục.
 */
export const ATTACK_STEPS: readonly AttackStep[] = [
  { windup: 0.1, recover: 0.2, mult: 1, arc: 0.85, range: 1.45, knockback: 2.4, stagger: 0.16, moveScale: 0.38 },
  { windup: 0.09, recover: 0.19, mult: 1.15, arc: 0.92, range: 1.45, knockback: 2.8, stagger: 0.18, moveScale: 0.38 },
  { windup: 0.15, recover: 0.36, mult: 1.9, arc: 1.05, range: 1.8, knockback: 6.2, stagger: 0.34, moveScale: 0.12 },
]

/** Sau frame gây sát thương, còn bấy nhiêu giây để bấm nối nhát tiếp theo. */
export const COMBO_CHAIN_WINDOW = 0.42

/**
 * Bộ màu của Hàn Lập, cho những chỗ CHỈ CẦN MÀU chứ không dựng lại hình.
 *
 * Hình của hắn nằm ở `art/characters/HanLap.ts` và có bảng màu riêng trong đó.
 * Bảng này còn lại để dùng cho hào quang, vệt và mọi thứ muốn ăn theo tông của
 * nhân vật mà không phải mở file dựng hình ra chép.
 */
export const HAN_LAP_LOOK = {
  robe: Palette.aoHanLap,
  robeDark: Palette.aoHanLapDam,
  trim: Palette.vienLamHanLap,
  sash: Palette.daiLungHanLap,
  skin: Palette.daNguoi,
  hair: Palette.tocHanLap,
  boot: Palette.hiaHanLap,
  eye: Palette.mat,
} as const
