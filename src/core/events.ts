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
  /**
   * Một pháp thuật vừa được bấm (bắt đầu dẫn khí).
   *
   * Có cả vị trí, ngũ hành và thời gian dẫn khí để VFX dựng được đoạn TỤ KHÍ —
   * hạt bay vào tâm trong lúc đang niệm. Không có nó thì mọi pháp thuật đều bật
   * ra đột ngột từ không khí và mất hết sức nặng.
   */
  'skill:cast': {
    id: string
    slot: number
    side: 'player' | 'ally' | 'enemy'
    x: number
    y: number
    z: number
    element: string
    castTime: number
  }
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

  /** Lên một hoặc nhiều tầng nhỏ. */
  'cultivation:tierUp': { realmName: string; tiers: number; x: number; y: number; z: number }
  /** Đột phá đại cảnh giới xong. */
  'cultivation:breakthrough': {
    success: boolean
    realmName: string
    chance: number
    x: number
    y: number
    z: number
  }
  /** Nhặt được vật phẩm. */
  'item:pickup': { id: string; count: number }

  /** Vệt gió của Ngự Kiếm Phi Hành — VFX vẽ, hệ di chuyển không biết VFX tồn tại. */
  'flight:trail': { x: number; y: number; z: number; facing: number }
  /** Bay lên / hạ xuống. */
  'flight:toggle': { active: boolean }

  /** Người chơi bấm Esc mà không có bảng nào đang mở — main mở menu tạm dừng. */
  'game:pauseRequest': Record<string, never>
  /** Vừa lưu (hoặc lưu thất bại). */
  'game:saved': { ok: boolean }

  /** Sinh lực người chơi đổi — HUD nghe. */
  'player:vitals': { sinhLuc: number; maxSinhLuc: number; linhLuc: number; maxLinhLuc: number }
}
