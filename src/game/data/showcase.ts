import { REALM, type RealmPosition } from './realms'
import { hasSkill, skillDef } from './skills'

export type ShowcaseAction =
  /** Thi triển một chiêu, gọi theo ID chứ không theo ô. */
  | { kind: 'skill'; id: string }
  /** Combo 3 nhát Thanh Nguyên Kiếm Quyết. */
  | { kind: 'melee' }
  /** Ngự Kiếm Phi Hành. */
  | { kind: 'flight' }
  /** Toạ thiền — Trường Xuân Công. */
  | { kind: 'meditate' }
  /** Cột kim quang đột phá đại cảnh giới. */
  | { kind: 'breakthrough' }

export interface ShowcaseStep {
  /**
   * Tiêu đề.
   *
   * Với bước `skill` thì để trống: tên lấy thẳng từ bảng pháp thuật. Gõ lại ở
   * đây là mở đường cho hai chỗ nói hai tên khác nhau sau lần đổi tên đầu tiên.
   */
  readonly title?: string
  /** Chú thích riêng của bản trình diễn — nói về CÁCH XEM, không lặp lại mô tả chiêu. */
  readonly note: string
  /**
   * Một lượt diễn dài bao lâu, giây.
   *
   * Bước LẶP MÃI cho tới khi người xem chọn bước khác, nên đây là nhịp lặp của
   * những bước không khai `repeatEvery` — cũng chính là khoảng đủ để đọc xong
   * chú thích và xem hết một lần thi triển.
   */
  readonly duration: number
  readonly action: ShowcaseAction
  /** Có thì lặp lại hành động theo nhịp này, thay cho `duration`. */
  readonly repeatEvery?: number
  /** Dựng lại mộc nhân và bia đá trước khi diễn bước này. */
  readonly refreshTargets?: boolean
  /** Cảnh giới Hàn Lập phải ở để diễn bước này. */
  readonly realm: RealmPosition
  /** Tên chương. Bảng bên trái gom các bước cùng chương lại một nhóm. */
  readonly chapter: string
}

const LK: RealmPosition = { major: REALM.LUYEN_KHI, tier: 12 }
const TC: RealmPosition = { major: REALM.TRUC_CO, tier: 2 }
const KD_SO: RealmPosition = { major: REALM.KET_DAN, tier: 0 }
const KD_CAO: RealmPosition = { major: REALM.KET_DAN, tier: 3 }
const NA: RealmPosition = { major: REALM.NGUYEN_ANH, tier: 2 }

const CH_LK = 'Luyện Khí kỳ'
const CH_TC = 'Trúc Cơ kỳ'
const CH_KD = 'Kết Đan kỳ'
const CH_NA = 'Nguyên Anh kỳ'

/** Bước thi triển một chiêu. Ném lỗi ngay nếu id không có trong bảng pháp thuật. */
function skill(id: string, step: Omit<ShowcaseStep, 'action'>): ShowcaseStep {
  if (!hasSkill(id)) throw new Error(`Bảng trình diễn trỏ vào chiêu không có: "${id}"`)
  return { ...step, action: { kind: 'skill', id } }
}

/**
 * Kịch bản trình diễn thần thông của Hàn Lập — Luyện Kiếm Đài.
 *
 * Là DỮ LIỆU, không phải mã: thêm một chiêu vào `skills.ts` rồi thêm một dòng ở
 * đây là nó vào bảng trình diễn, không phải sửa bộ điều phối.
 *
 * Chia CHƯƠNG theo cảnh giới, và mỗi bước tự khai cảnh giới của nó. Đây không
 * phải chuyện trình bày: Thanh Trúc Phong Vân Kiếm bay ra 12 thanh ở Kết Đan sơ
 * kỳ và 72 thanh ở Nguyên Anh, Kim Quang Thuẫn dày lên theo Thần Thức, Thực Kim
 * Trùng gặm mạnh lên theo Công. Diễn tất cả ở một cảnh giới thì mất hết những
 * điều đó, mà chúng chính là thứ nguyên tác nói nhiều nhất.
 *
 * Cùng một chiêu được phép xuất hiện HAI LẦN ở hai chương khác nhau, và đàn
 * kiếm trúc là chỗ duy nhất đáng làm thế: xem 12 thanh rồi xem 72 thanh mới đọc
 * ra được cảnh giới nghĩa là gì.
 */
