import { describe, expect, it } from 'vitest'
import { ARENA_FLAT_RADIUS, ARENA_ROLL_RADIUS, arenaGroundHeight } from '../groundHeight'

describe('arenaGroundHeight', () => {
  it('phẳng tuyệt đối trong vùng giữa', () => {
    expect(arenaGroundHeight(0, 0)).toBe(0)
    expect(arenaGroundHeight(5, -7)).toBe(0)
    // Ngay tại mép vùng phẳng vẫn phải bằng 0
    expect(arenaGroundHeight(ARENA_FLAT_RADIUS, 0)).toBe(0)
  })

  it('liên tục khi ra khỏi vùng phẳng', () => {
    // Không được có bậc: nhân vật đi qua mép sẽ giật nếu đứt đoạn
    const inside = arenaGroundHeight(ARENA_FLAT_RADIUS - 0.01, 0)
    const outside = arenaGroundHeight(ARENA_FLAT_RADIUS + 0.01, 0)
    expect(Math.abs(outside - inside)).toBeLessThan(0.02)
  })

  it('gợn hết biên độ ở ngoài vùng chuyển', () => {
    let maxAbs = 0
    for (let x = -80; x <= 80; x += 3.3) {
      for (let z = -80; z <= 80; z += 3.3) {
        if (Math.hypot(x, z) < ARENA_ROLL_RADIUS) continue
        maxAbs = Math.max(maxAbs, Math.abs(arenaGroundHeight(x, z)))
      }
    }
    // Tổng biên độ ba hàm sin là 4.2 + 1.5 + 0.5 = 6.2
    expect(maxAbs).toBeGreaterThan(2)
    expect(maxAbs).toBeLessThanOrEqual(6.2)
  })

  it('cho cùng kết quả với cùng đầu vào (xác định)', () => {
    expect(arenaGroundHeight(37.5, -21.25)).toBe(arenaGroundHeight(37.5, -21.25))
  })
})
