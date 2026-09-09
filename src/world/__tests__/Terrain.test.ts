import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { Rng } from '@/core/Rng'
import { Terrain } from '../Terrain'

function makeTerrain(): Terrain {
  return new Terrain(new Rng(20260909), { size: 120, segments: 24, amplitude: 6 })
}

/** Diện tích có dấu của tam giác 2D — dùng cho toạ độ barycentric. */
function area2(ax: number, az: number, bx: number, bz: number, cx: number, cz: number): number {
  return (bx - ax) * (cz - az) - (bz - az) * (cx - ax)
}

/**
 * Tìm tam giác của mesh chứa (x, z) rồi trả về cao độ nội suy trên tam giác đó.
 * Đây là "sự thật" — cao độ của mặt mà GPU thực sự vẽ ra.
 */
function heightFromMesh(terrain: Terrain, x: number, z: number): number | null {
  const pos = terrain.mesh.geometry.getAttribute('position')
  for (let i = 0; i < pos.count; i += 3) {
    const ax = pos.getX(i)
    const az = pos.getZ(i)
    const bx = pos.getX(i + 1)
    const bz = pos.getZ(i + 1)
    const cx = pos.getX(i + 2)
    const cz = pos.getZ(i + 2)

    const total = area2(ax, az, bx, bz, cx, cz)
    if (Math.abs(total) < 1e-12) continue

    const wa = area2(x, z, bx, bz, cx, cz) / total
    const wb = area2(ax, az, x, z, cx, cz) / total
    const wc = area2(ax, az, bx, bz, x, z) / total
    const eps = -1e-9
    if (wa < eps || wb < eps || wc < eps) continue

    return wa * pos.getY(i) + wb * pos.getY(i + 1) + wc * pos.getY(i + 2)
  }
  return null
}

describe('Terrain', () => {
  const terrain = makeTerrain()

  it('vùng giữa phẳng tuyệt đối trên MỌI điểm, không chỉ ở tâm', () => {
    // Kiểm tra dày trong cả vùng phẳng: biên vùng phẳng không trùng lưới nên
    // nếu không neo theo lưới thì các ô vắt qua biên sẽ nghiêng lấn vào trong
    const rng = new Rng(1234)
    for (let i = 0; i < 500; i++) {
      const p = rng.inAnnulus(0, 12)
      expect(terrain.heightAt(p.x, p.z)).toBe(0)
    }
  })

  it('heightAt() trả về CHÍNH XÁC cao độ của mặt được vẽ', () => {
    // Đây là tính chất quan trọng nhất của Terrain: nếu lệch thì bàn chân nhân
    // vật sẽ lún xuống đất hoặc lơ lửng, mà lệch vài cm thì rất khó nhìn ra
    const rng = new Rng(4242)
    let checked = 0
    for (let i = 0; i < 400; i++) {
      const x = rng.float(-55, 55)
      const z = rng.float(-55, 55)
      const truth = heightFromMesh(terrain, x, z)
      if (truth === null) continue
      expect(terrain.heightAt(x, z)).toBeCloseTo(truth, 6)
      checked++
    }
    // Bảo đảm phép kiểm tra thật sự có chạy, không phải continue hết
    expect(checked).toBeGreaterThan(350)
  })

  it('khớp đúng cao độ tại các đỉnh lưới', () => {
    const cell = terrain.cell
    const half = terrain.size / 2
    for (let k = 4; k < 20; k += 3) {
      const x = -half + k * cell
      const z = -half + (k + 2) * cell
      const truth = heightFromMesh(terrain, x + 1e-4, z + 1e-4)
      expect(terrain.heightAt(x + 1e-4, z + 1e-4)).toBeCloseTo(truth as number, 6)
    }
  })

  it('liên tục qua ranh giới ô — không có bậc', () => {
    const cell = terrain.cell
    const half = terrain.size / 2
    for (let k = 5; k < 20; k++) {
      const x = -half + k * cell
      const a = terrain.heightAt(x - 1e-4, 20)
      const b = terrain.heightAt(x + 1e-4, 20)
      expect(Math.abs(a - b)).toBeLessThan(1e-3)
    }
  })

  it('pháp tuyến hướng lên ở chỗ phẳng', () => {
    const n = terrain.normalAt(0, 0, new Vector3())
    expect(n.y).toBeCloseTo(1, 5)
  })

  it('vùng giữa luôn đi được, ngoài biên bản đồ thì không', () => {
    expect(terrain.isWalkable(0, 0)).toBe(true)
    expect(terrain.isWalkable(5, 5)).toBe(true)
    expect(terrain.isWalkable(80, 0)).toBe(false)
    expect(terrain.isWalkable(0, -80)).toBe(false)
  })

  it('cùng seed cho cùng địa hình', () => {
    const a = makeTerrain()
    const b = makeTerrain()
    const rng = new Rng(7)
    for (let i = 0; i < 200; i++) {
      const x = rng.float(-58, 58)
      const z = rng.float(-58, 58)
      expect(a.heightAt(x, z)).toBe(b.heightAt(x, z))
    }
  })

  it('địa hình thực sự có gợn ở vòng ngoài', () => {
    let min = Infinity
    let max = -Infinity
    const rng = new Rng(11)
    for (let i = 0; i < 500; i++) {
      const p = rng.inAnnulus(40, 58)
      const h = terrain.heightAt(p.x, p.z)
      min = Math.min(min, h)
      max = Math.max(max, h)
    }
    expect(max - min).toBeGreaterThan(3)
  })
})