export const SHOWCASE: readonly ShowcaseStep[] = [
  // ─────────────────────────── Luyện Khí kỳ ───────────────────────────
  {
    chapter: CH_LK,
    realm: LK,
    title: 'Thanh Nguyên Kiếm Quyết',
    note: 'Combo ba nhát. Nhát cuối chậm nhất, mạnh nhất, và đẩy lùi xa nhất.',
    duration: 6,
    action: { kind: 'melee' },
    repeatEvery: 0.5,
    refreshTargets: true,
  },
  skill('nguKiem', {
    chapter: CH_LK,
    realm: LK,
    note: 'Xem đường bay: kiếm xuyên qua cả hàng bia rồi quay về tay.',
    duration: 7,
    repeatEvery: 3,
  }),
  skill('phongDon', {
    chapter: CH_LK,
    realm: LK,
    note: 'Suốt cú lướt là miễn thương — đây là nút né đòn, không phải nút chạy.',
    duration: 6,
    repeatEvery: 1.6,
  }),
  skill('hoaCau', {
    chapter: CH_LK,
    realm: LK,
    note: 'Nổ lan rồi để lại vết thiêu. Nhìn số sát thương nhỏ nhảy đều mỗi giây sau đó.',
    duration: 7,
    repeatEvery: 2.2,
    refreshTargets: true,
  }),
  skill('kimQuangThuan', {
    chapter: CH_LK,
    realm: LK,
    note: 'Khiên suy từ Thần Thức, nên cùng một chiêu ở Nguyên Anh sẽ dày gấp mấy chục lần.',
    duration: 5,
  }),
  skill('thienLoiPhu', {
    chapter: CH_LK,
    realm: LK,
    note: 'Choáng nặng nhất trong cả giai đoạn Luyện Khí. Đắt, vì mỗi lần là mất một lá phù.',
    duration: 7,
    repeatEvery: 3,
    refreshTargets: true,
  }),
  skill('bangPhongPhu', {
    chapter: CH_LK,
    realm: LK,
    note: 'Không giết ai. Nó mua thời gian — bia trong vùng đứng im rồi chậm hẳn đi.',
    duration: 7,
    repeatEvery: 3.2,
    refreshTargets: true,
  }),
  skill('giaYThanCong', {
    chapter: CH_LK,
    realm: LK,
    note: 'Nhìn thanh sinh lực tụt ngay lúc thi triển: đó là cái giá, và nó có thật.',
    duration: 7,
  }),
  {
    chapter: CH_LK,
    realm: LK,
    title: 'Trường Xuân Công — toạ thiền',
    note: 'Công pháp Mặc Đại Phu truyền. Tăng Tu Vi đều, đổi lấy việc mất hết phòng bị.',
    duration: 5,
    action: { kind: 'meditate' },
  },

  // ──────────────────────────── Trúc Cơ kỳ ────────────────────────────
  {
    chapter: CH_TC,
    realm: TC,
    title: 'Ngự Kiếm Phi Hành',
    note: 'Mở ở Trúc Cơ. Bay qua rừng và đá, nhanh hơn 1,6 lần — nhưng không chém được, và bị choáng là rơi.',
    duration: 8,
    action: { kind: 'flight' },
  },
  skill('thucKimTrung', {
    chapter: CH_TC,
    realm: TC,
    note: 'Đòn đầu gần như không thấy gì. Sức của nó nằm hết ở sáu giây gặm sau đó.',
    duration: 9,
    repeatEvery: 4,
    refreshTargets: true,
  }),
  skill('nguHanhTranKy', {
    chapter: CH_TC,
    realm: TC,
    note: 'Không một điểm sát thương nào. Trận pháp trong nguyên tác luôn để GIỮ NGƯỜI, không để giết.',
    duration: 7,
    repeatEvery: 3.4,
    refreshTargets: true,
  }),

  // ──────────────────────────── Kết Đan kỳ ────────────────────────────
  skill('thanhTrucPhongVan', {
    chapter: CH_KD,
    realm: KD_SO,
    title: 'Thanh Trúc Phong Vân Kiếm — 12 thanh',
    note: 'Kết Đan sơ kỳ. Bộ đủ là 72 thanh, nhưng thần thức lúc này chỉ ngự nổi một bộ cơ sở.',
    duration: 9,
    refreshTargets: true,
  }),
  skill('daiDienQuyet', {
    chapter: CH_KD,
    realm: KD_CAO,
    note: 'Không tự có hình. Nó làm khiên và đàn kiếm mạnh thêm 50% — đó là lý do nó đứng ngay sau đàn kiếm.',
    duration: 9,
  }),
  {
    chapter: CH_KD,
    realm: KD_CAO,
    title: 'Đột phá đại cảnh giới',
    note: 'Cột kim quang và ba vòng shockwave. Sau khoảnh khắc này là Nguyên Anh.',
    duration: 6,
    action: { kind: 'breakthrough' },
  },

  // ─────────────────────────── Nguyên Anh kỳ ──────────────────────────
  skill('thanhTrucPhongVan', {
    chapter: CH_NA,
    realm: NA,
    title: 'Thanh Trúc Phong Vân Kiếm — đủ 72 thanh',
    note: 'Cùng một chiêu, cùng một phím. Khác nhau chỉ ở thần thức — và đó là toàn bộ ý nghĩa của việc đột phá.',
    duration: 10,
    refreshTargets: true,
  }),
  skill('canhKimKiemKhi', {
    chapter: CH_NA,
    realm: NA,
    note: 'Bảy đạo dồn vào một quạt hẹp, nên cả bảy cùng rơi lên một mục tiêu. Đòn dứt điểm đơn mục tiêu.',
    duration: 8,
    repeatEvery: 2.4,
    refreshTargets: true,
  }),
  skill('tamDiemPhien', {
    chapter: CH_NA,
    realm: NA,
    note: 'Đếm ba nhịp bùng — mỗi nhịp là một cái quạt. Sau đó cả vùng còn cháy thêm năm giây.',
    duration: 9,
    repeatEvery: 4,
    refreshTargets: true,
  }),
  skill('thienNhatChanThuy', {
    chapter: CH_NA,
    realm: NA,
    note: 'Hai đợt dội. Khắc chế hệ Hoả, nên bia thuộc hoả ăn nặng hơn hẳn.',
    duration: 9,
    repeatEvery: 4,
    refreshTargets: true,
  }),
  skill('nguyenTuThanQuang', {
    chapter: CH_NA,
    realm: NA,
    note: 'Chiêu duy nhất HÚT thay vì đẩy: cả vùng bị kéo về tâm rồi ghì lại. Sát thương gần như không có.',
    duration: 9,
    repeatEvery: 4,
    refreshTargets: true,
  }),
  skill('thaiAtThanhSon', {
    chapter: CH_NA,
    realm: NA,
    note: 'Dẫn khí lâu nhất bảng — 1,2 giây. Đổi lại là cú đánh nặng nhất Hàn Lập có.',
    duration: 9,
    repeatEvery: 4,
    refreshTargets: true,
  }),
  skill('phongLoiSi', {
    chapter: CH_NA,
    realm: NA,
    note: 'Lướt xa gấp đôi Phong Độn, và sau khi lướt xong đôi cánh vẫn còn: tốc độ giữ nguyên thêm năm giây.',
    duration: 8,
    repeatEvery: 2,
  }),
]

export const SHOWCASE_COUNT = SHOWCASE.length

/** Tên hiển thị của một bước: chiêu thì lấy từ bảng pháp thuật. */
export function stepTitle(step: ShowcaseStep): string {
  if (step.title) return step.title
  if (step.action.kind === 'skill') return skillDef(step.action.id).name
  return '—'
}

/** Chiêu của bước, nếu bước này là một chiêu. Panel đọc để dựng thẻ số liệu. */
export function stepSkill(step: ShowcaseStep) {
  return step.action.kind === 'skill' ? skillDef(step.action.id) : null
}

/** Danh sách chương theo đúng thứ tự xuất hiện, kèm khoảng bước của từng chương. */
export function showcaseChapters(): ReadonlyArray<{ title: string; from: number; to: number }> {
  const out: Array<{ title: string; from: number; to: number }> = []
  SHOWCASE.forEach((step, i) => {
    const last = out[out.length - 1]
    if (last && last.title === step.chapter) last.to = i
    else out.push({ title: step.chapter, from: i, to: i })
  })
  return out
}
