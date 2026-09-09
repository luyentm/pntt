import type { EffectKind } from '../Effects'
import type { Element } from '../Stats'
import type { ProjectileSpec } from '@/world/Projectile'
import { REALM, type RealmPosition } from './realms'

export type SkillAction =
  | { type: 'phiHanh'; spec: ProjectileSpec }
  | {
      type: 'phapVuc'
      /** Bán kính vùng ảnh hưởng. */
      radius: number
      mult: number
      element: Element
      /** Đặt tại con trỏ chuột thay vì tại chỗ người thi triển. */
      atCursor: boolean
      /** Tầm đặt tối đa tính từ người thi triển. */
      castRange: number
      knockback: number
      stagger: number
      onHit?: { kind: EffectKind; duration: number; magnitude: number }
    }
  | {
      type: 'hoTro'
      kind: EffectKind
      duration: number
      /** Nhân với Thần Thức để ra độ mạnh — pháp thuật phải lên theo cảnh giới. */
      magnitudeFromThanThuc: number
    }
  | { type: 'thanPhap'; distance: number; duration: number }
  | {
      /** Vũ kiếm: một đàn kiếm bay vây quét quanh người thi triển. */
      type: 'kiemVu'
      /** Bán kính vòng quét lớn nhất. */
      radius: number
      /** Hệ số sát thương MỖI LẦN quét trúng, không phải tổng. */
      mult: number
      duration: number
      knockback: number
      stagger: number
    }

export interface SkillDef {
  readonly id: string
  readonly name: string
  readonly desc: string
  /** Ký tự hiển thị trên thanh pháp thuật. */
  readonly glyph: string
  readonly requiredRealm: RealmPosition
  readonly linhLucCost: number
  readonly cooldown: number
  /** Thời gian dẫn khí trước khi chiêu phát ra. */
  readonly castTime: number
  /** Thời gian hồi sau khi chiêu phát ra. */
  readonly recover: number
  /** Còn bao nhiêu phần tốc độ di chuyển trong lúc thi triển. */
  readonly moveScale: number
  readonly element: Element
  readonly action: SkillAction
}

const LK = REALM.LUYEN_KHI

/**
 * Bảng pháp thuật. Thêm chiêu = thêm một entry, không sửa hệ thống nào.
 *
 * Thứ tự trong mảng là thứ tự ô 1..6 trên thanh pháp thuật.
 * `requiredRealm` là cổng mở: người chơi phải đột phá mới dùng được — đó là
 * phần thưởng cụ thể của việc tu luyện, không chỉ là con số stat tăng.
 */
