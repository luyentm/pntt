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
| Kéo chuột phải | Xoay camera quanh nhân vật — kéo xuống là nhìn từ trên, kéo lên là hạ xuống ngang tầm mắt |
| Cuộn chuột | Zoom |
| `` ` `` | Ẩn/hiện bảng debug |
| WASD / phím mũi tên | Di chuyển (theo hướng camera) |
| Chuột trái (hoặc `J`) | Chém — bấm liên tiếp để nối combo 3 nhát. Giữ để chém liên tục |
| — | **Tự ngắm bật mặc định**: đòn đánh và pháp thuật tự nhắm con quái có vòng vàng dưới chân. Tắt trong *Cài đặt* để ngắm bằng chuột |
| Giữ Shift | Đi chậm |
| `1`–`9`, `0` | Pháp thuật. Mười ô, mà bảng có **17 chiêu** — chiêu cảnh giới cao chiếm chỗ chiêu cũ trên đúng phím đó, và luôn là hai thứ cùng vai trò (phím 3 mãi là "đốt": 火 Hoả Cầu → 扇 Tam Diễm Phiến). Xem `game/Loadout.ts` |
| — | `0` là ô THỨ MƯỜI, không phải ô số không: nó nằm ngay sau `9` nên hàng số đọc ra là 1…0 |
| Giữ `F` | Toạ thiền — tăng Tu Vi chậm và đều. Tự thoát khi di chuyển hoặc bị đánh |
| `G` | Uống hết Tiểu Bình linh nhũ để lấy Tu Vi |
| `B` | Đột phá đại cảnh giới (vào màn thử dẫn khí) |
| `Space` | Ngự Kiếm Phi Hành — bật/tắt, mở ở Trúc Cơ |
| `C` / `I` / `K` | Bảng Tu Luyện / Túi Đồ / Luyện Đan (`Esc` đóng) |
| `Enter` | Khởi trận — mở đợt kế tiếp của "Thất Huyền Môn thủ trận" |
| `Esc` | Đóng bảng đang mở; không có bảng nào thì mở menu tạm dừng |

Trong màn thử dẫn khí: bấm `Space` mỗi khi con trỏ đi vào vùng sáng.

Hai màn xem, chọn từ menu chính:

| Màn | Phím |
|---|---|
| **Luyện Kiếm Đài** — trình diễn 17 pháp thuật qua bốn cảnh giới | bấm một dòng để chọn chiêu (chiêu đó lặp mãi) · `Q` `E` đổi chiêu · kéo chuột xoay quanh nhân vật · lăn chuột thu phóng · `1…0` tự thi triển · `Esc` về menu |
| **Đồ Giám** — tra nhân vật, yêu thú, pháp bảo; mô hình 3D xoay | bấm một thẻ để mở · `Esc` lùi về lưới, rồi về menu |

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
  chương cốt truyện về sau mà không phải sửa lõi. Bản này có **ba màn**:
  `ArenaScene` (lượt chơi), `SwordTerraceScene` (Luyện Kiếm Đài), `CodexScene` (Đồ Giám).

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
- **`scene.fog` không phải chỗ đáng tin để đọc lại.** Bộ stylized thay nó bằng `FogExp2`
  (mật độ, không có `near`/`far`), nên nhóm "Ánh sáng" của bảng debug — đọc
  `(scene.fog as { near: number }).near` — nhận `undefined` ngay khi bộ đó bật sẵn lúc
  khởi động, `gui.add` trả về `undefined` và cả `main` chết ở dòng `.name(...)`: màn hình
  đứng ở "Đang khai mở linh khí…". Ai cần sương của bộ mặc định thì phải giữ tham chiếu
  tới chính đối tượng đó (`sky.fog`). Cùng lý do, `Sky.setColors` ghi màu vào `sky.fog`
  chứ không vào `scene.fog` — ghi vào `scene.fog` là đè mất màu sương của bộ stylized.

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

### Hệ hạt đã bị bỏ

`vfx/Particles.ts` (5 dáng hạt, `InstancedMesh` theo dáng, billboard khói/loé mềm) và
`vfx/softTexture.ts` đã được **xoá hẳn**. Mọi hiệu ứng thần thông giờ dựng bằng dải ribbon
và vòng phẳng. Lý do là thẩm mỹ trước, chi phí sau: dải ribbon có ĐƯỜNG, và đường nói được
hướng của lực; một đám hạt chỉ nói được "có gì vừa xảy ra ở đây".

Những gì đã học từ hệ hạt vẫn còn giá trị và giữ lại đây: đo được rằng quy tắc lowpoly
không đắt vì hình học — nó đắt vì **diện tích phủ của vật trong suốt**. Cùng 768 hạt cùng
hình học, đổi hết sang cộng sáng ở cỡ phủ kín màn hình thì đắt **gấp 2,05 lần** (3,31 →
6,77 ms); còn ở hạn mức thật (32 haze + 24 smoke) thì chênh 0,08 ms, nhỏ hơn cả độ lệch
0,20 ms giữa hai lô đối chứng — tức là không đo được. Dải ribbon thắng ở đúng chỗ đó: nó
mảnh nên phủ ít pixel, mà vẫn là mặt phẳng cộng sáng nên vẫn chói.

Kèm theo, hook `ProjectileSystem.onTrail` (chặn nhịp 0,035 giây để nhả hạt sau viên đạn)
cũng bị bỏ — `onTrailPath` nhả mỗi khung đã thay hẳn, và nhịp 0,035 giây làm đầu dải tụt
sau viên đạn hơn nửa unit.

### Vệt đuôi (`vfx/RibbonTrails.ts`)

Dải ribbon bám theo chuyển động, tông chủ đạo **vàng kim ở đầu → lam lục linh khí ở đuôi**.
Dùng cho: chạy bộ · ngự kiếm phi hành · vệt lưỡi kiếm khi chém · cú lướt Phong Độn Thuật ·
đuôi từng viên phi hành khí (viên lấy màu ngũ hành của nó ở đầu vệt).

Đi theo CẶP màu chứ không một màu là chỗ quan trọng nhất về mặt thị giác. Một vệt một màu
đọc ra là "dải nhựa phát sáng"; vệt chuyển từ vàng nóng sang lam lục nguội đọc ra là linh
khí đang tan — mắt hiểu chuyển màu thành thời gian, nên chính gradient nói cho người xem
biết đầu nào là đầu mới. Và vàng phải ở ĐẦU: nó sáng hơn nên hút mắt, mà thứ cần hút mắt
là chỗ vật thể đang ở, không phải chỗ nó vừa rời khỏi.

**Cả 28 vệt nằm trong một `BufferGeometry`** với màu theo đỉnh dạng RGBA, tốn một draw call.
Không dùng lại cách của `SlashArcLayer` (mỗi vệt một `Mesh` + `Material` riêng) được: vệt
bám theo chuyển động thì mỗi ĐIỂM trên vệt phải có độ mờ và bề rộng riêng, không phải mỗi
vệt. Alpha theo đỉnh chỉ hoạt động khi thuộc tính `color` có `itemSize === 4` — three bật
`USE_COLOR_ALPHA` dựa vào đúng điều kiện đó, không phải vào một tuỳ chọn material.

Bốn quyết định hình học, mỗi cái sửa một cách vệt trông sai:

- **Trục bề rộng = `cross(tiếp tuyến, hướng nhìn)`**, tính lại từng điểm mỗi khung, nên mặt
  dải luôn quay ra camera. Trục cố định (ví dụ luôn theo +Y) thì ở góc iso xoay được, vệt
  biến thành một đường chỉ khi camera nhìn dọc trục đó — mà camera game này xoay 360°.
- **`side: DoubleSide`** là bắt buộc, không phải cho chắc: chiều quấn tam giác đảo khi tiếp
  tuyến đổi phía so với camera, và `FrontSide` cull đúng những đoạn đó, ra vệt đứt nham nhở.
  Đây đúng cái lỗi đã gặp ở billboard hạt — `PlaneGeometry` hướng +Z trong khi camera nhìn
  theo −Z của chính nó.
- **Thóp về đuôi** theo `(1 − u)^0.65`. Dải đều bề rộng đọc ra là "cái ống"; bề rộng thu hẹp
  là thứ mắt đọc thành hướng chuyển động.
- **Điểm chưa dùng bị gộp vào điểm cuối** thành tam giác diện tích 0, nên GPU không tô một
  pixel nào — rẻ hơn để chúng ở đâu đó với alpha 0.

**`step` KHÔNG dùng để làm vệt ngắn.** Nó là giãn cách *tối thiểu* giữa hai điểm xương sống,
nên với vật thể đi nhanh hơn `step` trong một khung thì khung nào cũng chốt điểm và giãn
cách thật hoá thành quãng-đi-một-khung — tức chiều dài vệt phụ thuộc fps và không hạ được
bằng `step`. Đó là lý do có tuỳ chọn `points` (số điểm vệt được dùng, 2..18): muốn ngắn thì
bớt điểm. Còn `step` nên đặt hơi DƯỚI quãng-đi-một-khung ở 60fps, để ở 60fps nó chốt mỗi
khung mà không vượt bước, và ở fps cao hơn nó chốt thưa hơn với cùng giãn cách.

**Lỗi thật, và nó không hề báo lỗi.** Điểm 0 của xương sống là "đầu sống": nó bị ghi lại
bằng vị trí hiện tại MỖI khung, vì nếu chỉ ghi khi đã đi đủ một bước thì đầu vệt tụt lại
sau vật thể tới cả bước và trông như dải bị đứt khỏi thanh kiếm. Bản đầu lại đo khoảng cách
"đã đi đủ bước chưa" với chính điểm 0 — nên mốc so sánh bị ghi lại cùng lúc với đầu vệt, và
phép đo luôn chỉ ra quãng đi trong MỘT khung (~0,07 unit ở tốc độ chạy) chứ không phải quãng
đi từ lần chốt trước. Vệt teo về một điểm dưới chân và đứng đó mãi. Mốc phải là ĐIỂM 1 —
điểm đã chốt gần nhất.

Test đầu tiên của tôi không bắt được: nó đẩy các điểm cách nhau 5 unit nên khung nào cũng
vượt bước, và nó xanh trong khi vệt trong game không hề dài ra. Test hồi quy giờ đẩy từng
bước **nhỏ hơn** bước chốt, đúng như trong game.

Một đánh đổi có chủ ý: điểm mới chốt vào đúng vị trí hiện tại, nên ở khung có chốt thì điểm
1 trùng khít điểm 0 và mất một trong 18 điểm ở mũi vệt. Cách chốt vị trí của khung TRƯỚC
dùng hết 18 điểm, nhưng làm nhịp chốt **phụ thuộc fps** — mốc lùi một khung nên điều kiện đủ
bước thoả sớm hơn, và giãn cách thật hoá thành `step − quãng-đi-một-khung`. Với một
codebase fixed-timestep thì đổi một điểm ở mũi vệt để lấy chiều dài không đổi là đáng.

**Danh tính cho từng viên đạn.** Hook `onTrail` cũ không có danh tính — ghi chú trong
`Projectile.ts` đã nói rõ lớp VFX không thể biết hai lời gọi liền nhau là của một viên hay
hai viên. Với hạt thì không sao, nhưng dải thì phải biết. Nên mỗi lần bắn được cấp một
`serial` chỉ tăng, cùng hai hook `onTrailPath` (mỗi khung) và `onTrailEnd`. Không lấy chỉ số
ô trong hồ làm danh tính: viên mới sinh ở ô vừa trả về sẽ tiếp tục vệt của viên cũ, ra một
dải nối từ chỗ viên trước vừa nổ sang chỗ viên sau vừa bắn. `onTrailEnd` phải gọi ở CẢ hai
đường viên bị thu hồi — `retire()` và nhánh "hồ cạn, giành lại viên già nhất" trong `take()`,
nhánh này không đi qua `retire`.

Dải nhả **mỗi khung**, không chặn nhịp: `onTrail` chặn 0,035 giây cho vừa với hạt, và ở nhịp
đó đầu dải tụt sau viên đạn hơn nửa unit — mắt đọc ra là dải bị đứt khỏi thanh kiếm. Khi hạt
bị bỏ thì `onTrail` cũng bị bỏ theo.

**Màu phải bão hoà hơn tưởng.** Dùng lại `Palette.vang` (`#F0D98A`) và `Palette.linh`
(`#7FE3D0`) thì vệt ra trắng vô sắc: dải vẽ bằng phép cộng nên nền càng sáng càng nuốt màu
nhạt, và trên sân đá thì không còn thấy vàng hay lục gì. Thêm cặp riêng `vetVang` `#FFD75E`
và `vetLuc` `#35E0B0`.

