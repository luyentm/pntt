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
    /** Phần bị khiên hấp thụ (đã nằm trong `amount`). */
    absorbed: number
    crit: boolean
    elementFactor: number
    realmFactor: number
    targetSide: 'player' | 'ally' | 'enemy'
    /** Có thì đây là sát thương theo thời gian, không phải một đòn đánh. */
    dot?: 'thieuDot' | 'trungDoc'
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
  /** Một pháp thuật vừa được bấm (bắt đầu dẫn khí). */
  'skill:cast': { id: string; slot: number; side: 'player' | 'ally' | 'enemy' }
  /** Pháp vực phát ra tại một điểm — VFX vẽ vòng sáng ở đây. */
  'skill:area': {
    x: number
    y: number
    z: number
    radius: number
    element: string
    skillId: string
  }
  /** Khiên/buff được dựng lên. */
  'skill:buff': {
    x: number
    y: number
    z: number
    kind: string
    magnitude: number
    duration: number
  }
  /** Cú lướt Phong Độn Thuật. */
  'skill:dash': { x: number; y: number; z: number; facing: number; distance: number }
  /** Thi triển thất bại — UI hiện lý do. */
  'skill:failed': { reason: string }

  /** Sinh lực người chơi đổi — HUD nghe. */
  'player:vitals': { sinhLuc: number; maxSinhLuc: number; linhLuc: number; maxLinhLuc: number }
}
