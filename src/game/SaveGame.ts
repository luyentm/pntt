import { Cultivation } from './Cultivation'
import { Inventory } from './Inventory'

/** Chỗ lưu. Trừu tượng ra để test được mà không cần trình duyệt. */
export interface SaveStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export const SAVE_KEY = 'pntt:save'
/** Tăng số này mỗi khi hình dạng dữ liệu lưu đổi, và thêm một bước ở `migrate`. */
export const SAVE_VERSION = 2

export interface SaveData {
  version: number
  /** Mốc thời gian lưu, ms. Chỉ để hiển thị, không dùng trong mô phỏng. */
  savedAt: number
  cultivation: ReturnType<Cultivation['toJSON']>
  inventory: Record<string, number>
  wave: { index: number; cleared: number; deaths: number }
  /** Tổng thời gian đã chơi, giây. */
  playTime: number
}

/**
 * Lưu và nạp tiến độ.
 *
 * Nguyên tắc bao trùm: **một bản lưu hỏng không bao giờ được làm sập game.**
 * Mọi đường đọc đều trả về `null` khi có gì không đúng, và người chơi chỉ mất
 * tiến độ — chứ không mở game ra thấy màn hình trắng và không còn cách nào vào
 * lại. Đó cũng là lý do mọi thứ ở đây đều kiểm tra kiểu lúc chạy thay vì tin
 * vào `as SaveData`: dữ liệu trong localStorage là dữ liệu NGOÀI, có thể do một
 * phiên bản khác ghi, do người chơi sửa tay, hoặc bị cắt giữa lúc ghi.
 */
export function saveGame(storage: SaveStorage, data: Omit<SaveData, 'version' | 'savedAt'>, now: number): boolean {
  try {
    const full: SaveData = { ...data, version: SAVE_VERSION, savedAt: now }
    storage.setItem(SAVE_KEY, JSON.stringify(full))
    return true
  } catch {
    // Hết dung lượng hoặc localStorage bị chặn (chế độ riêng tư của một số
    // trình duyệt). Không lưu được thì chơi tiếp, không phải dừng game.
    return false
  }
}

export function loadGame(storage: SaveStorage): SaveData | null {
  let raw: string | null
  try {
    raw = storage.getItem(SAVE_KEY)
  } catch {
    return null
  }
  if (!raw) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  return migrate(parsed)
}

export function hasSave(storage: SaveStorage): boolean {
  return loadGame(storage) !== null
}

export function clearSave(storage: SaveStorage): void {
  try {
    storage.removeItem(SAVE_KEY)
  } catch {
    // Không xoá được thì cũng không có gì để làm thêm
  }
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

/**
 * Đưa dữ liệu thô về hình dạng hiện tại.
 *
 * Bản lưu của phiên bản MỚI HƠN thì từ chối chứ không đoán: đoán ra một trạng
 * thái nửa vời còn tệ hơn là bắt đầu lại, vì người chơi sẽ tưởng save của mình
 * còn nguyên rồi mới phát hiện mất đồ.
 */
export function migrate(raw: unknown): SaveData | null {
  if (typeof raw !== 'object' || raw === null) return null
  const o = raw as Record<string, unknown>

  const version = num(o.version, 0)
  if (version <= 0 || version > SAVE_VERSION) return null

  const cul = o.cultivation
  if (typeof cul !== 'object' || cul === null) return null
  const c = cul as Record<string, unknown>

  // Bản 1 chưa có `wave` (M8 thêm chế độ thủ trận vào save) — thiếu thì coi như
  // chưa đánh đợt nào, chứ không làm cả bản lưu thành vô giá trị
  const waveRaw = o.wave
  const w = typeof waveRaw === 'object' && waveRaw !== null ? (waveRaw as Record<string, unknown>) : {}

  const inv = o.inventory
  const inventory: Record<string, number> = {}
  if (typeof inv === 'object' && inv !== null) {
    for (const [id, count] of Object.entries(inv as Record<string, unknown>)) {
      const n = num(count, 0)
      if (n > 0) inventory[id] = Math.floor(n)
    }
  }

  return {
    version: SAVE_VERSION,
    savedAt: num(o.savedAt, 0),
    cultivation: {
      major: Math.max(0, Math.floor(num(c.major, 1))),
      tier: Math.max(0, Math.floor(num(c.tier, 0))),
      tuVi: Math.max(0, num(c.tuVi, 0)),
      failStreak: Math.max(0, Math.floor(num(c.failStreak, 0))),
      linhNhu: Math.max(0, num(c.linhNhu, 0)),
      totalTuVi: Math.max(0, num(c.totalTuVi, 0)),
    },
    inventory,
    wave: {
      index: Math.max(0, Math.floor(num(w.index, 0))),
      cleared: Math.max(0, Math.floor(num(w.cleared, 0))),
      deaths: Math.max(0, Math.floor(num(w.deaths, 0))),
    },
    playTime: Math.max(0, num(o.playTime, 0)),
  }
}

/** Dựng lại đối tượng chơi được từ dữ liệu đã nạp. */
export function restore(data: SaveData): { cultivation: Cultivation; inventory: Inventory } {
  return {
    cultivation: Cultivation.fromJSON(data.cultivation),
    inventory: Inventory.fromJSON(data.inventory),
  }
}

/** Mô tả ngắn một bản lưu, để hiện ở menu chính. */
export function describeSave(data: SaveData, realmName: string): string {
  const minutes = Math.floor(data.playTime / 60)
  const waves = data.wave.cleared
  const parts = [realmName]
  if (waves > 0) parts.push(`${waves} đợt`)
  parts.push(minutes < 1 ? 'chưa tới một phút' : `${minutes} phút`)
  return parts.join(' · ')
}
