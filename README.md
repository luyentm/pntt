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

## Triển khai (GitHub Pages)

Đẩy lên `main` là tự deploy — `.github/workflows/deploy.yml` chạy test, build rồi
publish. Site ở `https://<user>.github.io/pntt/`.

Workflow tự bật Pages ở chế độ đúng (`configure-pages` với `enablement: true`), nên
không phải vào Settings bấm gì. **Lý do phải có tham số đó**: repo mặc định ở chế độ
*Deploy from a branch* (`main`, gốc), và ở chế độ đó Pages phục vụ **mã nguồn thô** —
`index.html` trỏ vào `./src/main.ts`, mà TypeScript thì trình duyệt không chạy được.
Lượt deploy đầu tiên đã xanh mà site vẫn hỏng đúng vì thế: hai deploy chạy song song
và bản legacy thắng. Đây là thay đổi cài đặt trên repo, không chỉ là code — muốn quay
lại thì *Settings → Pages → Source*.

Ba điểm phải đúng để chạy được trên Pages, và đều đã xử lý:

- **`base: './'` trong `vite.config.ts`.** Pages của repo phục vụ tại đường dẫn con
  `/pntt/`, nên base `/` sẽ làm mọi asset trỏ về `https://<user>.github.io/assets/…`
  và 404 hết. Đóng cứng `/pntt/` thì chạy được Pages nhưng hỏng `vite preview`, hỏng
  khi mở `dist` từ ổ đĩa, và hỏng luôn nếu repo đổi tên — `./` đúng ở cả bốn.
  An toàn vì đây là một trang duy nhất, không có router lồng đường dẫn.
- **Pages phải ở chế độ Actions, không phải branch.** Xem đoạn trên — đây là chỗ
  duy nhất mà "workflow xanh" không có nghĩa là "site chạy".
- **`public/.nojekyll`.** Không cần cho đường deploy bằng Actions, nhưng cần ngay khi
  ai đó chuyển sang deploy từ branch — Jekyll bỏ qua mọi thứ bắt đầu bằng `_`.
- **Bảng debug ẩn sẵn ở bản phát hành** (`import.meta.env.PROD`), vẫn mở được bằng
  `` ` ``. Đây là URL công khai: người vào lần đầu mà thấy bảng debug chiếm một phần
  ba màn hình kèm nút "Nhảy tới Kết Đan" thì vừa không nhìn ra game, vừa mất trắng
  toàn bộ nội dung mà cả bản demo được xây quanh.

Không có gì cần server: không API, không asset ngoài, không font CDN. `dist` là ba
file tĩnh (~218 KB gz) chạy được ở bất kỳ host tĩnh nào.

**Chưa có điều khiển cảm ứng** (plan để dành). Menu chính tự phát hiện máy chỉ có
cảm ứng và nói rõ cần bàn phím + chuột, thay vì để người dùng loay hoay với một màn
hình không phản hồi.

## Điều khiển

| Thao tác | Tác dụng |
|---|---|
| Kéo chuột phải | Xoay camera quanh nhân vật |
| Cuộn chuột | Zoom |
| `` ` `` | Ẩn/hiện bảng debug |
| WASD / phím mũi tên | Di chuyển (theo hướng camera) |
| Chuột trái (hoặc `J`) | Chém — bấm liên tiếp để nối combo 3 nhát. Giữ để chém liên tục |
| — | **Tự ngắm bật mặc định**: đòn đánh và pháp thuật tự nhắm con quái có vòng vàng dưới chân. Tắt trong *Cài đặt* để ngắm bằng chuột |
| Giữ Shift | Đi chậm |
| `1`–`7` | Pháp thuật: 劍 Ngự Kiếm · 風 Phong Độn · 火 Hoả Cầu · 盾 Kim Quang Thuẫn · 雷 Thiên Lôi Phù · 冰 Băng Phong Phù · 竹 Thanh Trúc Phong Vân Kiếm |
| Giữ `F` | Toạ thiền — tăng Tu Vi chậm và đều. Tự thoát khi di chuyển hoặc bị đánh |
| `G` | Uống hết Tiểu Bình linh nhũ để lấy Tu Vi |
| `B` | Đột phá đại cảnh giới (vào màn thử dẫn khí) |
| `Space` | Ngự Kiếm Phi Hành — bật/tắt, mở ở Trúc Cơ |
| `C` / `I` / `K` | Bảng Tu Luyện / Túi Đồ / Luyện Đan (`Esc` đóng) |
| `Enter` | Khởi trận — mở đợt kế tiếp của "Thất Huyền Môn thủ trận" |
| `Esc` | Đóng bảng đang mở; không có bảng nào thì mở menu tạm dừng |

Trong màn thử dẫn khí: bấm `Space` mỗi khi con trỏ đi vào vùng sáng.

## Kiến trúc

Chi tiết đầy đủ nằm trong plan. Tóm tắt:

- **Không có asset ngoài nào.** Không texture, không `.glb`, không file âm thanh.
  Model chibi và prop được **sinh bằng code** từ khối cơ bản + vertex color;
  animation là keyframe biên dịch sang `Float32Array`; âm thanh sinh bằng WebAudio
  (oscillator + bồi âm phi điều hoà, nhiễu trắng từ bộ sinh số tự viết).
  Bundle ~218 KB gz, load tức thì, chạy offline.
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

### Dãy nhà Thất Huyền Môn

Nhà sinh bằng code từ khối cơ bản + vertex color như mọi prop khác — không một file
model nào. Ngói lưu ly xanh lục, cột sơn đỏ, vách hồng đất, đấu củng sơn lam.

- **Mái là một ĐƯỜNG CONG thật**, không phải hai tấm phẳng. Mặt cắt `u^1.45` cho dốc
  gắt ở sống nóc và thoải dần xuống diềm, cộng một đoạn vểnh lên ở 22% cuối. Dùng `u`
  tuyến tính thì ra mái nhà kho, mất hẳn nét kiến trúc — mà mái cong có đầu vểnh chính
  là điểm nhận diện duy nhất người chơi đọc được ở khoảng cách iso.
