import type { EffectKind } from '../Effects'
import type { Element } from '../Stats'
import type { ProjectileSpec } from '@/world/Projectile'
import { REALM, realmOrdinal, type RealmPosition } from './realms'

/**
 * Hạng của thứ dùng để thi triển.
 *
 * Có mặt vì Luyện Kiếm Đài phải nói được "chiêu này ra từ CÁI GÌ": trong Phàm
 * Nhân, khoảng cách giữa một đạo phù lục dùng một lần và một bản mệnh pháp bảo
 * luyện hai mươi mốt năm là cả một đời người — mà nếu chỉ hiện tên chiêu thì hai
 * thứ đó đọc ra y như nhau.
 */
export type PhapBaoRank =
  /** Không cần vật gì, thuần pháp lực. */
  | 'khong'
  /** Công pháp — thứ tu luyện trong người, không cầm được. */
  | 'congPhap'
  /** Phù lục, dùng một lần. */
  | 'phuLuc'
  /** Pháp khí — vũ khí của Luyện Khí, Trúc Cơ. */
  | 'phapKhi'
  /** Pháp bảo — vũ khí của Kết Đan trở lên. */
  | 'phapBao'
  /** Bản mệnh pháp bảo — luyện bằng tinh huyết, hợp nhất với thần thức. */
  | 'banMenh'
  /** Linh trùng, linh thú. */
  | 'linhTrung'
  /** Trận pháp, trận kỳ. */
  | 'tranPhap'

export const PHAP_BAO_RANK_LABEL: Record<PhapBaoRank, string> = {
  khong: 'thuần pháp lực',
  congPhap: 'công pháp',
  phuLuc: 'phù lục',
  phapKhi: 'pháp khí',
  phapBao: 'pháp bảo',
  banMenh: 'bản mệnh pháp bảo',
  linhTrung: 'linh trùng',
  tranPhap: 'trận pháp',
}

export interface PhapBao {
  /** Tên gọi trong truyện. */
  readonly ten: string
  readonly hang: PhapBaoRank
  /** Một câu về vật đó — chất liệu, xuất xứ, hoặc điều làm nó đặc biệt. */
  readonly note: string
}

/** Vai trò trên chiến trường. Dùng để lọc và tô màu trong Đồ Giám. */
export type SkillRole = 'congKich' | 'khongChe' | 'hoTro' | 'thanPhap'

export const SKILL_ROLE_LABEL: Record<SkillRole, string> = {
  congKich: 'công kích',
  khongChe: 'khống chế',
  hoTro: 'hỗ trợ',
  thanPhap: 'thân pháp',
}

/**
 * Trạng thái áp lên mục tiêu khi trúng.
 *
 * `magnitudeFromCong` cộng `cong × hệ số này` vào độ mạnh. Cần cho sát thương
 * theo thời gian của CHIÊU NGƯỜI CHƠI: một con số cố định cân được ở Trúc Cơ
 * thì tới Kết Đan (công gấp bốn) không còn nhích nổi thanh máu. Cùng lý do mà
 * khiên suy từ Thần Thức.
 */
export interface SkillOnHit {
  readonly kind: EffectKind
  readonly duration: number
  readonly magnitude: number
  readonly magnitudeFromCong?: number
}

/** Bắn một LOẠT nhiều viên cùng lúc thay vì một viên. */
export interface Volley {
  readonly count: number
  /** Tổng bề rộng của quạt bắn, radian. Chia đều cho các viên. */
  readonly spread: number
}

export type SkillAction =
  | {
      type: 'phiHanh'
      spec: ProjectileSpec
      /** Có thì bắn cả loạt. Bỏ trống là một viên. */
      volley?: Volley
    }
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
      /**
       * Lực hất, tính TỪ TÂM VÙNG ra.
       *
       * Số ÂM là HÚT VÀO TÂM — đó là cách Nguyên Từ Thần Quang tồn tại mà không
       * cần một loại action riêng. Lấy tâm vùng làm gốc chứ không lấy người thi
       * triển: pháp vực đặt tại con trỏ thì "đẩy ra xa người thi triển" là sai
       * hướng, nó phải đẩy ra xa chỗ chiêu NỔ.
       */
      knockback: number
      stagger: number
      /** Số lần vùng bùng lên. Bỏ trống là một lần. */
      pulses?: number
      /** Giãn cách giữa hai lần bùng, giây. */
      pulseInterval?: number
      onHit?: SkillOnHit
    }
  | {
      type: 'hoTro'
      kind: EffectKind
      duration: number
      /** Nhân với Thần Thức để ra độ mạnh — pháp thuật phải lên theo cảnh giới. */
      magnitudeFromThanThuc?: number
      /**
       * Độ mạnh CỐ ĐỊNH, dùng khi con số là một TỈ LỆ chứ không phải một lượng.
       *
       * Giá Y Thần Công cộng 60% sát thương; suy tỉ lệ đó từ Thần Thức thì tới
       * Kết Đan nó thành cộng 4000%.
       */
      magnitudeFlat?: number
      /**
       * Đốt sinh lực khi thi triển, theo phần của sinh lực TỐI ĐA.
       *
       * Cái giá phải là sinh lực chứ không phải linh lực: đó là điều làm Giá Y
       * Thần Công đúng với nguyên tác — nó đổi tinh huyết lấy sức mạnh, nên
       * người chơi phải cân giữa "đánh mạnh hơn" và "chết dễ hơn" ngay trong
       * một lần bấm.
       */
      sinhLucCostFrac?: number
    }
  | {
      type: 'thanPhap'
      distance: number
      duration: number
      /** Trạng thái tự áp lên mình sau cú lướt. */
      after?: { kind: EffectKind; duration: number; magnitude: number }
    }
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
      /** Khoảng cách giữa hai lần một mục tiêu bị cùng đàn kiếm chém. */
      hitInterval: number
    }

