import { Game } from '@/core/Game'
import { DebugPanel } from '@/debug/DebugPanel'
import { ArenaScene } from '@/world/ArenaScene'

const canvas = document.getElementById('game-canvas')
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('Không tìm thấy #game-canvas')
}

const game = new Game(canvas)

// Nạp màn TRƯỚC khi dựng bảng debug: bảng đọc hook debug của màn lúc khởi tạo,
// nên nếu dựng trước thì nhóm điều khiển chiến đấu sẽ không xuất hiện
await game.setScene(new ArenaScene())
const debug = new DebugPanel(game)

// Số đọc của debug panel phải lấy SAU khi frame đã vẽ xong, nên hook vào
// sự kiện scene:loaded rồi tự chạy theo rAF riêng thay vì chen vào vòng lặp game.
//
// Nhịp 5 lần/giây, không phải mỗi khung: `listen()` của lil-gui ghi thẳng vào DOM,
// nên chạy mỗi khung là 120 lượt cập nhật DOM mỗi giây chỉ để đổi vài con số —
// mà mắt người không đọc nổi số nhảy nhanh hơn thế. Vẫn dùng rAF chứ không
// setInterval để nó tự dừng khi tab bị ẩn.
const DEBUG_POLL_MS = 200
let lastPollMs = 0

function pollDebug(nowMs: number): void {
  if (nowMs - lastPollMs >= DEBUG_POLL_MS) {
    lastPollMs = nowMs
    debug.update()
  }
  requestAnimationFrame(pollDebug)
}

game.start()
requestAnimationFrame(pollDebug)

document.getElementById('boot')?.classList.add('hidden')

// Tiện cho việc soi trong console trình duyệt
declare global {
  interface Window {
    __pntt?: { game: Game; debug: DebugPanel }
  }
}
window.__pntt = { game, debug }
