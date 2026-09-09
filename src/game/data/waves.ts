/** Một nhóm quái sinh ra trong đợt. */
export interface SpawnGroup {
  readonly id: string
  readonly count: number
  /** Vòng sinh quanh tâm luyện võ trường. */
  readonly ringMin: number
  readonly ringMax: number
}

export interface WaveDef {
  readonly name: string
  /** Câu báo trước, hiện giữa màn hình khi đợt bắt đầu. */
  readonly announce: string
  readonly groups: readonly SpawnGroup[]
  /** Số đệ tử đồng môn được phái ra hỗ trợ đợt này. */
  readonly allies: number
  /** Có thì đợt này là đợt tướng — thanh máu tướng hiện lên. */
  readonly boss?: string
}

/**
 * "Thất Huyền Môn thủ trận" — 5 đợt rồi tới tướng.
 *
 * Nhịp cố ý là NGƯỜI CHƠI TỰ BẤM để mở đợt sau, không tự chạy tiếp. Giữa hai
 * đợt là lúc toạ thiền, luyện đan và đột phá — nếu đợt tự tới thì cả vòng lặp
 * tu luyện của M5 bị chen ngang và người chơi buộc phải đánh với cảnh giới đang
 * có, thay vì được chuẩn bị.
 *
 * Đợt 5 cố tình đặt một Ma Đạo Trúc Cơ: người chơi còn Luyện Khí sẽ đánh nó chỉ
 * còn ~3,5% sát thương và tự hiểu rằng phải đột phá trước — bài học đó phải được
 * DẠY BẰNG CÁCH CHO GẶP, không phải bằng một dòng chữ.
 */
export const WAVES: readonly WaveDef[] = [
  {
    name: 'Đợt 1 — Yêu thú náo động',
    announce: 'Yêu thú từ hậu sơn tràn vào luyện võ trường',
    groups: [{ id: 'yeuThu', count: 8, ringMin: 14, ringMax: 26 }],
    allies: 0,
  },
  {
    name: 'Đợt 2 — Hắc lang thành bầy',
    announce: 'Hắc lang xuống núi, chúng biết vờn quanh trước khi vồ',
    groups: [
      { id: 'yeuThu', count: 6, ringMin: 14, ringMax: 26 },
      { id: 'hacLang', count: 4, ringMin: 18, ringMax: 30 },
    ],
    allies: 1,
  },
  {
    name: 'Đợt 3 — Độc thù trong sương',
    announce: 'Độc thù bò tới, đòn của chúng nhẹ nhưng vết độc thì không',
    groups: [
      { id: 'docThu', count: 7, ringMin: 13, ringMax: 24 },
      { id: 'hacLang', count: 3, ringMin: 18, ringMax: 30 },
    ],
    allies: 2,
  },
  {
    name: 'Đợt 4 — Ma đạo phá sơn môn',
    announce: 'Ma đạo tán tu đứng ngoài bắn phù — phải áp sát chúng',
    groups: [
      { id: 'maDaoTanTu', count: 3, ringMin: 20, ringMax: 30 },
      { id: 'thietGiapThi', count: 2, ringMin: 15, ringMax: 24 },
      { id: 'docThu', count: 4, ringMin: 13, ringMax: 22 },
    ],
    allies: 3,
  },
  {
    name: 'Đợt 5 — Trúc Cơ áp cảnh',
    announce: 'Một Trúc Cơ kỳ tới. Cảnh giới cách một bậc là cách một trời',
    groups: [
      { id: 'maDaoTrucCo', count: 1, ringMin: 16, ringMax: 20 },
      { id: 'thietGiapThi', count: 2, ringMin: 15, ringMax: 24 },
      { id: 'maDaoTanTu', count: 2, ringMin: 20, ringMax: 28 },
    ],
    allies: 4,
    boss: 'maDaoTrucCo',
  },
  {
    name: 'Đợt cuối — Mặc Đại Phu',
    announce: 'Mặc Đại Phu đoạt xá mà tới. Giữ lấy sơn môn.',
    groups: [
      { id: 'macDaiPhu', count: 1, ringMin: 14, ringMax: 18 },
      { id: 'thietGiapThi', count: 2, ringMin: 16, ringMax: 24 },
    ],
    allies: 5,
    boss: 'macDaiPhu',
  },
]

export function waveDef(index: number): WaveDef | null {
  return WAVES[index] ?? null
}

export const WAVE_COUNT = WAVES.length