export interface SkillDef {
  readonly id: string
  /**
   * Ô cố định trên thanh pháp thuật, 0..9 (phím `1`…`9` rồi `0`).
   *
   * Nhiều chiêu được phép khai CÙNG một ô: chiêu yêu cầu cảnh giới cao hơn sẽ
   * chiếm chỗ khi mở được. Xem `game/Loadout.ts` để hiểu vì sao lại làm vậy
   * thay vì lấy thứ tự mảng — tóm tắt: để đột phá không làm trượt hết phím bấm.
   */
  readonly slot: number
  readonly name: string
  /** Tên gốc, để trong Đồ Giám cho người đọc truyện đối chiếu. */
  readonly hanTu: string
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
  readonly role: SkillRole
  /** Thi triển bằng cái gì. */
  readonly phapBao: PhapBao
  /** Hàn Lập có được nó ở đâu trong truyện. */
  readonly nguonGoc: string
  /** Bản mệnh — luyện bằng tinh huyết, mất là tổn thương gốc rễ. */
  readonly banMenh?: true
  readonly action: SkillAction
}

const LK = REALM.LUYEN_KHI
const TC = REALM.TRUC_CO
const KD = REALM.KET_DAN
const NA = REALM.NGUYEN_ANH

/**
 * Bảng pháp thuật. Thêm chiêu = thêm một entry, không sửa hệ thống nào.
 *
 * Thứ tự trong mảng là thứ tự CẢNH GIỚI, không phải thứ tự ô trên thanh pháp
 * thuật — chuyện chia ô là việc của `loadout.ts`. Trước đây hai thứ này là một,
 * nên chèn một chiêu vào giữa mảng là đổi hết phím bấm của mọi chiêu phía sau
 * và bản lưu của người chơi cũng không mang theo ô nào; giờ mọi thứ khoá theo
 * `id`, chèn ở đâu cũng được.
 *
 * `requiredRealm` là cổng mở: người chơi phải đột phá mới dùng được — đó là
 * phần thưởng cụ thể của việc tu luyện, không chỉ là một con số stat tăng.
 */