**Chi phí, đo được:** +2 draw call và +1904 tam giác trên tổng ~99 nghìn. Là 952 tam giác
vẽ **hai lượt** — pass nét viền khai báo `EffectAttribute.DEPTH` nên `postprocessing` chạy
một lượt render depth riêng cho cả cảnh, và mọi hình khối trong game đều bị vẽ hai lượt như
vậy. Chi phí không đổi theo số vệt đang sống vì hình học được cấp sẵn toàn bộ.

**Đàn kiếm trúc, và hai lần phải nâng hạn mức hồ vệt.** Riêng Thanh Trúc Phong Vân Kiếm đã
chiếm một ô cho mỗi thanh, mà nó phát được giữa lúc đang chạy, đang có đàn phi hành khí bay
và đang chém. Hồ chật thì `pick()` bắt đầu cắt vệt của những thứ khác — mà cắt vệt *đang bám*
thì nó mất đột ngột giữa đường chứ không tan.

- **28 → 64 → 128** khi đàn kiếm còn 33 thanh: lúc nặng nhất đếm được 96 vệt cùng sống.
- **128 → 192** khi đàn kiếm lên đủ 72 thanh. Đo ở Luyện Kiếm Đài đúng lúc **phát lại** chiêu:
  **128/128 ô đang sống, trong đó 56 ô là vệt của lượt trước đang tan.** Phát lại thả cả 72
  chỗ ngồi rồi lập tức xin 72 chỗ mới, nên nhu cầu tức thời chạm **144** — vượt hạn mức.
  `pick()` luôn hy sinh vệt ĐANG TAN trước nên thứ tự đúng, nhưng cắt một vệt đang tan vẫn
  đọc ra là nó *biến mất* chứ không phải nó tan.

Có test khoá bất biến `TRAIL_CAPACITY >= SWORD_CAPACITY × 2`: hai con số nằm ở hai file không
liên quan gì nhau, nên nâng số kiếm mà quên hồ vệt thì không có gì báo.

Nới rộng gần như miễn phí vì hình học cấp sẵn toàn bộ và ô không dùng có diện tích 0. Đo được
ở khung Luyện Kiếm Đài lúc 72 kiếm đang quét: **41.804 tam giác / 234 draw call**, trong đó
192 ô vệt góp 6912 đỉnh và 6528 tam giác — và con số đó KHÔNG đổi theo số vệt đang sống.

`SwordStorm` không biết VFX tồn tại — nó nhả vị trí qua hai hook `onSwordTrail(seat, x, y, z)`
(gọi trong `render`, không phải `fixedUpdate`: vệt là hình ảnh, nhả theo nhịp 60Hz thì ở máy
chạy trên 60fps đầu vệt giật lùi so với thanh kiếm đã nội suy) và `onSwordsEnd()`. Danh tính
là `seat` — chỗ trong đội hình, cố định suốt lượt chiêu — nên không phải cấp số thứ tự như
phi hành khí. `onSwordsEnd` phải gọi cả khi **phát lại** chiêu, không chỉ khi nó tan: phát lại
lúc đang chạy thì đàn kiếm nhảy về bán kính tụ, và vệt đang bám sẽ vẽ một bó nan hoa từ vành vòng
cũ về sát người.

Lấy vị trí **mũi kiếm** (`r + BLADE_REACH × 0.5`), không phải tâm thân kiếm: lưỡi với ra ngoài
vòng bay, nên vệt xuất phát từ tâm sẽ nằm lệch vào trong so với chỗ mắt đang thấy lưỡi quét qua.

Lần đầu tôi đặt `step` 0.13 cho vệt ngắn và được **ba vòng tròn liền** — một pháp trận đứng
yên, không phải một đàn vật thể đang bay. Kiếm quay 0,23–0,34 unit mỗi khung, nhanh hơn bước, nên
vệt vẫn dài 16 × 0,28 ≈ 4,5 unit trong khi khoảng cách giữa hai thanh chỉ 3,4 unit. Sửa bằng
`points: 7` → vệt ~1,7 unit ≈ 16° ở bán kính 6, phủ chừng nửa khoảng giữa hai thanh: ra vòng
xoáy **đứt nét**, thấy rõ từng thanh kiếm mà vẫn có cảm giác cả đàn đang cuốn.

### Nan hoa, xoắn ốc và bảng màu ngũ hành

Ba kiểu nét dựng nên toàn bộ hiệu ứng thần thông sau khi bỏ hạt:

- **Nan hoa** (`Vfx.spokes`) — chùm dải toả ra từ một điểm. Thay cho tia lửa hạt ở cú đánh
  trúng, vụ nổ, mép pháp vực, tụ khí, và lúc quái chết.
- **Xoắn ốc** (`RibbonTrails.strokeSpiral`) — dải cuộn LÊN. Dùng cho lên khiên, lên tầng,
  đột phá, và cột khí giữa pháp vực.
- **Cung** (`strokeArc`) và **đường thẳng** (`strokeLine`) — vệt chém và cú lướt, đã có từ trước.

**Đầu vệt của nan hoa phải ở TÂM.** Dải thóp dần từ đầu về đuôi nên đầu vệt là đầu dày và
chói. Bản đầu tôi đặt đầu ở mút ngoài: mỗi nan hoa dày và sáng nhất ở vành rồi thóp về tâm,
và cả chùm đọc ra là những tia đang *chiếu vào* tâm — ngược hẳn nghĩa của một vụ nổ. Đặt
đầu ở tâm thì được đúng hình sao nổ, và nó đúng cho cả tụ khí vì chỗ linh khí đang tụ cũng
là chỗ phải sáng nhất. Nên không cần hai chiều, chỉ cần một.

Góc nan hoa **rải đều rồi nhiễu nhẹ**, không rải tự do: theo phân bố đúng thì với 5 nan sẽ
thường xuyên có mấy nan chồng khít nhau và cả chùm lệch hẳn về một phía, và mắt đọc ra là
hiệu ứng bị lỗi chứ không phải là ngẫu nhiên.

