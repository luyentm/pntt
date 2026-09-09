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
| Giữ Shift | Đi chậm |
| `1`–`6` | Pháp thuật *(từ M4)* |

## Kiến trúc

Chi tiết đầy đủ nằm trong plan. Tóm tắt:

- **Không có asset ngoài nào.** Không texture, không `.glb`, không file âm thanh.
  Model chibi và prop được **sinh bằng code** từ khối cơ bản + vertex color;
  animation là rig `Group` lồng nhau (không xương); âm thanh sinh bằng WebAudio.
  Bundle ~166 KB gz, load tức thì, chạy offline.
- **Vòng lặp fixed-timestep 60Hz + nội suy** (`core/Loop.ts`) — combat và AI xác định,
  không phụ thuộc fps.
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

`three` 0.185.1 · `postprocessing` (outline + bloom) · `yuka` (AI + navmesh) ·
`miniplex` (ECS) · `troika-three-text` (chữ 3D có dấu) · `lil-gui` (debug).

> Ghim three ở **0.185.1** vì `postprocessing` yêu cầu `three >= 0.168 < 0.186`.

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

## Tiến độ

- [x] **M0** Scaffold — renderer, camera iso, trời + sương mù, vòng lặp 60Hz, outline, bloom, debug panel
- [x] **M1** Hàn Lập chibi + di chuyển — rig xương, clip idle/walk/run, controller theo hướng camera, va chạm
- [x] **M2** Map sơn môn — terrain noise, cổng phái, đèn đá, đài luyện đan, rừng tùng + khóm tre (instanced)
- [ ] **M3** Combat cơ bản
- [ ] **M4** Pháp thuật & VFX
- [ ] **M5** Tu luyện & đột phá cảnh giới
- [ ] **M6** Vật phẩm, túi đồ, luyện đan
- [ ] **M7** Tướng & đại chiến
- [ ] **M8** Hoàn thiện
