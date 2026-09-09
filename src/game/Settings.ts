import type { SaveStorage } from './SaveGame'

export const SETTINGS_KEY = 'pntt:settings'

export interface Settings {
  /** Tỉ lệ phân giải render, 0.5..1. */
  resolutionScale: number
  shadows: boolean
  postFx: boolean
  /** 0 = không khoá (vẽ theo tần số màn hình). */
  fpsCap: number
  /** Âm lượng hiệu ứng, 0..1. */
  sfxVolume: number
}

export const DEFAULT_SETTINGS: Settings = {
  resolutionScale: 1,
  shadows: true,
  postFx: true,
  // Xem `Loop.fpsCap`: 60 là mặc định có chủ ý, không phải "chưa cấu hình"
  fpsCap: 60,
  sfxVolume: 0.6,
}

/** Các mức fps được chọn trong bảng cài đặt. */
export const FPS_CAP_CHOICES: readonly number[] = [30, 60, 120, 0]

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

/**
 * Cài đặt hình ảnh và âm thanh.
 *
 * Tách khỏi `SaveGame` có chủ ý: cài đặt phải sống sót qua cả việc "bắt đầu
 * lượt mới". Nhét chung vào bản lưu thì mỗi lần chơi lại từ đầu, người chơi lại
 * phải tắt đổ bóng và hạ phân giải một lần nữa — mà đó thường chính là lý do họ
 * đổi cài đặt ngay từ đầu.
 *
 * Mọi giá trị đọc vào đều bị KẸP LẠI, không chỉ kiểm kiểu: một
 * `resolutionScale: 40` trong localStorage (do sửa tay hoặc do phiên bản cũ) sẽ
 * cấp phát một framebuffer khổng lồ và treo máy trước khi kịp hiện gì.
 */
export function loadSettings(storage: SaveStorage): Settings {
  let raw: string | null
  try {
    raw = storage.getItem(SETTINGS_KEY)
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
  if (!raw) return { ...DEFAULT_SETTINGS }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
  if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULT_SETTINGS }
  const o = parsed as Record<string, unknown>

  const cap = Math.floor(num(o.fpsCap, DEFAULT_SETTINGS.fpsCap))
  return {
    resolutionScale: clamp(num(o.resolutionScale, DEFAULT_SETTINGS.resolutionScale), 0.5, 1),
    shadows: bool(o.shadows, DEFAULT_SETTINGS.shadows),
    postFx: bool(o.postFx, DEFAULT_SETTINGS.postFx),
    fpsCap: FPS_CAP_CHOICES.includes(cap) ? cap : DEFAULT_SETTINGS.fpsCap,
    sfxVolume: clamp(num(o.sfxVolume, DEFAULT_SETTINGS.sfxVolume), 0, 1),
  }
}

export function saveSettings(storage: SaveStorage, settings: Settings): void {
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Không lưu được cài đặt thì phiên này vẫn dùng được, chỉ là lần sau mất
  }
}
