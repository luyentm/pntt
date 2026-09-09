import { InstancedMesh } from 'three'
import { describe, expect, it } from 'vitest'
import { Rng } from '@/core/Rng'
import { ParticleLayer } from '../Particles'

/**
 * Lấy InstancedMesh của một dáng hạt THEO TÊN, không theo chỉ số.
 *
 * Theo chỉ số thì việc thêm một dáng mới vào giữa `SHAPES` sẽ làm test trỏ sang
 * mesh khác và báo sai — đúng chuyện đã xảy ra khi thêm dáng `haze`.
 */
function batchMesh(layer: ParticleLayer, shape = 'shard'): InstancedMesh {
  const mesh = layer.group.children.find((m) => m.name === `vfx:particles:${shape}`)
  if (!(mesh instanceof InstancedMesh)) throw new Error(`không thấy mesh cho dáng "${shape}"`)
  return mesh
}

const dt = 1 / 60

/** Tỉ lệ trung bình của các hạt khói đang sống, đọc từ ma trận instance. */
function smokeScale(layer: ParticleLayer): number {
  const mesh = batchMesh(layer, 'smoke')
  const a = mesh.instanceMatrix.array
  let sum = 0
  let n = 0
  for (let i = 0; i < mesh.count; i++) {
    if ((a[i * 16 + 13] as number) < -100) continue
    // Cột đầu của ma trận là trục X đã nhân tỉ lệ
    sum += Math.abs(a[i * 16] as number)
    n++
  }
  return n > 0 ? sum / n : 0
}

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

  describe('khói — dáng duy nhất phá quy tắc lowpoly', () => {
    it('có hạn mức RIÊNG và rất chặt, không dùng chung với hạt khối đặc', () => {
      // Khói trong suốt nên không ghi depth: N lớp chồng nhau là N lần fill.
      // Đo được: cùng 768 hạt, chỉ đổi sang cộng sáng là đắt gấp 2,05 lần. Hạn
      // mức là "ngân sách phủ màn hình", nên nó phải không thể bị vượt.
      const layer = new ParticleLayer(256)
      layer.emit(0, 0, 0, new Rng(1), { count: 500, shape: 'smoke', life: [9, 9] })
      const smoke = layer.activeCount
      expect(smoke).toBeLessThanOrEqual(48)

      // Và phát đầy khói KHÔNG được lấn chỗ của hạt khối đặc
      layer.emit(0, 0, 0, new Rng(2), { count: 100, shape: 'shard', life: [9, 9] })
      expect(layer.activeCount).toBe(smoke + 100)
    })

    it('khói PHÌNH RA theo thời gian, không thu nhỏ', () => {
      // Khói thật loang ra khi nguội; thu nhỏ đọc ra là hút vào, ngược hẳn
      const layer = new ParticleLayer(64)
      layer.emit(0, 0, 0, new Rng(3), {
        count: 6,
        shape: 'smoke',
        life: [1, 1],
        size: [1, 1],
        speed: [0, 0],
        gravity: 0,
      })
      const early = smokeScale(layer)
      for (let i = 0; i < Math.round(0.45 / dt); i++) layer.update(dt)
      expect(smokeScale(layer)).toBeGreaterThan(early)
    })


    it('haze và smoke là HAI hồ riêng, mỗi cái một hạn mức', () => {
      // Cộng sáng không thể làm ra khói (nó chỉ thêm sáng), và alpha tối không
      // làm được quầng lửa. Một vụ nổ thật có cả hai, nên phải là hai hồ.
      const layer = new ParticleLayer(256)
      layer.emit(0, 0, 0, new Rng(1), { count: 200, shape: 'haze', life: [9, 9] })
      const haze = layer.activeCount
      layer.emit(0, 0, 0, new Rng(2), { count: 200, shape: 'smoke', life: [9, 9] })
      const total = layer.activeCount
      expect(haze).toBeLessThanOrEqual(32)
      expect(total - haze).toBeLessThanOrEqual(24)
      // Tổng ngân sách phủ màn hình phải chặt
      expect(total).toBeLessThanOrEqual(56)
    })

    it('không có camera thì vẫn chạy được, không nổ', () => {
      // Test không có camera, và một lớp hiệu ứng không được đòi đồ hoạ mới chạy
      const layer = new ParticleLayer(64)
      layer.emit(0, 0, 0, new Rng(4), { count: 8, shape: 'smoke' })
      expect(() => layer.update(dt)).not.toThrow()
    })
  })
})
