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
| WASD / phím mũi tên | Di chuyển *(từ M1)* |
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
- **Màn chơi qua interface `GameScene`** (`world/Scene.ts`) — điểm cắm để thêm các
  chương cốt truyện về sau mà không phải sửa lõi.

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

## Tiến độ

- [x] **M0** Scaffold — renderer, camera iso, trời + sương mù, vòng lặp 60Hz, outline, bloom, debug panel
- [ ] **M1** Hàn Lập chibi + di chuyển
- [ ] **M2** Map sơn môn (terrain thật)
- [ ] **M3** Combat cơ bản
- [ ] **M4** Pháp thuật & VFX
- [ ] **M5** Tu luyện & đột phá cảnh giới
- [ ] **M6** Vật phẩm, túi đồ, luyện đan
- [ ] **M7** Tướng & đại chiến
- [ ] **M8** Hoàn thiện
