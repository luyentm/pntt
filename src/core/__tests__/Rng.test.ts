import { describe, expect, it } from 'vitest'
import { Rng } from '../Rng'

describe('Rng', () => {
  it('cùng seed cho cùng dãy số', () => {
    const a = new Rng(12345)
    const b = new Rng(12345)
    for (let i = 0; i < 50; i++) expect(a.next()).toBe(b.next())
  })

  it('seed khác cho dãy khác', () => {
    const a = new Rng(1)
    const b = new Rng(2)
    expect(a.next()).not.toBe(b.next())
  })

  it('next() luôn nằm trong [0, 1)', () => {
    const r = new Rng(777)
    for (let i = 0; i < 20000; i++) {
      const v = r.next()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('lưu và phục hồi được state — đủ cho save game', () => {
    const r = new Rng(999)
    for (let i = 0; i < 10; i++) r.next()
    const saved = r.state
    const expected = [r.next(), r.next(), r.next()]

    const restored = new Rng()
    restored.state = saved
    expect([restored.next(), restored.next(), restored.next()]).toEqual(expected)
  })

  it('int() lấy được cả hai đầu và không bao giờ vượt ra ngoài', () => {
    const r = new Rng(4242)
    let sawMin = false
    let sawMax = false
    for (let i = 0; i < 5000; i++) {
      const v = r.int(3, 7)
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(3)
      expect(v).toBeLessThanOrEqual(7)
      if (v === 3) sawMin = true
      if (v === 7) sawMax = true
    }
    expect(sawMin).toBe(true)
    expect(sawMax).toBe(true)
  })

  it('weighted() tôn trọng trọng số và bỏ qua mục trọng số 0', () => {
    const r = new Rng(31337)
    const counts = { a: 0, b: 0, c: 0 }
    for (let i = 0; i < 30000; i++) {
      counts[r.weighted(['a', 'b', 'c'] as const, [1, 3, 0])]++
    }
    expect(counts.c).toBe(0)
    // b nặng gấp 3 lần a
    expect(counts.b / counts.a).toBeGreaterThan(2.7)
    expect(counts.b / counts.a).toBeLessThan(3.3)
  })

  it('weighted() báo lỗi khi độ dài lệch hoặc tổng trọng số bằng 0', () => {
    const r = new Rng(1)
    expect(() => r.weighted(['a', 'b'], [1])).toThrow(/độ dài/)
    expect(() => r.weighted(['a', 'b'], [0, 0])).toThrow(/tổng trọng số/)
  })

  it('pick() báo lỗi trên mảng rỗng thay vì trả undefined', () => {
    expect(() => new Rng(1).pick([])).toThrow(/rỗng/)
  })

  it('inAnnulus() luôn nằm trong khuyên yêu cầu', () => {
    const r = new Rng(2024)
    for (let i = 0; i < 5000; i++) {
      const p = r.inAnnulus(4, 9)
      const d = Math.hypot(p.x, p.z)
      expect(d).toBeGreaterThanOrEqual(4 - 1e-9)
      expect(d).toBeLessThanOrEqual(9 + 1e-9)
    }
  })

  it('onCircle() trả về vector đơn vị', () => {
    const r = new Rng(5)
    for (let i = 0; i < 1000; i++) {
      const p = r.onCircle()
      expect(Math.hypot(p.x, p.z)).toBeCloseTo(1, 9)
    }
  })

  it('shuffle() giữ nguyên tập phần tử', () => {
    const r = new Rng(88)
    const items = [1, 2, 3, 4, 5, 6, 7, 8]
    const shuffled = r.shuffle([...items])
    expect([...shuffled].sort((a, b) => a - b)).toEqual(items)
  })

  it('fork() cho nhánh độc lập, không làm lệch dòng số của nhánh cha', () => {
    // Đây là tính chất quan trọng: rải decor của một màn không được làm đổi
    // kết quả roll drop vật phẩm hay roll đột phá
    const parent = new Rng(1000)
    parent.fork()
    const afterFork = parent.next()

    const control = new Rng(1000)
    control.next() // fork() tiêu đúng một lần next()
    expect(afterFork).toBe(control.next())
  })
})
