import { SKILLS } from './skills'

export type ShowcaseAction =
  /** Thi triển pháp thuật ở ô này. */
  | { kind: 'skill'; slot: number }
  /** Combo 3 nhát Thanh Nguyên Kiếm Quyết. */
  | { kind: 'melee' }
  /** Ngự Kiếm Phi Hành. */
  | { kind: 'flight' }
  /** Toạ thiền. */
  | { kind: 'meditate' }
  /** Cột kim quang đột phá đại cảnh giới. */
  | { kind: 'breakthrough' }

export interface ShowcaseStep {
  readonly title: string
  readonly note: string
  /** Thời lượng của bước, giây. */
  readonly duration: number
  readonly action: ShowcaseAction
  /** Có thì lặp lại hành động theo nhịp này. */
  readonly repeatEvery?: number
  /** Dựng lại bia đỡ trước khi diễn bước này. */
  readonly refreshDummies?: boolean
}

/** Tìm ô của một chiêu theo id. Ném lỗi nếu bảng chiêu đổi mà quên sửa ở đây. */
function slot(id: string): number {
  const i = SKILLS.findIndex((s) => s.id === id)
  if (i < 0) throw new Error(`Bảng trình diễn trỏ vào chiêu không có: "${id}"`)
  return i
}

/**
 * Kịch bản trình diễn thần thông của Hàn Lập.
 *
 * Là DỮ LIỆU, không phải mã: thêm một chiêu vào `skills.ts` rồi thêm một dòng ở
 * đây là nó vào showreel, không phải sửa bộ điều phối.
 *
 * Thứ tự đi từ thứ Hàn Lập có sớm nhất tới thứ có muộn nhất — nó cũng chính là
 * thứ tự người chơi sẽ mở được trong lượt chơi thật, nên xem showreel một lượt
 * là hiểu luôn con đường tu luyện.
 */
export const SHOWCASE: readonly ShowcaseStep[] = [
  {
    title: 'Thanh Nguyên Kiếm Quyết',
    note: 'Combo ba nhát. Nhát cuối đẩy lùi mạnh nhất.',
    duration: 6,
    action: { kind: 'melee' },
    repeatEvery: 0.5,
    refreshDummies: true,
  },
  {
    title: 'Ngự Kiếm Thuật',
    note: 'Phi kiếm xuyên qua hàng địch rồi quay về. Hệ Kim.',
    duration: 7,
    action: { kind: 'skill', slot: slot('nguKiem') },
    repeatEvery: 3,
  },
  {
    title: 'Phong Độn Thuật',
    note: 'Lướt theo hướng đang đi, và miễn thương suốt cú lướt.',
    duration: 6,
    action: { kind: 'skill', slot: slot('phongDon') },
    repeatEvery: 1.6,
  },
  {
    title: 'Hoả Cầu Thuật',
    note: 'Cầu lửa nổ lan, để lại vết thiêu đốt. Hệ Hoả.',
    duration: 7,
    action: { kind: 'skill', slot: slot('hoaCau') },
    repeatEvery: 2.2,
    refreshDummies: true,
  },
  {
    title: 'Kim Quang Thuẫn',
    note: 'Khiên hấp thụ sát thương. Mạnh theo Thần Thức, nên lên cảnh giới là khiên dày thêm.',
    duration: 5,
    action: { kind: 'skill', slot: slot('kimQuangThuan') },
  },
  {
    title: 'Thiên Lôi Phù',
    note: 'Giáng sấm xuống chỗ ngắm. Sát thương lớn nhất và choáng nặng nhất.',
    duration: 7,
    action: { kind: 'skill', slot: slot('thienLoiPhu') },
    repeatEvery: 3,
    refreshDummies: true,
  },
  {
    title: 'Băng Phong Phù',
    note: 'Đóng băng cả một vùng. Địch trong đó bất động rồi bị làm chậm. Hệ Thuỷ.',
    duration: 7,
    action: { kind: 'skill', slot: slot('bangPhongPhu') },
    repeatEvery: 3.2,
    refreshDummies: true,
  },
  {
    title: 'Ngự Kiếm Phi Hành',
    note: 'Mở ở Trúc Cơ. Cưỡi phi kiếm bay qua rừng và đá, nhanh hơn 1,6 lần — nhưng không chém được, và bị choáng là rơi.',
    duration: 8,
    action: { kind: 'flight' },
  },
  {
    title: 'Thanh Trúc Phong Vân Kiếm',
    note: 'Mở ở Kết Đan. 33 thanh kiếm trúc vây quanh người, ba vòng quay ngược nhau.',
    duration: 9,
    action: { kind: 'skill', slot: slot('thanhTrucPhongVan') },
    refreshDummies: true,
  },
  {
    title: 'Trường Xuân Công — toạ thiền',
    note: 'Tăng Tu Vi chậm và đều. Đổi lấy việc mất hoàn toàn khả năng phòng bị.',
    duration: 5,
    action: { kind: 'meditate' },
  },
  {
    title: 'Đột phá đại cảnh giới',
    note: 'Cột kim quang và ba vòng shockwave. Khoảnh khắc đáng nhớ nhất của cả bản demo.',
    duration: 6,
    action: { kind: 'breakthrough' },
  },
]

export const SHOWCASE_COUNT = SHOWCASE.length