export const SKILLS: readonly SkillDef[] = [
  // ────────────────────────────── Luyện Khí kỳ ──────────────────────────────
  // Thất Huyền Môn rồi Hoàng Phong Cốc. Toàn đồ rẻ tiền: một thanh phi kiếm hạ
  // phẩm, mấy đạo phù lục mua ngoài chợ, và hai môn công pháp người khác cho.

  {
    id: 'nguKiem',
    slot: 0,
    name: 'Ngự Kiếm Thuật',
    hanTu: '御剑术',
    desc: 'Phóng phi kiếm bay xuyên qua địch rồi quay về. Hệ Kim.',
    glyph: '劍',
    requiredRealm: { major: LK, tier: 0 },
    linhLucCost: 7,
    cooldown: 2.6,
    castTime: 0.16,
    recover: 0.2,
    moveScale: 0.55,
    element: 'kim',
    role: 'congKich',
    phapBao: {
      ten: 'Phi kiếm hạ phẩm',
      hang: 'phapKhi',
      note: 'Một thanh pháp khí thường, thứ mà đệ tử Luyện Khí nào cũng có.',
    },
    nguonGoc: 'Pháp thuật nhập môn của Hoàng Phong Cốc.',
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
    slot: 1,
    name: 'Phong Độn Thuật',
    hanTu: '风遁术',
    desc: 'Lướt nhanh theo hướng ngắm, trong lúc lướt không bị trúng đòn.',
    glyph: '風',
    requiredRealm: { major: LK, tier: 1 },
    linhLucCost: 5,
    cooldown: 4.2,
    castTime: 0.02,
    recover: 0.12,
    moveScale: 0,
    element: 'vo',
    role: 'thanPhap',
    phapBao: { ten: '—', hang: 'khong', note: 'Chỉ dẫn linh lực xuống chân.' },
    nguonGoc: 'Thuật độn hạng thấp, học được ở Hoàng Phong Cốc.',
    action: { type: 'thanPhap', distance: 5.4, duration: 0.2 },
  },
  {
    id: 'hoaCau',
    slot: 2,
    name: 'Hoả Cầu Thuật',
    hanTu: '火球术',
    desc: 'Bắn cầu lửa, nổ lan và gây thiêu đốt. Hệ Hoả.',
    glyph: '火',
    requiredRealm: { major: LK, tier: 2 },
    linhLucCost: 11,
    cooldown: 4,
    castTime: 0.28,
    recover: 0.24,
    moveScale: 0.32,
    element: 'hoa',
    role: 'congKich',
    phapBao: { ten: '—', hang: 'khong', note: 'Ngưng linh lực hoả thành cầu.' },
    nguonGoc: 'Pháp thuật cấp một, phổ thông tới mức không ai coi là bản lĩnh.',
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
        // Vết thiêu suy theo công, không phải một con số chết: 4 sát thương mỗi
        // giây cân được ở Luyện Khí thì tới Kết Đan chỉ còn là tiếng gõ cửa
        onHit: { kind: 'thieuDot', duration: 4, magnitude: 4, magnitudeFromCong: 0.12 },
      },
    },
  },
  {
    id: 'kimQuangThuan',
    slot: 3,
    name: 'Kim Quang Thuẫn',
    hanTu: '金光罩',
    desc: 'Dựng khiên kim quang hấp thụ sát thương. Mạnh theo Thần Thức.',
    glyph: '盾',
    requiredRealm: { major: LK, tier: 4 },
    linhLucCost: 14,
    cooldown: 11,
    castTime: 0.22,
    recover: 0.18,
    moveScale: 0.6,
    element: 'kim',
    role: 'hoTro',
    phapBao: {
      ten: 'Hộ thân kim quang',
      hang: 'khong',
      note: 'Một lớp quang mạc dựng bằng linh lực, tan hết là hết.',
    },
    nguonGoc: 'Hộ thân thuật cơ bản của tu sĩ chính đạo.',
    action: { type: 'hoTro', kind: 'khien', duration: 8, magnitudeFromThanThuc: 5.5 },
  },
  {
    id: 'thienLoiPhu',
    slot: 4,
    name: 'Thiên Lôi Phù',
    hanTu: '天雷符',
    desc: 'Giáng sấm xuống chỗ ngắm, sát thương lớn và gây choáng nặng.',
    glyph: '雷',
    requiredRealm: { major: LK, tier: 6 },
    linhLucCost: 17,
    cooldown: 7.5,
    castTime: 0.34,
    recover: 0.3,
    moveScale: 0.18,
    element: 'kim',
    role: 'congKich',
    phapBao: {
      ten: 'Thiên Lôi Phù',
      hang: 'phuLuc',
      note: 'Phù lục dùng một lần. Đắt, nên tu sĩ nghèo chỉ dám để dành lúc nguy.',
    },
    nguonGoc: 'Mua ở phường thị. Hàn Lập luôn thủ sẵn một xấp trong túi trữ vật.',
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
    slot: 5,
    name: 'Băng Phong Phù',
    hanTu: '冰封符',
    desc: 'Đóng băng một vùng, địch trong đó bất động rồi bị làm chậm. Hệ Thuỷ.',
    glyph: '冰',
    requiredRealm: { major: LK, tier: 8 },
    linhLucCost: 13,
    cooldown: 9.5,
    castTime: 0.3,
    recover: 0.26,
    moveScale: 0.28,
    element: 'thuy',
    role: 'khongChe',
    phapBao: {
      ten: 'Băng Phong Phù',
      hang: 'phuLuc',
      note: 'Phù lục hệ Thuỷ. Không giết ai, nhưng mua được vài giây để chạy.',
    },
    nguonGoc: 'Mua ở phường thị, cùng chỗ với Thiên Lôi Phù.',
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
    id: 'giaYThanCong',
    slot: 6,
    name: 'Giá Y Thần Công',
    hanTu: '嫁衣神功',
    desc: 'Đốt tinh huyết đổi lấy sức mạnh: mất 18% sinh lực tối đa, cộng 60% sát thương trong 8 giây.',
    glyph: '嫁',
    // Mở ở hậu kỳ Luyện Khí — đúng lúc Mặc Đại Phu truyền nó trong truyện, và
    // cũng là lúc người chơi bắt đầu gặp thứ mà công thường không hạ nổi
    requiredRealm: { major: LK, tier: 9 },
    // Giá rẻ về linh lực vì cái giá thật nằm ở sinh lực
    linhLucCost: 8,
    cooldown: 26,
    castTime: 0.5,
    recover: 0.35,
    moveScale: 0.35,
    element: 'vo',
    role: 'hoTro',
    phapBao: {
      ten: 'Giá Y Thần Công',
      hang: 'congPhap',
      note: 'Tà công đốt tinh huyết. Mạnh tức thì, và rút ngắn thọ nguyên.',
    },
    nguonGoc: 'Mặc Đại Phu truyền cho Hàn Lập, kèm cả cái bẫy đằng sau nó.',
    action: {
      type: 'hoTro',
      kind: 'giaY',
      duration: 8,
      magnitudeFlat: 0.6,
      sinhLucCostFrac: 0.18,
    },
  },

  // ─────────────────────────────── Trúc Cơ kỳ ───────────────────────────────
  // Bắt đầu có thứ của riêng mình: một đàn linh trùng nuôi từ nhỏ, và trận pháp
  // — thứ về sau thành nghề tay trái nổi tiếng nhất của Hàn Lập.

  {
    id: 'thucKimTrung',
    slot: 7,
    name: 'Thực Kim Trùng',
    hanTu: '噬金虫',
    desc: 'Thả đàn trùng ăn kim khí. Đòn đầu nhẹ nhưng gặm mòn địch trong 6 giây. Hệ Kim.',
    glyph: '蟲',
    requiredRealm: { major: TC, tier: 0 },
    linhLucCost: 24,
    cooldown: 13,
    castTime: 0.45,
    recover: 0.3,
    moveScale: 0.4,
    element: 'kim',
    role: 'congKich',
    phapBao: {
      ten: 'Thực Kim Trùng',
      hang: 'linhTrung',
      note: 'Linh trùng ăn kim loại. Cắn thủng được cả pháp khí, nên hộ giáp không cứu nổi.',
    },
    nguonGoc: 'Hàn Lập nuôi từ mấy con trùng non, cho ăn tinh kim suốt nhiều năm.',
    action: {
      type: 'phapVuc',
      // Vùng RỘNG nhưng đòn đầu nhẹ: đàn trùng không nổ, nó bám. Toàn bộ sức
      // của chiêu nằm ở sáu giây gặm sau đó, nên nó là chiêu mở đầu một trận
      // chứ không phải chiêu kết thúc.
      radius: 3.4,
      mult: 0.6,
      element: 'kim',
      atCursor: true,
      castRange: 10,
      // KHÔNG đẩy lùi: trùng bám vào người thì thứ cuối cùng nên làm là ném mục
      // tiêu ra khỏi vùng của chính mình
      knockback: 0,
      stagger: 0.15,
      onHit: { kind: 'trungDoc', duration: 6, magnitude: 2, magnitudeFromCong: 0.22 },
    },
  },
  {
    id: 'nguHanhTranKy',
    slot: 8,
    name: 'Ngũ Hành Trận Kỳ',
    hanTu: '五行阵旗',
    desc: 'Cắm năm lá trận kỳ khoá cứng một vùng rộng. Không gây sát thương — nó giữ người.',
    glyph: '陣',
    requiredRealm: { major: TC, tier: 1 },
    linhLucCost: 30,
    cooldown: 18,
    castTime: 0.7,
    recover: 0.35,
    moveScale: 0.25,
    element: 'tho',
    role: 'khongChe',
    phapBao: {
      ten: 'Ngũ hành trận kỳ',
      hang: 'tranPhap',
      note: 'Năm lá cờ nhỏ. Bày đúng chỗ thì trói được kẻ hơn mình cả một cảnh giới.',
    },
    nguonGoc: 'Hàn Lập học trận pháp từ ngọc giản, rồi thành người bày trận có tiếng.',
    action: {
      type: 'phapVuc',
      // Vùng rất rộng và KHÔNG sát thương: giá trị của trận pháp trong nguyên
      // tác luôn là "giữ đối phương lại", không phải "giết đối phương". Cho nó
      // sát thương thì nó thành một Thiên Lôi Phù to hơn và mất hẳn bản sắc.
      radius: 5,
      mult: 0,
      element: 'tho',
      atCursor: true,
      castRange: 9,
      knockback: 0,
      stagger: 0,
      onHit: { kind: 'dongBang', duration: 2.8, magnitude: 0 },
    },
  },

  // ─────────────────────────────── Kết Đan kỳ ───────────────────────────────
  // Hai thứ bản mệnh. Đây là lúc Hàn Lập thôi dùng đồ mua sẵn.

  {
    id: 'thanhTrucPhongVan',
    slot: 9,
    name: 'Thanh Trúc Phong Vân Kiếm',
    hanTu: '青竹蜂云剑',
    desc: 'Đàn phi kiếm trúc vây quét quanh người. Số kiếm bay ra tăng theo cảnh giới. Hệ Mộc, mang lôi.',
    glyph: '竹',
    requiredRealm: { major: KD, tier: 0 },
    linhLucCost: 60,
    cooldown: 22,
    castTime: 0.6,
    recover: 0.4,
    // Còn đi được nửa tốc trong lúc kiếm quay: đây là chiêu giữ vòng, nếu đứng
    // yên thì vòng quét không bao giờ đuổi được con quái đang chạy ra ngoài
    moveScale: 0.5,
    element: 'moc',
    role: 'congKich',
    banMenh: true,
    phapBao: {
      ten: 'Thanh Trúc Phong Vân Kiếm',
      hang: 'banMenh',
      note: 'Bộ đủ 72 thanh, luyện từ sáu gốc Kim Lôi Trúc vạn niên. Mộc và Lôi song thuộc tính.',
    },
    nguonGoc:
      'Ghi trong Thanh Nguyên Kiếm Quyết — cùng một lộ với đường kiếm cận chiến. Hàn Lập luyện xong sau khi Kết Đan hai mươi mốt năm.',
    action: {
      type: 'kiemVu',
      // Vòng kiếm CHẶT quanh người, không phải một vụ nổ diện rộng: người chơi
      // vừa đi vừa lái đàn kiếm vào giữa đám quái suốt 5 giây.
      radius: 3,
      // 0.55 mỗi nhịp, nhịp 0.3 giây: mục tiêu đứng trong vòng suốt chiêu ăn
      // khoảng 16 lần hệ số công. Đắt (60 linh lực, hồi 22 giây) nên xứng, mà
      // vẫn không xoá sạch mọi thứ trong một lần bấm.
      mult: 0.55,
      duration: 5,
      knockback: 1.2,
      stagger: 0.1,
      hitInterval: 0.3,
    },
  },
  {
    id: 'daiDienQuyet',
    slot: 6,
    name: 'Đại Diễn Quyết',
    hanTu: '大衍诀',
    desc: 'Thần thức bùng lên: khiên và đàn kiếm mạnh thêm 50% trong 12 giây.',
    glyph: '衍',
    requiredRealm: { major: KD, tier: 1 },
    linhLucCost: 34,
    cooldown: 30,
    castTime: 0.7,
    recover: 0.4,
    moveScale: 0.3,
    element: 'vo',
    role: 'hoTro',
    banMenh: true,
    phapBao: {
      ten: 'Đại Diễn Quyết',
      hang: 'congPhap',
      note: 'Công pháp luyện thần thức. Thần thức mạnh thì điều được nhiều pháp bảo cùng lúc.',
    },
    nguonGoc: 'Bản mệnh công pháp của Hàn Lập, thứ khiến hắn khác mọi tu sĩ cùng cảnh giới.',
    action: {
      type: 'hoTro',
      kind: 'daiDien',
      duration: 12,
      magnitudeFlat: 0.5,
    },
  },

  // ────────────────────────────── Nguyên Anh kỳ ─────────────────────────────
  // Sáu thứ trứ danh nhất. Từ đây trở đi Hàn Lập không còn đánh bằng một chiêu
  // — hắn đánh bằng cả một bộ pháp bảo, và đó chính là công của Đại Diễn Quyết.

  {
    id: 'canhKimKiemKhi',
    slot: 0,
    name: 'Canh Kim Kiếm Khí',
    hanTu: '庚金剑气',
    desc: 'Bảy đạo kiếm khí kim thuộc bắn thành quạt hẹp, xuyên qua mọi thứ chắn đường.',
    glyph: '庚',
    requiredRealm: { major: NA, tier: 0 },
    linhLucCost: 96,
    cooldown: 9,
    castTime: 0.4,
    recover: 0.3,
    moveScale: 0.3,
    element: 'kim',
    role: 'congKich',
    phapBao: {
      ten: 'Canh kim kiếm khí',
      hang: 'khong',
      note: 'Không phải vật — là kiếm khí luyện từ Canh Tinh, sắc bén bậc nhất trong ngũ hành.',
    },
    nguonGoc: 'Thần thông kim thuộc Hàn Lập luyện thành sau khi kết anh.',
    action: {
      type: 'phiHanh',
      // Quạt HẸP (0.3 radian cho cả bảy đạo) chứ không xoè rộng: đây là chiêu
      // dồn vào MỘT mục tiêu. Xoè rộng thì mỗi đạo trúng một con khác nhau và
      // chiêu mạnh nhất của Nguyên Anh lại gãi ngứa bảy chỗ.
      volley: { count: 7, spread: 0.3 },
      spec: {
        look: 'kiemKhi',
        behavior: 'thang',
        speed: 24,
        radius: 0.3,
        scale: 0.8,
        lifetime: 1.1,
        mult: 1.35,
        knockback: 1.1,
        stagger: 0.1,
        pierce: 2,
        element: 'kim',
      },
    },
  },
  {
    id: 'tamDiemPhien',
    slot: 2,
    name: 'Tam Diễm Phiến',
    hanTu: '三焰扇',
    desc: 'Quạt ba lần, mỗi lần một tầng lửa. Vùng cháy để lại thiêu đốt kéo dài. Hệ Hoả.',
    glyph: '扇',
    requiredRealm: { major: NA, tier: 0 },
    linhLucCost: 120,
    cooldown: 20,
    castTime: 0.55,
    recover: 0.45,
    moveScale: 0.35,
    element: 'hoa',
    role: 'congKich',
    phapBao: {
      ten: 'Tam Diễm Phiến',
      hang: 'phapBao',
      note: 'Quạt ba nan. Quạt một cái ra hoả, hai cái ra phong hoả, ba cái thì lửa không tắt được.',
    },
    nguonGoc: 'Pháp bảo Hàn Lập lấy được ở Thiên Nam, một trong những thứ hắn dùng lâu nhất.',
    action: {
      type: 'phapVuc',
      radius: 4.2,
      mult: 2.1,
      element: 'hoa',
      atCursor: true,
      castRange: 11,
      knockback: 2.2,
      stagger: 0.25,
      // Ba nhịp, không phải một vụ nổ to: chính ba nhịp mới đọc ra là BA CÁI
      // QUẠT. Gộp thành một thì tên chiêu nói một đằng, hình nói một nẻo.
      pulses: 3,
      pulseInterval: 0.42,
      onHit: { kind: 'thieuDot', duration: 5, magnitude: 6, magnitudeFromCong: 0.28 },
    },
  },
  {
    id: 'thienNhatChanThuy',
    slot: 5,
    name: 'Thiên Nhất Chân Thuỷ',
    hanTu: '天一真水',
    desc: 'Hàn thuỷ chí âm dội xuống hai đợt, đóng băng tất cả trong vùng. Khắc chế hệ Hoả.',
    glyph: '水',
    requiredRealm: { major: NA, tier: 1 },
    linhLucCost: 132,
    cooldown: 24,
    castTime: 0.6,
    recover: 0.4,
    moveScale: 0.3,
    element: 'thuy',
    role: 'khongChe',
    phapBao: {
      ten: 'Thiên Nhất Chân Thuỷ',
      hang: 'phapBao',
      note: 'Chí âm chí hàn, khắc mọi loại lửa. Một giọt cũng đủ đóng băng cả một dòng suối.',
    },
    nguonGoc: 'Linh thuỷ trân quý Hàn Lập thu được, chứa trong bình riêng và dùng rất dè.',
    action: {
      type: 'phapVuc',
      radius: 4.6,
      mult: 2.4,
      element: 'thuy',
      atCursor: true,
      castRange: 11,
      knockback: 0,
      stagger: 0,
      pulses: 2,
      pulseInterval: 0.6,
      onHit: { kind: 'dongBang', duration: 2.2, magnitude: 0 },
    },
  },
  {
    id: 'nguyenTuThanQuang',
    slot: 8,
    name: 'Nguyên Từ Thần Quang',
    hanTu: '元磁神光',
    desc: 'Quang mạc từ tính hút mọi thứ về tâm rồi ghì chặt. Sát thương thấp, khống chế thì tuyệt đối.',
    glyph: '磁',
    requiredRealm: { major: NA, tier: 1 },
    linhLucCost: 110,
    cooldown: 26,
    castTime: 0.65,
    recover: 0.4,
    moveScale: 0.28,
    element: 'kim',
    role: 'khongChe',
    phapBao: {
      ten: 'Nguyên Từ Thần Quang',
      hang: 'khong',
      note: 'Thần thông hiếm. Ghì được cả pháp bảo kim thuộc của đối phương xuống đất.',
    },
    nguonGoc: 'Hàn Lập luyện thành từ Nguyên Từ Sơn, một trong những quân bài giấu kỹ nhất.',
    action: {
      type: 'phapVuc',
      radius: 5.5,
      mult: 1.2,
      element: 'kim',
      atCursor: true,
      castRange: 12,
      // ÂM = hút vào tâm. Đây là chỗ duy nhất trong bảng dùng số âm, và nó là
      // lý do `knockback` được định nghĩa theo TÂM VÙNG chứ không theo người
      // thi triển — hút "về phía người thi triển" thì cả đám quái đổ vào mặt
      // mình, đúng thứ chiêu này sinh ra để tránh.
      knockback: -4.5,
      stagger: 0.3,
      onHit: { kind: 'chamLai', duration: 6, magnitude: 0.7 },
    },
  },
  {
    id: 'thaiAtThanhSon',
    slot: 4,
    name: 'Thái Ất Thanh Sơn Quyết',
    hanTu: '太乙青山诀',
    desc: 'Hoá linh lực thành một toà núi xanh giộng thẳng xuống. Sát thương lớn nhất trong tay Hàn Lập.',
    glyph: '山',
    requiredRealm: { major: NA, tier: 2 },
    linhLucCost: 170,
    cooldown: 40,
    // Dẫn khí LÂU nhất bảng: một toà núi phải mất thời gian mới hiện ra, và
    // chính khoảng chờ đó mới làm cú giộng có sức nặng
    castTime: 1.2,
    recover: 0.6,
    moveScale: 0.1,
    element: 'tho',
    role: 'congKich',
    phapBao: {
      ten: 'Thái Ất Thanh Sơn Quyết',
      hang: 'congPhap',
      note: 'Công pháp hoá sơn. Núi càng nặng thì thần thức tiêu hao càng lớn.',
    },
    nguonGoc: 'Công pháp thượng thừa Hàn Lập học được, dùng khi cần dứt điểm.',
    action: {
      type: 'phapVuc',
      radius: 5.2,
      mult: 12.5,
      element: 'tho',
      atCursor: true,
      castRange: 10,
      knockback: 7,
      stagger: 1.4,
    },
  },
  {
    id: 'phongLoiSi',
    slot: 1,
    name: 'Phong Lôi Sí',
    hanTu: '风雷翅',
    desc: 'Mọc đôi cánh phong lôi: lướt xa gấp đôi Phong Độn, và giữ tốc độ tăng vọt sau đó.',
    glyph: '翅',
    requiredRealm: { major: NA, tier: 2 },
    linhLucCost: 60,
    cooldown: 14,
    castTime: 0.05,
    recover: 0.15,
    moveScale: 0,
    element: 'vo',
    role: 'thanPhap',
    phapBao: {
      ten: 'Phong Lôi Sí',
      hang: 'congPhap',
      note: 'Đôi cánh xanh lam ghép từ phong và lôi. Thân pháp nhanh nhất Hàn Lập từng có.',
    },
    nguonGoc: 'Thần thông thân pháp Hàn Lập luyện ở Nguyên Anh, thứ đã cứu mạng hắn nhiều lần.',
    action: {
      type: 'thanPhap',
      distance: 10.5,
      duration: 0.26,
      // Cú lướt xong vẫn còn cánh: đó là khác biệt với Phong Độn Thuật, thứ chỉ
      // là một bước nhảy. Không có đuôi này thì hai chiêu chỉ khác nhau con số.
      after: { kind: 'phongLoi', duration: 5, magnitude: 0.75 },
    },
  },
]

