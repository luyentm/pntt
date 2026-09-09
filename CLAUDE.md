# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Tổng quan

Web ARPG chibi lowpoly theo thế giới *Phàm Nhân Tu Tiên*. TypeScript + three.js + Vite,
**không một asset ngoài nào**: model, prop, animation, âm thanh đều sinh bằng code.
`dist` là ba file tĩnh chạy offline.

Toàn bộ code, comment, doc và commit message viết bằng **tiếng Việt**. Comment ở đây giải
thích *tại sao* chứ không thuật lại code — giữ đúng lối đó khi thêm code mới.

## Lệnh

`node_modules` không được commit, nên bắt đầu bằng `npm ci`.

| Lệnh | Việc |
|---|---|
| `npm run dev` | Dev server, cổng 5173 (`strictPort`) |
| `npm test` | Toàn bộ test (vitest, chạy một lượt rồi thoát) |
| `npx vitest run src/game/__tests__/Stats.test.ts` | Một file test |
| `npx vitest run -t 'tên test'` | Một test theo tên |
| `npm run typecheck` | Chỉ `tsc --noEmit` |
| `npm run build` | Typecheck **rồi** build vào `dist/` |

Xem trong trình duyệt: dùng preview tool với `.claude/launch.json` (tên cấu hình `pntt`),
không chạy dev server bằng shell. Trong console có `window.__pntt`
(`game`, `scene`, `debug`, `menu`, `sfx`, `stylized`) để soi trạng thái sống; phím `` ` ``
mở bảng debug (ẩn sẵn ở bản PROD, vẫn mở được).

## Ràng buộc không được phá

Đây là những quyết định mà cả kiến trúc dựng quanh — phá một cái là hỏng nhiều chỗ xa nhau:

- **Không asset ngoài.** Không texture, không `.glb`, không file âm thanh, không font CDN.
  Thêm hình = thêm hàm dựng geometry trong `src/art/`; thêm tiếng = thêm voice trong
  `src/audio/Synth.ts`. `troika-three-text` đã bị loại vì nó tải font từ CDN lúc chạy.
- **`Math.random()` bị cấm toàn project.** Mọi số ngẫu nhiên đi qua `core/Rng.ts`
  (`ctx.rng`, hoặc `rng.fork()` cho một nhánh riêng). Tính xác định là điều kiện để combat
  test được — đây cũng là lý do `yuka` bị loại.
- **Gameplay chỉ chạy trong `fixedUpdate` (60Hz).** `render(alpha, frameDt)` chỉ được làm
  việc thuần hình ảnh: nội suy, VFX, camera. Đọc `frameDt` để quyết định gameplay là làm
  kết quả phụ thuộc fps.
- **Không physics engine, không ECS, không hệ hạt.** Va chạm là hình tròn trên XZ + spatial
  hash tự viết (`world/Collision.ts`, `world/CombatWorld.ts`); thực thể là lớp
  `Combatant` có kiểu rõ ràng; hiệu ứng dựng bằng **dải ribbon** (`vfx/RibbonTrails.ts`) —
  `vfx/Particles.ts` đã bị xoá hẳn, đừng dựng lại.
- **UI là overlay DOM/CSS** (`src/ui/`, `ui/styles/base.css`), không vẽ chữ trong canvas.
- **`three` ghim ở `0.185.1`** vì `postprocessing` yêu cầu `>= 0.168 < 0.186`.
- **`base: './'` trong `vite.config.ts`** — GitHub Pages phục vụ ở đường dẫn con `/pntt/`.
- Kiến trúc dựng theo **tỉ lệ chibi**, không tỉ lệ người thật (nhân vật cao ~1.1 unit).
- **Hàn Lập KHÔNG đi qua `buildChibi`.** Hắn có builder riêng
  (`art/characters/HanLap.ts`) và được phép tốn gấp nhiều lần tam giác, vì chỉ có một hắn
  trên màn hình. `buildChibi` giữ đúng vai cũ: dựng hàng chục quái rẻ tiền. Cả hai vẫn ra
  MỘT `SkinnedMesh` một draw call, và dùng chung `CHIBI_RIG`.
- **Thêm khớp vào rig thì thêm ở CUỐI `CHIBI_JOINTS`.** Clip lưu dữ liệu theo chỉ số mảng
  đó; chèn vào giữa là lệch toàn bộ animation đã có mà không có gì báo.

## Kiến trúc

Lõi không biết luật chơi; luật không biết đồ hoạ.

```
core/     Game (trục chính) · Loop (fixed-timestep + nội suy) · Input · EventBus · Rng · noise
render/   Renderer · IsoCamera · Lighting · Sky · Composer (outline + bloom) · stylized/
world/    GameScene interface + BA màn: ArenaScene (lượt chơi) · SwordTerraceScene
          (Luyện Kiếm Đài) · CodexScene (Đồ Giám). Player · Agent · CombatWorld
          · Collision · Projectile · SkillCaster · SwordStorm · TrainingTarget
          · Terrain · Crowd · Pickups
game/     Luật chơi thuần số: Stats · Cultivation · Effects · Inventory · Alchemy
          · SaveGame · Settings · Loadout · WaveDirector · BreakthroughTrial
          · ShowcaseDirector
game/data/ Nội dung: units · skills · items · recipes · realms · waves · dropTables
          · showcase · codex · player