- Dấu trong `rotateX(atan2(-dy, dz))` của từng đốt mái rất dễ đặt sai, và kết quả là
  mái gập ngược lên trời. Đã ghi lại phép suy ra ngay tại chỗ.
- **Hàng ngói so le hai tông màu.** Ở cỡ này thì từng viên ngói không đọc được, nhưng
  các HÀNG thì có — và so le màu là cách rẻ nhất để có hàng, thay vì dựng từng viên.
  Đầu ngói ở mép diềm thì làm thật bằng nửa hình trụ: đó là chi tiết đọc rõ nhất.
- **Thứ tự ưu tiên chi tiết chọn theo những gì ĐỌC ĐƯỢC ở ~20 unit**: mái cong trước,
  rồi cột đỏ và đấu củng lam, rồi mới cửa và cửa sổ. Hoa văn trên vách thì không làm —
  ở cỡ đó nó không chiếm nổi một pixel.
- **Cửa sổ giấy là mesh RIÊNG** với material glow: nó phải bỏ qua tone mapping để bloom
  bắt được, còn thân nhà thì nhận sáng bình thường. Hai yêu cầu đó không thể ở cùng một
  material, nên mỗi biến thể nhà cần hai `PropBatch`.
- **Móng đá dày 0.46 có lý do thật**: nó vừa là bậc thềm, vừa che khe hở khi nhà đặt
  trên địa hình gợn. Cao độ lấy theo góc CAO NHẤT của móng chứ không theo tâm — lấy tâm
  thì góc cao của nhà lún vào đất.
- **Va chạm: nhiều hình tròn rải dọc chiều dài**, bán kính lấy theo chiều NGẮN để không
  chặn rộng hơn thực tế. Một hình tròn không bao nổi một cái nhà hình chữ nhật. Đã kiểm:
  đi từ trước vào chính điện bị chặn ở z = 39,7 (nhà ở z = 42), từ bên chặn ở x = 3, còn
  đi dọc giữa phố thì thông. Đứng ĐÚNG tâm nhà thì không bị đẩy — hai lực đẩy đối xứng
  triệt tiêu nhau, đúng tính chất đã ghi của bộ giải Jacobi, và không tới được bằng cách
  đi bộ.
- **Đặt ở phía +Z, bên ngoài cổng phái.** Vòng sinh quái của đợt là 13–30 và lớp quân
  hậu cảnh ở phía −X; đặt nhà vào hai vùng đó thì hoặc nhà chắn mất trận đánh, hoặc quái
  sinh ra trong nhà. Ở +Z thì từ sân nhìn ra cổng là thấy cả dãy phố phía sau, và người
  chơi hồi sinh ở cổng nên đó là thứ đầu tiên họ thấy.
- **Phải có vùng giữ trống cho lối đi.** Cây tránh được NHÀ nhờ va chạm tĩnh nhưng không
  tránh được LỐI ĐI — một cây tùng mọc giữa phố ngay trước cửa chính điện làm cả trục
  nhìn mất ý nghĩa. Khóm tre và đá nhỏ không đi qua `tryPlace` nên phải chặn riêng.
- **Đèn phố là cần thật, không phải trang trí**: cả dãy nhà nằm ngoài mọi nguồn sáng
  điểm nên nó tối đến mức chỉ còn đọc được mấy ô cửa sổ sáng.

7 căn, 3 biến thể → **6 draw call** cho toàn bộ dãy phố (3 thân + 3 cửa sổ).

### Hệ hạt

Hiệu ứng ban đầu chỉ có mảnh vỡ + vệt chém + vòng loang, nên bảy chiêu khác nhau nhìn
ra gần như một chiêu bảy màu. Thêm một lớp hạt dùng chung và ba lớp phụ.

- **Vẫn tự viết, không dùng thư viện particle.** Thư viện sinh ra sprite mờ, còn cả
  game này là lowpoly có mặt cắt — hạt cũng phải là khối có facet mới cùng chất. Đây là
  quyết định từ đầu project và vẫn đúng.
- **Ba dáng hạt, mỗi dáng một `InstancedMesh`** → cả lớp hạt tốn đúng 3 draw call.
  `shard` (tứ diện, mảnh vỡ) · `spark` (hộp thuôn, **xoay theo vận tốc** và dài ra theo
  tốc độ — chính việc đó làm nó đọc ra là tốc độ, một khối vuông bay nhanh vẫn chỉ là
  khối vuông) · `mote` (bát diện nhỏ, đốm linh khí).
- **Dùng mảng typed, không mảng object**: ba dáng × 256 hạt × 15 trường. Mảng typed vừa
  gọn hơn vừa không tạo 768 object cho GC phải theo dõi.
- **Mỗi ngũ hành một CHẤT, không chỉ một màu.** Hoả: tro nóng bay lên, trọng lực âm, cản
  cao. Thuỷ: mảnh băng rơi, trọng lực mạnh, không cản. Kim: tia lửa bắn thẳng và tắt sớm.
  Mộc: đốm lơ lửng, cản rất cao. Chỉ đổi màu thì bảy chiêu vẫn là một chiêu bảy màu.
- **Dáng `implode` là phần quan trọng nhất**: hạt sinh trên vỏ cầu rồi bay VÀO tâm trong
  lúc đang niệm chú. Nó làm chiêu có cảm giác được DỰNG LÊN thay vì bật ra từ không khí —
  và nó cũng là lời báo trước cho đối thủ, nên vừa đẹp vừa công bằng. `skill:cast` được
  mở rộng thêm vị trí, ngũ hành và thời gian dẫn khí để dựng được đoạn này.
