import { Sfx } from '@/audio/Sfx'
import { Game } from '@/core/Game'
import { realmName } from '@/game/data/realms'
import { clearSave, describeSave, loadGame, type SaveStorage } from '@/game/SaveGame'
import { loadSettings, saveSettings, type Settings } from '@/game/Settings'
import { DebugPanel } from '@/debug/DebugPanel'
import { StylizedToggle } from '@/render/stylized'
import { Menu } from '@/ui/Menu'
import { ArenaScene } from '@/world/ArenaScene'
import { CodexScene } from '@/world/CodexScene'
import { SwordTerraceScene } from '@/world/SwordTerraceScene'

const canvasEl = document.getElementById('game-canvas')
if (!(canvasEl instanceof HTMLCanvasElement)) {
  throw new Error('Không tìm thấy #game-canvas')
}
// Gán lại sau khi kiểm tra: TypeScript không giữ được kết quả thu hẹp kiểu qua
// biên của một closure, nên `canvasEl` bên trong hàm vẫn bị coi là có thể null
const canvas: HTMLCanvasElement = canvasEl
const uiRoot = document.getElementById('ui-root')
if (!uiRoot) throw new Error('Không tìm thấy #ui-root')

/**
 * localStorage có thể ném lỗi ngay khi CHẠM VÀO ở chế độ riêng tư của một số
 * trình duyệt. Bọc lại thành một chỗ lưu không bao giờ ném: không lưu được là
 * mất tiến độ, còn ném lỗi ở đây là không vào được game.
 */
