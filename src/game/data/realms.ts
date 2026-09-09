/**
 * Thang cảnh giới của Phàm Nhân Tu Tiên.
 *
 * Lượt chơi thật đi tới Kết Đan; Nguyên Anh có mặt để bộ pháp thuật kể được
 * hết con đường của Hàn Lập trong Luyện Kiếm Đài. Các đại cảnh giới sau (Hoá
 * Thần, Luyện Hư...) thêm vào CUỐI mảng là xong — mọi công thức đều tính theo
 * chỉ số nên không phải sửa gì.
 */

export interface MajorRealm {
  readonly key: string
  readonly name: string
  /** Tên từng tầng nhỏ trong đại cảnh giới. */
  readonly tiers: readonly string[]
  /** Hệ số nhân stat khi vừa vào đại cảnh giới này. */
  readonly powerBase: number
  /** Mỗi tầng nhỏ cộng thêm bao nhiêu vào hệ số. */
  readonly powerPerTier: number
}

const luyenKhiTiers = Array.from({ length: 13 }, (_, i) => `tầng ${i + 1}`)

export const MAJOR_REALMS: readonly MajorRealm[] = [
  {
    key: 'phamNhan',
    name: 'Phàm nhân',
    tiers: ['chưa nhập đạo'],
    powerBase: 1,
    powerPerTier: 0,
  },
  {
    key: 'luyenKhi',
    name: 'Luyện Khí kỳ',
    tiers: luyenKhiTiers,
    powerBase: 2,
    powerPerTier: 0.42,
  },
  {
    key: 'trucCo',
    name: 'Trúc Cơ kỳ',
    tiers: ['sơ kỳ', 'trung kỳ', 'hậu kỳ'],
    powerBase: 12,
    powerPerTier: 3.2,
  },
  {
    key: 'ketDan',
    name: 'Kết Đan kỳ',
    tiers: ['sơ kỳ', 'trung kỳ', 'hậu kỳ', 'đại thành'],
    powerBase: 46,
    powerPerTier: 11,
  },
  {
    /**
     * Nguyên Anh kỳ — cảnh giới của những pháp bảo trứ danh nhất.
     *
     * Thêm vào vì bộ pháp thuật cần tới nó, không phải vì lượt chơi cần: Tam
     * Diễm Phiến, Nguyên Từ Thần Quang, Thiên Nhất Chân Thuỷ và Canh Kim Kiếm
     * Khí đều là thứ Hàn Lập chỉ dùng được sau khi kết anh, nên gắn chúng vào
     * Kết Đan là nói sai nguyên tác ngay ở chỗ dễ kiểm nhất.
     *
     * `powerBase` gấp bốn Kết Đan, giữ đúng nhịp nhảy của ba mốc trước
     * (2 → 12 → 46 → 184): mỗi đại cảnh giới là một VỰC, và chính con số này
     * là thứ `realmGapFactor` dựa vào để nói điều đó.
     */
    key: 'nguyenAnh',
    name: 'Nguyên Anh kỳ',
    tiers: ['sơ kỳ', 'trung kỳ', 'hậu kỳ', 'đại thành'],
    powerBase: 184,
    powerPerTier: 44,
  },
]

/**
 * Tu Vi cần để lên tầng KẾ TIẾP, tính từ vị trí hiện tại.
 *
 * Đường cong cố tình KHÔNG đều. Ba tầng đầu nhanh để người mới thấy tiến độ
 * ngay; giữa vừa phải; ba tầng cuối của Luyện Khí là BÌNH CẢNH, chậm hẳn — đó
 * chính là lúc người chơi phải đi tìm đan dược thay vì cứ đánh quái, và là thứ
 * làm việc đột phá lên Trúc Cơ có sức nặng.
 *
 * Trả về Infinity ở tầng cuối của một đại cảnh giới: từ đó chỉ đột phá được
 * bằng cách dùng đan dược đúng loại, không thể tích Tu Vi mà lên.
 */
export function tuViForNextTier(pos: RealmPosition): number {
  const realm = majorRealm(pos.major)
  const tier = Math.min(realm.tiers.length - 1, Math.max(0, pos.tier))

  // Tầng cuối của đại cảnh giới -> phải đột phá, không tích Tu Vi mà qua được
  if (tier >= realm.tiers.length - 1) return Number.POSITIVE_INFINITY

  const scale = realm.powerBase * 22
  // Tăng theo luỹ thừa, và có hệ số bình cảnh cho ba tầng cuối
  const growth = Math.pow(1.42, tier)
  const nearCap = tier >= realm.tiers.length - 4
  const bottleneck = nearCap ? 1.9 : 1
  return Math.round(scale * growth * bottleneck)
}

/** Tu Vi cộng dồn để đi hết một đại cảnh giới — dùng cho thanh tiến độ tổng. */
export function tuViForMajor(major: number): number {
  const realm = majorRealm(major)
  let total = 0
  for (let tier = 0; tier < realm.tiers.length - 1; tier++) {
    total += tuViForNextTier({ major, tier })
  }
  return total
}