- **Tia sét thật cho Thiên Lôi Phù** (`LightningBolt`): đường gấp khúc dựng LẠI mỗi lần
  giáng, cộng ba nhánh con. Dùng lại đúng một hình thì lần thứ hai người chơi nhận ra
  ngay và nó thành một cái sticker. Chi phí là ghi lại một `Float32Array` cấp phát sẵn.
- **Vết còn lại trên đất** (`GroundMarks`): vệt cháy, mảng băng, nằm 2–3 giây. Một chiêu
  diện rộng mà không để lại gì thì nó chỉ là một tia sáng loé qua — người chơi không có
  bằng chứng nào rằng chỗ đó vừa bị đánh.
- **Vệt sau phi hành khí**, chặn nhịp 0,035 giây. Chặn nhịp Ở TRONG `ProjectileSystem`
  chứ không ở lớp VFX: lớp VFX nhận vệt qua một hook không có danh tính của từng viên,
  nên nó không thể biết hai lời gọi liền nhau là của một viên hay hai viên.

Bốn chỗ phải sửa khi nối vào:

- **`AreaBurst` đang phủ mờ ở opacity 0,9**, nên cái cột của Thiên Lôi Phù là một tấm
  vàng đặc che kín một phần ba khung hình — và che mất chính tia sét vừa dựng. Đổi sang
  cộng sáng (cùng lỗi đã sửa ở `BreakthroughFx`), và bỏ hẳn cột cho Thiên Lôi Phù vì giờ
  đã có tia sét thật.
- **Đàn kiếm trúc phát `skill:area` mười lần mỗi giây** suốt 5 giây. Với lớp hạt mới đó
  là ~1500 hạt và 50 vết cháy chồng lên nhau. Tách hẳn hai đồng hồ: sát thương giữ nhịp
  dày 0,1 giây, hình ảnh 0,6 giây — và đếm cả hai ở chỗ có `dt` thật, vì trừ theo hằng
  số trong `strikeRing` sẽ sai đơn vị (hàm đó được gọi mỗi 0,1 giây, không mỗi
  `HIT_INTERVAL`).
- `emit()` phải ghi **ma trận đầu tiên** ngay, không chờ `update()`: nếu chờ thì hạt vừa
  sinh còn giữ ma trận cũ (đã bị đẩy xuống y = −999 lúc tắt) trong đúng một khung.
- Hạt cũng phải **xác định theo seed** — một lời gọi `Math.random()` lẻ trong lớp hạt là
  đủ phá vỡ tính chất mà cả game được thiết kế quanh. Có test đối chiếu hai lần chạy
  cùng seed.

Đo ở đỉnh tải: **768 hạt (đầy hồ) + 55 nhân vật + đàn kiếm = 1,23 ms/khung** trên ngân
sách 16,7 ms, 149 draw call.

#### Hai dáng billboard mềm — chỗ duy nhất phá quy tắc lowpoly

`haze` (cộng sáng — quầng lửa, kim quang) và `smoke` (alpha tối — khói thật). Chỉ Hoả
Cầu và đột phá được dùng.

- **Cộng sáng KHÔNG THỂ làm ra khói.** Nó chỉ cộng thêm sáng, còn khói phải che bớt —
  thử cộng sáng với màu khói trước và ra một quầng phát sáng, đọc ra là lửa. Ngược lại
  alpha tối không làm được quầng lửa. Một vụ nổ thật có cả hai: loé sáng rồi mới ra khói,
  nên phải là hai hồ riêng với hai `blending` khác nhau.
- **Texture mềm sinh bằng code** (`DataTexture` 64×64, dốc alpha `smoothstep`). Đây là
  cách duy nhất có hạt mềm mà không phá tính chất "không một file asset nào": nó tốn
  16 KB bộ nhớ và **không thêm một byte nào vào bundle**.
- **`DoubleSide` là bắt buộc, không phải cho chắc.** `PlaneGeometry` hướng mặt về +Z còn
  camera nhìn theo −Z của chính nó, nên copy quaternion camera vào billboard làm mặt
  phẳng quay RA SAU và `FrontSide` cull sạch — hạt có trong dữ liệu, mesh `visible`, đủ
  instance, mà trên màn hình không có gì.
- Khói `renderOrder` 6, quầng lửa 7: khói che, quầng cộng sáng. Sai thứ tự thì quầng bị
  khói làm mờ thay vì rực lên trên nền khói.
- Billboard **phình ra** rồi mờ, không thu nhỏ: khói thật loang ra khi nguội, còn thu nhỏ
  đọc ra là hút vào. Và "mờ dần" ở đây là kết quả của việc cùng một lượng sáng bị trải ra
  diện tích lớn hơn — instance không có alpha riêng.

**Chi phí, đo được:**

| | ms/khung (trung vị 7 lô) |
|---|---|
| 768 hạt khối đặc | 3,66 |
| + billboard (32 haze + 24 smoke) | **3,74** |
| 768 hạt khối đặc (lô đối chứng thứ hai) | 3,86 |

Hai lô đối chứng lệch 0,20 ms, lớn hơn khoảng cách 0,08 ms giữa có và không billboard —
tức là **ở hạn mức này chi phí không đo được**. Đối chiếu với phép đo ở đầu kia: cùng 768
hạt cùng hình học, đổi hết sang cộng sáng ở cỡ phủ kín màn hình thì đắt **gấp 2,05 lần**
(3,31 → 6,77 ms). Kết luận: quy tắc lowpoly không đắt vì hình học — nó đắt vì **diện tích
phủ của hạt trong suốt**, nên nới quy tắc bằng một *hạn mức phủ màn hình* là gần như miễn
phí, còn nới bằng cách bỏ hẳn thì không.

### Chế độ trình diễn thần thông

Chọn từ menu chính (*Xem thần thông*). Mở hết cảnh giới Kết Đan nên cả 7 pháp thuật,
ngự kiếm phi hành và 33 kiếm trúc đều dùng được ngay.

