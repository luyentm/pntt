import { InstancedMesh } from 'three'
import { describe, expect, it } from 'vitest'
import { Rng } from '@/core/Rng'
import { ParticleLayer } from '../Particles'

/** Lấy InstancedMesh của một dáng hạt. Kiểu hoá đúng thay vì cast bừa. */
function batchMesh(layer: ParticleLayer, index = 0): InstancedMesh {
  const mesh = layer.group.children[index]
  if (!(mesh instanceof InstancedMesh)) throw new Error('không phải InstancedMesh')
  return mesh
}

const dt = 1 / 60

/** Bán kính trung bình của các hạt đang sống, đọc từ ma trận instance. */
function radiusOf(layer: ParticleLayer): number {
  const mesh = batchMesh(layer)
  const a = mesh.instanceMatrix.array
  let sum = 0
  let n = 0
  for (let i = 0; i < mesh.count; i++) {
    const x = a[i * 16 + 12] as number
    const y = a[i * 16 + 13] as number
    const z = a[i * 16 + 14] as number
    if (y < -100) continue // ô đã tắt bị đẩy xuống -999
    sum += Math.hypot(x, z)
    n++
  }
  return n > 0 ? sum / n : 0
}

describe('ParticleLayer', () => {
  it('phát ra đúng số hạt đã yêu cầu', () => {
    const layer = new ParticleLayer(64)
    layer.emit(0, 0, 0, new Rng(1), { count: 12 })
    expect(layer.activeCount).toBe(12)
  })

  it('mỗi dáng có hồ RIÊNG — phát dáng này không lấn chỗ dáng kia', () => {
    const layer = new ParticleLayer(8)
    layer.emit(0, 0, 0, new Rng(1), { count: 8, shape: 'shard' })
    layer.emit(0, 0, 0, new Rng(2), { count: 8, shape: 'spark' })
    layer.emit(0, 0, 0, new Rng(3), { count: 8, shape: 'mote' })
    expect(layer.activeCount).toBe(24)
  })

  it('hạt tự tắt khi hết đời', () => {
    const layer = new ParticleLayer(32)
    layer.emit(0, 0, 0, new Rng(1), { count: 10, life: [0.2, 0.25] })
    expect(layer.activeCount).toBe(10)
    for (let i = 0; i < Math.round(0.4 / dt); i++) layer.update(dt)
    expect(layer.activeCount).toBe(0)
  })

  it('cạn hồ thì GIÀNH LẠI ô cũ, không phình thêm và không nổ', () => {
    // Hồ cạn giữa lúc đông quái nhất là chuyện sẽ xảy ra thật. Cắt sớm một hiệu
    // ứng còn tốt hơn tụt fps hoặc sinh rác.
    const layer = new ParticleLayer(10)
    for (let i = 0; i < 5; i++) layer.emit(0, 0, 0, new Rng(i), { count: 10 })
    expect(layer.activeCount).toBeLessThanOrEqual(10)
    expect(() => layer.update(dt)).not.toThrow()
  })

  it('cùng seed cho cùng kết quả — hạt cũng phải xác định', () => {
    // Cả game được thiết kế quanh Rng có seed; một lời gọi Math.random() lẻ
    // trong lớp hạt là đủ phá vỡ tính chất đó
    function run(seed: number): number[] {
      const layer = new ParticleLayer(32)
      layer.emit(0, 0, 0, new Rng(seed), { count: 6, pattern: 'sphere' })
      for (let i = 0; i < 10; i++) layer.update(dt)
      return Array.from(batchMesh(layer).instanceMatrix.array).slice(0, 48)
    }
    expect(run(7)).toEqual(run(7))
    expect(run(7)).not.toEqual(run(8))
  })

  describe('dáng phát', () => {
    it('implode sinh hạt ở VÒNG NGOÀI rồi bay vào tâm', () => {
      // Đây là dáng tụ khí — nếu hạt bay ra thì hiệu ứng nói ngược hẳn ý nghĩa
      const layer = new ParticleLayer(32)
      layer.emit(0, 0, 0, new Rng(5), {
        count: 8,
        pattern: 'implode',
        radius: 3,
        speed: [3, 3],
        gravity: 0,
        life: [2, 2],
      })
      const first = radiusOf(layer)
      for (let i = 0; i < 20; i++) layer.update(dt)
      const later = radiusOf(layer)
      expect(first).toBeGreaterThan(1.5)
      expect(later).toBeLessThan(first)
    })

    it('ring sinh hạt trên vòng rồi bay RA ngoài', () => {
      const layer = new ParticleLayer(32)
      layer.emit(0, 0, 0, new Rng(5), {
        count: 8,
        pattern: 'ring',
        radius: 2,
        speed: [3, 3],
        gravity: 0,
        life: [2, 2],
      })
      const first = radiusOf(layer)
      for (let i = 0; i < 20; i++) layer.update(dt)
      expect(radiusOf(layer)).toBeGreaterThan(first)
    })
  })

  it('clear tắt sạch', () => {
    const layer = new ParticleLayer(32)
    layer.emit(0, 0, 0, new Rng(1), { count: 20, life: [5, 5] })
    layer.clear()
    expect(layer.activeCount).toBe(0)
  })
})