/**
 * Số kiếm trúc bay ra theo cảnh giới — mốc lấy thẳng từ nguyên tác.
 *
 * Trong truyện Hàn Lập luyện đủ 72 thanh ngay ở Kết Đan, nhưng thần thức chỉ
 * ngự nổi sáu bảy thanh lúc sơ kỳ và hai bốn thanh lúc hậu kỳ; phải tới Nguyên
 * Anh mới điều được cả bộ. Đó là một chi tiết đáng giữ, vì nó biến việc đột phá
 * thành một thứ NHÌN THẤY ĐƯỢC: cùng một chiêu, cùng một phím, mà vòng kiếm dày
 * lên gấp đôi.
 *
 * Mốc 24 (Kết Đan hậu kỳ) và 72 (Nguyên Anh) là hai con số nguyên tác nói thẳng.
 * Ba mốc còn lại lấp vào theo bội của 12 — một bộ cơ sở của pháp bảo này là 12
 * thanh — thay vì theo con số "sáu bảy thanh", vì một vòng sáu thanh chia cho ba
 * vòng đồng tâm thì mỗi vòng còn hai cái, không ra nổi hình đội ngũ.
 */
const SO_KIEM_THEO_CANH_GIOI: ReadonlyArray<readonly [RealmPosition, number]> = [
  [{ major: KD, tier: 0 }, 12],
  [{ major: KD, tier: 1 }, 18],
  [{ major: KD, tier: 2 }, 24],
  [{ major: KD, tier: 3 }, 36],
  [{ major: NA, tier: 0 }, 72],
]

