import type { BeastShape } from '@/art/buildBeast'
import { Palette } from '@/art/Palette'
import { REALM, type RealmPosition } from './realms'
import type { BaseStats } from '../Stats'

/** Phần tạo hình — quyết định dùng rig thú hay rig người. */
export type EnemyLook =
  | {
      rig: 'beast'
      shape: BeastShape
      fur: number
      furDark: number
      belly: number
      eye: number
      nose: number
    }
  | {
      rig: 'chibi'
      robe: number
      robeDark: number
      trim: number
      sash: number
      skin: number
      hair: number
      boot: number
      eye: number
    }

export interface EnemyDef {
  readonly id: string
  readonly name: string
  readonly realm: RealmPosition
  readonly base: BaseStats
  /** Tỉ lệ dựng model. */
  readonly scale: number
  /** Tầm phát hiện người chơi. */
  readonly aggroRange: number
  /** Khoảng cách bắt đầu ra đòn. */
  readonly attackRange: number
  /** Nửa góc hình quạt của đòn đánh (radian). */
  readonly attackArc: number
  readonly attackMult: number
  /** Từ lúc bắt đầu đòn tới frame gây sát thương. */
  readonly attackWindup: number
  /** Thời gian hồi sau frame gây sát thương. */
  readonly attackRecover: number
  /** Giãn cách tối thiểu giữa hai đòn. */
  readonly attackCooldown: number
  /** Đẩy lùi con này gây ra. */
  readonly knockback: number
  /** Khoảng cách nó muốn giữ khi vờn quanh mục tiêu (0 = áp sát thẳng). */
  readonly circleDistance: number
  readonly look: EnemyLook
}

/**
 * Bảng quái. Thêm loài mới = thêm một entry ở đây, không sửa hệ thống nào.
 *
 * Chỉ số nền cố tình để thấp: sát thương và sinh lực thực tế được nhân theo
 * `realm` trong `deriveStats`, nên cân bằng chỉ cần chỉnh cảnh giới của quái.
 */
export const ENEMIES: Record<string, EnemyDef> = {
  /** Yêu Thử — chuột yêu, yếu nhưng đi theo bầy. Quái đầu tiên người chơi gặp. */
  yeuThu: {
    id: 'yeuThu',
    name: 'Yêu Thử',
    realm: { major: REALM.LUYEN_KHI, tier: 0 },
    base: {
      sinhLuc: 26,
      linhLuc: 0,
      cong: 3.4,
      phong: 1.2,
      thanThuc: 2,
      toc: 3.6,
      bao: 0.04,
      baoMult: 1.5,
      element: 'tho',
    },
    scale: 0.52,
    aggroRange: 13,
    attackRange: 1.0,
    attackArc: 0.75,
    attackMult: 1,
    attackWindup: 0.16,
    attackRecover: 0.34,
    attackCooldown: 0.9,
    knockback: 1.4,
    circleDistance: 0,
    look: {
      rig: 'beast',
      shape: 'rat',
      fur: 0x6b6257,
      furDark: 0x4a433a,
      belly: 0xc0a98f,
      eye: Palette.maHuyet,
      nose: 0x2a2320,
    },
  },

  /** Hắc Lang — sói đen, nhanh, biết vờn quanh rồi mới vồ. */
  hacLang: {
    id: 'hacLang',
    name: 'Hắc Lang',
    realm: { major: REALM.LUYEN_KHI, tier: 3 },
    base: {
      sinhLuc: 42,
      linhLuc: 0,
      cong: 5.2,
      phong: 2.2,
      thanThuc: 4,
      toc: 5.2,
      bao: 0.09,
      baoMult: 1.7,
      element: 'kim',
    },
    scale: 1.02,
    aggroRange: 18,
    attackRange: 1.7,
    attackArc: 0.7,
    attackMult: 1.15,
    attackWindup: 0.2,
    attackRecover: 0.42,
    attackCooldown: 1.35,
    knockback: 3.2,
    // Vờn quanh trước khi vồ: làm con sói khác hẳn con chuột chỉ biết lao vào
    circleDistance: 3.4,
    look: {
      rig: 'beast',
      shape: 'wolf',
      fur: 0x2f2b33,
      furDark: 0x1b191f,
      belly: 0x4a4550,
      eye: 0xd8452f,
      nose: 0x141216,
    },
  },
}

export type EnemyId = keyof typeof ENEMIES

export function enemyDef(id: string): EnemyDef {
  const def = ENEMIES[id]
  if (!def) throw new Error(`Không có quái với id "${id}"`)
  return def
}
