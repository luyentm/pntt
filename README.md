# Phàm Nhân Tu Tiên — Web ARPG chibi lowpoly

Game nhập vai hành động trên nền web, đồ hoạ + hiệu ứng lowpoly, nhân vật chibi,
đi theo thế giới *Phàm Nhân Tu Tiên*: đánh quái, đánh tướng, thu thập vật phẩm và
tu luyện từ **Luyện Khí** → **Trúc Cơ** → **Kết Đan**.

## Chạy

```bash
npm ci && npm run dev
```

Mở http://localhost:5173

| Lệnh | Việc |
|---|---|
| `npm run dev` | Chạy dev server (cổng 5173) |
| `npm run build` | Typecheck + build production vào `dist/` |
| `npm run typecheck` | Chỉ kiểm tra type |
| `npm test` | Chạy test logic (vitest) |

## Điều khiển

| Thao tác | Tác dụng |
|---|---|
| Kéo chuột phải | Xoay camera quanh nhân vật |
| Cuộn chuột | Zoom |
| `` ` `` | Ẩn/hiện bảng debug |
| WASD / phím mũi tên | Di chuyển (theo hướng camera) |
| Chuột trái (hoặc `J`) | Chém — bấm liên tiếp để nối combo 3 nhát. Giữ để chém liên tục |
| Giữ Shift | Đi chậm |
| `1`–`7` | Pháp thuật: 劍 Ngự Kiếm · 風 Phong Độn · 火 Hoả Cầu · 盾 Kim Quang Thuẫn · 雷 Thiên Lôi Phù · 冰 Băng Phong Phù · 竹 Thanh Trúc Phong Vân Kiếm |
| Giữ `F` | Toạ thiền — tăng Tu Vi chậm và đều. Tự thoát khi di chuyển hoặc bị đánh |
| `G` | Uống hết Tiểu Bình linh nhũ để lấy Tu Vi |
| `B` | Đột phá đại cảnh giới (vào màn thử dẫn khí) |
| `Space` | Ngự Kiếm Phi Hành — bật/tắt, mở ở Trúc Cơ |
| `C` / `I` / `K` | Bảng Tu Luyện / Túi Đồ / Luyện Đan (`Esc` đóng) |

Trong màn thử dẫn khí: bấm `Space` mỗi khi con trỏ đi vào vùng sáng.

## Kiến trúc

Chi tiết đầy đủ nằm trong plan. Tóm tắt:

- **Không có asset ngoài nào.** Không texture, không `.glb`, không file âm thanh.
  Model chibi và prop được **sinh bằng code** từ khối cơ bản + vertex color;
  animation là rig `Group` lồng nhau (không xương); âm thanh sinh bằng WebAudio.
  Bundle ~206 KB gz, load tức thì, chạy offline.
- **Vòng lặp fixed-timestep 60Hz + nội suy** (`core/Loop.ts`) — combat và AI xác định,
  không phụ thuộc fps. Số lần **vẽ** khoá ở 60 fps mặc định (`loop.fpsCap`), đổi được
  trong bảng debug → *Hình ảnh → Giới hạn fps*.
- **Va chạm tự viết**, mọi thứ là hình tròn trên mặt phẳng XZ + spatial hash.
  Không dùng physics engine: nhẹ hơn ~1 MB wasm và deterministic nên test được.
- **UI là overlay DOM/CSS**, không vẽ chữ trong canvas (tiếng Việt có dấu trong
  canvas rất tệ).
- **Nội dung là data** (`game/data/`): thêm quái / skill / đan dược = thêm một entry,
  không viết system mới.
- **Mỗi nhân vật là MỘT `SkinnedMesh`** (`art/ChibiRig.ts`): từng khối được gắn cứng
  vào đúng một xương (rigid skinning, `skinWeight = 1`). Cách animate không đổi —
  vẫn xoay khớp bằng số — nhưng cả nhân vật chỉ tốn **1 draw call** thay vì ~10 nếu
  dùng cây `Group`. Với "đại chiến" hàng chục quái thì đó là khác biệt giữa 80 và
  800 draw call.
- **Animation không dùng file**: clip là keyframe sparse được biên dịch sang
  `Float32Array` lúc nạp module (`anim/Clip.ts`), lúc chạy chỉ đọc số và lerp trong
  buffer cấp phát sẵn → không sinh rác mỗi frame. Clip lưu ĐỘ LỆCH so với thế nghỉ,
  nên sửa tỉ lệ nhân vật trong `CHIBI_REST` không làm hỏng animation.
- **Màn chơi qua interface `GameScene`** (`world/Scene.ts`) — điểm cắm để thêm các
  chương cốt truyện về sau mà không phải sửa lõi.

### Prop lặp lại dùng `InstancedMesh`

`art/PropBatch.ts` gộp nhiều bản của cùng một prop vào một `InstancedMesh`. Đánh
đổi: mọi bản dùng chung geometry nên biến thể chỉ còn ở tỉ lệ và góc xoay — bù lại
bằng cách dựng vài **biến thể geometry**, mỗi biến thể một batch. Kết quả: 276 cây
tùng / khóm tre / hòn đá tốn **9 draw call** thay vì 276.

### Thư viện

`three` 0.185.1 · `postprocessing` (outline + bloom) · `lil-gui` (debug) · `vitest`.

> Ghim three ở **0.185.1** vì `postprocessing` yêu cầu `three >= 0.168 < 0.186`.

**Ba thư viện dự kiến ban đầu đã bị loại sau khi va vào yêu cầu thật:**

| Thư viện | Lý do loại |
|---|---|
| `yuka` (AI) | Tách đàn của nó cần `vehicle.neighbors` do `EntityManager` riêng của nó điền → phải nuôi **hai** chỉ mục không gian và đồng bộ vị trí qua lại mỗi frame, trong khi hitbox đã cần một chỉ mục sẵn. Thêm nữa nó dùng `Math.random()` ở 10 chỗ (kể cả `WanderBehavior`), phá tính xác định mà cả game được thiết kế quanh. Điểm mạnh riêng của nó là tìm đường navmesh — đấu trường mở không cần. Tự viết steering hết ~120 dòng. |
| `miniplex` (ECS) | Các thực thể ở đây là những **hồ đồng dạng** (quái, đồng môn, người chơi), không phải tập hợp component thay đổi bất thường. ECS chỉ tiết kiệm được vài chục dòng kiểm tra `if (e.health)`, mà nó KHÔNG giải bài toán chỉ mục không gian — thứ vẫn phải tự viết. Một lớp có kiểu rõ ràng đọc và gỡ lỗi dễ hơn. |
| `troika-three-text` | Giải font bằng cách **tải từ CDN** (`cdn.jsdelivr.net/gh/lojjic/unicode-font-resolver`) lúc chạy, phá vỡ nguyên tắc "không asset ngoài, chạy offline" — mà tiếng Việt có dấu lại là thứ phụ thuộc CDN đó nhiều nhất. Số sát thương chuyển sang **DOM overlay**: nét căng ở mọi zoom, đủ dấu miễn phí, không tốn draw call. |

### Nét viền (`render/effects/EdgeOutlineEffect.ts`)

Viền cel-shading tự viết, suy ra từ depth buffer (5 lần lấy mẫu, không cần normal
buffer). `OutlineEffect` có sẵn của `postprocessing` chỉ tô viền cho object được
*chọn*, còn ở đây cần viền cho **mọi** vật thể — đó chính là thứ làm chibi lowpoly
tách khỏi nền.

Ba lớp phòng vệ chống nét giả trên địa hình lowpoly (mỗi ranh giới facet là một
nếp gấp hình học thật, vẽ hết ra thì mặt đất thành lưới wireframe):

1. **Đạo hàm cấp hai** của độ sâu — mặt phẳng nghiêng cho ~0, chỉ chỗ độ sâu nhảy
   bậc mới vọt lên.
2. **Dập theo góc nhìn** — mặt gần song song tia nhìn thì bỏ, vì ở đó pháp tuyến
   dựng từ depth rất nhiễu. Nhân vật/prop luôn có mặt hướng camera nên không ảnh hưởng.
3. **Tan theo khoảng cách** — nếp gấp tan sớm (16→42), silhouette giữ xa hơn
   (45→95) vì nó là thứ định hình bóng cây/núi trên nền sương.

## Ghi chú kỹ thuật đáng nhớ

Những chỗ đã mất thời gian mò ra, ghi lại để không phải mò lại:

- `composer.setSize(w, h, false)` — thiếu tham số thứ ba thì three ghi
  `canvas.style` bằng px và đè mất CSS `width: 100%`.
- `Renderer` đo kích thước từ **canvas** qua `ResizeObserver`, không từ
  `window.innerWidth` + event `resize` (canvas do CSS bố cục nên đổi kích thước
  trong nhiều trường hợp window không phát event, và đọc `innerWidth` lúc đang
  resize thì sai vĩnh viễn).
- `renderer.info.autoReset = false` + `beginFrame()` — nếu không thì draw call đọc
  ra luôn bằng 1, vì EffectComposer gọi `renderer.render()` nhiều lần mỗi frame.
- Cylinder có **mặt trên kín**, nên xếp đĩa lồng nhau thì đĩa càng rộng phải càng
  thấp; ngược lại nó che kín đĩa bên trong (xem `buildStoneFloor`).
- Tóc chibi là **vòm kín + tấm mặt bán kính lớn hơn**. Mũ cầu đơn thì che mất mắt;
  hai nửa cầu trước/sau thì lệch mép ở thái dương.
- Nhân vật hướng **+Z**. Trong animation: `rx` âm = đưa chi ra trước, gập đầu gối =
  `rx` dương, gập khuỷu = `rx` âm.
- Cự ly camera **17 unit**. Thử 30 thì chibi chỉ còn ~35px, mất hết chi tiết.
- Hitbox đòn đánh là **hình quạt**, không phải hình tròn — và góc quạt được nới
  theo bán kính mục tiêu, nếu không thì boss to đứng sát cạnh vẫn lọt khỏi đòn.
- `Enemy` phải lấy tốc độ từ `combatant.stats.toc`, KHÔNG từ `def.base.toc`. Đọc
  chỉ số nền thì mọi hiệu ứng lên tốc độ (làm chậm, tăng tốc) đều vô tác dụng —
  một lỗi im lặng rất khó phát hiện.
- `resolve()` của va chạm **cộng dồn kiểu Jacobi**; đẩy tuần tự từng vật cản bị
  zig-zag khi kẹt giữa hai vật và hội tụ rất chậm.
- Đòn đánh của người là **lớp phủ** chỉ trên thân trên, nên chân vẫn giữ chu kỳ
  chạy → đánh được trong lúc di chuyển. Thú vồ bằng cả người nên dùng clip toàn thân.
- Lọc mục tiêu PHẢI dùng `isHostile()`, không phải `c.side !== me.side`. Với người
  chơi thì `'ally' !== 'player'` là true, nên phép so sánh thô biến mọi pháp vực và
  phi hành khí thành đánh cả đồng môn — ở đại chiến thì người chơi tự diệt quân mình.
  (Bug này đã có thật, test bắt được, giờ đã khoá bằng test riêng.)
- Điểm ngắm của pháp vực được **CHỐT lúc bấm**, không đọc lại lúc chiêu phát. Đọc
  lại thì rê chuột trong lúc dẫn khí sẽ làm chiêu đi theo chuột và cảm giác điều
  khiển trơn tuột, mất hết sức nặng.
- Ngắm quá xa thì **kẹp về tầm tối đa**, không huỷ chiêu — mất chiêu đọc ra là
  "game không nhận input".
- Sát thương theo thời gian gây theo **nhịp giây**, không rải mỗi frame: 60 con số
  "0.4" mỗi giây thì không ai đọc nổi.
- Trạng thái chồng nhau thì **giữ mạnh hơn**, không cộng dồn — cộng dồn khiến một
  chiêu làm chậm bắn liên tục đóng băng mục tiêu vĩnh viễn.
- `toneMapped: false` là điều kiện BẮT BUỘC để bloom bắt được vật sáng; tone mapping
  ACES kéo mọi màu về dưới ngưỡng luminance.
- Có **hỗ trợ ngắm mềm** (nửa góc 60°): ngắm hoàn toàn theo con trỏ rất dễ trượt
  khi tay đang bấm WASD, và một nhát trượt vì lệch 10° đọc ra là "game không nhận
  input" chứ không phải "mình ngắm sai".
- **Kiến trúc phải theo tỉ lệ CHIBI, không theo tỉ lệ người thật.** Cổng phái cao
  5.2 và cột đá cao 4.4 (đúng tỉ lệ thật) làm nhân vật cao 1.1 trông như con sâu và
  chắn mất khung hình. Cổng 3.2, cột 2.9, đèn 1.6 mới đúng.
- `Terrain` tự dựng lưới thay vì dùng `PlaneGeometry`, để biết chắc mỗi ô chia tam
  giác theo đường chéo nào → `heightAt()` nội suy trên đúng tam giác đang được vẽ,
  bàn chân không bao giờ lún hay lơ lửng (có test đối chiếu trực tiếp với mesh).
- Vùng phẳng của terrain phải **neo theo lưới** (`flatRadius + 1.5·cell`), vì
  `heightAt()` nội suy từ đỉnh lưới nên ô vắt qua biên sẽ nghiêng lấn vào trong.
- `flatten` của terrain dùng **smoothstep**; tuyến tính để lại nếp gấp hiện lên
  thành một vành tròn trông như bờ cao nguyên nhân tạo.
- Mái kiến trúc phải là **hai tấm dốc chụm sống nóc**; một hộp phẳng nằm ngang đọc
  ra là "tấm ván xanh" chứ không phải mái.

### Hiệu năng

- **Khoá 60 fps là mặc định, không phải "không khoá".** Trên màn Liquid Retina XDR
  ProMotion, không khoá nghĩa là 120 fps trên một framebuffer 3134×2096 (6,57 MPx ở
  DPR 2) có MSAA 4× trên target half-float cộng hai pass hậu xử lý — khoảng 790 MPx/s.
  Trên laptop đó là quạt quay, đổi lấy một khác biệt mà đồ hoạ lowpoly gần như không
  thể hiện ra được. Khoá 60 giảm **đúng một nửa** số lần vẽ và **không đổi một bước mô
  phỏng nào** (đo trên bundle thật: 121 vs 240 lần vẽ trong 2 giây, cả hai đều 119
  bước fixed).
- Việc khoá fps **phải có dung sai** (`CAP_TOLERANCE = 0.2`). `requestAnimationFrame`
  không bao giờ gọi đúng mốc; trên màn 60 Hz mà khoá 60 fps, một khung tới ở 16,5 ms
  thay vì 16,67 ms sẽ bị bỏ và khung sau dồn thành 33 ms — tức là khoá 60 lại cho ra
  30 fps giật. Có test cho đúng trường hợp này.
- Khi trễ thì **neo mốc lại theo hiện tại**, không cộng dồn nợ. Cộng dồn thì sau một
  lần đứng máy vòng lặp sẽ vẽ liên tiếp mấy khung để trả nợ — đúng lúc máy yếu nhất.
- Bảng debug nhịp **5 lần/giây**, không phải mỗi khung: `listen()` của lil-gui ghi
  thẳng vào DOM, chạy mỗi khung là 120 lượt cập nhật DOM mỗi giây chỉ để đổi vài con
  số mà mắt không đọc nổi.

### M5 + M6 — tu luyện và vật phẩm

- **Đột phá thất bại KHÔNG tụt đại cảnh giới và không chết** — chỉ mất Tu Vi, tụt một
  tầng nhỏ, và **cộng thêm tỉ lệ cho lần sau** (pity). Một cơ chế xoá được nhiều giờ
  chơi sẽ khiến người chơi không dám thử, mà thứ đáng nhớ ở đây là khoảnh khắc vượt
  qua, không phải nỗi sợ mất mát.
- Màn thử dẫn khí **chỉ CỘNG THÊM vào tỉ lệ** (tối đa +28%), không thay thế phép roll.
  Nếu kỹ năng quyết định hoàn toàn thì "đột phá" biến thành trò bấm nhịp và mất hẳn
  chất cơ duyên; ngược lại nếu không thưởng gì thì màn thử vô nghĩa.
- Bị đánh gián đoạn giữa lúc đột phá thì **huỷ hẳn, KHÔNG tiêu đan dược**. Một viên
  Trúc Cơ Đan là mấy chục phút gom nguyên liệu — mất nó vì một con yêu thử chạy ngang
  thì người chơi sẽ không bao giờ dám đột phá ở ngoài chỗ đã dọn sạch.
- Các vùng sáng của màn thử được đặt trong **ô riêng, không bao giờ chồng nhau**. Rải
  tự do thì hai vùng trùng chỗ, và khi đó một điểm trên thanh phải bấm hai lần mới
  xong — người chơi đọc ra là "bấm trúng mà game không nhận" (có test 300 seed).
- Tu Vi là phần thưởng **chắc chắn**, vật phẩm là phần thưởng **may rủi**. Để cả hai
  đều may rủi thì có những lượt đánh mãi mà không tiến bộ gì.
- Phần thưởng phải trả **trước khi dọn xác** — `reap()` tháo con vật ra khỏi danh sách
  nên sau đó không còn chỗ nào biết nó từng là con gì để quay bảng rơi. Và phải đánh
  dấu con đã trả thưởng: `dead` còn đúng suốt mấy giây diễn cảnh chết, không đánh dấu
  thì mỗi bước fixed lại rơi thêm một lượt.
- **Giá của phi hành tính theo PHẦN linh lực tối đa** (2,2%/giây), không phải hằng số.
  Thử hằng số 3,6/giây trước: tới Kết Đan thì bay được 15 phút liền và phi hành mất
  hẳn tính chất "phải cân nhắc khi nào nên bay". Cùng một lỗi với việc để độ mạnh
  khiên là hằng số.
- Bay thì **không chém được** (hai chân đang đứng trên chính thanh kiếm đó) và **bị
  choáng là rơi**. Không có hai điều đó thì phi hành là lựa chọn luôn đúng, và cả
  phần chiến đấu trên mặt đất thành vô dụng ngay khi vào Trúc Cơ.
- Đủ cao mới bỏ qua va chạm tĩnh (`FLY_CLEARANCE = 0.85`): bỏ ngay từ lúc nhấc lên
  thì nhân vật xuyên thẳng qua tảng đá đang đứng cạnh.
- 33 thanh kiếm trúc gây sát thương theo **vòng quét có nhịp** (0,3 giây/mục tiêu),
  không theo từng thanh. Tính theo từng thanh thì một con quái đứng đúng chỗ ăn 33 đòn
  trong một frame và chết tức khắc bất kể cảnh giới — phá vỡ luật chênh lệch cảnh giới,
  thứ quan trọng nhất của cả hệ chiến đấu.
- Vòng kiếm **bung ra rồi GIỮ**, không loang ra mãi. Thử cho loang tới 7 unit trước:
  33 thanh rải trên vòng lớn nhìn ra là một đống que bay tản mát và người chơi không
  còn điều khiển được gì. Giữ vòng chặt (bán kính 3) thì đàn kiếm đặc, và người chơi
  **lái** được nó bằng cách đi bộ.
- Lưỡi kiếm phải **nghiêng gần vuông góc** quanh trục bay. Để nằm ngang thì từ góc iso
  nó đọc ra là một que gỗ rơi trên đất. Và 33 thanh phải chia thành **ba vòng đều quay
  ngược nhau** — rải tự do thì thành một đống que bay lộn xộn, chia vòng thì đọc ra
  ngay là một đội hình do người tu điều khiển.
- Cột sáng đột phá dùng **cộng sáng (`AdditiveBlending`)**, không phủ mờ. Phủ mờ ở
  opacity 0,9 làm cột thành một tấm ván vàng đặc che kín nhân vật — mà cả khoảnh khắc
  này là để NHÌN nhân vật đang lên cảnh giới.
- Lên **tầng nhỏ** thì hiệu ứng nhỏ có chủ ý. Nếu mỗi tầng cũng nổ cột sáng thì 13 tầng
  Luyện Khí sẽ làm khoảnh khắc đột phá đại cảnh giới mất thiêng.
- Dáng toạ thiền phải **khép tay** rồi gập khuỷu cho hai bàn tay chụm trước bụng. Dáng
  xoè tay ra hai bên đọc ra là "đang đứng chờ"; từ góc iso chỉ có bóng ngoài là đọc
  được, nên khép tay quan trọng hơn mọi chi tiết khác của clip.
- Bảng UI nhận **getter, không nhận giá trị**: stat và cảnh giới đổi ngay giữa lúc bảng
  đang mở (đột phá, uống đan), nên chụp giá trị một lần lúc dựng sẽ làm bảng nói sai mà
  không có gì báo.
- Đan đột phá **không có nút "Dùng"** trong túi đồ — nó bị tiêu trong lúc đột phá. Cho
  nút thì người chơi sẽ bấm và tưởng mình vừa làm mất viên đan quý nhất trò chơi.
- Con trỏ của màn thử dịch một **lớp bọc rộng bằng cả thanh**, kim chỉ nằm trong nó.
  Dịch thẳng cái kim thì phần trăm tính theo bề rộng của kim và con trỏ gần như không
  nhích.

## Tiến độ

- [x] **M0** Scaffold — renderer, camera iso, trời + sương mù, vòng lặp 60Hz, outline, bloom, debug panel
- [x] **M1** Hàn Lập chibi + di chuyển — rig xương, clip idle/walk/run, controller theo hướng camera, va chạm
- [x] **M2** Map sơn môn — terrain noise, cổng phái, đèn đá, đài luyện đan, rừng tùng + khóm tre (instanced)
- [x] **M3** Combat cơ bản — combo 3 nhát, hitbox hình quạt, AI quái, thanh máu, HUD, VFX
- [x] **M4** Pháp thuật & VFX — 6 chiêu, phi hành khí, trạng thái (khiên/băng/thiêu), thanh pháp thuật
- [x] **M5+M6** Tu luyện, đột phá, vật phẩm — 13 tầng Luyện Khí, toạ thiền, Tiểu Bình,
      màn thử dẫn khí + `BreakthroughFx`, Trúc Cơ → Ngự Kiếm Phi Hành, Kết Đan → 33 kiếm trúc,
      drop table, túi đồ, luyện đan, ba bảng UI
- [ ] **M7** Tướng & đại chiến
- [ ] **M8** Hoàn thiện
