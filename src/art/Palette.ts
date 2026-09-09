/**
 * Bảng màu chung. Giữ tất cả màu ở một chỗ để đổi tông cả game bằng một file.
 * Tông tổng thể: lụa xanh + mực nho, điểm kim (vàng đồng) — chất tranh thuỷ mặc tu tiên.
 */
export const Palette = {
  // --- Địa hình ---
  co: 0x6d9e63,
  coDam: 0x4a7a50,
  coKho: 0x9aa564,
  dat: 0x7a6448,
  datDam: 0x5b4a36,
  da: 0x848a90,
  daDam: 0x5c6268,
  daNhat: 0xa8aeb4,
  cat: 0xc9b48c,

  // --- Cây cối ---
  than: 0x4a3a2c,
  thanNhat: 0x6b5540,
  laTung: 0x2f5d43,
  laTungNhat: 0x3d7553,
  laPhong: 0xb5502f,
  tre: 0x7fa860,

  // --- Nhân vật ---
  daNguoi: 0xf2cda6,
  daNguoiDam: 0xd9ab82,
  toc: 0x22201e,
  mat: 0x1a1a20,

  // Trang phục đệ tử Thất Huyền Môn — lam nhạt viền trắng ngà
  aoDeTu: 0x7794b8,
  aoDeTuDam: 0x4f6a8c,
  vienAo: 0xe3ddc9,
  // Trang phục Hàn Lập
  aoHanLap: 0x5f7ea6,
  aoHanLapDam: 0x3d5675,
  daiLung: 0x8d6a3f,

  // Ma đạo — tím đen pha huyết
  aoMaDao: 0x3a2740,
  aoMaDaoDam: 0x241829,
  maHuyet: 0x8c2b32,

  // --- Ngũ hành ---
  kim: 0xe3c76a,
  moc: 0x57a862,
  thuy: 0x4f95cc,
  hoa: 0xdd5c33,
  tho: 0xa8834f,

  // --- Linh khí / hiệu ứng ---
  linh: 0x7fe3d0,
  linhDam: 0x2e9c8a,
  than_thuc: 0xa98fd6,
  loi: 0xbfe4ff,
  bang: 0x9fd8f0,
  doc: 0x8fbf4a,
  vang: 0xf0d98a,

  // --- UI / thế giới ---
  troiTren: 0x2e4a6b,
  troiChanTroi: 0x9fb9c9,
  troiDuoi: 0x6b7b7a,
  suongMu: 0x9fb2be,
  nangSom: 0xffe8c2,

  // --- Ánh sáng ---
  /** Nắng chính: vàng ấm, hơi ngả kim. */
  nangKim: 0xffdca6,
  /**
   * Ánh trời cho hemisphere.
   *
   * BỚT bão hoà có chủ ý. Thử 0x5b7fa6 (xanh đậm) trước: mặt chibi chuyển sang
   * xám-lục vì ánh môi trường xanh cộng đèn viền teal triệt hết sắc da ấm — mà
   * mặt nhân vật là thứ không được phép mất màu trong một game chibi.
   */
  troiSang: 0x8296ab,
  /**
   * Ánh dội từ đất.
   *
   * Sáng và ấm, không phải nâu tối. Mặt nhân vật gần như thẳng đứng nên nó nhận
   * khoảng một nửa ánh trời và một nửa ánh đất — để ánh đất tối thì cả khuôn mặt
   * chìm thành một khối xám bất kể ánh trời màu gì.
   */
  datDoi: 0x7d6a52,
  /** Đèn viền linh khí, tách nhân vật khỏi nền. */
  vienLinh: 0x86cbd6,
  /** Sương xa: đậm hơn chân trời nên núi xa đọc ra là núi, không phải sữa. */
  suongSau: 0x7b96a6,
  /** Lửa trong đài luyện đan. */
  luaDan: 0xff9a4a,
} as const

export type PaletteKey = keyof typeof Palette
