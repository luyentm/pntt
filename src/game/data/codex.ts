import { REALM, type RealmPosition } from './realms'
import { hasSkill } from './skills'
import { UNITS, type UnitDef } from './units'

/** Ba ngăn của Đồ Giám. */
export type CodexCategory = 'nhanVat' | 'yeuThu' | 'phapBao'

export const CODEX_CATEGORY_LABEL: Record<CodexCategory, string> = {
  nhanVat: 'Nhân vật',
  yeuThu: 'Yêu thú · Ma đạo',
  phapBao: 'Pháp bảo · Linh vật',
}

/**
 * Mô hình dựng lên bệ xoay.
 *
 * `unit` dựng lại đúng con vật/người trong bảng `UNITS`, nên Đồ Giám không có
 * bản sao thứ hai của bất kỳ tạo hình nào: sửa màu áo ma đạo trong `units.ts`
 * là Đồ Giám đổi theo. `prop` dành cho những thứ không phải combatant.
 */
export type CodexModel =
  | { kind: 'unit'; id: string }
  | { kind: 'hanLap' }
  | {
      kind: 'prop'
      id: 'kiemTruc' | 'tamDiemPhien' | 'tranKy' | 'thienLoiTruc' | 'chuongThienBinh' | 'thucKimTrung'
    }

export interface CodexEntry {
  readonly id: string
  readonly name: string
  /** Tên gốc, để người đọc truyện đối chiếu. */
  readonly hanTu?: string
  readonly category: CodexCategory
  /** Một dòng dưới tên trong lưới. */
  readonly tagline: string
  /** Đoạn giới thiệu — nói về vai trò trong truyện, không lặp lại chỉ số. */
  readonly lore: string
  readonly model: CodexModel
  /** Cảnh giới. Với entry lấy từ `UNITS` thì bỏ trống, chỉ số đọc thẳng từ đó. */
  readonly realm?: RealmPosition
  /** Đơn vị trong bảng `UNITS` — máu, công, phòng đọc từ đây. */
  readonly unitId?: string
  /** Công pháp và thần thông của nhân vật này, theo id trong bảng pháp thuật. */
  readonly skills?: readonly string[]
  /** Tỉ lệ dựng trên bệ. 1 là vừa khung; con nhỏ cần lớn hơn 1 mới nhìn rõ. */
  readonly displayScale?: number
}

/**
 * Đồ Giám — bảng tra nhân vật, yêu thú và pháp bảo.
 *
 * Là DỮ LIỆU, cùng khuôn với bảng pháp thuật và bảng trình diễn: thêm một mục
 * là thêm một entry, không sửa hệ thống nào. Bảng này cố tình để MỞ và điền dần
 * — nó là chỗ chứa mọi thứ về sau sẽ có trong game, nên nó phải đọc được cả khi
 * mới có mười lăm mục.
 *
 * Chỉ số KHÔNG gõ ở đây. Entry nào có `unitId` thì máu, công, phòng và cảnh giới
 * đều đọc thẳng từ `units.ts`; entry pháp bảo thì đọc từ `skills.ts`. Chép số
 * sang đây là mở đường cho hai chỗ nói hai con số khác nhau sau lần cân bằng
 * đầu tiên, và Đồ Giám là chỗ người chơi TIN nhất nên nó nói sai là tệ nhất.
 */