art/      Rig + hàm dựng geometry (chibi, thú, prop, kiến trúc, pháp bảo, cánh)
          · Palette · PropBatch · characters/HanLap (bản dựng riêng, high-poly)
anim/     Rig · Clip (keyframe biên dịch sang Float32Array) · clips/
vfx/      Vfx (mặt tiền) · RibbonTrails · FootAura · SlashArc · AreaBurst · ...
ui/       Hud · Menu · SkillBar · panels/ · styles/base.css
audio/    Synth (WebAudio procedural) · Sfx (nghe EventBus)
```

Bốn đường nối đáng nhớ:

- **`GameScene` (`world/Scene.ts`)** là điểm cắm để thêm chương về sau. `Game.setScene()`
  cấp `SceneContext` (three scene, camera, lighting, input, rng đã fork, bus). Màn có thể
  khai `debug?: SceneDebugActions` — bảng debug **đọc hook này lúc khởi tạo**, nên phải
  `setScene()` trước khi dựng `DebugPanel`.
- **`EventBus<GameEvents>`** là kênh một chiều gameplay → VFX/UI/SFX. Danh mục sự kiện tập
  trung ở `core/events.ts`; hệ chiến đấu emit `combat:hit`, `skill:cast`… mà không cần biết
  ai nghe. Thêm hiệu ứng nghe-được thường là thêm listener, không phải sửa combat.
- **`Combatant` ⟷ `CombatantView`** (`world/Combatant.ts`, `world/views.ts`) — logic giữ số
  và trạng thái, view chỉ trả lời "hãy diễn cảnh chạy / trúng đòn". Nhờ vậy test dựng
  `FakeView` và chạy được không cần WebGL.
- **`ArenaScene`** là nơi lắp đặt của lượt chơi: nó cầm collision, combat world,
  projectile, VFX, mọi panel UI và các director. Đây là file lớn nhất (~1470 dòng) và là
  chỗ để tra "thứ này được nối vào đâu". Hai màn kia cố tình KHÔNG dùng lại nó — chế độ
  trình diễn từng là một cờ `demoMode` chạy xuyên qua đấu trường, và mỗi hệ gameplay ở đó
  (đợt sóng, quái nền, nhặt đồ, tự lưu, hồi sinh) phải mọc thêm một câu hỏi "có đang trình
  diễn không". `main.ts` điều phối ba màn và dựng LẠI `DebugPanel` mỗi lần đổi.

**Nội dung là data.** Thêm quái / chiêu / đan dược = thêm một entry trong `game/data/`,
không viết system mới. Nếu thấy mình phải sửa `SkillCaster` để thêm một chiêu, hãy xem lại
liệu nó có khớp vào một `SkillAction` sẵn có.

**Hệ pháp thuật khoá theo `id`, không theo chỉ số mảng.** 17 chiêu chia bốn đại cảnh giới
(Luyện Khí → Trúc Cơ → Kết Đan → Nguyên Anh), mà thanh chỉ có 10 ô — `game/Loadout.ts` gán ô
cố định cho từng chiêu và cho chiêu cảnh giới cao chiếm chỗ chiêu cùng vai trò. Số liệu sát
thương SUY từ `action` (`skillDamage`), không có trường gõ tay: thẻ ở Luyện Kiếm Đài và Đồ
Giám đều đọc từ đó. `PLAYABLE_MAJOR_CAP` tách trần của lượt chơi khỏi trần của thang cảnh giới.

**Từ vựng nghiệp vụ giữ nguyên tiếng Việt không dấu** trong tên biến: `tuVi`, `linhLuc`,
`sinhLuc`, `cong`, `phong`, `thanThuc`, `toc`, `bao`, `phapVuc`, `phiHanh`. Đừng dịch sang
`hp`/`mp` ở tầng luật.

## Test

Vitest chạy ở Node, **không có WebGL**. Test được import `three` để dùng toán và geometry
(`Terrain`, `RibbonTrails` có test đo trực tiếp buffer attribute), nhưng không bao giờ dựng
`WebGLRenderer`. Test nằm ở `__tests__/` cạnh code. Tra mesh trong test **theo tên**
(`getObjectByName('vfx:trails:mesh')`), không theo chỉ số con — chỉ số làm test âm thầm đo
sai mesh mà vẫn xanh.

TS ở chế độ `strict` + `noUncheckedIndexedAccess` + `noUnusedLocals`: đọc phần tử mảng phải
xử lý `undefined` (lối trong repo là `arr[i] as T` khi đã kiểm tra biên).

## Deploy

Đẩy lên `main` là tự deploy (`.github/workflows/deploy.yml`): test → build → Pages.
Workflow tự bật Pages ở chế độ Actions bằng `configure-pages` với `enablement: true`; xem
README để hiểu cái bẫy "workflow xanh mà site vẫn hỏng".

## README là sổ ghi quyết định

`README.md` (~840 dòng) chép lại từng chỗ đã mất thời gian mò ra: hiệu năng, ánh sáng, hình
học vệt đuôi, tỉ lệ kiến trúc, những bug im lặng đã gặp và test đã khoá chúng lại. **Đọc
mục liên quan trước khi sửa một hệ đã có** — phần lớn con số trong code là kết quả đo,
không phải áng. Khi tự mò ra một điều không hiển nhiên, ghi tiếp vào đúng mục đó.
