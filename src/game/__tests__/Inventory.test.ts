import { describe, expect, it } from 'vitest'
import { Inventory } from '../Inventory'

describe('Inventory', () => {
  it('cộng và đếm', () => {
    const inv = new Inventory()
    inv.add('hoiKhiDan', 3)
    inv.add('hoiKhiDan', 2)
    expect(inv.count('hoiKhiDan')).toBe(5)
  })

  it('BÁO LỖI với id không tồn tại thay vì âm thầm tạo vật phẩm ma', () => {
    const inv = new Inventory()
    expect(() => inv.add('khongCoThat', 1)).toThrow()
  })

  it('trừ được khi đủ', () => {
    const inv = new Inventory()
    inv.add('hoiKhiDan', 5)
    expect(inv.remove('hoiKhiDan', 3)).toBe(true)
    expect(inv.count('hoiKhiDan')).toBe(2)
  })

  it('KHÔNG trừ gì khi không đủ', () => {
    const inv = new Inventory()
    inv.add('hoiKhiDan', 2)
    expect(inv.remove('hoiKhiDan', 5)).toBe(false)
    expect(inv.count('hoiKhiDan')).toBe(2)
  })

  it('removeAll theo nguyên tắc TẤT CẢ HOẶC KHÔNG GÌ', () => {
    // Luyện đan thiếu một nguyên liệu thì không được ăn mất các nguyên liệu khác
    const inv = new Inventory()
    inv.add('thanhNguyenThao', 3)
    inv.add('huyetLinhChi', 1)

    const ok = inv.removeAll([
      { id: 'thanhNguyenThao', count: 2 },
      { id: 'huyetLinhChi', count: 5 },
    ])
    expect(ok).toBe(false)
    expect(inv.count('thanhNguyenThao')).toBe(3)
    expect(inv.count('huyetLinhChi')).toBe(1)
  })

  it('removeAll trừ hết khi đủ cả', () => {
    const inv = new Inventory()
    inv.add('thanhNguyenThao', 3)
    inv.add('huyetLinhChi', 2)
    expect(
      inv.removeAll([
        { id: 'thanhNguyenThao', count: 2 },
        { id: 'huyetLinhChi', count: 1 },
      ]),
    ).toBe(true)
    expect(inv.count('thanhNguyenThao')).toBe(1)
    expect(inv.count('huyetLinhChi')).toBe(1)
  })

  it('byKind lọc đúng nhóm và sắp theo bậc phẩm giảm dần', () => {
    const inv = new Inventory()
    inv.add('thanhNguyenThao', 1) // linh thảo bậc 1
    inv.add('camLinhCan', 1) // linh thảo bậc 4
    inv.add('hoiKhiDan', 1) // đan dược
    const herbs = inv.byKind('linhThao')
    expect(herbs.map((s) => s.id)).toEqual(['camLinhCan', 'thanhNguyenThao'])
  })

  it('không liệt kê mục đã về 0', () => {
    const inv = new Inventory()
    inv.add('hoiKhiDan', 1)
    inv.remove('hoiKhiDan', 1)
    expect(inv.entries).toHaveLength(0)
    expect(inv.size).toBe(0)
  })

  it('lưu/nạp giữ nguyên nội dung', () => {
    const inv = new Inventory()
    inv.add('hoiKhiDan', 4)
    inv.add('linhThachHa', 250)
    const restored = Inventory.fromJSON(inv.toJSON())
    expect(restored.count('hoiKhiDan')).toBe(4)
    expect(restored.count('linhThachHa')).toBe(250)
  })

  it('nạp save cũ có id không còn tồn tại thì BỎ QUA, không làm hỏng cả save', () => {
    // Bảng vật phẩm sẽ đổi giữa các phiên bản, save cũ vẫn phải nạp được
    const restored = Inventory.fromJSON({ hoiKhiDan: 2, vatPhamDaBoDi: 7 })
    expect(restored.count('hoiKhiDan')).toBe(2)
    expect(restored.count('vatPhamDaBoDi')).toBe(0)
  })
})
