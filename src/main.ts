import { Game } from '@/core/Game'
import { DebugPanel } from '@/debug/DebugPanel'
import { ArenaScene } from '@/world/ArenaScene'

const canvas = document.getElementById('game-canvas')
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('Không tìm thấy #game-canvas')
}

const game = new Game(canvas)
const debug = new DebugPanel(game)

// Số đọc của debug panel phải lấy SAU khi frame đã vẽ xong, nên hook vào
// sự kiện scene:loaded rồi tự chạy theo rAF riêng thay vì chen vào vòng lặp game
function pollDebug(): void {
  debug.update()
  requestAnimationFrame(pollDebug)
}

await game.setScene(new ArenaScene())
game.start()
pollDebug()

document.getElementById('boot')?.classList.add('hidden')

// Tiện cho việc soi trong console trình duyệt
declare global {
  interface Window {
    __pntt?: { game: Game; debug: DebugPanel }
  }
}
window.__pntt = { game, debug }