- **Showreel tự chạy** đi qua 11 mục — combo cận chiến, 7 pháp thuật, phi hành, toạ
  thiền, đột phá — kèm tên và chú thích cho từng thứ. `P` đổi giữa tự chạy và tự chơi,
  `Q`/`E` lật mục, hoặc bấm thẳng vào danh sách bên trái.
- Danh sách hiện **hết** kịch bản chứ không chỉ mục đang diễn: người vào đây để xem Hàn
  Lập có những gì, nên phải thấy toàn bộ ngay và nhảy tới cái mình muốn, không phải ngồi
  đợi showreel đi tới.
- **Chờ 0,9 giây sau khi hiện chú thích rồi mới diễn.** Chữ và chiêu nổ cùng lúc thì mắt
  bị chia hai chỗ và không đọc được cái nào.
- **Bia đỡ là `passive`** — không tìm mục tiêu, không ra đòn, nhưng vẫn là phe địch nên
  mọi chiêu vẫn ăn vào đủ cả đẩy lùi, đóng băng và thiêu đốt. Để chúng đánh trả thì mỗi
  mục trình diễn bị một con quái xông vào cắn ngang. Máu ×40 để chúng không chết giữa
  lúc đang diễn.
- **KHÔNG chạm vào tiến độ.** Nó ghi đè cảnh giới trong bộ nhớ nhưng không bao giờ ghi
  ra `localStorage`, và "Lưu và về menu" trong lúc trình diễn cũng không ghi — ghi cảnh
  giới Kết Đan của chế độ xem vào bản lưu sẽ xoá sạch tiến độ thật. Đã kiểm cả vòng:
  lưu → vào trình diễn → về menu → Tiếp tục, ra đúng tiến độ cũ.
- `freeCast` bỏ giá linh lực nhưng **giữ hồi chiêu**: hồi chiêu là thứ giữ nhịp cho
  showreel, bỏ nó thì mỗi mục thành một tràng chiêu chồng lên nhau. Bộ trình diễn tự xoá
  hồi chiêu của ĐÚNG ô nó cần, nên Thanh Trúc Phong Vân Kiếm (hồi 22 giây) vẫn diễn được
  trong một mục 9 giây.
- Bộ điều phối phải **tắt trạng thái kéo dài khi rời mục**: bay và toạ thiền là bật/tắt
  chứ không phải một cú nổ, không tắt thì nhân vật vẫn lơ lửng trong lúc showreel đã
  sang mục khác.

Ba chỗ phải sửa khi nối vào:

- Dùng `P`/`Q`/`E`, **không** dùng `Space` và mũi tên — `Space` đã là phím ngự kiếm phi
  hành và mũi tên đã là phím di chuyển. Chồng lên nhau thì một lần bấm `Space` vừa lật
  showreel vừa cất nhân vật lên trời.
- `Esc` phải bắt **trong** hàm đọc phím của chế độ trình diễn: đường `Esc` thường nằm
  trong `updateCultivationInput`, mà hàm đó không chạy ở chế độ này.
- `WaveBanner.update()` tự chọn thẻ theo trạng thái bộ điều phối, và trạng thái đó là
  `idle` sau khi reset — nên nó **dựng lại** thẻ "bấm ENTER để khởi trận" ngay khung sau
  khi vào chế độ trình diễn, đè lên đúng cái thẻ đang giới thiệu chiêu. Gọi `hide()` một
  lần lúc vào là không đủ; phải chặn cả lời gọi `update` mỗi khung.

### Ánh sáng

Cảnh ban đầu nhìn ra "nhạt nhoà": cỏ, đá và cột đều nằm trong **cùng một dải xám-lục
hẹp**, bóng gần như không thấy, và không có gì tách nhân vật khỏi nền. Bốn nguyên nhân,
sửa cả bốn — và nguyên nhân lớn nhất KHÔNG phải ánh sáng:

- **Cả luyện võ trường ra đúng một màu, và đó là lỗi nội dung.** Màu terrain suy từ cao
  độ và độ dốc, mà sân đấu nằm trong *vùng phẳng* nên cả hai đều là hằng số ở đó. Không
  cấu hình ánh sáng nào chữa được một mặt phẳng một màu. Thêm nhiễu màu hai tần số vào
  vertex color: một dải rộng cho từng vạt cỏ, một dải hẹp cho lấm tấm trong vạt. Đo được:
  dải sáng trong sân từ **0.008 lên 0.049**. Lần đầu tôi đặt hệ số 0.5/0.62 và *nghĩ* là
  xong — phải đo mới thấy mắt không thể thấy gì ở mức đó.
- **Hemisphere quá mạnh** (0.85 so với nắng 1.75). Nó rọi từ cả trên và dưới nên không
  mặt nào thật sự nằm trong tối: mọi khối mất chiều, và đổ bóng chỉ còn một vệt xám nhạt.
  Nay 0.46 / nắng 1.95, và hai màu của hemisphere **đối nhau về nhiệt độ** (trời xanh
  lạnh, đất nâu ấm) nên mặt hướng lên và hướng xuống khác nhau cả về màu, không chỉ độ
  sáng — đó là thứ làm khối lowpoly có chất liệu thay vì trông như nhựa xám.
- **Sương bắt đầu ở 30 unit**, mà sân đấu rộng khoảng 30 — gần như toàn bộ những gì
  người chơi đang nhìn đều nằm trong sương. Đẩy ra 44–165, và làm màu sương **đậm hơn**
  chân trời: sương sáng bằng trời thì địa hình xa lẫn vào nền thành một dải sữa, sương
  đậm hơn thì rừng xa hiện lên thành từng lớp bóng.
- **Không có chấm màu.** Thêm tương phản + bão hoà + vignette, gộp CHUNG một pass với
  viền (cả ba đều không có tích chập nên postprocessing hợp vào cùng một shader).

Thêm mới:

- **Đèn viền linh khí** — directional thứ hai, không đổ bóng, rọi từ phía sau và thấp,
  màu teal. Đây là nguồn quan trọng nhất về mặt cảm giác "tu tiên": nhân vật và quái
  luôn có một đường sáng lạnh ở rìa tách khỏi hậu cảnh. Gần như miễn phí vì không có bóng.
- **Hai đèn điểm làm điểm nhấn**, không phải để soi cảnh: một đốm lửa ấm ở đài luyện đan
  và một quầng linh khí lạnh giữa sân. Ánh sáng đều khắp thì không có chỗ nào đáng nhìn.
- **Nắng hạ từ 51° xuống ~42°** cho bóng dài — bóng dài là thứ nói cho mắt biết mặt đất
  có hướng.
- **Tone mapping đổi từ ACES sang Neutral** (Khronos PBR Neutral). ACES nén cao sáng bằng
  cách kéo màu về phía trắng; với lowpoly — nơi MÀU là toàn bộ thông tin bề mặt vì không
  có texture — nó vừa làm nhạt màu vừa khiến cỏ cháy trắng ngay khi tăng nắng.

Hai chỗ sai mà chỉ thấy được khi xem từng khung hình:

- Nắng 2.35 làm **cỏ và nhân vật cháy trắng**; ngược lại hemisphere 0.38 với màu trời đậm
  làm **mặt chibi chuyển sang xám-lục** — ánh môi trường xanh cộng đèn viền teal triệt hết
  sắc da ấm. Mặt nhân vật là thứ không được phép mất màu trong một game chibi, nên màu
  trời của hemisphere phải BỚT bão hoà và màu đất phải sáng-ấm chứ không nâu tối (mặt gần
  như thẳng đứng nên nó nhận khoảng nửa ánh trời nửa ánh đất).
- three r155+ dùng đèn **đúng vật lý**: `PointLight.intensity` là candela và `decay: 2` là
  nghịch đảo bình phương, nên 9 candela ở cách 1,5 unit đã cháy trắng cả cái đài. Giá trị
  dùng được là 3.4 và 2.2.

Mọi con số trên đều dò bằng **mắt trong game** qua nhóm "Ánh sáng" và "Chấm màu" của bảng
debug, không tính ra — khoảng dùng được hẹp hơn tôi tưởng.

### Bộ ánh sáng stylized/fantasy

`src/render/stylized/` là một bộ ánh sáng + sương mù + hậu kỳ **thứ hai**, độc lập với bộ
mặc định, bật/tắt được lúc chạy qua nhóm "Stylized / fantasy" của bảng debug (hoặc
`window.__pntt.stylized`). Ba tệp: `tune.ts` (mọi con số, kèm HEX và khoảng dùng được),
`StylizedAtmosphere.ts` (dựng và cập nhật), `index.ts` (công tắc A/B).

Tông màu: **vàng cam là nắng**, **lam là bóng đổ và sương**, **đỏ cam là điểm nhấn quanh
nhân vật**. Điểm cần hiểu trước tiên là **bóng đổ không có màu riêng** — không có tham số
nào tên là "màu bóng". Vùng bóng chỉ là vùng không nhận được nắng, nên màu của nó hoàn
toàn do `HemisphereLight` quyết định. Muốn bóng ám lam thì phải làm màu trời của
hemisphere lam, và nó phải **bão hoà** chứ không chỉ tối: `#2E3A6E` tối nhưng xám nên
bóng ra xám nâu; `#3D47A8` sáng hơn mà bão hoà hơn, và bóng mới đọc ra lam tím.

Bốn thứ tôi làm sai trước khi ra được cấu hình hiện tại:

- **Phơi sáng đi SAI HƯỚNG.** Tôi để 1.25 vì nghĩ ACESFilmic nén cao sáng nên phải bù
  lên; kết quả là cả cảnh bạc trắng và bóng mất hết màu. Cách đúng là ngược lại: hạ phơi
  sáng về 0.95 rồi đẩy nắng từ 2.6 lên 3.4 bù lại. Vùng có nắng sáng y như cũ, nhưng vùng
  bóng tối hơn nhiều — biên độ sáng-tối rộng ra chính là cảm giác sâu. Hai tham số này
  chỉnh độc lập được, và đó là mẹo đáng nhớ nhất ở đây.
- **Đèn điểm đặt BÊN TRONG vật nó rọi.** Bốn đèn lam ban đầu đặt ở `y = 3.1`, đúng chỗ
  chóp cột đá. Với `decay: 2` thì khoảng cách gần bằng 0 nên chóp cột cháy trắng thành
  quầng bloom to nhất khung hình, hút mắt khỏi nhân vật — không phải vì candela quá lớn.
  Hạ về `y = 1.4` (ngang thân cột) thì cùng cường độ ấy lại đổ một vũng lam ra mặt đất.
- **Đèn ấm đặt trên đỉnh đầu.** `warmHeight = 1.6` làm đèn nằm ngay trên đầu nhân vật, và
  đèn điểm thẳng trên đầu chỉ rọi được mảng tóc đen — nhìn vào không thấy nhân vật sáng
  lên chút nào. Hạ về 1.0 (ngang ngực) thì nó rọi thân áo và dội một vũng ấm quanh chân.
  Bán kính cũng phải gọn: thử 12 thì vũng sáng loang gần hết sân đá và cả sân hoá hồng —
  điểm nhấn chỉ là điểm nhấn khi có chỗ tối cạnh nó.
- **Sương quá mỏng để tồn tại.** `FogExp2` mật độ 0.016 nghe hợp lý, nhưng sân đấu chỉ
  rộng khoảng 30 unit nên mọi thứ trong khung hình mới bị nhuộm ~20%. Phải lên 0.032 thì
  cỏ ở xa mới thật sự tan vào màu lam.

Hai chi tiết API của three phải kiểm bằng cách đọc mã nguồn của bản đang cài:

- **`OutputPass` là bắt buộc** ở cuối chuỗi `EffectComposer` của addons. Render target
  của composer là linear HalfFloat, và `OutputPass` chính là pass áp `renderer.toneMapping`
  + `outputColorSpace`. Thiếu nó thì đặt `ACESFilmicToneMapping` không có tác dụng gì.
- **`PCFSoftShadowMap` bị hạ cấp lúc chạy.** `WebGLShadowMap.render()` của three 0.185 in
  cảnh báo rồi tự đổi `this.type = PCFShadowMap` ngay khung hình đầu. Đường bóng mềm thật
  còn lại là `VSMShadowMap` — nó tôn trọng `shadow.radius`/`shadow.blurSamples`, đổi lại
  cần `bias` gần 0 chứ không âm sâu như PCF. Đo được: gán `PCFSoftShadowMap` rồi đọc lại
  `shadowMap.type` thì thấy 2 đã thành 1.

Một bài học về **cách đo**, không về ánh sáng: có hai lượt tôi kết luận "bóng đổ mất hẳn"
và đi truy nguyên nhân, trong khi bóng vẫn ở đó — công cụ chụp ảnh của pane trình duyệt
trả về **khung hình cũ** khi cảnh được vẽ ngoài `requestAnimationFrame`. Phải vẽ vài khung
rồi chụp, và khi một thay đổi "không có tác dụng gì" thì việc cần làm đầu tiên là kiểm
xem mình có đang xem đúng khung hình không. Cả bộ chỉ số (`shadowMap.type`, số draw call
tăng 44 khi bật bóng, kích thước shadow map) đều báo bóng vẫn chạy — tôi tin ảnh hơn tin
số liệu, và đó là chỗ sai.

### Tự ngắm

- **Bật mặc định.** Ngắm bằng chuột đòi người chơi làm ba việc cùng lúc: bấm WASD để
  đi, kéo chuột phải để xoay camera, và giữ con trỏ đúng trên con quái. Ở góc iso xoay
  được thì việc thứ ba gần như không làm nổi, và một nhát chém trượt vì lệch mười độ
  đọc ra là "game không nhận input" chứ không phải "mình ngắm sai". Vẫn giữ đường ngắm
  bằng chuột sau một công tắc — nó chính xác hơn khi muốn chọn đúng một con trong đám.
- **Chọn mục tiêu không phải "gần nhất".** Điểm quan trọng nhất là *dính mục tiêu*:
  chọn thuần gần nhất gây ra đúng cái lỗi ai cũng gặp — đang đánh dở một con thì con
  khác nhích lại gần hơn 10cm, đòn tiếp theo quay sang nó, và không con nào chết. Điểm
  của một ứng viên là `khoảng cách + góc lệch × 1.7`, và mục tiêu đang nhắm được trừ
  2.4 unit, nên nó chỉ đổi khi con mới rõ ràng hợp lý hơn.
- **Hướng ưu tiên là hướng ĐANG ĐI**, không phải hướng đang nhìn: người chơi chạy về
  phía nào thì muốn đánh phía đó. Không bấm phím nào thì mới lấy hướng nhìn.
- **Vùng trễ ở mép tầm**: bắt mục tiêu mới trong bán kính 11, nhưng giữ mục tiêu cũ
  tới 13.75. Bỏ đúng ở mép sẽ làm mục tiêu nhấp nháy vào/ra khi con quái đi lảng vảng
  quanh mép. Bản đầu của tôi giữ mục tiêu qua bước kiểm tra rồi lại ghi đè bằng kết quả
  truy vấn ở bán kính trong, nên vùng trễ không có tác dụng gì — test bắt được.
- **Phải có vòng chỉ mục tiêu.** Không có nó thì tự ngắm là một hộp đen: người chơi bấm
  chém mà không biết trước sẽ trúng con nào, và cảm giác điều khiển còn tệ hơn ngắm
  bằng chuột. Vòng màu kim, dày hơn con trỏ mặt đất, và to theo bán kính con quái —
  cùng một vòng cho con yêu thử và cho Mặc Đại Phu thì không đọc ra là đang chỉ vào nó.
- **Ở chế độ tự ngắm thì bỏ giới hạn góc của hỗ trợ ngắm** (60°). Giới hạn đó tồn tại
  để tôn trọng hướng người chơi đang ngắm bằng chuột; giữ lại khi không ai ngắm gì thì
  chỉ làm đòn chém ra sau lưng.
- **Phong Độn Thuật lướt theo hướng ĐANG ĐI, không theo hướng nhìn.** Bắt buộc từ khi
  có tự ngắm: hướng nhìn luôn chỉ vào con quái, mà đây là nút né đòn — lướt thẳng vào
  con vừa vung đòn thì nó thành nút tự sát, đúng lúc người chơi bấm nó để thoát.

### M8 — lưu, menu, âm thanh, cân bằng

- **Một bản lưu hỏng không bao giờ được làm sập game.** Mọi đường đọc trả về
  `null` khi có gì không đúng, và mọi giá trị đều kiểm kiểu LÚC CHẠY thay vì tin
  vào `as SaveData` — dữ liệu trong localStorage là dữ liệu ngoài: có thể do một
  phiên bản khác ghi, do người chơi sửa tay, hoặc bị cắt giữa lúc ghi.
- Bản lưu của phiên bản **mới hơn thì từ chối**, không đoán. Đoán ra một trạng
  thái nửa vời còn tệ hơn bắt đầu lại, vì người chơi sẽ tưởng save còn nguyên rồi
  mới phát hiện mất đồ. Bản CŨ hơn thì migrate (thiếu `wave` = chưa đánh đợt nào).
- `localStorage` **ném lỗi ngay khi chạm vào** ở chế độ riêng tư của một số trình
  duyệt. Cả `SaveStorage` được bọc lại để không bao giờ ném: không lưu được là mất
  tiến độ, còn ném lỗi ở đây là không vào được game.