export const CODEX: readonly CodexEntry[] = [
  // ───────────────────────────── Nhân vật ─────────────────────────────
  {
    id: 'hanLap',
    name: 'Hàn Lập',
    hanTu: '韩立',
    category: 'nhanVat',
    tagline: 'Phàm nhân · con đường từ Thất Huyền Môn tới Nguyên Anh',
    lore:
      'Xuất thân nông hộ, không linh căn thượng phẩm, không cơ duyên trời cho. Thứ đưa hắn đi xa là ' +
      'cẩn thận tới mức lạnh lùng: giấu bài, chuẩn bị đường lui, và không bao giờ đánh một trận không ' +
      'cần đánh. Bản mệnh công pháp là Đại Diễn Quyết, bản mệnh pháp bảo là bảy mươi hai thanh Thanh ' +
      'Trúc Phong Vân Kiếm.',
    model: { kind: 'hanLap' },
    realm: { major: REALM.NGUYEN_ANH, tier: 2 },
    skills: [
      'nguKiem',
      'phongDon',
      'hoaCau',
      'kimQuangThuan',
      'thienLoiPhu',
      'bangPhongPhu',
      'giaYThanCong',
      'thucKimTrung',
      'nguHanhTranKy',
      'thanhTrucPhongVan',
      'daiDienQuyet',
      'canhKimKiemKhi',
      'tamDiemPhien',
      'thienNhatChanThuy',
      'nguyenTuThanQuang',
      'thaiAtThanhSon',
      'phongLoiSi',
    ],
  },
  {
    id: 'macDaiPhu',
    name: 'Mặc Đại Phu',
    hanTu: '墨大夫',
    category: 'nhanVat',
    tagline: 'Người dạy, và người định đoạt xá',
    lore:
      'Dạy Hàn Lập chữ nghĩa, y thuật và Trường Xuân Công — rồi nuôi hắn như nuôi một cái vỏ để đoạt ' +
      'xá. Giá Y Thần Công trong tay Hàn Lập chính là món quà của lão, kèm cả cái bẫy đằng sau nó. ' +
      'Trận đầu tiên trong đời Hàn Lập mà thua là chết.',
    model: { kind: 'unit', id: 'macDaiPhu' },
    unitId: 'macDaiPhu',
    skills: ['giaYThanCong'],
  },
  {
    id: 'deTu',
    name: 'Đệ tử Thất Huyền Môn',
    category: 'nhanVat',
    tagline: 'Đồng môn — lam bào viền trắng ngà',
    lore:
      'Bảy phái nhỏ hợp lại giữ một vùng phàm tục. Phần lớn đệ tử cả đời dừng ở Luyện Khí, và chính ' +
      'điều đó làm cảnh giới trong truyện có sức nặng: Trúc Cơ không phải một cấp, nó là một đời người.',
    model: { kind: 'unit', id: 'deTu' },
    unitId: 'deTu',
    skills: ['nguKiem'],
  },
  {
    id: 'maDaoTrucCo',
    name: 'Ma Đạo Trúc Cơ',
    category: 'nhanVat',
    tagline: 'Chênh một đại cảnh giới là một vực thẳm',
    lore:
      'Kẻ đã trúc cơ thì Luyện Khí không đánh lại bằng cách chơi giỏi hơn — chỉ còn cách đột phá, hoặc ' +
      'lấy đông hơn, hoặc dùng thứ nó không ngờ tới. Đây là con quái dạy người chơi luật quan trọng ' +
      'nhất của cả hệ chiến đấu.',
    model: { kind: 'unit', id: 'maDaoTrucCo' },
    unitId: 'maDaoTrucCo',
  },

  // ─────────────────────────── Yêu thú · Ma đạo ───────────────────────────
  {
    id: 'yeuThu',
    name: 'Yêu Thử',
    category: 'yeuThu',
    tagline: 'Yếu, nhưng không bao giờ đi một mình',
    lore:
      'Con quái đầu tiên người chơi gặp. Một con thì không đáng gì; sáu con vây lại thì một đệ tử mới ' +
      'nhập môn vẫn có thể chết, và đó là bài học đầu tiên về tách đàn và đẩy lùi.',
    model: { kind: 'unit', id: 'yeuThu' },
    unitId: 'yeuThu',
    displayScale: 1.7,
  },
  {
    id: 'hacLang',
    name: 'Hắc Lang',
    category: 'yeuThu',
    tagline: 'Vờn quanh rồi mới vồ',
    lore:
      'Nhanh hơn người, và biết giữ khoảng. Nó không xông thẳng như yêu thử — nó chạy vòng cho tới khi ' +
      'thấy sườn hở, nên đứng yên đánh trả là cách chết nhanh nhất.',
    model: { kind: 'unit', id: 'hacLang' },
    unitId: 'hacLang',
    displayScale: 1.35,
  },
  {
    id: 'docThu',
    name: 'Độc Thù',
    category: 'yeuThu',
    tagline: 'Đòn nhẹ, nhưng vết cắn không ngừng',
    lore:
      'Sát thương của nó gần như không thấy lúc trúng. Cái giết người là sáu giây sau đó — và nếu bị ' +
      'ba con cắn cùng lúc thì thanh máu tụt cả khi không con nào còn chạm tới mình.',
    model: { kind: 'unit', id: 'docThu' },
    unitId: 'docThu',
    displayScale: 1.5,
  },
  {
    id: 'thietGiapThi',
    name: 'Thiết Giáp Thi',
    category: 'yeuThu',
    tagline: 'Xác luyện — chậm, dày, và không biết đau',
    lore:
      'Tay sai Mặc Đại Phu gọi lên từ phase hai. Không đẩy lùi nổi, không choáng lâu, nên nó biến một ' +
      'trận đấu tay đôi thành một bài toán về chỗ đứng.',
    model: { kind: 'unit', id: 'thietGiapThi' },
    unitId: 'thietGiapThi',
  },
  {
    id: 'maDaoTanTu',
    name: 'Ma đạo tán tu',
    category: 'yeuThu',
    tagline: 'Đánh xa — buộc người chơi phải áp sát',
    lore:
      'Kẻ đầu tiên bắn trả từ xa. Đứng ngoài mà đối bắn với nó là thua, vì nó không cần tới gần; ' +
      'chiêu đúng ở đây là Phong Độn Thuật rồi ba nhát Thanh Nguyên Kiếm Quyết.',
    model: { kind: 'unit', id: 'maDaoTanTu' },
    unitId: 'maDaoTanTu',
  },

  // ─────────────────────────── Pháp bảo · Linh vật ───────────────────────────
  {
    id: 'thanhTrucPhongVan',
    name: 'Thanh Trúc Phong Vân Kiếm',
    hanTu: '青竹蜂云剑',
    category: 'phapBao',
    tagline: 'Bản mệnh pháp bảo — bộ đủ 72 thanh',
    lore:
      'Luyện từ sáu gốc Kim Lôi Trúc vạn niên, mỗi gốc ra mười hai thanh. Hàn Lập hoàn thành sau khi ' +
      'Kết Đan hai mươi mốt năm, nhưng thần thức lúc sơ kỳ chỉ ngự nổi sáu bảy thanh, hậu kỳ hai bốn ' +
      'thanh — phải tới Nguyên Anh mới điều được cả bộ. Mộc và Lôi song thuộc tính, ghi trong chính ' +
      'Thanh Nguyên Kiếm Quyết mà hắn học từ thuở Hoàng Phong Cốc.',
    model: { kind: 'prop', id: 'kiemTruc' },
    skills: ['thanhTrucPhongVan'],
  },
  {
    id: 'tamDiemPhien',
    name: 'Tam Diễm Phiến',
    hanTu: '三焰扇',
    category: 'phapBao',
    tagline: 'Quạt một cái ra hoả, ba cái thì lửa không tắt',
    lore:
      'Pháp bảo hoả thuộc lấy được ở Thiên Nam, và là một trong những thứ Hàn Lập dùng lâu nhất. Ba ' +
      'tầng lửa của nó không phải ba mức sát thương — nó là ba loại lửa khác nhau chồng lên nhau.',
    model: { kind: 'prop', id: 'tamDiemPhien' },
    skills: ['tamDiemPhien'],
  },
  {
    id: 'thucKimTrung',
    name: 'Thực Kim Trùng',
    hanTu: '噬金虫',
    category: 'phapBao',
    tagline: 'Linh trùng ăn kim khí — cắn thủng cả pháp khí',
    lore:
      'Nuôi từ mấy con trùng non, cho ăn tinh kim suốt nhiều năm. Thứ làm nó đáng sợ không phải sát ' +
      'thương mà là chỗ nó đi qua: hộ giáp và phi kiếm của đối phương cũng là kim loại.',
    model: { kind: 'prop', id: 'thucKimTrung' },
    skills: ['thucKimTrung'],
    displayScale: 1.15,
  },
  {
    id: 'nguHanhTranKy',
    name: 'Ngũ Hành Trận Kỳ',
    hanTu: '五行阵旗',
    category: 'phapBao',
    tagline: 'Năm lá cờ trói được kẻ hơn mình một cảnh giới',
    lore:
      'Hàn Lập học trận pháp từ ngọc giản rồi thành người bày trận có tiếng. Trận pháp trong nguyên tác ' +
      'gần như không bao giờ để giết — nó để GIỮ, và giữ được nửa khắc là đủ đổi cả kết cục.',
    model: { kind: 'prop', id: 'tranKy' },
    skills: ['nguHanhTranKy'],
  },
  {
    id: 'thienLoiTruc',
    name: 'Kim Lôi Trúc',
    hanTu: '金雷竹',
    category: 'phapBao',
    tagline: 'Không phải chiêu thức — là nguyên liệu luyện đàn kiếm',
    lore:
      'Trúc thiên lôi, thúc bằng nước lục trong Chưởng Thiên Bình suốt hơn hai mươi năm mới đủ vạn ' +
      'niên phẩm chất. Sáu gốc thành bảy mươi hai thanh phi kiếm. Cả bản mệnh pháp bảo của Hàn Lập mọc ' +
      'ra từ mấy cây trúc này.',
    model: { kind: 'prop', id: 'thienLoiTruc' },
  },
  {
    id: 'chuongThienBinh',
    name: 'Chưởng Thiên Bình',
    hanTu: '掌天瓶',
    category: 'phapBao',
    tagline: 'Cơ duyên lớn nhất, và không dùng để đánh nhau',
    lore:
      'Cái bình xanh nhặt được từ thuở còn là phàm nhân. Nước lục trong bình thúc linh thảo chín sớm ' +
      'gấp hàng chục lần — nghĩa là mọi đan dược, mọi nguyên liệu, mọi pháp bảo về sau đều bắt đầu từ ' +
      'đây. Hàn Lập giấu nó kỹ hơn bất cứ thứ gì khác.',
    model: { kind: 'prop', id: 'chuongThienBinh' },
  },
]