const storage: SaveStorage = {
  getItem: (k) => {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  setItem: (k, v) => {
    try {
      localStorage.setItem(k, v)
    } catch {
      /* bỏ qua */
    }
  },
  removeItem: (k) => {
    try {
      localStorage.removeItem(k)
    } catch {
      /* bỏ qua */
    }
  },
}

let settings: Settings = loadSettings(storage)

const game = new Game(canvas)
const stylized = new StylizedToggle(game)
game.stylized = stylized
const sfx = new Sfx(game.bus, settings.sfxVolume)

/**
 * Ba màn của bản này.
 *
 * `arena` là lượt chơi thật; `terrace` là Luyện Kiếm Đài; `codex` là Đồ Giám.
 * Chúng là ba `GameScene` riêng chứ không phải ba chế độ của một màn, và đó là
 * điều làm cả ba đơn giản: đấu trường không phải hỏi "có đang trình diễn không"
 * ở bảy chỗ khác nhau, còn Đồ Giám thì không có combat để mà tắt.
 */
type SceneKey = 'arena' | 'terrace' | 'codex'

let arena: ArenaScene | null = null
let terrace: SwordTerraceScene | null = null
let codex: CodexScene | null = null
let currentKey: SceneKey | null = null
/**
 * Bảng debug được DỰNG LẠI mỗi lần đổi màn.
 *
 * Bắt buộc, không phải chuyện gọn gàng: `DebugPanel` đọc `scene.debug` MỘT LẦN
 * lúc khởi tạo để quyết định có hiện nhóm chiến đấu hay không. Giữ nguyên một
 * bảng qua các lần đổi màn thì nó vẫn cầm hook của màn cũ — tức nút "sinh quái"
 * vẫn sinh quái vào một `ArenaScene` đã bị `unload`, và không có gì báo.
 */
let debug: DebugPanel | null = null

/** Màn đang chạy, ở dạng đọc được chung — chỉ dùng cho cài đặt và đèn stylized. */
function activeScene(): ArenaScene | SwordTerraceScene | CodexScene | null {
  if (currentKey === 'arena') return arena
  if (currentKey === 'terrace') return terrace
  if (currentKey === 'codex') return codex
  return null
}

async function gotoScene(key: SceneKey): Promise<void> {
  if (currentKey === key) return

  // Vứt bỏ màn cũ: mỗi màn dựng UI riêng vào #ui-root và đăng ký listener riêng
  // trên bus, nên giữ lại một màn đã rời đi là giữ lại cả lớp phủ của nó
  if (key !== 'arena') arena = null
  if (key !== 'terrace') terrace = null
  if (key !== 'codex') codex = null

  let scene: ArenaScene | SwordTerraceScene | CodexScene
  if (key === 'arena') {
    arena = new ArenaScene()
    arena.storage = storage
    scene = arena
  } else if (key === 'terrace') {
    terrace = new SwordTerraceScene()
    scene = terrace
  } else {
    codex = new CodexScene()
    scene = codex
  }

  currentKey = key
  await game.setScene(scene)

  // Bộ stylized chỉ dành cho màn có THẾ GIỚI.
  //
  // Nó dựng một buổi trưa ngoài trời: nắng 1,95, đèn viền linh khí, sương mù xa
  // và bloom. Trên một sân đá có cây, có nhà, có quái thì đó đúng là thứ làm
  // cảnh đẹp lên. Trên bệ trưng bày của Đồ Giám — một mô hình đơn độc, không
  // nền, không gì để so sáng — cũng bấy nhiêu ánh sáng đó đốt cháy trắng cả
  // khuôn mặt, và người xem không còn đọc được màu áo lẫn nét mặt, tức mất đúng
  // thứ họ mở Đồ Giám ra để xem. Màn nào cấp `coolSpots` thì có thế giới; màn
  // nào không thì dùng bộ đèn mặc định, dịu hơn hẳn.
  if ('coolSpots' in scene) stylized.enable(scene.coolSpots)
  else stylized.disable()
  applySettings(settings)

  debug?.dispose()
  debug = new DebugPanel(game)
}

function applySettings(next: Settings): void {
  settings = next
  // Chỉ màn có người chơi mới có tuỳ chọn tự ngắm; Đồ Giám thì không
  const scene = activeScene()
  if (scene && 'player' in scene && scene.player) scene.player.autoAim = next.autoAim
  game.renderer.resolutionScale = next.resolutionScale
  game.lighting.shadowsEnabled = next.shadows
  game.composer.enabled = next.postFx
  // Bộ stylized có đèn và chuỗi pass riêng, nên hai dòng trên không chạm tới nó
  // — không nối lại thì hai công tắc này im lặng mất tác dụng khi bộ đang bật
  stylized.shadowsEnabled = next.shadows
  stylized.postFxEnabled = next.postFx
  game.loop.fpsCap = next.fpsCap
  sfx.setVolume(next.sfxVolume)
  saveSettings(storage, next)
}

/** Mô tả bản lưu hiện có, hoặc null nếu chưa có. */
function saveInfo(): string | null {
  const data = loadGame(storage)
  if (!data) return null
  return describeSave(data, realmName({ major: data.cultivation.major, tier: data.cultivation.tier }))
}

const menu = new Menu(uiRoot, settings, {
  continueSave: () => {
    void gotoScene('arena').then(() => {
      const data = loadGame(storage)
      if (data && arena) arena.applySave(data)
      enterPlay()
    })
  },
  newGame: () => {
    clearSave(storage)
    void gotoScene('arena').then(() => {
      arena?.resetProgress()
      enterPlay()
    })
  },
  showcase: () => {
    // KHÔNG xoá bản lưu và không ghi gì. Luyện Kiếm Đài là một màn RIÊNG nên nó
    // vật lý không có đường nào chạm tới tiến độ: nó không cầm `storage`, không
    // có `save()`, và cảnh giới nó đặt cho nhân vật nằm trong một `Player` khác
    // hẳn với `Player` của đấu trường.
    void gotoScene('terrace').then(enterPlay)
  },
  codex: () => {
    void gotoScene('codex').then(enterPlay)
  },
  resume: () => enterPlay(),
  saveAndQuit: () => {
    // Chỉ đấu trường mới có gì để lưu. Hai màn kia không phải một lượt chơi.
    arena?.save(Date.now())
    openMenu('main')
  },
  changeSettings: (patch) => {
    applySettings({ ...settings, ...patch })
    menu.syncSettings(settings)
  },
})

function openMenu(screen: 'main' | 'pause'): void {
  if (screen === 'main') menu.setSaveInfo(saveInfo())
  menu.show(screen)
  game.isPaused = true
}

function enterPlay(): void {
  menu.close()
  game.isPaused = false
  // Mở khoá âm thanh ở đây: đây là lần bấm chuột của người dùng, và trình duyệt
  // chỉ cho dựng AudioContext từ trong một cử chỉ thật
  sfx.unlock()
  canvas.focus()
}

game.bus.on('game:pauseRequest', () => {
  if (menu.isOpen) return
  // Hai màn xem không có gì để "tạm dừng" — Esc là đường ra thẳng về menu chính
  if (currentKey !== 'arena') {
    openMenu('main')
    return
  }
  openMenu('pause')
})

// Đóng menu tạm dừng bằng Esc. Bắt ở đây chứ không trong Input: lúc menu đang
// mở thì màn không chạy fixedUpdate nữa, nên không ai đọc phím giúp được.
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Escape') return
  if (!menu.isOpen) return
  if (menu.current === 'settings') {
    menu.show('pause')
    return
  }
  if (menu.current === 'pause') enterPlay()
})