- Cài đặt lưu **tách khỏi bản lưu**: nó phải sống sót qua cả "bắt đầu lượt mới".
  Nhét chung thì mỗi lần chơi lại từ đầu người chơi lại phải tắt đổ bóng một lần
  nữa — mà đó thường chính là lý do họ vào cài đặt ngay từ đầu.
- Giá trị cài đặt đọc vào bị **KẸP LẠI**, không chỉ kiểm kiểu: một
  `resolutionScale: 40` sẽ cấp phát một framebuffer khổng lồ và treo máy trước khi
  kịp hiện gì.
- Tự lưu theo **thời gian** bên cạnh theo **mốc** (lên tầng, đột phá). Chỉ theo
  mốc thì người cày Tu Vi mười phút mà chưa lên tầng nào, đóng tab là mất trắng.
  Và **không** lưu giữa lúc đang đánh dở một đợt hay đang đột phá — bản lưu đó mở
  lại sẽ để người chơi đứng giữa đợt 4 với sân trống.
- `Cultivation.loadFrom` mutate CHÍNH đối tượng cũ chứ không tạo instance mới:
  `Combatant.realm` trỏ vào cùng object đó, nên thay bằng instance mới sẽ để
  combatant giữ tham chiếu cũ và nhân vật đánh bằng cảnh giới của bản lưu trước.
- `Esc` là "lùi một bước": có bảng đang mở thì đóng bảng, không thì mở menu tạm
  dừng. Nếu `Esc` luôn mở menu thì người đang xem túi đồ phải bấm hai lần mới về
  được trận.
- Menu **làm mờ nền, không che hẳn**: thế giới vẫn được vẽ phía sau (game chỉ tạm
  dừng mô phỏng, không dừng render). Một màn hình đen ở menu chính sẽ che mất thứ
  duy nhất bán được trò chơi này — chính cái sơn môn.
- Âm thanh **sinh bằng WebAudio, không một file audio nào**. Nhiễu trắng sinh bằng
  bộ sinh số tuyến tính tự viết, không `Math.random()`.
- `AudioContext` phải dựng **từ trong một cử chỉ của người dùng** (lần bấm vào
  menu). Dựng sớm hơn thì nó nằm ở `suspended` mãi — âm thanh "không lỗi gì" mà
  cũng chẳng bao giờ nghe được.
- Bộ **chặn nhịp âm thanh** là bắt buộc: một phát Thiên Lôi Phù trúng 12 con phát
  12 sự kiện `combat:hit` trong đúng một frame, và 12 tiếng gõ cộng biên độ thành
  một tiếng "bục" méo, to hơn mọi thứ khác trong game.
- Trần giọng là **40, không phải 20**. Thử 20 thì riêng tiếng đột phá đã tốn 9
  giọng (hợp âm rải 4 nốt + khánh 4 bồi âm + một hơi nhiễu), nên đang đánh nhau mà
  đột phá thì tiếng quan trọng nhất của cả bản demo bị cắt mất.
- Tiếng kim khí làm bằng **bồi âm phi điều hoà tắt lệch nhau**. Một sine đơn nghe
  ra là tiếng máy đo; chồng bồi âm rồi cho tắt lệch thì tai đọc ra là "một vật
  bằng đồng vừa bị gõ".
- Tiếng **bị đánh** phải đục và thấp, khác hẳn tiếng mình **đánh trúng** — trong
  một trận đông người thì đó là thông tin quan trọng nhất, và mắt đang không rảnh.

#### Cân bằng: ba con số đo được, không phải cảm giác

- **Lỗi thật: 6 đơn vị của M7 không có bảng rơi nào.** Không lỗi nào được ném ra —
  `tuViReward` chỉ trả về 0 — nên hạ Thiết Giáp Thi, ma đạo tán tu và cả Mặc Đại
  Phu đều được **0 Tu Vi và 0 vật phẩm**: cả nửa sau của game không trả thưởng gì.
  Giờ có test đối chiếu bảng rơi với bảng đơn vị.
- **Lỗi thiết kế: toạ thiền vô hiệu hoá bình cảnh.** Lượng hồi từng tính theo phần
  trăm mốc của tầng (`0.028 × mốc`), nên mốc bị chia lại đúng bằng lượng hồi và
  MỌI tầng đều mất đúng 36 giây — kể cả ba tầng cuối Luyện Khí cố tình đắt gấp 2,7
  lần. Toạ thiền suông đi hết Luyện Khí trong **7 phút**, nhanh hơn đánh quái 5
  lần, và đường chơi tối ưu thành ra là ngồi giữ `F` trong góc. Đổi sang lượng
  tuyệt đối theo cảnh giới → **26 phút**, và bình cảnh cắn thật.
- Tiểu Bình từng cho gần trọn một tầng mỗi 3 phút (229/254 Tu Vi) → cả Luyện Khí
  đi được bằng cách để game chạy không. Hạ xuống **89 Tu Vi/bình** (35% mốc tầng).
- Tụ Khí Đan 180 → **900 Tu Vi**: ba tầng bình cảnh cần 1962/2787/3957, nên ở 180
  thì phải hơn hai chục viên cho MỘT tầng, và đan dược không còn là câu trả lời cho
  bình cảnh mà chỉ là thứ nhặt được rồi quên.
- Thêm **hồi sinh quái nền** (1 con/7 giây, giữ 10 con, thang theo cảnh giới người
  chơi). Không có nó thì sau khi dọn 10 con đầu là hết hẳn thứ để cày giữa hai đợt
  — mà "chuẩn bị giữa hai đợt" chính là chỗ vòng lặp tu luyện của M5 sống.

### M7 — tướng và đại chiến

