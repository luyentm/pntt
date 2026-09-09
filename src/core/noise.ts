import type { Rng } from './Rng'

/**
 * Perlin noise 2D có seed.
 *
 * Dùng gradient noise (Perlin) chứ không value noise: value noise để lại các vệt
 * thẳng theo trục x/z rất dễ nhận ra trên địa hình, còn gradient noise thì không.
 */
export class Noise2D {
  private readonly perm = new Uint8Array(512)
  private readonly gradX = new Float32Array(256)
  private readonly gradZ = new Float32Array(256)

  constructor(rng: Rng) {
    const p = new Uint8Array(256)
    for (let i = 0; i < 256; i++) p[i] = i
    // Trộn bằng RNG có seed -> cùng seed cho cùng địa hình, tái lập được
    for (let i = 255; i > 0; i--) {
      const j = rng.int(0, i)
      const tmp = p[i] as number
      p[i] = p[j] as number
      p[j] = tmp
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255] as number

    for (let i = 0; i < 256; i++) {
      const a = rng.next() * Math.PI * 2
      this.gradX[i] = Math.cos(a)
      this.gradZ[i] = Math.sin(a)
    }
  }

  /** Kết quả trong khoảng [-1, 1]. */
  noise(x: number, z: number): number {
    const xi = Math.floor(x)
    const zi = Math.floor(z)
    const xf = x - xi
    const zf = z - zi

    // Smootherstep (6t^5-15t^4+10t^3): đạo hàm cấp hai liên tục nên địa hình
    // không có nếp gấp ở ranh giới ô của lưới noise
    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10)
    const v = zf * zf * zf * (zf * (zf * 6 - 15) + 10)

    const x0 = xi & 255
    const z0 = zi & 255
    const x1 = (x0 + 1) & 255
    const z1 = (z0 + 1) & 255

    const dot = (gx: number, gz: number, dx: number, dz: number): number =>
      (this.gradX[gx] as number) * dx + (this.gradZ[gz] as number) * dz

    const h00 = (this.perm[(this.perm[x0] as number) + z0] as number) & 255
    const h10 = (this.perm[(this.perm[x1] as number) + z0] as number) & 255
    const h01 = (this.perm[(this.perm[x0] as number) + z1] as number) & 255
    const h11 = (this.perm[(this.perm[x1] as number) + z1] as number) & 255

    const n00 = dot(h00, h00, xf, zf)
    const n10 = dot(h10, h10, xf - 1, zf)
    const n01 = dot(h01, h01, xf, zf - 1)
    const n11 = dot(h11, h11, xf - 1, zf - 1)

    const a = n00 + u * (n10 - n00)
    const b = n01 + u * (n11 - n01)
    return a + v * (b - a)
  }

  /** Tổng nhiều tầng noise — cho địa hình có cả đồi lớn và gợn nhỏ. */
  fbm(x: number, z: number, octaves = 4, lacunarity = 2.05, gain = 0.5): number {
    let sum = 0
    let amp = 1
    let freq = 1
    let norm = 0
    for (let i = 0; i < octaves; i++) {
      sum += this.noise(x * freq, z * freq) * amp
      norm += amp
      amp *= gain
      freq *= lacunarity
    }
    return norm > 0 ? sum / norm : 0
  }
}