export function soKiemTruc(realm: RealmPosition): number {
  const ord = realmOrdinal(realm)
  let count = 12
  for (const [pos, n] of SO_KIEM_THEO_CANH_GIOI) {
    if (ord >= realmOrdinal(pos)) count = n
  }
  return count
}

// ───────────────────────────── Số liệu sát thương ─────────────────────────────

export type DamageBand = 'khong' | 'nhe' | 'vua' | 'nang' | 'cucNang' | 'huyDiet'

export const DAMAGE_BAND_LABEL: Record<DamageBand, string> = {
  khong: 'không sát thương',
  nhe: 'nhẹ',
  vua: 'vừa',
  nang: 'nặng',
  cucNang: 'cực nặng',
  huyDiet: 'huỷ diệt',
}

export interface SkillDamage {
  /** Hệ số công MỘT mục tiêu chịu mỗi lần trúng. */
  readonly moiDon: number
  /** Số lần một mục tiêu bị trúng trong một lần thi triển. */
  readonly soDon: number
  /** Hệ số công quy đổi từ sát thương theo thời gian. */
  readonly theoThoiGian: number
  /** Tổng hệ số công một mục tiêu chịu, đã gộp nổ lan và DoT. */
  readonly tong: number
  /** Số mục tiêu tối đa. 0 = không giới hạn (pháp vực, vòng quét). */
  readonly soMucTieu: number
  readonly bac: DamageBand
}