- **Đợt sau KHÔNG tự chạy tiếp — phải người chơi bấm `Enter`.** Giữa hai đợt là lúc
  toạ thiền, luyện đan và đột phá; nếu đợt tự tới thì cả vòng lặp tu luyện của M5 bị
  chen ngang và người chơi buộc phải đánh với cảnh giới đang có thay vì được chuẩn bị.
- Điều kiện dẹp xong đợt chỉ đếm quái **có cờ `waveTag`**. Đếm hết mọi con thì một
  con yêu thử nền lang thang ở rìa bản đồ sẽ khoá cứng cả đợt.
- Bộ điều phối đợt có cờ **"đã thấy quái"**. Nó chuyển sang `fighting` trong cùng lời
  gọi đã yêu cầu sinh quái, còn màn thì đếm số quái sống *trước* lời gọi đó — không
  chặn thì con số 0 cũ của bước trước làm đợt tự dẹp ngay khoảnh khắc vừa sinh, và cả
  6 đợt chạy hết trong hai giây mà không con quái nào kịp xuất hiện (test bắt được).
- `WaveDirector` **không cầm scene, không cầm three, không sinh gì** — nó đọc hai con
  số (còn mấy con sống, người chơi chết chưa) và gọi yêu cầu qua `WaveActions`. Nhờ vậy
  chạy hết 6 đợt trong test mà không cần đồ hoạ.
- Bị hạ giữa đợt thì đợt **thất bại và làm lại**, quái của đợt cũ bị dọn sạch. Để lại
  thì người chơi vừa hồi sinh đã bị cả đợt cũ vây và không bao giờ gỡ lại được. Và dọn
  bằng cách đặt cờ `dead` chứ không qua `strike()` — qua `strike()` là cho Tu Vi miễn
  phí mỗi lần chết.
- **Cùng một `Agent` chạy cho cả ma đạo và đệ tử Thất Huyền Môn**; phe được quyết định
  lúc SINH, không nằm trong dữ liệu. Mọi chỗ chọn mục tiêu đều đi qua `isHostile`, nên
  không có một nhánh `if` nào cho riêng đồng minh. "Đệ tử đi theo người chơi" cũng
  không thêm trạng thái nào — chỉ là hành vi lảng vảng quanh nhà, với cái nhà biết đi.
- `grantRewards` phải **lọc `side !== 'enemy'`**. Không có dòng đó thì từ lúc có đồng
  môn, mỗi đệ tử tử trận lại rơi linh thảo và cho người chơi Tu Vi — vừa sai về nghĩa,
  vừa biến "để đồng môn chết" thành một cách farm.
- **Phase của tướng là hệ số nhân chồng lên máy trạng thái đã có**, không phải một AI
  thứ hai. Và phase chỉ đi MỘT CHIỀU: cho lùi thì một lần hồi máu sẽ gọi thêm một lượt
  tay sai nữa, sân đấu đầy quái mà người chơi không hiểu vì sao.
- Tay sai của tướng **có** tính vào đợt. Không tính thì hạ tướng xong là đợt kết thúc
  mà lũ tay sai còn lại vẫn đứng đó đánh mãi.
- Thanh máu tướng hiện **vạch mốc phase** đúng tại `atHp`. Ẩn đi thì mỗi lần đổi phase
  chỉ là một điều bất ngờ khó chịu; hiện ra thì nó thành một cái hẹn, và người chơi
  biết dồn sát thương hay giữ chiêu.
- Đơn vị đánh xa **không gọi `announceSwing`** — vệt chém ở đó sẽ nói dối người chơi
  rằng vừa có một đòn cận chiến, trong khi thứ đang bay tới là một lá phù.
- Trạng thái của đòn đánh chỉ dán khi mục tiêu **còn sống**; dán độc lên một cái xác
  thì DoT sẽ tích tắc trên xác suốt lúc diễn cảnh chết.
- Lớp quân hậu cảnh **không có AI, không va chạm, không gây sát thương** và tách hẳn
  khỏi `Agent`: cảm giác đại chiến đến từ số lượng NHÌN THẤY, còn chiến đấu thật chỉ
  cần vài chục đơn vị quanh người chơi. Nuôi 200 `Agent` đầy đủ để chúng đánh nhau ở
  nơi người chơi không tới được là trả giá mô phỏng cho một thứ không ai tương tác.
  Mỗi phe một `InstancedMesh` → cả đám đông tốn đúng **2 draw call**.
- Quân hậu cảnh đánh theo **CẶP**, và rải trên **cung hẹp vòng 32–43**. Hai hình lao
  vào nhau rồi lùi ra đọc ra là giao tranh, còn một đám di chuyển ngẫu nhiên chỉ đọc ra
  là một cái chợ. Rải thưa trên nửa vòng 34–52 thì từ trong sân chỉ thấy vài cái đốm —
  cảm giác đại chiến đến từ **mật độ**, không từ diện tích.
- Vũ khí của quân hậu cảnh dày **0.1** chứ không 0.05: ở khoảng cách 35 unit thì 0.05
  unit không chiếm nổi một pixel, nên cái lát mỏng đó vừa vô hình vừa vẫn tốn tam giác.
- BSD `sed` trên macOS **không hỗ trợ `\b`** — các mẫu đổi tên định danh im lặng không
  khớp mà vẫn trả về mã 0. Đổi tên hàng loạt thì dùng Python, đừng dùng `sed`.

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
- [x] **M7** Tướng & đại chiến — bộ điều phối 6 đợt, đệ tử đồng môn AI, lớp quân hậu cảnh
      instanced, Ma Đạo Trúc Cơ (bài học chênh cảnh giới), Mặc Đại Phu 3 phase, thanh máu
      tướng, thắng/thua
- [x] **M8** Hoàn thiện — lưu localStorage + migration, menu chính, tạm dừng, cài đặt
      (phân giải · đổ bóng · hậu xử lý · giới hạn fps · âm lượng), SFX procedural bằng
      WebAudio, pass cân bằng
