import { describe, expect, it } from 'vitest'
import { CollisionWorld, type StaticBody } from '../Collision'

describe('CollisionWorld', () => {
  it('không đẩy khi hình tròn nằm ngoài vật cản', () => {
    const w = new CollisionWorld()
    w.addStatic(0, 0, 1)
    const pos = { x: 5, z: 0 }
    expect(w.resolve(pos, 0.3)).toBe(false)
    expect(pos).toEqual({ x: 5, z: 0 })
  })

  it('đẩy ra đúng tới điểm tiếp xúc, không hơn không kém', () => {
    const w = new CollisionWorld()
    w.addStatic(0, 0, 1)
    const pos = { x: 0.5, z: 0 }
    expect(w.resolve(pos, 0.3)).toBe(true)
    // Điểm tiếp xúc = bán kính vật cản + bán kính thể động
    expect(Math.hypot(pos.x, pos.z)).toBeCloseTo(1.3, 6)
    // Đẩy theo đúng pháp tuyến nên không lệch sang trục kia
    expect(pos.z).toBeCloseTo(0, 6)
  })

  it('chọn được một hướng đẩy khi hai tâm trùng nhau', () => {
    const w = new CollisionWorld()
    w.addStatic(0, 0, 1)
    const pos = { x: 0, z: 0 }
    expect(w.resolve(pos, 0.4)).toBe(true)
    // Không suy ra được hướng, nhưng vẫn phải thoát ra hẳn chứ không kẹt ở tâm
    expect(Math.hypot(pos.x, pos.z)).toBeCloseTo(1.4, 6)
  })

  it('kẹt giữa hai vật cản: đẩy thẳng ra theo khe, không zig-zag', () => {
    const w = new CollisionWorld()
    // Hai vật cản chồng lấn nhau (cách 2, mỗi cái bán kính 1) -> khe bị bịt kín,
    // đường thoát duy nhất là theo trục z
    w.addStatic(-1, 0, 1)
    w.addStatic(1, 0, 1)
    const pos = { x: 0, z: 0.1 }
    w.resolve(pos, 0.3)
    // Cộng dồn làm hai lực ngang triệt tiêu -> không bị lệch sang x
    expect(pos.x).toBeCloseTo(0, 6)
    // Và phải tiến ra theo z
    expect(pos.z).toBeGreaterThan(0.1)
  })

  it('kẹt sâu thì thoát hết sau vài frame', () => {
    const w = new CollisionWorld()
    w.addStatic(-1, 0, 1)
    w.addStatic(1, 0, 1)
    const pos = { x: 0, z: 0.1 }
    // resolve() chạy mỗi frame, nên hợp đồng thật là "hội tụ sau vài frame"
    // chứ không phải "thoát hết trong một lần gọi"
    for (let frame = 0; frame < 6; frame++) w.resolve(pos, 0.3)
    expect(Math.hypot(pos.x + 1, pos.z)).toBeGreaterThanOrEqual(1.3 - 1e-4)
    expect(Math.hypot(pos.x - 1, pos.z)).toBeGreaterThanOrEqual(1.3 - 1e-4)
  })

  it('mỗi vòng lặp phải làm giảm độ lún, không được dao động', () => {
    const w = new CollisionWorld()
    w.addStatic(-1, 0, 1)
    w.addStatic(1, 0, 1)
    const pos = { x: 0, z: 0.1 }
    let prev = -Infinity
    for (let frame = 0; frame < 6; frame++) {
      w.resolve(pos, 0.3)
      const clearance = Math.min(
        Math.hypot(pos.x + 1, pos.z),
        Math.hypot(pos.x - 1, pos.z),
      )
      expect(clearance).toBeGreaterThan(prev)
      prev = clearance
    }
  })

  it('tìm được vật cản lớn hơn một ô của spatial hash', () => {
    const w = new CollisionWorld()
    // Bán kính 12 phủ nhiều ô (CELL = 5) -> phải được ghi vào mọi ô nó chạm
    w.addStatic(0, 0, 12)
    const found: StaticBody[] = []
    expect(w.query(11, 0, 0.3, found)).toBe(1)
    expect(w.query(30, 0, 0.3, found)).toBe(0)
  })

  it('không trả về trùng lặp khi vật cản nằm ở nhiều ô', () => {
    const w = new CollisionWorld()
    w.addStatic(0, 0, 9)
    const found: StaticBody[] = []
    // Truy vấn lớn phủ nhiều ô mà vật cản cũng có mặt ở mọi ô đó
    expect(w.query(0, 0, 8, found)).toBe(1)
  })

  it('clear() xoá hết vật cản', () => {
    const w = new CollisionWorld()
    w.addStatic(0, 0, 1)
    expect(w.count).toBe(1)
    w.clear()
    expect(w.count).toBe(0)
    const pos = { x: 0, z: 0 }
    expect(w.resolve(pos, 0.5)).toBe(false)
  })
})