// Lưu khi rời trang. 'visibilitychange' đáng tin hơn 'beforeunload' trên mobile
// và khi tab bị đóng đột ngột.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && !menu.isOpen && currentKey === 'arena') {
    arena?.save(Date.now())
  }
})

// Số đọc của debug panel phải lấy SAU khi frame đã vẽ xong, nên hook vào
// sự kiện scene:loaded rồi tự chạy theo rAF riêng thay vì chen vào vòng lặp game.
//
// Nhịp 5 lần/giây, không phải mỗi khung: `listen()` của lil-gui ghi thẳng vào DOM,
// nên chạy mỗi khung là 120 lượt cập nhật DOM mỗi giây chỉ để đổi vài con số —
// mà mắt người không đọc nổi số nhảy nhanh hơn thế. Vẫn dùng rAF chứ không
// setInterval để nó tự dừng khi tab bị ẩn.
const DEBUG_POLL_MS = 200
let lastPollMs = 0
let lastFrameMs = 0

function pollDebug(nowMs: number): void {
  // Đồng hồ của Sfx phải nhích theo thời gian THẬT mỗi khung, không theo nhịp
  // 200ms của bảng debug: bộ chặn nhịp âm thanh làm việc ở mức 45ms, nên một
  // đồng hồ chỉ nhảy 5 lần/giây sẽ cho qua đúng một tiếng mỗi 200ms
  if (lastFrameMs > 0) sfx.update(Math.min(0.25, (nowMs - lastFrameMs) / 1000))
  lastFrameMs = nowMs

  if (nowMs - lastPollMs >= DEBUG_POLL_MS) {
    lastPollMs = nowMs
    debug?.update()
  }
  requestAnimationFrame(pollDebug)
}

// Màn mở đầu là đấu trường: menu chính vẫn VẼ thế giới phía sau, và một màn hình
// đen ở đó sẽ che mất thứ duy nhất bán được trò chơi này — chính cái sơn môn.
await gotoScene('arena')

game.start()
requestAnimationFrame(pollDebug)
openMenu('main')

document.getElementById('boot')?.classList.add('hidden')

// Tiện cho việc soi trong console trình duyệt
declare global {
  interface Window {
    __pntt?: {
      game: Game
      menu: Menu
      sfx: Sfx
      stylized: StylizedToggle
      /** Màn đang chạy. Đổi màn thì đọc lại qua getter này, đừng giữ tham chiếu. */
      readonly scene: ArenaScene | SwordTerraceScene | CodexScene | null
      readonly debug: DebugPanel | null
    }
  }
}
window.__pntt = {
  game,
  menu,
  sfx,
  stylized,
  get scene() {
    return activeScene()
  },
  get debug() {
    return debug
  },
}