**Bảng màu ngũ hành đi theo CẶP** (`ELEMENT_TRAIL`): kim `#FFF3C0→#D99B2C`, mộc
`#DCF46E→#2F9E55`, thuỷ `#D8F6FF→#2F7FD6`, hoả `#FFD45E→#D8341A`, thổ `#F4CC86→#8A5524`,
cộng ba cặp riêng cho sấm (`#EAF7FF→#6F9FFF`), ma đạo (`#D94A52→#3A2740`) và phong lam
(`#9FF3FF→#2445C8`). Đổi một màu
thì bảy chiêu vẫn là một chiêu bảy màu; đổi cả cặp thì mỗi chiêu có một đường chuyển màu
riêng, và đó là thứ đọc được cả khi vệt chỉ hiện hai phần mười giây. Đầu vệt của hệ nào
cũng sáng và ngả vàng/trắng: đầu vệt là chỗ vừa xảy ra lực, và mắt đọc "sáng gắt" thành
"mạnh" — để đầu vệt đúng màu hệ thì hoả cầu ra một vệt đỏ đều tay, nhìn như dải sơn.

Ba chiêu dùng cặp RIÊNG chứ không lấy theo ngũ hành, tra qua bảng `SKILL_TRAIL` (id chiêu
→ cặp màu, tra trước ngũ hành). Sấm và cú giộng của boss đều là hệ `kim`, nên lấy theo hệ
thì tia sét ra màu vàng đồng và đòn của Mặc Đại Phu trông như một chiêu kim quang chính
đạo. Phong Độn Thuật là `vo` nên nó rơi vào cặp chủ đạo — mà cú lướt và cú chạy bộ đi cùng
một đường thẳng ngang mặt đất, cùng màu nữa thì chiêu đọc ra là "chạy nhanh một nhịp";
cặp **phong lam** cho nó một dải xanh riêng.

Cặp phong lam khác hai cặp lam đã có ở KHOẢNG chuyển màu, không ở sắc: thuỷ và sấm đều bắt
đầu gần như trắng nên nhìn nhanh thì chúng chỉ khác nhau ở độ đậm của đuôi; phong lam bắt
đầu ở lam ngọc rõ màu rồi chìm xuống lam sâu, nên nó đọc ra là một dải xanh thật chứ không
phải một vệt trắng hơi ngả xanh.

Gom vào một bảng thay vì rải `if (id === …)` ở từng chỗ nghe sự kiện, và việc đó lộ ra một
lỗi đã có: `skill:area` có ngoại lệ cho sấm mà `skill:cast` thì không, nên đoạn TỤ KHÍ của
Thiên Lôi Phù bốc lên màu vàng đồng rồi tia sét mới đánh xuống màu lam điện — đoạn dẫn khí
nói sai về chiêu đang tới. Vệt quạt của cú lướt thì lấy lam giữa `Palette.thuy`, vì tấm
quạt chỉ có MỘT màu: đầu cặp gần như trắng (tan vào nền trời) và đuôi cặp thì thẫm (tan vào
bóng cỏ), chỉ dải ribbon có chuyển màu mới dùng được cả hai đầu.

**Chi phí, đo được ở khoảnh khắc nặng nhất** (đàn kiếm trúc + vệt chạy + hai vụ nổ + một
pháp vực, 96 vệt cùng sống): **+10 draw call và +6672 tam giác** trên tổng 96 nghìn, cho cả
dải ribbon và hào quang chân. Trong 10 draw call đó chỉ 1 là của lớp dải (nó gộp mọi vệt
vào một mesh), 4 là bốn vòng hào quang đang sống, và tất cả nhân hai vì pass nét viền cần
một lượt render depth riêng.

### Hào quang dưới chân (`vfx/FootAura.ts`)

Vòng linh khí loang ra dưới chân mỗi khi chạy, nhả xen kẽ lệch sang hai bên nên đọc ra là
từng BƯỚC CHÂN chứ không phải một hiệu ứng đứng yên nhấp nháy. Màu đổi luân phiên vàng kim
/ lam lục. Lúc ngự kiếm phi hành thì vòng to hơn và nhịp chậm hơn: không có bước chân nào
cả, nó là luồng khí dưới phi kiếm.

Là lớp riêng chứ không dùng lại `AreaBurstLayer` dù hình học y hệt, vì NHỊP khác hẳn:
`AreaBurstLayer` nhả một vòng mỗi vụ nổ, lớp này nhả ~9 vòng mỗi giây suốt cả lượt chơi.
Chung hồ thì vòng dưới chân giành hết 12 ô và mọi pháp vực đều mất vòng — tức người chơi
mất đúng cái thứ nói cho họ biết tầm của chiêu.

Không làm một đĩa sáng bám dưới chân: nó trùng ngay với ô chọn mục tiêu và vòng chỉ dẫn vốn
đã có ở cảnh, nên đọc ra là "nhân vật đang được chọn". Vòng LOANG RA thì không lẫn với gì,
vì không có thứ nào khác dưới chân biết nở ra.

**Hai lỗi cùng một loại: hiệu ứng chạy đúng hoàn toàn mà màn hình trống trơn.**

Cả hai đều không báo lỗi, và cả hai đều không phát hiện được bằng cách đọc chỉ số — `visible`
đúng, `opacity` 0,7, `scale` 1,3, vị trí đúng, vẫn tốn một draw call.

1. **Thứ tự đỉnh cho pháp tuyến hướng XUỐNG.** Tích có hướng hai cạnh đầu tam giác của
   `ringGeometry` ra `(0, −0.22, 0)`, nên camera nhìn từ trên chỉ thấy mặt sau và `FrontSide`
   cull sạch. Ghi chú `// Thứ tự đỉnh cho pháp tuyến hướng lên (+Y)` trong mã là **sai** —
   và nó sai từ `AreaBurstLayer`, nghĩa là **cái vòng loang ra của pháp vực chưa từng hiện
   lên**: bấy lâu nay pháp vực chỉ có cột sáng và vết cháy, còn cái vòng vẽ ra TẦM của chiêu
   thì không ai thấy. Đã sửa cả hai lớp bằng `side: DoubleSide` — với một vòng phẳng vẽ bằng
   phép cộng thì mặt trước hay sau không có nghĩa gì, nên vẽ cả hai mặt là câu trả lời đúng,
   không phải đảo winding.
2. **Nhấc lên thiếu sáu phần nghìn unit.** `y` truyền vào là cao độ ĐỊA HÌNH, còn sàn đá của
   luyện võ trường là một prop nằm trên địa hình — đo được mặt trên của nó ở `y = 0.056`.
   Tôi nhấc 0.05, nên vòng nằm dưới sàn và bị che trên toàn bộ khu vực người chơi ở nhiều
   nhất. Cách tìm ra: nhả ba vòng ở ba độ cao (0.05 / 0.5 / 1.5) rồi chụp một ảnh — hai vòng
   trên hiện, vòng dưới không. Giờ nhấc 0.14, và `AreaBurstLayer` cũng được nâng từ 0.06 lên
   0.14 vì 0.06 chỉ vượt sàn bốn phần nghìn unit.

Bài học chung với chuyện "vệt teo về một điểm" ở trên: **với hiệu ứng đồ hoạ, chỉ số đúng
không chứng minh được gì cả.** Ba lần trong đợt này tôi có đủ số liệu nói "nó đang chạy" và
cả ba lần màn hình trống. Cách duy nhất là chụp ảnh và nhìn.

### Ba chiêu đặc trưng của Hàn Lập

Ngoài đàn kiếm trúc, ba thứ gắn với Hàn Lập nhất trong nguyên tác — và mỗi chiêu cố tình
là một VERB khác nhau, không phải thêm một nút gây sát thương nữa:

| Chiêu | Cảnh giới | Verb |
|---|---|---|
| 嫁 **Giá Y Thần Công** | hậu kỳ Luyện Khí | Đổi tài nguyên: đốt 18% sinh lực tối đa, cộng 60% sát thương trong 8 giây |
| 蟲 **Thực Kim Trùng** | Trúc Cơ | Sát thương theo thời gian: đòn đầu nhẹ, gặm 6 giây trên vùng rộng 3,4 |
| 衍 **Đại Diễn Quyết** | Kết Đan | Nhân chiêu khác: khiên và đàn kiếm mạnh + lâu thêm 50% trong 12 giây |

Ba chỗ đặt tay vào hệ thống, mỗi chỗ chọn có lý do:

- **Giá Y Thần Công nhân ở `CombatWorld.strike`**, không trong `computeDamage`. Trong
  nguyên tác nó là sức mạnh của cả NGƯỜI, nên phải ăn vào nhát kiếm, pháp vực, phi kiếm và
  đàn kiếm như nhau — mà `strike` là cửa duy nhất cả bốn đều đi qua. Nhét vào công thức sát
  thương thì `computeDamage` phải biết tới hệ trạng thái, và nó đang là một hàm thuần.