export const SKILLS: readonly SkillDef[] = [
  {
    id: 'nguKiem',
    name: 'Ngự Kiếm Thuật',
    desc: 'Phóng phi kiếm bay xuyên qua địch rồi quay về. Hệ Kim.',
    glyph: '劍',
    requiredRealm: { major: LK, tier: 0 },
    linhLucCost: 7,
    cooldown: 2.6,
    castTime: 0.16,
    recover: 0.2,
    moveScale: 0.55,
    element: 'kim',
    action: {
      type: 'phiHanh',
      spec: {
        look: 'kiem',
        behavior: 'hoiKiem',
        speed: 15,
        radius: 0.42,
        scale: 0.85,
        lifetime: 3.2,
        mult: 1.45,
        knockback: 2,
        stagger: 0.14,
        // Xuyên nhiều vì nó còn quay về: một đường bay trúng được cả hàng
        pierce: 4,
        element: 'kim',
        outRange: 9.5,
      },
    },
  },
  {
    id: 'phongDon',
    name: 'Phong Độn Thuật',
    desc: 'Lướt nhanh theo hướng ngắm, trong lúc lướt không bị trúng đòn.',
    glyph: '風',
    requiredRealm: { major: LK, tier: 1 },
    linhLucCost: 5,
    cooldown: 4.2,
    castTime: 0.02,
    recover: 0.12,
    moveScale: 0,
    element: 'vo',
    action: { type: 'thanPhap', distance: 5.4, duration: 0.2 },
  },
  {
    id: 'hoaCau',
    name: 'Hoả Cầu Thuật',
    desc: 'Bắn cầu lửa, nổ lan và gây thiêu đốt. Hệ Hoả.',
    glyph: '火',
    requiredRealm: { major: LK, tier: 2 },
    linhLucCost: 11,
    cooldown: 4,
    castTime: 0.28,
    recover: 0.24,
    moveScale: 0.32,
    element: 'hoa',
    action: {
      type: 'phiHanh',
      spec: {
        look: 'hoaCau',
        behavior: 'thang',
        speed: 11,
        radius: 0.5,
        scale: 0.72,
        lifetime: 2.2,
        mult: 1.1,
        knockback: 2.4,
        stagger: 0.2,
        pierce: 1,
        element: 'hoa',
        explodeRadius: 2.5,
        explodeMult: 1.6,
        onHit: { kind: 'thieuDot', duration: 4, magnitude: 4 },
      },
    },
  },
  {
    id: 'kimQuangThuan',
    name: 'Kim Quang Thuẫn',
    desc: 'Dựng khiên kim quang hấp thụ sát thương. Mạnh theo Thần Thức.',
    glyph: '盾',
    requiredRealm: { major: LK, tier: 4 },
    linhLucCost: 14,
    cooldown: 11,
    castTime: 0.22,
    recover: 0.18,
    moveScale: 0.6,
    element: 'kim',
    action: { type: 'hoTro', kind: 'khien', duration: 8, magnitudeFromThanThuc: 5.5 },
  },
  {
    id: 'thienLoiPhu',
    name: 'Thiên Lôi Phù',
    desc: 'Giáng sấm xuống chỗ ngắm, sát thương lớn và gây choáng nặng.',
    glyph: '雷',
    requiredRealm: { major: LK, tier: 6 },
    linhLucCost: 17,
    cooldown: 7.5,
    castTime: 0.34,
    recover: 0.3,
    moveScale: 0.18,
    element: 'kim',
    action: {
      type: 'phapVuc',
      radius: 2.4,
      mult: 2.3,
      element: 'kim',
      atCursor: true,
      castRange: 11,
      knockback: 4.5,
      stagger: 0.7,
    },
  },
  {
    id: 'bangPhongPhu',
    name: 'Băng Phong Phù',
    desc: 'Đóng băng một vùng, địch trong đó bất động rồi bị làm chậm. Hệ Thuỷ.',
    glyph: '冰',
    requiredRealm: { major: LK, tier: 8 },
    linhLucCost: 13,
    cooldown: 9.5,
    castTime: 0.3,
    recover: 0.26,
    moveScale: 0.28,
    element: 'thuy',
    action: {
      type: 'phapVuc',
      radius: 3.1,
      mult: 0.7,
      element: 'thuy',
      atCursor: true,
      castRange: 10,
      knockback: 0,
      stagger: 0,
      onHit: { kind: 'dongBang', duration: 1.6, magnitude: 0 },
    },
  },
  {
    id: 'thanhTrucPhongVan',
    name: 'Thanh Trúc Phong Vân Kiếm',
    desc: '33 thanh kiếm trúc bay vây quét quanh người. Bản mệnh pháp khí Kết Đan. Hệ Mộc.',
    glyph: '竹',
    requiredRealm: { major: REALM.KET_DAN, tier: 0 },
    linhLucCost: 60,
    cooldown: 22,
    castTime: 0.6,
    recover: 0.4,
    // Còn đi được nửa tốc trong lúc kiếm quay: đây là chiêu giữ vòng, nếu đứng
    // yên thì vòng quét không bao giờ đuổi được con quái đang chạy ra ngoài
    moveScale: 0.5,
    element: 'moc',
    action: {
      type: 'kiemVu',
      // Vòng kiếm CHẶT quanh người, không phải một vụ nổ diện rộng: người chơi
      // vừa đi vừa lái đàn kiếm vào giữa đám quái suốt 5 giây.
      radius: 3,
      // 0.55 mỗi nhịp, nhịp 0.3 giây: mục tiêu đứng trong vòng suốt chiêu ăn
      // khoảng 8 lần hệ số công. Đắt (60 linh lực, hồi 22 giây) nên xứng, mà
      // vẫn không xoá sạch mọi thứ trong một lần bấm.
      mult: 0.55,
      duration: 5,
      knockback: 1.2,
      stagger: 0.1,
    },
  },
]

export function skillDef(id: string): SkillDef {
  const def = SKILLS.find((s) => s.id === id)
  if (!def) throw new Error(`Không có pháp thuật với id "${id}"`)
  return def
}
