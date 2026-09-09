/**
 * BẢNG TINH CHỈNH — mọi con số của phong cách stylized/fantasy nằm ở đây.
 *
 * Tách riêng khỏi mã dựng để tinh chỉnh không phải đọc logic. Mọi màu ghi bằng
 * HEX kèm tên gọi, mọi cường độ kèm khoảng dùng được.
 */

export const TUNE = {
  // ─────────────────────────────────────────────────────────────────────────
  // RENDERER
  // ─────────────────────────────────────────────────────────────────────────
  renderer: {
    /**
     * Phơi sáng. Khoảng dùng được: 0.85 – 1.3.
     *
     * DƯỚI 1 chứ không trên. Trực giác nói ACESFilmic nén cao sáng nên phải bù
     * phơi sáng lên, và bản đầu để 1.25 vì thế — kết quả là cảnh bạc trắng,
     * nhoà, cỏ ra xám-lục và bóng mất hết màu.
     *
     * Cách đúng là NGƯỢC LẠI: hạ phơi sáng xuống 0.95 rồi đẩy `sun.intensity`
     * lên bù lại. Cùng một độ sáng ở vùng có nắng, nhưng vùng bóng tối hơn
     * nhiều — và biên độ sáng-tối rộng ra chính là thứ tạo cảm giác sâu.
     */
    exposure: 0.95,
    /**
     * Cỡ shadow map. 2048 là điểm cân bằng; 4096 nét hơn rõ rệt nhưng tốn gấp
     * bốn bộ nhớ và chậm hơn đáng kể trên laptop.
     */
    shadowMapSize: 2048,
    /**
     * Kiểu bóng mềm: `'vsm'` hoặc `'pcf'`.
     *
     * KHÔNG có lựa chọn `PCFSoftShadowMap`, dù hằng số đó vẫn tồn tại và gán
     * được. Trong three 0.185 `WebGLShadowMap.render()` có đoạn:
     *
     *     if (this.type === PCFSoftShadowMap) {
     *       warn('PCFSoftShadowMap has been deprecated. Using PCFShadowMap instead.')
     *       this.type = PCFShadowMap
     *     }
     *
     * Nghĩa là nó bị HẠ CẤP LÚC CHẠY, ngay ở khung hình đầu tiên. Đặt nó thì
     * đọc lại giá trị sẽ thấy đã thành `PCFShadowMap` — chỉ được một cảnh báo
     * trong console và không có bóng mềm nào.
     *
     * `'vsm'` (VSMShadowMap) là đường bóng mềm THẬT còn lại: nó tôn trọng
     * `shadow.radius` và `shadow.blurSamples`, nên mép bóng mềm được bao nhiêu
     * là do mình chọn. Đổi lại nó có hiện tượng rỉ sáng (light bleeding) ở chỗ
     * hai vật che nhau, và cần `bias` gần 0 chứ không âm sâu như PCF.
     *
     * `'pcf'` thì mép cứng hơn nhưng không có rỉ sáng — dùng khi VSM gây lỗi.
     */
    shadowKind: 'vsm' as 'vsm' | 'pcf',
    /** Số mẫu làm mờ của VSM. 8–16 là khoảng dùng được; cao hơn thì tốn mà gần như không khác. */
    shadowBlurSamples: 12,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ÁNH SÁNG MÔI TRƯỜNG — thứ QUYẾT ĐỊNH màu của bóng đổ
  // ─────────────────────────────────────────────────────────────────────────
  hemisphere: {
    /**
     * Màu trời: xanh lam ngả tím, bão hoà. `#3D47A8`
     *
     * Đây là con số quan trọng nhất của cả bộ. `HemisphereLight` rọi từ trên
     * xuống bằng màu này, và những mặt KHÔNG nhận được nắng thì chỉ còn nó —
     * nên chính nó là màu của bóng đổ. Bóng "ám xanh dương" mà bạn muốn không
     * đến từ việc làm bóng xanh, mà từ việc ánh môi trường vốn đã xanh.
     *
     * Phải BÃO HOÀ, không chỉ tối. `#2E3A6E` của bản đầu tối nhưng xám, và
     * bóng đổ ra xám nâu chứ không xanh. `#3D47A8` sáng hơn mà bão hoà hơn —
     * và đó mới là lúc bóng đổ đọc ra màu lam tím.
     *
     * Đậm hơn (`#2A3480`) → huyền bí hơn, vùng tối dễ mất chi tiết. Nhạt hơn
     * (`#5A64C4`) → dịu và dễ đọc hơn, bớt kịch tính.
     */
    skyColor: 0x3d47a8,
    /**
     * Màu đất dội lên: nâu đất ấm. `#5A4636`
     *
     * Rọi các mặt hướng XUỐNG, và nó là nguồn duy nhất chống lại màu lam của
     * trời. Bản đầu để `#3A4030` (lục sẫm) thì mặt nhân vật — gần như thẳng
     * đứng nên nhận nửa trời nửa đất — chìm thành một khối xám lạnh. Nâu ấm
     * kéo da và áo về lại phía đỏ, đúng tông nhân vật mà bạn muốn.
     */
    groundColor: 0x5a4636,
    /**
     * Cường độ. Khoảng dùng được: 0.6 – 1.4.
     *
     * Đây là cái van điều tiết ĐỘ SÂU của bóng. Cao thì bóng nhạt và cảnh
     * phẳng; thấp thì bóng sâu nhưng dễ đen kịt.
     *
     * 1.0 nghe như ngược với "bóng sâu", nhưng cặp phải đọc CÙNG NHAU: ở
     * 3.4 / 1.0 tỉ lệ nắng-so-với-môi-trường là 3.4:1, còn phơi sáng đã hạ về
     * 0.95. Nhờ vậy bóng vừa đủ tối để có chiều, vừa đủ sáng để thấy rõ nó
     * đang ám MÀU LAM chứ không phải chỉ là một vùng đen.
     */
    intensity: 1.0,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // NẮNG — key light
  // ─────────────────────────────────────────────────────────────────────────
  sun: {
    /**
     * Vàng cam rực. `#FFA947`
     *
     * Bão hoà hơn `#FFC469` của bản đầu. Với lowpoly thì MÀU là toàn bộ thông
     * tin bề mặt vì không có texture, nên nắng nhạt màu làm mọi vật liệu nhạt
     * theo. Dịu hơn: `#FFC469`. Gắt hơn, ngả chiều tà: `#FF8F33`.
     */
    color: 0xffa947,
    /**
     * Cường độ. Khoảng dùng được: 2.0 – 4.5.
     *
     * Tương phản của cả ảnh là TỈ LỆ giữa con số này và `hemisphere.intensity`,
     * còn độ sáng tổng thể là `renderer.exposure`. Hai thứ đó chỉnh ĐỘC LẬP
     * được, và đó là mẹo quan trọng nhất ở đây: muốn sâu hơn thì đẩy con số
     * này lên VÀ hạ phơi sáng xuống, chứ đừng chỉ đẩy một cái.
     *
     * Ở 3.4 / 1.0 tỉ lệ là 3.4:1 với phơi sáng 0.95.
     */
    intensity: 3.4,
    /**
     * Hướng tới mặt trời, sẽ được chuẩn hoá.
     *
     * Y thấp (0.45–0.65) cho bóng DÀI và chếch, đó là thứ tạo "vệt nắng". Y cao
     * (>0.85) cho nắng gần đỉnh đầu: bóng bé xíu dưới chân, cảnh phẳng lì.
     */
    direction: { x: -0.55, y: 0.58, z: 0.4 },
    /** Nửa chiều rộng khung bóng, world unit. Nhỏ = bóng nét hơn ở gần. */
    shadowExtent: 24,
    /**
     * Chống bóng răng cưa. Âm quá thì bóng tách khỏi chân vật (peter-panning).
     *
     * VSM cần `bias` gần 0; giá trị âm sâu kiểu PCF làm bóng VSM biến mất hẳn.
     */
    shadowBias: -0.00008,
    shadowNormalBias: 0.03,
    /**
     * Bán kính làm mềm mép bóng. CHỈ có tác dụng với VSM.
     *
     * Với `PCFShadowMap` thì three dùng một kernel cố định và tham số này bị bỏ
     * qua hoàn toàn — đặt bao nhiêu cũng không đổi gì.
     */
    shadowRadius: 3.2,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ĐÈN ĐIỂM — tương phản màu
  // ─────────────────────────────────────────────────────────────────────────
  points: {
    /** Xanh lục lam ở các góc tàn tích. `#4FE0D8` */
    coolColor: 0x4fe0d8,
    /**
     * three r155+ dùng đèn ĐÚNG VẬT LÝ: intensity là candela và `decay: 2` là
     * nghịch đảo bình phương. Nên 4 candela ở cách 2 unit chỉ còn ~1 — đừng
     * lấy con số của các bản three cũ, chúng lớn hơn cả chục lần.
     *
     * VÀ vì là nghịch đảo bình phương, con số này gắn chặt với việc bạn đặt
     * đèn CÁCH BỀ MẶT bao xa. Thử 22 candela với các đèn đặt ngay trong chóp
     * cột đá thì chóp cột cháy trắng thành một quầng bloom to — không phải vì
     * 22 quá lớn, mà vì khoảng cách gần bằng 0. Quy tắc: đặt đèn BÊN CẠNH vật
     * cần rọi, đừng đặt bên trong nó.
     */
    coolIntensity: 6,
    coolDistance: 16,
    /** Đỏ cam gần nhân vật. `#FF7043` */
    warmColor: 0xff7043,
    warmIntensity: 9,
    /**
     * Bán kính tắt. 9 là vũng sáng GỌN quanh nhân vật.
     *
     * Thử 12 thì nó loang ra gần hết sân đá và cả sân hoá hồng — mất hẳn tác
     * dụng làm điểm nhấn, vì điểm nhấn chỉ là điểm nhấn khi có chỗ tối cạnh nó.
     */
    warmDistance: 9,
    /**
     * Cao độ của đèn theo nhân vật, so với chân. Ngang ngực, không phải trên đầu.
     *
     * 1.6 thì đèn nằm ngay trên đỉnh đầu, và đèn điểm thẳng trên đầu chỉ rọi
     * được mảng tóc đen — nhìn vào không thấy nhân vật sáng lên chút nào. Hạ
     * về 1.0 thì nó rọi thân và áo, đồng thời dội một vũng ấm ra mặt đất quanh
     * chân: đó mới là thứ tách nhân vật khỏi nền.
     */
    warmHeight: 1.0,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // SƯƠNG MÙ VÀ NỀN — phải CÙNG MỘT MÀU
  // ─────────────────────────────────────────────────────────────────────────
  fog: {
    /**
     * Xanh lam thẳm ngả teal. `#16324A`
     *
     * `scene.background` dùng ĐÚNG màu này. Lệch nhau thì đường chân trời hiện
     * ra thành một vệt rõ ở chỗ địa hình xa gặp nền — và cả cảm giác "tan vào
     * xa" biến mất.
     */
    color: 0x16324a,
    /**
     * Mật độ của `FogExp2`. Rất nhạy: 0.012 là sương mỏng thấy xa ~120 unit,
     * 0.03 là sương dày chỉ thấy ~50 unit. Bước tinh chỉnh nên là 0.002.
     *
     * 0.032 chứ không 0.016: sân đấu chỉ rộng khoảng 30 unit, nên ở 0.016 thì
     * mọi thứ người chơi đang nhìn mới bị nhuộm ~20% và sương gần như không
     * tồn tại. Phải dày đến mức này thì cỏ ở xa mới thật sự tan vào màu lam.
     */
    density: 0.032,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // BLOOM
  // ─────────────────────────────────────────────────────────────────────────
  bloom: {
    /**
     * Ngưỡng sáng để một pixel bắt đầu loé. Khoảng dùng được: 0.7 – 0.95.
     *
     * Đây là cái van chống LOÁ TOÀN MÀN HÌNH. Hạ xuống 0.5 thì cả mặt đất được
     * nắng chiếu cũng loé và ảnh mất hết nét. Cao thì chỉ những chi tiết
     * `emissive` và vùng nắng gắt nhất mới sáng lên — đó là thứ bạn muốn.
     */
    threshold: 0.85,
    /** Độ mạnh. Khoảng dùng được: 0.3 – 1.0. Trên 1.2 là sương khói mù mịt. */
    strength: 0.7,
    /** Độ loang. 0.4 cho quầng gọn, 0.9 cho quầng bồng bềnh. */
    radius: 0.7,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // VẬT LIỆU
  // ─────────────────────────────────────────────────────────────────────────
  material: {
    /**
     * Nhám cao, kim loại thấp — đúng cho stylized.
     *
     * `roughness` thấp (<0.4) cho ra highlight bóng loáng, đọc ra là nhựa hoặc
     * kim loại và phá ngay chất vẽ tay. `metalness` trên 0 thì vật thể lấy màu
     * từ môi trường phản chiếu; không có envMap thì nó thành ra ĐEN.
     */
    roughness: 0.9,
    metalness: 0.02,
    /**
     * Cường độ phát sáng của chi tiết rune / cầu phép.
     *
     * Phải LỚN HƠN 1 để vượt ngưỡng bloom sau tone mapping. Ở 1.0 thì màu
     * emissive chỉ làm vật sáng hơn một chút mà không loé ra ngoài viền.
     */
    emissiveIntensity: 2.2,
  },
} as const

export type StylizedTune = typeof TUNE