- **Đại Diễn Quyết nhân ở `SkillCaster`**, chỗ pháp thuật được DỰNG RA (độ mạnh khiên, sát
  thương và thời gian đàn kiếm) — không nhân vào sát thương mỗi đòn, vì làm thế là nó trùng
  vai với Giá Y Thần Công và hai chiêu mất hết khác biệt. Không tăng bán kính vòng kiếm:
  vòng rộng ra thì đàn kiếm rải mỏng và người chơi mất khả năng lái nó bằng cách đi bộ.
  Cũng không tăng SỐ KIẾM: cái quyết định ngự nổi bao nhiêu thanh là thần thức nền, còn Đại
  Diễn Quyết chỉ là một cú bùng tạm — cho nó thêm kiếm thì vòng kiếm dày lên rồi mỏng lại
  giữa trận, và người chơi mất mốc để đọc cảnh giới của mình.
- **Độ mạnh của chiêu hỗ trợ có HAI đường ra.** Khiên là một LƯỢNG nên suy từ Thần Thức và
  tự lên theo cảnh giới; Giá Y và Đại Diễn là một TỈ LỆ nên phải là số cố định — suy tỉ lệ
  từ Thần Thức thì tới Kết Đan nó thành cộng vài nghìn phần trăm. Ngược lại, sát thương theo
  thời gian của Thực Kim Trùng thì PHẢI suy theo công (`magnitudeFromCong`): một hằng số cân
  được ở Trúc Cơ thì tới Kết Đan không nhích nổi thanh máu.

Ba thứ nhỏ phải sửa kèm, đều là dạng lỗi im lặng nếu bỏ qua:

- `Input.skillPressed()` quét thêm `Digit9` và `Digit0`; trước đó nó dừng ở `Digit8` nên hai
  chiêu cuối có ô trên thanh mà không có phím nào gọi được.
- Chữ bay lên của chiêu hỗ trợ hiện `⛨ 1870` cho khiên nhưng `+60%` cho hai chiêu tỉ lệ —
  cùng một trường `magnitude` mà đọc ra hai nghĩa khác nhau, và "⛨ 0.6" thì không nói gì cả.
- Màn trình diễn phải **bù sinh lực**, không chỉ linh lực: Giá Y Thần Công đốt 18% máu mỗi
  lần thi triển, nên sau vài vòng thanh máu cạn tới đáy và người xem đọc ra là nhân vật đang
  chết dở. (Từ bản lặp-một-chiêu thì bù trước **mỗi nhịp**, không chỉ mỗi bước — xem mục
  Luyện Kiếm Đài.)

### Hàn Lập — bản dựng riêng, và khớp bàn tay

Nhân vật người chơi **không** đi qua `buildChibi` nữa. Hắn có builder riêng
(`art/characters/HanLap.ts`) và được phép tốn gấp nhiều lần tam giác.

Lý do tách chứ không thêm cờ vào `buildChibi`: hàm đó tồn tại để dựng **hàng chục** đơn vị
cùng lúc, nên ngân sách tam giác của nó là ngân sách của cả một đợt quái. Hàn Lập thì chỉ có
**một** trên màn hình, luôn ở giữa khung, và là thứ người chơi nhìn suốt cả lượt chơi. Hai
bài toán ngược nhau; nhồi cả hai vào một hàm sẽ kéo một trong hai về phía sai.

Bản riêng bám bản thiết kế nguyên mẫu: mặt cầu **7×5 → 16×12**, mái chẻ giữa dựng từng lọn
rời, hai lọn tóc mai buông quá cằm, **đuôi ngựa dài** bảy đốt có vòng kim ở gốc, đạo bào
**trắng ngà** với giao lĩnh hai lớp (vạt ngoài trắng đè lên lớp lót lam), đai lưng có nút
thắt và hai dải buông, ống tay loe mạnh viền lam, vạt dưới có sáu nếp gấp. Đo được: **9.398
tam giác / 24 draw call** cho cả gian Đồ Giám, và **vẫn đúng MỘT draw call** cho nhân vật —
rigid skinning không quan tâm có bao nhiêu khối, chỉ quan tâm mỗi khối thuộc xương nào.

Bàn tay để **đơn giản là cố ý**, đúng như bản thiết kế ghi ("Simplified Hand Geometry"):
ngón tay ở tỉ lệ chibi nhỏ hơn một pixel ở khoảng cách chơi, nên chúng chỉ làm bàn tay thành
một đám nhiễu.

#### Đổi màu áo: từ lam sang trắng ngà

Trước đây Hàn Lập mặc lam đậm — **cùng tông với đồng môn Thất Huyền Môn** (`aoDeTu`
0x7794B8), chỉ khác một bậc độ sáng. Đứng giữa một đám đệ tử thì nhân vật người chơi lẫn hẳn
vào nền, mà đó là thứ tệ nhất một game hành động có thể làm. Đảo ngược quan hệ sáng-tối (thân
áo TRẮNG, viền LAM) tách hắn ra khỏi mọi thứ khác trên sân mà không cần một màu lạc lõng nào.

#### `handL` / `handR` — hai khớp thêm vào CUỐI rig

Thêm ở cuối `CHIBI_JOINTS`, đúng luật của rig: clip lưu dữ liệu theo chỉ số mảng đó, nên chèn
vào giữa là lệch toàn bộ animation đã có mà không có gì báo. Thêm ở cuối thì mọi clip cũ vẫn
đọc đúng khớp của chúng, và hai khớp mới chỉ nhận thế nghỉ.

Chúng có để **treo pháp bảo**. Trước đây bàn tay là một khối cầu hàn cứng vào khuỷu, nên
không có node nào để gắn cây quạt hay lá phù vào — Hàn Lập thi triển Tam Diễm Phiến mà cây
quạt không nằm trong tay ai cả.

`art/props/handProps.ts` ánh xạ chiêu → vật cầm tay, và chỉ những chiêu có **vật thật** mới
có mặt: Hoả Cầu Thuật, Canh Kim Kiếm Khí, Thái Ất Thanh Sơn Quyết đều là pháp lực thuần, nhét
một vật vào tay chúng là nói sai về chính hạng của chiêu mà thẻ giới thiệu vừa ghi rõ ngay
bên dưới màn hình. Vật cầm tay **gọi đúng hàm của bản trưng bày** rồi bọc vào một `Group` để
thu nhỏ — dựng bản thứ hai thì đổi màu nan quạt ở Đồ Giám mà quạt trong tay vẫn màu cũ.

Test khoá ngưỡng "không vật nào dài quá nửa thân người", và **nó đã bắt được một lỗi thật**:
phi kiếm ở tỉ lệ 0,5 ra 0,55 unit, tức dài đúng bằng nửa nhân vật.

`UPPER_BODY` phải thêm hai khớp bàn tay, dù chưa clip nào xoay chúng: pháp bảo treo vào khớp
này, nên khi lớp phủ đòn đánh bỏ sót bàn tay thì cây quạt giữ thế của clip CHÂN — nó lắc theo
nhịp chạy trong lúc tay đang vung.

### Phong Lôi Sí — đôi cánh phong lôi

Chiêu duy nhất trong bảng **mọc thêm hình lên người thi triển**, nên nó không thể chỉ là một
vệt sáng: người xem phải nhìn ra đôi cánh trước khi nhìn ra cú lướt.

Cánh gắn vào **xương thân**, không vào `chibi.root`. Gắn vào root thì cánh đứng yên trong lúc
thân nhấp nhô theo chu kỳ chạy — đọc ra là đôi cánh trôi lơ lửng cạnh người chứ không mọc
trên lưng người.

**Ba quyết định về cách vỗ:**

- **Từng phiến lệch pha nhau.** Cả năm phiến vỗ cùng nhịp thì cánh cứng như một tấm ván bản
  lề. Lệch mỗi phiến 0,42 radian thì cú vỗ chạy từ vai ra mũi cánh thành một làn sóng — đó là
  toàn bộ khác biệt giữa "cánh" và "cái quạt giấy".
