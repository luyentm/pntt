/**
 * Danh mục sự kiện toàn game.
 *
 * Dùng `type` chứ không `interface`: chỉ type alias mới có index signature ngầm,
 * nên mới thoả ràng buộc `M extends Record<string, unknown>` của EventBus.
 */
export type GameEvents = {
  'scene:loaded': { name: string }
  'scene:unloaded': { name: string }
  'render:quality': { resolutionScale: number; postFx: boolean; shadows: boolean }
  /** Yêu cầu rung camera — hệ thống gameplay emit, camera nghe. */
  'camera:shake': { magnitude: number; duration?: number }
  'toast': { text: string; kind?: 'info' | 'good' | 'bad' }
}
