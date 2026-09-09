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
  /**
   * Trang phục Hàn Lập theo bản thiết kế nguyên mẫu: ÁO TRẮNG NGÀ VIỀN LAM.
   *
   * Trước đây Hàn Lập mặc lam đậm — cùng tông với đồng môn Thất Huyền Môn
   * (`aoDeTu` 0x7794B8), chỉ khác một bậc độ sáng. Đứng giữa một đám đệ tử thì
   * nhân vật người chơi lẫn hẳn vào nền, mà đó là thứ tệ nhất một game hành
   * động có thể làm. Đảo ngược quan hệ sáng-tối (thân áo TRẮNG, viền LAM) tách
   * hắn ra khỏi mọi thứ khác trên sân mà không cần một màu lạc lõng nào.
   */
  aoHanLap: 0xece8db,
  aoHanLapDam: 0xcbc6b4,
  /** Viền cổ, viền tay, gấu áo của Hàn Lập — lam trung, đủ đậm để cắt nền trắng. */
  vienLamHanLap: 0x5588bb,
  /** Đai lưng Hàn Lập — lam xám nhạt, giữa thân áo trắng và viền lam. */
  daiLungHanLap: 0x9fb4c8,
  /** Tóc Hàn Lập: đen ngả lam, không đen tuyệt đối — đen thuần nuốt hết facet. */
  tocHanLap: 0x1b202a,
  /** Hài Hàn Lập — thạch bản sẫm. */
  hiaHanLap: 0x2b3038,
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
  /**
   * Đầu vệt đuôi: vàng kim BÃO HOÀ.
   *
   * Không dùng lại `vang` (0xF0D98A) được: nó nhạt, và vệt đuôi vẽ bằng phép
   * cộng (additive) nên nền càng sáng thì màu nhạt càng bị nuốt — trên sân đá
   * nó ra một vệt trắng vô sắc. Bão hoà lên thì vệt còn đọc ra là vàng ở mọi nền.
   */
  vetVang: 0xffd75e,
  /** Đuôi vệt đuôi: lam lục linh khí bão hoà, đậm hơn `linh` để nổi trên cỏ. */
  vetLuc: 0x35e0b0,

  // --- UI / thế giới ---
  troiTren: 0x2e4a6b,
  troiChanTroi: 0x9fb9c9,
  troiDuoi: 0x6b7b7a,
  suongMu: 0x9fb2be,
  nangSom: 0xffe8c2,

  // --- Kiến trúc Thất Huyền Môn ---
  /** Ngói lưu ly xanh lục — màu định danh của mái sơn môn. */
  ngoi: 0x3d8f7a,
  ngoiDam: 0x2b6a5b,
  ngoiNhat: 0x5fae99,
  /** Diềm mái và đầu ngói. */
  diemMai: 0xa8cfc0,
  /** Cột và khung cửa sơn đỏ. */
  cotDo: 0xb03a2e,
  cotDoDam: 0x8a2a20,
  /** Vách tường — hồng đất ấm, không phải trắng. */
  vach: 0xc07a68,
  vachDam: 0x9c5a4c,
  /** Đấu củng dưới mái, sơn lam. */
  dauCung: 0x3d5fa8,
  dauCungDam: 0x2a4480,
  /** Bậc thềm và móng đá. */
  themDa: 0xcfc6ac,
  /** Cửa sổ giấy, sáng đèn từ trong. */
  cuaSo: 0xe8b158,
  /** Cánh cửa gỗ. */
  cuaGo: 0x6b4630,

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