- **Vỗ quanh trục Z là chính, trục Y là phụ.** Z là nâng lên hạ xuống (cái mắt đọc là "đang
  bay"); Y là quét trước sau, và để nó lớn thì cánh trông như đang **bơi**.
- **`power` nhân vào cả góc xoè lẫn tỉ lệ.** Chỉ thu tỉ lệ thì lúc cánh nhỏ nó vẫn xoè hết
  cỡ — một đôi cánh tí hon gắn trên lưng. Thu cả góc xoè thì nó cụp về sát lưng rồi mới biến
  mất, tức đọc ra là cánh đang xếp. Mọc nhanh hơn xếp (12 so với 5): phải kịp hiện ra trước
  cú lướt, nhưng nán lại một nhịp sau khi hết hiệu lực.

**Bốn thứ phải sửa sau khi nhìn thấy nó chạy** — không cái nào đoán ra được trước khi dựng:

- **Màu lông phải TỐI hơn hẳn cặp màu vệt của chính chiêu.** Bản đầu lấy đúng màu vệt
  (0x9FF3FF → 0x7B3BD6) đắp lên lông, và kết quả là hai khối **trắng tinh** hai bên người:
  lông cánh là bề mặt *được chiếu sáng*, mà nắng của bộ stylized mạnh 1,95 cộng hemisphere —
  một màu nền đã ở mức 0xF3 thì nhân lên là vượt trần, mọi facet biến mất, rồi bloom trùm
  nốt. Vệt đuôi không bị vì nó vẽ bằng phép cộng và không nhận ánh sáng nào. Phần chói giao
  cho hai thứ *tự phát sáng*: khớp vai và tia lôi.
- **Vật phát sáng phải là điểm nhấn NHỎ NHẤT khung hình.** Khớp vai bản đầu là nón 0,05 × 0,13
  ở độ mờ 0,72; nó bloom thành hai tam giác trắng to hơn cả cánh, che mất đúng thứ nó sinh ra
  để nối vào.
- **Vệt đuôi phải gác theo TỐC ĐỘ, không theo "cánh đang xoè".** Cánh vỗ tại chỗ thì đầu cánh
  chạy đi chạy lại trên một cung ngắn, và vệt dài 0,3 giây cuộn chồng lên chính nó thành một
  **đốm sáng đặc** — hai khối trắng hai bên vai. Vệt là thứ nói "vật này đang lao qua không
  gian"; đứng yên thì nó không có gì để nói. Ngưỡng 2,4 lấy đúng ngưỡng của vệt chạy bộ.
- **Tia lôi phải GÃY KHÚC.** Một thanh thẳng phát sáng đọc ra là tia laser; cái làm mắt nhận
  ra sét là những khúc gãy đột ngột, không phải độ sáng. Bốn khúc là đủ — ba thì chưa thành
  nhịp, sáu thì ở cỡ này mỗi khúc nhỏ hơn một pixel và tia lại thẳng trở lại. Gộp thành một
  geometry nên cả tia vẫn là một draw call, y như thanh thẳng nó thay thế.

Bề rộng quạt lông cũng phải **thu lại** một lần: bản đầu xoè hơn 110° cho cả hai bên, và nhìn
từ sau lưng thì hai cánh khép thành một vòng gần tròn quanh người — mắt đọc ra một cái quạt
xoè. Cánh chim thật hẹp hơn nhiều so với trực giác: cái nói lên "cánh" là nó **chỉ về một
hướng**, không phải nó phủ được bao nhiêu độ.

### Bộ stylized chỉ dành cho màn có THẾ GIỚI

Nó dựng một buổi trưa ngoài trời: nắng 1,95, đèn viền linh khí, sương mù xa và bloom. Trên
một sân đá có cây, có nhà, có quái thì đó đúng là thứ làm cảnh đẹp lên.

Trên bệ trưng bày của Đồ Giám — một mô hình đơn độc, không nền, không gì để so sáng — cũng
bấy nhiêu ánh sáng đó **đốt cháy trắng cả khuôn mặt**, và người xem không còn đọc được màu áo
lẫn nét mặt, tức mất đúng thứ họ mở Đồ Giám ra để xem. Mất khá lâu mới nhận ra thủ phạm là
ánh sáng chứ không phải mô hình: tắt bộ stylized một lần là thấy ngay bản dựng vốn sạch sẽ.

Nên `main.ts` bật bộ stylized theo một điều kiện đọc được: màn nào cấp `coolSpots` thì có
thế giới; màn nào không thì dùng bộ đèn mặc định, dịu hơn hẳn.

### Bộ pháp thuật theo nguyên tác — 17 chiêu, bốn cảnh giới

Bảng chiêu cũ có 10 mục và dừng ở Kết Đan. Nay là **17 chiêu chia bốn đại cảnh giới**, và
thang cảnh giới có thêm **Nguyên Anh kỳ** — không phải để chơi tới đó, mà vì sáu pháp bảo
trứ danh nhất của Hàn Lập chỉ dùng được sau khi kết anh, nên gắn chúng vào Kết Đan là nói
sai nguyên tác ngay ở chỗ dễ kiểm nhất.

| Cảnh giới | Chiêu |
|---|---|
| **Luyện Khí** | 劍 Ngự Kiếm Thuật · 風 Phong Độn Thuật · 火 Hoả Cầu Thuật · 盾 Kim Quang Thuẫn · 雷 Thiên Lôi Phù · 冰 Băng Phong Phù · 嫁 Giá Y Thần Công |
| **Trúc Cơ** | 蟲 Thực Kim Trùng · 陣 Ngũ Hành Trận Kỳ |
| **Kết Đan** | 竹 Thanh Trúc Phong Vân Kiếm · 衍 Đại Diễn Quyết |
| **Nguyên Anh** | 庚 Canh Kim Kiếm Khí · 扇 Tam Diễm Phiến · 水 Thiên Nhất Chân Thuỷ · 磁 Nguyên Từ Thần Quang · 山 Thái Ất Thanh Sơn Quyết · 翅 Phong Lôi Sí |

`PLAYABLE_MAJOR_CAP` tách **trần của lượt chơi** khỏi **trần của thang**. Không tách thì
Kết Đan đại thành đột phá thẳng lên Nguyên Anh mà KHÔNG tốn đan dược nào — `BREAKTHROUGH_PILL`
không có mục cho cảnh giới mới nên `requiredPill()` trả về rỗng và cửa mở toang. Một đại cảnh
giới được tặng không, không có gì báo.

#### ★ 33 kiếm trúc là SAI — nguyên tác là 72, và số kiếm đổi theo cảnh giới

Con số 33 nằm cứng trong `SwordStorm.ts` (và trong một chuỗi ở menu chính) từ đầu, kèm cả
một comment khẳng định "đúng như trong truyện". Tra lại thì:

- Bộ đủ là **72 thanh** — sáu bộ 12, luyện từ sáu gốc **Kim Lôi Trúc** vạn niên, xong sau
  khi Hàn Lập Kết Đan hai mươi mốt năm.
- Kết Đan **sơ kỳ chỉ ngự nổi sáu bảy thanh**, **hậu kỳ hai bốn thanh**; phải tới **Nguyên
  Anh** mới điều được cả bộ. Về sau luyện thêm lên 108.
- Thuộc tính **Mộc + Lôi**, và nó được ghi trong chính **Thanh Nguyên Kiếm Quyết** — cùng
  một lộ với combo cận chiến người chơi dùng từ phút đầu.
- **Thiên Lôi Trúc là NGUYÊN LIỆU, không phải chiêu thức.** Nó về Đồ Giám dạng linh vật.

Nên số kiếm giờ **suy từ cảnh giới** (`soKiemTruc`), không phải hằng số: 12 → 18 → 24 → 36
qua bốn tầng Kết Đan, rồi 72 ở Nguyên Anh. Hai mốc 24 và 72 là con số nguyên tác nói thẳng;
ba mốc còn lại lấp theo bội của 12 (một bộ cơ sở) chứ không theo "sáu bảy thanh", vì một
vòng sáu thanh chia cho ba vòng đồng tâm thì mỗi vòng còn hai cái, không ra nổi hình đội ngũ.

Ba điều rút ra khi làm chỗ này:

- **`SWORD_CAPACITY` là sức chứa của InstancedMesh, không phải số kiếm bay ra.** Cấp phát
  theo mức trần một lần rồi chỉ đổi `mesh.count` — đổi số kiếm không tốn thêm draw call nào.
  Vượt trần thì `setMatrixAt` ghi ra ngoài buffer, mà three **không ném lỗi**, nó chỉ âm thầm
  bỏ qua. Có test khoá.
- **Số kiếm KHÔNG được nhân vào sát thương.** Nó đổi mật độ hình ảnh và bề rộng đội hình;
  sức mạnh đã nằm ở `mult` và ở cảnh giới rồi. Nhân vào thì Nguyên Anh ăn gấp sáu Kết Đan
  chỉ vì đội hình dày hơn, tức luật chênh lệch cảnh giới bị đếm hai lần. Có test khoá.
- **Làm tròn XUỐNG bội của ba.** Đội hình là ba vòng đồng tâm; một con số lẻ để lại một vòng
  thiếu chỗ, và chỗ thiếu đó quay vòng vòng quanh người thành một khoảng hở chạy liên tục —
  mắt đọc ra là lỗi chứ không phải đội hình.

Và đây là chi tiết đáng giá nhất: cùng một chiêu, cùng một phím, vòng kiếm dày lên gấp sáu
khi đột phá. Việc lên cảnh giới trở thành thứ **nhìn thấy được** thay vì một con số stat.

#### Khoá theo `id`, không theo chỉ số mảng

`SkillCaster` trước đây khoá hồi chiêu, ô đang thi triển và cổng cảnh giới theo **chỉ số
trong mảng `SKILLS`**. Cái giá là một dòng cảnh báo ngay trong bảng chiêu: *"thêm vào CUỐI
mảng, không chèn giữa"* — chèn giữa là đổi hết phím bấm của mọi chiêu phía sau, và không có
gì báo lỗi. Với 17 chiêu chia bốn cảnh giới thì luật đó không giữ nổi: một chiêu Trúc Cơ mới
phải nằm cạnh các chiêu Trúc Cơ khác thì bảng mới đọc được.

Nay mọi thứ khoá theo `id` (`Map<string, number>` cho hồi chiêu, `activeId` thay `activeSlot`),
và chèn ở đâu trong mảng cũng được.

#### `Loadout` — 17 chiêu, 10 ô, và phím bấm không bao giờ trượt

Thanh pháp thuật chỉ có mười ô. Cách chọn KHÔNG phải "lấy mười chiêu mới nhất": làm vậy thì
mỗi lần đột phá là mọi phím trượt đi một ô, và người chơi đã quen tay bỗng bấm sai hết.

Thay vào đó mỗi chiêu tự khai một **ô cố định** (`SkillDef.slot`), nhiều chiêu được phép
dùng chung một ô, và chiêu cảnh giới cao **chiếm chỗ** chiêu cũ trên đúng phím đó. Cặp chiếm
chỗ luôn là hai thứ **cùng vai trò**:

```
phím 1  Ngự Kiếm Thuật   → Canh Kim Kiếm Khí     (đòn bắn thẳng)
phím 2  Phong Độn Thuật  → Phong Lôi Sí          (thân pháp)
phím 3  Hoả Cầu Thuật    → Tam Diễm Phiến        (hệ Hoả)
phím 5  Thiên Lôi Phù    → Thái Ất Thanh Sơn     (đòn nặng đặt tại con trỏ)
phím 6  Băng Phong Phù   → Thiên Nhất Chân Thuỷ  (đóng băng)
phím 7  Giá Y Thần Công  → Đại Diễn Quyết        (tự bùng sức mạnh)
phím 9  Ngũ Hành Trận Kỳ → Nguyên Từ Thần Quang  (khống chế cả vùng)
```

Nên phím 3 mãi mãi là "đốt" và phím 2 mãi mãi là "né", qua cả bốn cảnh giới. Test khoá đúng
bất biến đó: với mọi ô, chiêu Nguyên Anh phải cùng `role` với chiêu Luyện Khí nó thay thế.

Điều kiện để `loadoutFor` xác định: **không có hai chiêu cùng ô VÀ cùng cảnh giới**. Bằng
nhau thì kết quả phụ thuộc thứ tự mảng — tức đảo hai dòng trong bảng là đổi phím bấm của
người chơi, im lặng. Có test riêng cho việc này.

#### Số liệu sát thương SUY từ `action`, không gõ tay

`SkillDef` cố tình **không có** trường "sát thương". `skillDamage(def)` đọc thẳng từ `action`
và trả về hệ số mỗi đòn, số đòn, phần quy đổi từ DoT, tổng, và một bậc đọc nhanh (`nhẹ` →
`vừa` → `nặng` → `cực nặng` → `huỷ diệt`). Thẻ ở Luyện Kiếm Đài và trang Đồ Giám đều đọc từ
đây, nên chỉnh một hệ số `mult` là mọi chỗ hiển thị đổi theo. Một bảng gõ tay thì sớm muộn
cũng nói sai, và nó nói sai **im lặng**.

Đơn vị là **hệ số công**, không phải sát thương tuyệt đối: sát thương thật còn qua phòng ngự,
ngũ hành và chênh lệch cảnh giới, nên một con số tuyệt đối chỉ đúng với đúng một cặp đánh nhau.

Hai chỗ phải cẩn thận trong công thức:

- **Đàn kiếm trừ đoạn tụ kiếm.** Gần một giây đầu đàn kiếm quay sát người và không chém ai;
  tính cả đoạn đó thì con số trên thẻ cao hơn thứ mục tiêu thật sự phải chịu.
- **`pierce` là số MỤC TIÊU, không phải số đòn.** Ngự Kiếm Thuật xuyên 4 nhưng một mục tiêu
  chỉ ăn một lần, nên `soDon` là 1 còn `soMucTieu` là 4. Gộp hai trục đó vào một con số thì
  chiêu nhập môn được xếp cùng bậc với Thái Ất Thanh Sơn Quyết.

#### Ba thứ thêm vào hệ chiêu

- **`volley`** — bắn một loạt thay vì một viên. Canh Kim Kiếm Khí bắn bảy đạo trong một quạt
  HẸP (0,3 radian) chứ không xoè rộng: đây là chiêu dồn vào MỘT mục tiêu, xoè rộng thì mỗi
  đạo trúng một con khác nhau và chiêu mạnh nhất của Nguyên Anh lại gãi ngứa bảy chỗ.
- **`pulses`** — pháp vực bùng nhiều nhịp. Tam Diễm Phiến quạt ba lần, Thiên Nhất Chân Thuỷ
  dội hai đợt. Gộp thành một vụ nổ to thì tên chiêu nói một đằng còn hình nói một nẻo. Nhịp
  còn nợ chạy **độc lập với pha thi triển**: ba nhịp của Tam Diễm Phiến kéo 1,3 giây còn thu
  thế chỉ 0,45 giây — buộc chúng vào pha thì hai nhịp cuối biến mất đúng lúc người chơi đã đi
  tiếp. Và mỗi nhịp phải **truy vấn lại vòng tròn**, nếu dùng lại danh sách mục tiêu của nhịp
  đầu thì con quái đã chạy khỏi biển lửa vẫn cháy còn con vừa chạy vào thì không việc gì.
- **Lực hút** — `knockback` âm. Đi kèm một sửa lỗi có sẵn từ trước: pháp vực trước đây nhờ
  `strike` đẩy, mà `strike` đẩy ra xa **người thi triển**. Với pháp vực đặt tại con trỏ thì
  gốc đúng phải là **tâm vùng** — sai gốc thì một quả sấm rơi phía sau lưng địch lại hất nó
  về phía mình. Sửa xong thì số âm tự nhiên thành lực hút, và Nguyên Từ Thần Quang không cần
  một loại `action` riêng.

### Luyện Kiếm Đài — màn trình diễn thần thông

Chọn từ menu chính. Là một **`GameScene` riêng** (`world/SwordTerraceScene.ts`), không phải
một cờ `demoMode` chạy xuyên qua đấu trường như trước.

Đó là thay đổi đáng ghi lại nhất ở đây. Chế độ cũ sống nhờ một biến bool, và **mỗi** nhánh
gameplay của đấu trường — đợt sóng, quái nền, nhặt đồ, tự lưu, hồi sinh, thanh banner — đều
phải mọc thêm một câu hỏi "có đang trình diễn không". Bảy chỗ có thể quên, mà quên chỗ nào
thì hỏng chỗ đó theo kiểu im lặng: một con quái nền lang thang vào giữa lúc đang diễn, hoặc
cảnh giới của chế độ xem bị ghi đè lên bản lưu thật. Tách ra thì màn này **không có** những
hệ đó để mà quên — nó không cầm `storage`, không có `save()`, và `Player` của nó là một thực
thể khác hẳn. `ArenaScene` gọn đi gần 200 dòng.

- **Không một sinh vật nào trong màn.** Bia là **mộc nhân** (người gỗ) và **bia đá**, dựng
  bằng geometry trong `art/props/training.ts`. Vẫn là `Combatant` phe địch nên mọi chiêu ăn
  vào đủ cả đẩy lùi, đóng băng, thiêu đốt và số sát thương bay lên — tức người xem vẫn đọc
  được toàn bộ phản hồi của một chiêu — nhưng không con nào có `Agent`, không con nào tự đi
  lại hay đánh trả.
- **Mộc nhân giữ dáng NGƯỜI nhưng không có mặt.** Hình người cho biết chiêu đang đánh vào
  đâu; một khối trụ thì đòn chém ngang bụng và đòn giộng vào đầu trông y hệt nhau. Nhưng
  thêm mắt vào là nó thành một sinh vật, và cả lý do bỏ quái khỏi màn này biến mất.
- **Thân tách khỏi gốc thành hai `Group`.** Đòn đánh làm thân nghiêng và rung, chân đế vẫn
  cắm xuống đá. Xoay chung một node thì cả cái đế nhấc lên khỏi sàn và mắt đọc ra là một món
  đồ chơi bị đá đổ. Biên độ rung có **trần**: một chiêu nhiều nhịp gọi `showHurt` bốn lần
  trong một giây, không có trần thì bia quay tít như chong chóng.
- **Phòng ngự và bạo kích của bia bằng 0.** Đây là màn để ĐỌC sức của từng chiêu; phòng ngự
  bóp méo con số theo một đường phi tuyến và bạo kích làm nó nhảy ngẫu nhiên. Bỏ cả hai thì
  số bay lên tỉ lệ thẳng với hệ số công ghi trên thẻ — hai chỗ nói cùng một điều.
- **Máu bia suy theo cảnh giới NGƯỜI THI TRIỂN.** Ở Nguyên Anh, công của Hàn Lập gấp gần ba
  mươi lần lúc Luyện Khí; một con số cứng thì hoặc bia bất tử ở đầu showreel hoặc bốc hơi
  trước nhịp quét thứ hai ở cuối.
- **Mỗi bước tự khai cảnh giới, và bộ điều phối đặt cảnh giới TRƯỚC khi dựng bia.** Máu bia
  suy từ cảnh giới người chơi, nên dựng trước rồi mới nâng cảnh giới thì cả vòng bia mỏng đi
  một bậc và chết ngay nhịp quét đầu. Có test khoá đúng thứ tự hai lời gọi đó.
- **Đàn kiếm trúc xuất hiện HAI LẦN trong kịch bản** — 12 thanh ở Kết Đan sơ kỳ, 72 thanh ở
  Nguyên Anh. Đây là chỗ duy nhất đáng lặp lại một chiêu: xem 12 rồi xem 72 mới đọc ra được
  cảnh giới nghĩa là gì.
- **Bộ điều phối gọi chiêu theo `id`, không theo ô.** Đó là điều làm màn này diễn được cả
  mười bảy chiêu: thanh pháp thuật chỉ có mười ô nên bảy chiêu bị chiếm chỗ, và nếu showreel
  cũng đi qua ô thì bảy chiêu đó không có đường nào gọi ra.
- **Kẹp người chơi trong lòng đài bằng một phép chia**, không dựng vành va chạm. Vành tròn
  ghép từ hình tròn tĩnh thì luôn có kẽ hở giữa hai hình, mà một cú Phong Lôi Sí dài 10,5
  unit tìm ra kẽ hở đó ngay lần lướt đầu tiên.
- **Đài dùng `FLAT_GROUND`, không dùng `Terrain`.** Địa hình gợn sóng làm bia đứng lệch cao
  độ nhau vài phần mười unit, và ở một màn để ĐO thì mọi chênh lệch không giải thích được
  đều là nhiễu. Đài cũng có bốn vòng khắc và tám nan hoa — không phải trang trí: sân trống
  hoàn toàn thì mắt không có mốc nào để đo khoảng cách, nên người xem không đọc ra bán kính
  3 của đàn kiếm khác bán kính 5,2 của Thái Ất Thanh Sơn ở chỗ nào.
- **Thả vệt đuôi theo HẾT sức chứa đàn kiếm**, không theo số kiếm của lượt vừa rồi: lượt
  trước có thể đông hơn lượt này, và vệt của những chỗ ngồi thừa sẽ treo lại giữa không khí
  cho tới lần nào đó tình cờ đông bằng.
- `Q` `E` đổi chiêu · `1…0` tự thi triển · `Esc` về menu. Dùng `Q`/`E` chứ **không** `Space`
  và mũi tên — `Space` đã là ngự kiếm phi hành, mũi tên đã là phím đi.

#### Chọn một chiêu là chiêu đó lặp mãi — không còn showreel tự chạy

Bản đầu là một **showreel**: vào màn là nó tự đi hết hai mươi hai bước rồi quay vòng, mỗi
bước sống đúng `duration` giây. Nghe thì hợp lý, nhưng nó hỏng đúng cái việc người ta mở màn
này ra để làm. Muốn nhìn kỹ đàn 72 thanh kiếm trúc bay theo quỹ đạo nào thì có **chín giây**;
hết chín giây là nó lôi sang chiêu khác dù đang xem dở, và muốn xem lại thì phải đợi hết cả
vòng. Xem một chiêu là việc **ngắm** — nó phải lặp tới khi người xem chán, không phải tới khi
đồng hồ hết.

Giờ bộ điều phối giữ **đúng một bước** và lặp nó vô hạn. Nhịp lặp là `repeatEvery` nếu bước
có khai, không thì chính `duration` — cùng bộ số cũ, đọc lại theo một nghĩa khác. Đổi chiêu
chỉ có ba đường, và cả ba đều đi qua `select()`: bấm một dòng trong danh sách bên trái, hoặc
`Q` / `E`. Danh sách 22 dòng đó từ chỗ là mục lục trở thành **bộ điều khiển chính** của màn.

Ba thứ phải sửa kèm, đều chỉ lộ ra khi một bước chạy vô hạn thay vì chín giây:

- **Bù sinh lực và linh lực trước MỖI nhịp**, không chỉ lúc vào bước. Giá Y Thần Công đốt 18%
  máu mỗi lần thi triển và ngự kiếm phi hành đốt 2,2% linh lực mỗi giây: xem một chiêu vài
  phút thì nhân vật kiệt quệ rồi rơi khỏi kiếm giữa chừng, và người xem đọc ra là một cái lỗi
  chứ không phải cái giá của chiêu. Bù ngay **trước** nhịp nên cú tụt vẫn thấy rõ đúng lúc.
- **Trạng thái bật/tắt được gọi lại mỗi nhịp.** `setFlying` và `setMeditating` đều thoát sớm
  khi đã đúng trạng thái, nên gọi lại không tốn gì — mà lại là thứ dựng chúng dậy sau khi bị
  choáng hoặc bị ngắt giữa chừng.
- **Toạ thiền do mã ra lệnh cần cờ riêng (`scriptedMeditate`).** Đây là một bug im lặng có
  sẵn từ trước, chỉ lộ ra khi bước lặp: `updateMeditation` huỷ toạ thiền ngay khi không còn
  ai giữ `F`, mà bộ trình diễn thì không giữ phím nào — nên bước Trường Xuân Công **chưa bao
  giờ** diễn ra được lấy một khung hình, và chẳng có gì báo.

#### Trục dọc của camera từng ngược

`IsoCamera.orbit()` có hai dấu **ngược nhau**, và đó là thứ trông như lỗi mà lại đúng:
`yaw` là góc quay quanh trục đứng, `pitch` là **độ cao** của camera — cùng một chiều kéo trên
màn hình ra hai dấu khác nhau trong toạ độ cầu. Bản đầu để cả hai cùng dấu trừ, nên kéo xuống
lại **hạ** camera xuống ngang tầm mắt: ngược với mọi game có camera quay quanh nhân vật, và
đứng cạnh trục ngang thì hai trục đá nhau — cú kéo chéo nào cũng sai một nửa.

Quy ước chốt lại: **camera đi theo tay, cảnh trượt ngược lại**. Kéo sang phải thì camera vòng
sang phải; kéo xuống thì camera dâng lên nhìn từ trên. Có test trong
`render/__tests__/IsoCamera.test.ts` khoá cả hai trục, và nó đo bằng **phép chiếu thật** —
chiếu đỉnh đầu nhân vật ra NDC rồi xem nó trượt lên hay xuống — chứ không đọc dấu của `pitch`.
Đọc dấu thì test chỉ chép lại code, và nó sẽ xanh y nguyên khi ai đó lật ngược quy ước.

#### Chuột trái xoay camera, và cho zoom sát hơn hẳn lượt chơi

Đây là màn để NGẮM một vật, nên phải xoay quanh nó được. Ba thay đổi nhỏ, mỗi cái chặn một
kiểu hỏng riêng:

- **`GameScene.orbitOnLeftDrag`** — `Game` vẫn là chỗ duy nhất đọc chuột để xoay camera, màn
  chỉ khai "ở đây chuột trái cũng xoay". Để `Game` hỏi tên màn, hay để màn tự gọi
  `camera.orbit()` trong `render()`, đều là nhét điều khiển camera vào chỗ thứ hai.
- **`Player.mouseAttack = false`** ở màn này. Không tắt thì mỗi vòng kéo camera lại vung ra
  một combo ba nhát — vừa che mất chiêu đang diễn vừa đánh sập vòng bia. Phím `J` vẫn chém.
- **Lớp phủ `.showcase` phải thật sự cho chuột đi xuyên qua.** Nó khai
  `pointer-events: none` từ đầu, nhưng khai báo đó bị `#ui-root > *` đè mất — xem mục *Ba màn,
  và hai cái bẫy CSS*. Đây mới là lý do thật khiến xoay và zoom không nhúc nhích, và nó chặn
  cả ba màn chứ không riêng màn này.
- **`minDistance` hạ từ 9 xuống 5**, và **trả lại lúc `unload`**. Camera là của `Game`, dùng
  chung cho cả ba màn: để nguyên 5 thì quay về đấu trường vẫn zoom sát được vào gáy nhân vật
  và mất hết tầm nhìn chiến thuật. Ở 5 unit thì đếm được nếp áo Hàn Lập — mà cái đó thì chỉ
  màn này mới cần.

#### Thẻ giới thiệu nói ba thứ, theo đúng thứ tự người xem cần

Tên chiêu → **thi triển bằng gì** (pháp bảo và hạng của nó) → **mạnh cỡ nào** (bậc sát thương
kèm con số suy ra nó) → rồi mới tới chú thích về cách xem. Thiếu hai cái giữa thì mọi chiêu
đọc ra như nhau — mà trong Phàm Nhân, khoảng cách giữa một lá phù mua ngoài chợ và một bản
mệnh pháp bảo luyện hai mươi mốt năm mới là nội dung thật.

Danh sách bên trái **chia chương theo cảnh giới** chứ không phải một cột 22 dòng phẳng: cột
phẳng thì người xem không đọc ra được rằng bộ pháp thuật này đi theo một CON ĐƯỜNG.

### Đồ Giám

Bảng tra nhân vật · yêu thú · pháp bảo. Lưới thẻ, bấm một thẻ thì mô hình dựng lên **bệ xoay**
ở giữa và trang chi tiết mở ra bên phải.

Là một `GameScene` (`world/CodexScene.ts`) chứ không phải một lớp phủ DOM, và lý do là chính
cái bệ xoay: mô hình ở đây dựng bằng **đúng những hàm geometry mà trận đấu dùng**, nên con
Hắc Lang trong Đồ Giám là con Hắc Lang thật chứ không phải một tấm ảnh chụp sẽ lệch đi sau
lần đổi màu lông đầu tiên.

- **Không một chỉ số nào gõ tay.** Mục có `unitId` thì máu, công, phòng, cảnh giới đọc thẳng
  từ `units.ts`; mục pháp bảo đọc từ `skills.ts`. Đồ Giám là chỗ người chơi TIN nhất, nên nó
  nói sai là tệ nhất. Có test cấm một mục vừa khai `unitId` vừa tự khai `realm` — hai nguồn
  cho cùng một con số là hai chỗ để nói khác nhau, và giá trị bị `codexRealm` bỏ qua sẽ nằm
  trong file trông như sự thật mà không bao giờ được đọc.
- **In chỉ số ở CẢNH GIỚI của nó, không in chỉ số nền.** Chỉ số nền của Mặc Đại Phu là 150
  sinh lực; con thật ở Trúc Cơ hậu kỳ có gần ba nghìn. In số nền thì bảng nói một điều đúng
  về dữ liệu và sai hoàn toàn về thứ người chơi sẽ gặp.
- **Không lấy `def.scale` làm tỉ lệ trưng bày.** Đó là tỉ lệ so với nhân vật cao 1,1 unit
  trong trận, nên con Yêu Thử ra 0,52 và trên cái bệ nó chỉ còn là một chấm. Mọi mô hình
  dựng ở tỉ lệ 1 rồi `displayScale` của từng mục chỉnh cho vừa khung.
- **Chạy clip `IDLE` một nhịp cho mô hình có xương.** Rig ở tư thế nghỉ là hai tay dang ngang
  và chân duỗi thẳng — một hình nộm, không phải một người.
- **Ẩn hẳn cái bệ khi chưa chọn mục.** Ở chế độ lưới thì thẻ trải hết bề ngang, nên cái bệ
  chỉ là một khối nằm sau đám chữ: nó không nói gì mà lại tranh mắt.
- **Bệ phải THẤP và NGUỘI màu.** Bản đầu dùng `themDa` (đá thềm, ngả kem) cho mặt bệ, và dưới
  nắng vàng của bộ stylized nó ra một cái đĩa CAM to hơn cả vật đứng trên nó — cái bệ giành
  mất chỗ của thứ nó phải tôn lên.
- **Thứ tự Euler của đàn kiếm trưng bày phải là `YXZ`.** Geometry hướng mũi về +Z; muốn mũi
  chĩa lên và hơi ngả ra ngoài thì phải ngửa quanh X trước rồi mới quay quanh Y để về chỗ
  ngồi, tức Y là phép quay NGOÀI CÙNG. Với thứ tự `XYZ` mặc định thì Y nằm trong, và kết quả
  là mười hai thanh nằm ngang xoè ra như nan hoa bánh xe.
- **Hai vòng sáu thanh, không phải một vòng mười hai.** Một vòng đơn nhìn từ góc iso thì sáu
  thanh phía sau bị sáu thanh phía trước che gần hết, nên đếm ra khoảng bảy. Hai vòng lệch
  cao độ và lệch pha nửa bước thì con số mười hai đếm được bằng mắt — mà đếm được mới là
  điều làm nó đáng nhìn.
- **Trang chi tiết dán vào mép phải (`margin-left: auto`),** lưới co về mép trái. Khoảng
  trống ở giữa chính là chỗ đứng của bệ xoay; không có dòng đó thì hai cột chữ dồn về trái
  và mô hình nằm ngay dưới đám chữ.
- **`Esc` lùi từng bước:** đang xem chi tiết thì về lưới, ở lưới mới ra menu. Đồ Giám là thứ
  người ta lật qua lật lại chứ không xem một lượt rồi thôi.
- Dữ liệu tự **ném lỗi lúc nạp module** nếu một `skills`/`unitId`/`prop` id trỏ vào chỗ không
  có. Một id sai chỉ hiện ra khi có người bấm đúng mục đó, và lúc ấy nó là một ô trống chứ
  không phải một lỗi.

### Ba màn, và hai cái bẫy CSS

`main.ts` giờ điều phối ba `GameScene`: `arena` (lượt chơi), `terrace` (Luyện Kiếm Đài),
`codex` (Đồ Giám). Ba chỗ phải sửa kèm:

- **`DebugPanel` phải được dựng LẠI mỗi lần đổi màn.** Nó đọc `scene.debug` một lần lúc khởi
  tạo để quyết định có hiện nhóm chiến đấu hay không; giữ nguyên một bảng qua các lần đổi màn
  thì nó vẫn cầm hook của màn cũ — nút "sinh quái" vẫn sinh quái vào một `ArenaScene` đã bị
  `unload`, và không có gì báo.
- **Menu phải có `z-index`.** Trước đây nó nằm trên nhờ thứ tự DOM: nó được dựng SAU khi màn
  đã nạp xong nên nằm cuối `#ui-root`. Từ lúc có ba màn thì thứ tự đó đảo ngược — menu dựng
  một lần lúc khởi động, còn màn nạp lại mỗi lần đổi, nên lớp phủ của màn được thêm sau và đè
  lên menu. Thẻ *"bấm ENTER để khởi trận"* của `WaveBanner` nằm chình ình giữa menu chính,
  che mất hai nút.
- **`#ui-root > *` nuốt sạch chuột, và không có gì báo.** Dòng
  `#ui-root > * { pointer-events: auto }` mang một `id`, nên nó **thắng về độ cụ thể** mọi
  khai báo `pointer-events: none` mà từng lớp phủ tự viết bằng class. Ba lớp phủ tràn màn
  hình — `.showcase`, `.world-bars`, `.float-text-layer` — do đó nằm đè kín canvas và ăn hết
  sự kiện chuột: `Input` gắn listener trên chính thẻ `<canvas>`, mà sự kiện thì không bao giờ
  tới đó. Kéo xoay camera, lăn zoom và ngắm bằng chuột đều chết **im lặng** — không lỗi
  console, không cảnh báo, `elementFromPoint` ở giữa màn hình trả về một div trong suốt. Sửa
  bằng `:where(#ui-root) > *`: `:where()` có độ cụ thể bằng không, nên dòng đó trở lại đúng
  vai *mặc định* của nó và mọi `pointer-events: none` được tôn trọng như tác giả đã định.
  Lối chẩn: khi chuột "không ăn", đo `document.elementFromPoint(x, y)` trước khi đi đọc code
  điều khiển — nó chỉ thẳng ra thủ phạm trong một dòng.

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

`src/render/stylized/` là một bộ ánh sáng + sương mù + hậu kỳ độc lập với bộ ban đầu, và
là bộ **đang bật mặc định** — `main` bật nó ngay sau khi nạp màn, tắt được lúc chạy qua
nhóm "Stylized / fantasy" của bảng debug (hoặc `window.__pntt.stylized`) để so sánh A/B
trên cùng một cảnh. Ba tệp: `tune.ts` (mọi con số, kèm HEX và khoảng dùng được),
`StylizedAtmosphere.ts` (dựng và cập nhật), `index.ts` (công tắc A/B).

Vị trí bốn đèn lạnh do **màn** cấp (`ArenaScene.coolSpots`), không phải bảng debug: màn
mới là nơi biết bốn cột đá đứng đâu, và công tắc nhớ lại vị trí của lần bật đầu để bật/tắt
sau đó không cần biết gì về bố cục sân.

Bật mặc định thì phải **nối lại hai công tắc trong bảng Cài đặt**: bộ này có đèn và chuỗi
pass riêng, nên `lighting.shadowsEnabled` chỉ tắt bóng của nắng cũ và `composer.enabled`
thì vô nghĩa khi `renderOverride` đã thay cả đường vẽ — không nối thì "Đổ bóng" và "Hậu xử
lý" im lặng mất tác dụng, kiểu hỏng tệ nhất cho một công tắc vì người chơi không có cách
nào biết. "Hậu xử lý: tắt" ở đây nghĩa là tắt BLOOM chứ không bỏ cả chuỗi pass: `OutputPass`
mới là thứ áp tone mapping, bỏ nó thì ảnh ra nhạt sai màu.

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
- Đàn kiếm trúc gây sát thương theo **vòng quét có nhịp** (0,3 giây/mục tiêu),
  không theo từng thanh. Tính theo từng thanh thì một con quái đứng đúng chỗ ăn cả bộ đòn
  trong một frame và chết tức khắc bất kể cảnh giới — phá vỡ luật chênh lệch cảnh giới,
  thứ quan trọng nhất của cả hệ chiến đấu.
- Vòng kiếm **bung ra rồi GIỮ**, không loang ra mãi. Thử cho loang tới 7 unit trước:
  đàn kiếm rải trên vòng lớn nhìn ra là một đống que bay tản mát và người chơi không
  còn điều khiển được gì. Giữ vòng chặt (bán kính 3) thì đàn kiếm đặc, và người chơi
  **lái** được nó bằng cách đi bộ.
- Lưỡi kiếm phải **nghiêng gần vuông góc** quanh trục bay. Để nằm ngang thì từ góc iso
  nó đọc ra là một que gỗ rơi trên đất. Và đàn kiếm phải chia thành **ba vòng đều quay
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
      màn thử dẫn khí + `BreakthroughFx`, Trúc Cơ → Ngự Kiếm Phi Hành, Kết Đan → đàn kiếm trúc,
      drop table, túi đồ, luyện đan, ba bảng UI
- [x] **M7** Tướng & đại chiến — bộ điều phối 6 đợt, đệ tử đồng môn AI, lớp quân hậu cảnh
      instanced, Ma Đạo Trúc Cơ (bài học chênh cảnh giới), Mặc Đại Phu 3 phase, thanh máu
      tướng, thắng/thua
- [x] **M8** Hoàn thiện — lưu localStorage + migration, menu chính, tạm dừng, cài đặt
      (phân giải · đổ bóng · hậu xử lý · giới hạn fps · âm lượng), SFX procedural bằng
      WebAudio, pass cân bằng