const KHONG_SAT_THUONG: SkillDamage = {
  moiDon: 0,
  soDon: 0,
  theoThoiGian: 0,
  tong: 0,
  soMucTieu: 0,
  bac: 'khong',
}

function band(tong: number): DamageBand {
  if (tong <= 0) return 'khong'
  if (tong < 1.5) return 'nhe'
  if (tong < 3.5) return 'vua'
  if (tong < 7) return 'nang'
  if (tong < 12) return 'cucNang'
  return 'huyDiet'
}

/**
 * Số liệu sát thương của một chiêu, SUY THẲNG từ `action`.
 *
 * Cố tình không có trường "sát thương" gõ tay trong `SkillDef`. Thẻ giới thiệu
 * ở Luyện Kiếm Đài và Đồ Giám đều đọc từ đây, nên chỉnh cân bằng một con số
 * `mult` là mọi chỗ hiển thị đổi theo — một bảng gõ tay thì sớm muộn cũng nói
 * sai, và nó nói sai một cách im lặng.
 *
 * Đơn vị là HỆ SỐ CÔNG, không phải sát thương tuyệt đối: sát thương thật còn qua
 * phòng ngự, ngũ hành và chênh lệch cảnh giới, nên một con số tuyệt đối chỉ đúng
 * với đúng một cặp đánh nhau.
 */
