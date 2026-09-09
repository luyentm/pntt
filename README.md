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