export function codexEntry(id: string): CodexEntry {
  const e = CODEX.find((x) => x.id === id)
  if (!e) throw new Error(`Không có mục Đồ Giám với id "${id}"`)
  return e
}

/** Đơn vị của một mục, nếu mục đó lấy chỉ số từ bảng đơn vị. */
export function codexUnit(entry: CodexEntry): UnitDef | null {
  return entry.unitId ? (UNITS[entry.unitId] ?? null) : null
}

/** Cảnh giới của một mục: ưu tiên bảng đơn vị, rồi mới tới giá trị tự khai. */
export function codexRealm(entry: CodexEntry): RealmPosition | null {
  return codexUnit(entry)?.realm ?? entry.realm ?? null
}

/** Các mục theo từng ngăn, giữ nguyên thứ tự khai báo. */
export function codexByCategory(category: CodexCategory): readonly CodexEntry[] {
  return CODEX.filter((e) => e.category === category)
}

/**
 * Mọi id chiêu mà Đồ Giám trỏ tới đều phải có thật.
 *
 * Kiểm ngay lúc nạp module chứ không đợi test: một id sai chỉ hiện ra khi có
 * người bấm đúng mục đó, và lúc đó nó là một ô trống chứ không phải một lỗi.
 */
for (const entry of CODEX) {
  for (const id of entry.skills ?? []) {
    if (!hasSkill(id)) throw new Error(`Đồ Giám "${entry.id}" trỏ vào chiêu không có: "${id}"`)
  }
  if (entry.unitId && !UNITS[entry.unitId]) {
    throw new Error(`Đồ Giám "${entry.id}" trỏ vào đơn vị không có: "${entry.unitId}"`)
  }
}