export function skillDamage(def: SkillDef): SkillDamage {
  const a = def.action

  switch (a.type) {
    case 'phiHanh': {
      const s = a.spec
      const soDon = a.volley?.count ?? 1
      const dot = s.onHit ? (s.onHit.magnitudeFromCong ?? 0) * s.onHit.duration : 0
      const tong = s.mult * soDon + (s.explodeMult ?? 0) + dot
      return {
        moiDon: s.mult,
        soDon,
        theoThoiGian: dot,
        tong,
        // Nổ lan không đếm được số mục tiêu, nên báo là không giới hạn
        soMucTieu: s.explodeRadius ? 0 : s.pierce * soDon,
        bac: band(tong),
      }
    }

    case 'phapVuc': {
      const soDon = a.pulses ?? 1
      const dot = a.onHit ? (a.onHit.magnitudeFromCong ?? 0) * a.onHit.duration : 0
      const tong = a.mult * soDon + dot
      return {
        moiDon: a.mult,
        soDon,
        theoThoiGian: dot,
        tong,
        soMucTieu: 0,
        bac: band(tong),
      }
    }

    case 'kiemVu': {
      // Trừ đi đoạn tụ kiếm: gần một giây đầu đàn kiếm quay sát người và KHÔNG
      // chém ai. Tính cả đoạn đó thì con số quảng cáo cao hơn thứ mục tiêu thật
      // sự phải chịu.
      const sweeping = Math.max(0, a.duration - 1.05)
      const soDon = Math.floor(sweeping / a.hitInterval)
      const tong = a.mult * soDon
      return { moiDon: a.mult, soDon, theoThoiGian: 0, tong, soMucTieu: 0, bac: band(tong) }
    }

    default:
      return KHONG_SAT_THUONG
  }
}

export function skillDef(id: string): SkillDef {
  const def = SKILLS.find((s) => s.id === id)
  if (!def) throw new Error(`Không có pháp thuật với id "${id}"`)
  return def
}

/** Có chiêu này trong bảng không. Dùng cho dữ liệu trỏ chéo (trình diễn, Đồ Giám). */
export function hasSkill(id: string): boolean {
  return SKILLS.some((s) => s.id === id)
}
