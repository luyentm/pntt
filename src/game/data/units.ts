import type { BeastShape } from '@/art/buildBeast'
import { Palette } from '@/art/Palette'
import type { ProjectileSpec } from '@/world/Projectile'
import { REALM, type RealmPosition } from './realms'
import type { EffectKind } from '../Effects'
import type { BaseStats } from '../Stats'

/** Phần tạo hình — quyết định dùng rig thú hay rig người. */
export type UnitLook =
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

/**
 * Một phase của tướng.
 *
 * Phase là HỆ SỐ NHÂN chồng lên chính máy trạng thái đã có, không phải một AI
 * thứ hai. Nhờ vậy "boss vào phase 2 thì hăng hơn" không cần thêm nhánh nào vào
 * Agent — chỉ là những con số khác nhân vào cùng một hành vi.
 */
export interface BossPhase {
  /** Vào phase khi sinh lực còn ≤ tỉ lệ này (1 = ngay từ đầu). */
  readonly atHp: number
  readonly name: string
  readonly speedMult: number
  /** Nhân vào giãn cách giữa hai đòn. Nhỏ hơn 1 = đánh dồn hơn. */
  readonly cooldownMult: number
  readonly damageMult: number
  /** Vào phase thì gọi thêm tay sai. */
  readonly summon?: { readonly id: string; readonly count: number }
  /** Đòn quét vòng quanh mình, phát theo nhịp suốt phase. */
  readonly slam?: {
    readonly radius: number
    readonly mult: number
    readonly interval: number
    readonly knockback: number
  }
}

export interface BossDef {
  /** Danh hiệu hiện trên thanh máu tướng. */
  readonly title: string
  /** Xếp từ phase đầu (atHp cao) xuống phase cuối. */
  readonly phases: readonly BossPhase[]
}

export interface UnitDef {
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
  readonly look: UnitLook
  /** Trạng thái gắn vào đòn đánh của nó (độc, thiêu đốt, làm chậm...). */
  readonly attackEffect?: { readonly kind: EffectKind; readonly duration: number; readonly magnitude: number }
  /**
   * Có thì đơn vị đánh XA bằng phi hành khí thay vì đòn cận chiến.
   * `attackRange` vẫn là khoảng cách nó muốn đứng, nên caster giữ khoảng còn
   * đơn vị cận chiến áp sát — cùng một mã theo dõi mục tiêu.
   */
  readonly ranged?: { readonly spec: ProjectileSpec }
  /** Có thì đây là tướng: thanh máu lớn, nhiều phase. */
  readonly boss?: BossDef
}

/**
 * Bảng đơn vị: quái, ma đạo, đồng môn, tướng.
 *
 * Cùng một bảng cho cả địch và bạn vì chúng dùng cùng một máy trạng thái
 * (`Agent`) — phe được quyết định lúc SINH, không phải trong dữ liệu. Nhờ vậy
 * cùng một `deTu` có thể là đồng môn ở màn này và địch ở màn sau, không phải
 * khai báo hai lần.
 *
 * Thêm loài mới = thêm một entry ở đây, không sửa hệ thống nào.
 *
 * Chỉ số nền cố tình để thấp: sát thương và sinh lực thực tế được nhân theo
 * `realm` trong `deriveStats`, nên cân bằng chỉ cần chỉnh cảnh giới của quái.
 */