/** Chỉ số đại cảnh giới. Dùng số chứ không dùng key để so sánh cao thấp được. */
export const REALM = {
  PHAM_NHAN: 0,
  LUYEN_KHI: 1,
  TRUC_CO: 2,
  KET_DAN: 3,
  NGUYEN_ANH: 4,
} as const

/**
 * Đại cảnh giới cao nhất mà LƯỢT CHƠI THẬT đi tới được.
 *
 * Tách khỏi `MAJOR_REALMS.length - 1` vì hai con số này có hai nghĩa khác nhau.
 * Thang cảnh giới có Nguyên Anh để Luyện Kiếm Đài kể hết bộ pháp thuật của Hàn
 * Lập; lượt chơi thì chưa có nội dung cho nó. Không tách ra thì Kết Đan đại
 * thành đột phá thẳng lên Nguyên Anh mà KHÔNG tốn đan dược nào — bảng
 * `BREAKTHROUGH_PILL` không có mục cho cảnh giới đó, nên `requiredPill()` trả
 * về rỗng và cửa mở toang. Một đại cảnh giới được tặng không, không có gì báo.
 */
export const PLAYABLE_MAJOR_CAP: number = REALM.KET_DAN

export interface RealmPosition {
  /** Chỉ số trong MAJOR_REALMS. */
  major: number
  /** Chỉ số tầng nhỏ, bắt đầu từ 0. */
  tier: number
}

/**
 * Số thứ tự tuyệt đối của một cảnh giới trong toàn thang.
 * Cần để so sánh cao thấp qua các đại cảnh giới bằng một phép so sánh số duy nhất
 * (ví dụ: kiểm tra đã đủ cảnh giới để mở một pháp thuật).
 */
export function realmOrdinal(pos: RealmPosition): number {
  let n = 0
  const major = Math.min(MAJOR_REALMS.length - 1, Math.max(0, pos.major))
  for (let i = 0; i < major; i++) n += (MAJOR_REALMS[i] as MajorRealm).tiers.length
  const realm = MAJOR_REALMS[major] as MajorRealm
  return n + Math.min(realm.tiers.length - 1, Math.max(0, pos.tier))
}

/** Tổng số tầng của toàn thang — dùng cho thanh tiến độ tổng. */
export function totalTiers(): number {
  let n = 0
  for (const r of MAJOR_REALMS) n += r.tiers.length
  return n
}

export function majorRealm(major: number): MajorRealm {
  const clamped = Math.min(MAJOR_REALMS.length - 1, Math.max(0, major))
  return MAJOR_REALMS[clamped] as MajorRealm
}

/** Số tầng nhỏ của một đại cảnh giới. */
export function tierCount(major: number): number {
  return majorRealm(major).tiers.length
}

/** Tên đầy đủ, ví dụ "Luyện Khí kỳ tầng 7". */
export function realmName(pos: RealmPosition): string {
  const realm = majorRealm(pos.major)
  const tier = realm.tiers[Math.min(realm.tiers.length - 1, Math.max(0, pos.tier))]
  return realm.tiers.length === 1 ? realm.name : `${realm.name} ${tier}`
}

/** Hệ số sức mạnh dùng để suy ra stat. Tăng đơn điệu theo cảnh giới. */
export function realmPower(pos: RealmPosition): number {
  const realm = majorRealm(pos.major)
  const tier = Math.min(realm.tiers.length - 1, Math.max(0, pos.tier))
  return realm.powerBase + realm.powerPerTier * tier
}

/**
 * ★ LUẬT CHÊNH LỆCH CẢNH GIỚI — mechanic đặc trưng nhất của Phàm Nhân Tu Tiên.
 *
 * Chênh một ĐẠI cảnh giới là một vực thẳm, không phải một bước. Luyện Khí không
 * thể đánh thắng Trúc Cơ bằng cách farm thêm trang bị hay chơi giỏi hơn — phải
 * đột phá. Chính điều này làm việc lên cấp có sức nặng thật, thay vì chỉ là con
 * số tăng dần.
 *
 * Không bao giờ trả về 0: vẫn phải gọt được một chút để người chơi thấy mình
 * đang làm gì đó, và để "lấy nhiều đánh ít" còn có ý nghĩa.
 */
export function realmGapFactor(attackerMajor: number, defenderMajor: number): number {
  const gap = attackerMajor - defenderMajor
  if (gap >= 0) {
    // Đánh xuống thì áp đảo, nhưng có trần để không thành vô nghĩa
    return Math.min(3, 1 + gap * 0.6)
  }
  // Kết hợp với phòng ngự cao hơn của đối phương, 0.15 cho ra khoảng 11% sát
  // thương thực tế khi đánh lên một đại cảnh giới — tức cần hơn 10 lần số đòn.
  // Đủ để là một vực thẳm, mà vẫn không phải là bức tường tuyệt đối.
  const penalties = [0.15, 0.035, 0.012]
  return penalties[Math.min(penalties.length - 1, -gap - 1)] as number
}
