import { describe, expect, it } from 'vitest'
import { DoubleSide, Mesh } from 'three'
import { FootAuraLayer } from '../FootAura'

function rings(layer: FootAuraLayer): Mesh[] {
  return layer.group.children.filter((c): c is Mesh => (c as Mesh).isMesh === true)
}

function hien(layer: FootAuraLayer): Mesh[] {
  return rings(layer).filter((r) => r.visible)
}

describe('FootAuraLayer', () => {
  it('vẽ CẢ HAI MẶT — thứ tự đỉnh của vòng cho pháp tuyến hướng xuống', () => {
    // Lỗi thật: `FrontSide` cull sạch vòng vì camera nhìn từ trên chỉ thấy mặt
    // sau. Mọi chỉ số (visible, opacity, scale) vẫn đúng và vẫn tốn một draw
    // call, nên không có cách nào phát hiện ngoài việc nhìn vào khung hình.
    const layer = new FootAuraLayer()
    for (const r of rings(layer)) {
      expect((r.material as { side: number }).side).toBe(DoubleSide)
    }
  })

  it('nhấc vòng lên đủ cao để vượt mặt sàn đá (y = 0.056)', () => {
    // Bản đầu nhấc 0.05 — hụt sáu phần nghìn unit — nên vòng bị sàn che trên
    // toàn bộ khu vực người chơi ở nhiều nhất
    const layer = new FootAuraLayer()
    layer.spawn(1, 0, 2)
    const r = hien(layer)[0]!
    expect(r.position.y).toBeGreaterThan(0.056)
    expect(r.position.x).toBe(1)
    expect(r.position.z).toBe(2)
  })

  it('nở ra và mờ dần rồi tự tắt', () => {
    const layer = new FootAuraLayer()
    layer.spawn(0, 0, 0, { from: 0.2, to: 1, life: 0.4, peak: 0.8 })
    const r = hien(layer)[0]!
    const mat = r.material as { opacity: number }
    expect(r.scale.x).toBeCloseTo(0.2, 4)
    expect(mat.opacity).toBeCloseTo(0.8, 4)

    layer.update(0.2)
    const giua = { s: r.scale.x, o: mat.opacity }
    expect(giua.s).toBeGreaterThan(0.2)
    expect(giua.s).toBeLessThan(1)
    expect(giua.o).toBeLessThan(0.8)
    expect(giua.o).toBeGreaterThan(0)

    layer.update(0.15)
    expect(r.scale.x).toBeGreaterThan(giua.s)
    expect(mat.opacity).toBeLessThan(giua.o)

    layer.update(0.1) // tổng 0.45 > life 0.4
    expect(r.visible).toBe(false)
    expect(mat.opacity).toBe(0)
    expect(hien(layer)).toHaveLength(0)
  })

  it('tỉ lệ Y giữ nguyên 1 — vòng phẳng, không được dày lên theo bán kính', () => {
    const layer = new FootAuraLayer()
    layer.spawn(0, 0, 0, { from: 0.2, to: 3, life: 1 })
    const r = hien(layer)[0]!
    layer.update(0.5)
    expect(r.scale.y).toBe(1)
    expect(r.scale.x).toBeCloseTo(r.scale.z, 6)
  })

  it('hết chỗ thì giành lại vòng cũ nhất, không lớn thêm', () => {
    const layer = new FootAuraLayer(3)
    for (let i = 0; i < 10; i++) layer.spawn(i, 0, 0, { life: 5 })
    expect(rings(layer)).toHaveLength(3)
    expect(hien(layer)).toHaveLength(3)
  })
})
