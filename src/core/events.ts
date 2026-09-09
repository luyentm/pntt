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

  /** Một đòn đã trúng. VFX và UI nghe sự kiện này, hệ chiến đấu không cần biết chúng tồn tại. */
  'combat:hit': {
    x: number
    y: number
    z: number
    amount: number
    crit: boolean
    elementFactor: number
    realmFactor: number
    targetSide: 'player' | 'ally' | 'enemy'
  }
  'combat:death': { side: 'player' | 'ally' | 'enemy'; x: number; y: number; z: number }
  /** Một đòn vừa được vung ra (dù trúng hay không) — VFX vẽ vệt chém từ đây. */
  'combat:swing': {
    x: number
    y: number
    z: number
    facing: number
    radius: number
    side: 'player' | 'ally' | 'enemy'
  }
  /** Sinh lực người chơi đổi — HUD nghe. */
  'player:vitals': { sinhLuc: number; maxSinhLuc: number; linhLuc: number; maxLinhLuc: number }
}