export const UNITS: Record<string, UnitDef> = {
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

  /** Đệ tử Thất Huyền Môn — đồng môn AI, sinh ra ở phe 'ally'. */
  deTu: {
    id: 'deTu',
    name: 'Đệ tử Thất Huyền Môn',
    realm: { major: REALM.LUYEN_KHI, tier: 4 },
    base: {
      sinhLuc: 48,
      linhLuc: 20,
      cong: 5,
      phong: 2.6,
      thanThuc: 6,
      toc: 4.4,
      bao: 0.07,
      baoMult: 1.6,
      element: 'kim',
    },
    scale: 0.96,
    aggroRange: 16,
    attackRange: 1.3,
    attackArc: 0.8,
    attackMult: 1.05,
    attackWindup: 0.19,
    attackRecover: 0.36,
    attackCooldown: 1.1,
    knockback: 2,
    circleDistance: 0,
    look: {
      rig: 'chibi',
      robe: Palette.aoDeTu,
      robeDark: Palette.aoDeTuDam,
      trim: Palette.vienAo,
      sash: Palette.daiLung,
      skin: Palette.daNguoi,
      hair: Palette.toc,
      boot: 0x3b3f46,
      eye: Palette.mat,
    },
  },

  /** Độc Thù — nhả độc, sát thương theo thời gian thay vì đánh mạnh. */
  docThu: {
    id: 'docThu',
    name: 'Độc Thù',
    realm: { major: REALM.LUYEN_KHI, tier: 2 },
    base: {
      sinhLuc: 30,
      linhLuc: 0,
      cong: 2.6,
      phong: 1.4,
      thanThuc: 3,
      toc: 4.6,
      bao: 0.03,
      baoMult: 1.4,
      element: 'moc',
    },
    scale: 0.66,
    aggroRange: 14,
    attackRange: 1.1,
    attackArc: 0.7,
    // Đòn yếu, cái đau nằm ở vết độc: buộc người chơi phải rút ra chứ không
    // đứng đổi đòn, mà không cần cho nó sát thương tức thì cao
    attackMult: 0.55,
    attackWindup: 0.14,
    attackRecover: 0.3,
    attackCooldown: 1,
    knockback: 1,
    circleDistance: 2.2,
    attackEffect: { kind: 'trungDoc', duration: 5, magnitude: 3 },
    look: {
      rig: 'beast',
      shape: 'rat',
      fur: 0x53663a,
      furDark: 0x36452a,
      belly: 0x8fbf4a,
      eye: Palette.doc,
      nose: 0x232b1c,
    },
  },

  /** Thiết Giáp Thi — thi thể luyện của ma đạo: chậm, dày, đẩy lùi rất mạnh. */
  thietGiapThi: {
    id: 'thietGiapThi',
    name: 'Thiết Giáp Thi',
    realm: { major: REALM.LUYEN_KHI, tier: 7 },
    base: {
      sinhLuc: 140,
      linhLuc: 0,
      cong: 7.4,
      phong: 9,
      thanThuc: 1,
      toc: 2.3,
      bao: 0.02,
      baoMult: 1.5,
      element: 'tho',
    },
    scale: 1.16,
    aggroRange: 15,
    attackRange: 1.5,
    attackArc: 0.9,
    attackMult: 1.5,
    // Lấy đà rất lâu: đây là con quái DẠY người chơi né. Đòn nó đau nhưng báo
    // trước gần nửa giây, nên ăn đòn là do đứng sai chỗ chứ không do bất công.
    attackWindup: 0.46,
    attackRecover: 0.55,
    attackCooldown: 1.9,
    knockback: 6,
    circleDistance: 0,
    look: {
      rig: 'chibi',
      robe: 0x4a4f55,
      robeDark: 0x2c3034,
      trim: 0x6e7580,
      sash: 0x2a2226,
      skin: 0x9fae9a,
      hair: 0x1a1b1d,
      boot: 0x22252a,
      eye: Palette.doc,
    },
  },

  /** Ma đạo tán tu — pháp sư đánh xa, buộc người chơi phải áp sát. */
  maDaoTanTu: {
    id: 'maDaoTanTu',
    name: 'Ma đạo tán tu',
    realm: { major: REALM.LUYEN_KHI, tier: 6 },
    base: {
      sinhLuc: 52,
      linhLuc: 40,
      cong: 6.6,
      phong: 2,
      thanThuc: 9,
      toc: 3.9,
      bao: 0.06,
      baoMult: 1.6,
      element: 'hoa',
    },
    scale: 0.98,
    aggroRange: 22,
    // Đứng xa mà bắn: `attackRange` là khoảng nó MUỐN giữ, nên nó tự lùi khi bị
    // áp sát. Kết hợp với circleDistance thành ra nó luôn chạy vòng ngoài.
    attackRange: 8.5,
    attackArc: 0.5,
    attackMult: 1,
    attackWindup: 0.5,
    attackRecover: 0.4,
    attackCooldown: 2.4,
    knockback: 1.8,
    circleDistance: 9,
    ranged: {
      spec: {
        look: 'phuLuc',
        behavior: 'thang',
        speed: 10,
        radius: 0.42,
        scale: 0.8,
        lifetime: 2.4,
        mult: 1.1,
        knockback: 2,
        stagger: 0.18,
        pierce: 1,
        element: 'hoa',
        onHit: { kind: 'thieuDot', duration: 3, magnitude: 3 },
      },
    },
    look: {
      rig: 'chibi',
      robe: Palette.aoMaDao,
      robeDark: Palette.aoMaDaoDam,
      trim: Palette.maHuyet,
      sash: 0x1d1420,
      skin: 0xd8bfa0,
      hair: 0x14121a,
      boot: 0x1a1620,
      eye: Palette.maHuyet,
    },
  },

  /**
   * Ma Đạo Trúc Cơ — tướng nhỏ, TỒN TẠI ĐỂ DẠY LUẬT CHÊNH CẢNH GIỚI.
   *
   * Ở Trúc Cơ nên người chơi còn Luyện Khí sẽ đánh nó chỉ còn ~3,5% sát thương:
   * cả một hồi cày cũng không hạ nổi. Đó là bài học của cả bản demo, và nó phải
   * được dạy bằng cách CHO GẶP một lần chứ không bằng một dòng chữ giải thích.
   */
  maDaoTrucCo: {
    id: 'maDaoTrucCo',
    name: 'Ma Đạo Trúc Cơ',
    realm: { major: REALM.TRUC_CO, tier: 0 },
    base: {
      sinhLuc: 60,
      linhLuc: 60,
      cong: 5.2,
      phong: 3.4,
      thanThuc: 8,
      toc: 4.6,
      bao: 0.1,
      baoMult: 1.8,
      element: 'thuy',
    },
    scale: 1.2,
    aggroRange: 24,
    attackRange: 1.9,
    attackArc: 0.85,
    attackMult: 1.2,
    attackWindup: 0.3,
    attackRecover: 0.4,
    attackCooldown: 1.5,
    knockback: 4.5,
    circleDistance: 3.6,
    look: {
      rig: 'chibi',
      robe: 0x3a2f52,
      robeDark: 0x241d33,
      trim: Palette.than_thuc,
      sash: Palette.maHuyet,
      skin: 0xd4b795,
      hair: 0x121018,
      boot: 0x1b1725,
      eye: Palette.than_thuc,
    },
    boss: {
      title: 'Ma Đạo Trúc Cơ kỳ',
      phases: [
        { atHp: 1, name: 'Thăm dò', speedMult: 1, cooldownMult: 1, damageMult: 1 },
        {
          atHp: 0.5,
          name: 'Động nộ',
          speedMult: 1.22,
          cooldownMult: 0.72,
          damageMult: 1.15,
          slam: { radius: 3.4, mult: 1.1, interval: 4.5, knockback: 5 },
        },
      ],
    },
  },

  /**
   * Mặc Đại Phu — tướng chính, dạng đoạt xá.
   *
   * Ba phase: đánh thường → gọi Thiết Giáp Thi → quét vòng liên tục. Mỗi phase
   * đổi CÁCH đánh chứ không chỉ đổi con số, nên người chơi phải đổi cách chơi
   * theo, không phải chỉ đứng chịu lâu hơn.
   */
  macDaiPhu: {
    id: 'macDaiPhu',
    name: 'Mặc Đại Phu',
    realm: { major: REALM.TRUC_CO, tier: 2 },
    base: {
      sinhLuc: 150,
      linhLuc: 120,
      cong: 6.4,
      phong: 4.2,
      thanThuc: 12,
      toc: 4.2,
      bao: 0.12,
      baoMult: 1.9,
      element: 'moc',
    },
    scale: 1.26,
    aggroRange: 28,
    attackRange: 2.1,
    attackArc: 0.95,
    attackMult: 1.25,
    attackWindup: 0.32,
    attackRecover: 0.42,
    attackCooldown: 1.4,
    knockback: 5,
    circleDistance: 3,
    attackEffect: { kind: 'chamLai', duration: 2.5, magnitude: 0.35 },
    look: {
      rig: 'chibi',
      robe: 0x2f2a3a,
      robeDark: 0x1a1722,
      trim: 0x9a7f4a,
      sash: Palette.maHuyet,
      skin: 0xc9b79c,
      hair: 0xe8e2d0,
      boot: 0x17141c,
      eye: Palette.doc,
    },
    boss: {
      title: 'Mặc Đại Phu — Trúc Cơ hậu kỳ',
      phases: [
        { atHp: 1, name: 'Đoạt xá', speedMult: 1, cooldownMult: 1, damageMult: 1 },
        {
          atHp: 0.66,
          name: 'Khu thi',
          speedMult: 1.1,
          cooldownMult: 0.85,
          damageMult: 1.1,
          summon: { id: 'thietGiapThi', count: 2 },
        },
        {
          atHp: 0.3,
          name: 'Huyết sát',
          speedMult: 1.3,
          cooldownMult: 0.62,
          damageMult: 1.25,
          summon: { id: 'maDaoTanTu', count: 2 },
          slam: { radius: 4.2, mult: 1.3, interval: 3.6, knockback: 6.5 },
        },
      ],
    },
  },
}

export type UnitId = keyof typeof UNITS

export function unitDef(id: string): UnitDef {
  const def = UNITS[id]
  if (!def) throw new Error(`Không có đơn vị với id "${id}"`)
  return def
}
