import { Sfx } from '@/audio/Sfx'
import { Game } from '@/core/Game'
import { realmName } from '@/game/data/realms'
import { clearSave, describeSave, loadGame, type SaveStorage } from '@/game/SaveGame'
import { loadSettings, saveSettings, type Settings } from '@/game/Settings'
import { DebugPanel } from '@/debug/DebugPanel'
import { StylizedToggle } from '@/render/stylized'
import { Menu } from '@/ui/Menu'
import { ArenaScene } from '@/world/ArenaScene'

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
const scene = new ArenaScene()
scene.storage = storage

// Nạp màn TRƯỚC khi dựng bảng debug: bảng đọc hook debug của màn lúc khởi tạo,
// nên nếu dựng trước thì nhóm điều khiển chiến đấu sẽ không xuất hiện
await game.setScene(scene)
// Bộ môi trường stylized/fantasy — bật/tắt trong bảng debug để so sánh trực
// tiếp với bộ mặc định trên cùng một cảnh
const stylized = new StylizedToggle(game)
game.stylized = stylized
const debug = new DebugPanel(game)
const sfx = new Sfx(game.bus, settings.sfxVolume)

function applySettings(next: Settings): void {
  settings = next
  scene.player.autoAim = next.autoAim
  game.renderer.resolutionScale = next.resolutionScale
  game.lighting.shadowsEnabled = next.shadows
  game.composer.enabled = next.postFx
  game.loop.fpsCap = next.fpsCap
  sfx.setVolume(next.sfxVolume)
  saveSettings(storage, next)
}
applySettings(settings)

/** Mô tả bản lưu hiện có, hoặc null nếu chưa có. */
function saveInfo(): string | null {
  const data = loadGame(storage)
  if (!data) return null
  return describeSave(data, realmName({ major: data.cultivation.major, tier: data.cultivation.tier }))
}

const menu = new Menu(uiRoot, settings, {
  continueSave: () => {
    scene.exitDemo()
    const data = loadGame(storage)
    if (data) scene.applySave(data)
    enterPlay()
  },
  newGame: () => {
    clearSave(storage)
    scene.exitDemo()
    scene.resetProgress()
    enterPlay()
  },
  showcase: () => {
    // KHÔNG xoá bản lưu và không ghi gì: chế độ này chỉ để xem, nên nó không
    // được phép chạm vào tiến độ của người chơi
    scene.enterDemo()
    enterPlay()
  },
  resume: () => enterPlay(),
  saveAndQuit: () => {
    // Ở chế độ trình diễn thì KHÔNG lưu: nó không phải một lượt chơi, và ghi
    // cảnh giới Kết Đan của chế độ xem vào bản lưu sẽ xoá sạch tiến độ thật
    if (scene.demoMode) scene.exitDemo()
    else scene.save(Date.now())
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
  // Chế độ trình diễn không có gì để "tạm dừng" — Esc là đường ra
  if (scene.demoMode) {
    scene.exitDemo()
    openMenu('main')
    return
  }
  openMenu('pause')
})

// Đóng menu tạm dừng bằng Esc. Bắt ở đây chứ không trong Input: lúc menu đang
// mở thì màn không chạy fixedUpdate nữa, nên không ai đọc phím giúp được.
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Escape' || !menu.isOpen) return
  if (menu.current === 'settings') {
    menu.show('pause')
    return
  }
  if (menu.current === 'pause') enterPlay()
})

// Lưu khi rời trang. 'visibilitychange' đáng tin hơn 'beforeunload' trên mobile
// và khi tab bị đóng đột ngột.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && !menu.isOpen && !scene.demoMode) {
    scene.save(Date.now())
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
    debug.update()
  }
  requestAnimationFrame(pollDebug)
}

game.start()
requestAnimationFrame(pollDebug)
openMenu('main')

document.getElementById('boot')?.classList.add('hidden')

// Tiện cho việc soi trong console trình duyệt
declare global {
  interface Window {
    __pntt?: {
      game: Game
      debug: DebugPanel
      scene: ArenaScene
      menu: Menu
      sfx: Sfx
      stylized: StylizedToggle
    }
  }
}
window.__pntt = { game, debug, scene, menu, sfx, stylized }
