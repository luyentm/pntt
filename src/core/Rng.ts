/**
 * mulberry32 — PRNG có seed, 32-bit, nhanh và chất lượng đủ tốt cho game.
 * Có seed để: drop vật phẩm / rải decor / roll đột phá đều tái lập được -> test được,
 * và save game chỉ cần lưu lại `state`.
 */
export class Rng {
  private s: number

  constructor(seed = 0x9e3779b9) {
    this.s = (seed >>> 0) || 1
  }

  get state(): number {
    return this.s
  }

  set state(value: number) {
    this.s = (value >>> 0) || 1
  }

  /** [0, 1) */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0
    let t = this.s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** [min, max) */
  float(min: number, max: number): number {
    return min + this.next() * (max - min)
  }

  /** [min, max] — cả hai đầu đều lấy được */
  int(min: number, max: number): number {
    return Math.floor(this.float(min, max + 1))
  }

  /** true với xác suất p (0..1) */
  chance(p: number): boolean {
    return this.next() < p
  }

  /** [-spread, spread] */
  spread(spread: number): number {
    return this.float(-spread, spread)
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick: mảng rỗng')
    return items[this.int(0, items.length - 1)] as T
  }

  /** Chọn theo trọng số. `weights` phải cùng độ dài với `items` và tổng > 0. */
  weighted<T>(items: readonly T[], weights: readonly number[]): T {
    if (items.length === 0 || items.length !== weights.length) {
      throw new Error('Rng.weighted: độ dài items và weights phải khớp và > 0')
    }
    let total = 0
    for (const w of weights) total += Math.max(0, w)
    if (total <= 0) throw new Error('Rng.weighted: tổng trọng số phải > 0')
    let roll = this.next() * total
    for (let i = 0; i < items.length; i++) {
      roll -= Math.max(0, weights[i] as number)
      if (roll <= 0) return items[i] as T
    }
    return items[items.length - 1] as T
  }

  /** Fisher-Yates, đảo tại chỗ. */
  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = this.int(0, i)
      const tmp = items[i] as T
      items[i] = items[j] as T
      items[j] = tmp
    }
    return items
  }

  /** Điểm ngẫu nhiên trên vòng tròn đơn vị, mặt phẳng XZ. */
  onCircle(): { x: number; z: number } {
    const a = this.next() * Math.PI * 2
    return { x: Math.cos(a), z: Math.sin(a) }
  }

  /** Điểm ngẫu nhiên trong hình khuyên [rMin, rMax] trên mặt phẳng XZ (phân bố đều theo diện tích). */
  inAnnulus(rMin: number, rMax: number): { x: number; z: number } {
    const r = Math.sqrt(this.float(rMin * rMin, rMax * rMax))
    const dir = this.onCircle()
    return { x: dir.x * r, z: dir.z * r }
  }

  /** Nhánh RNG độc lập — để mỗi hệ thống có dòng số riêng, không ảnh hưởng nhau. */
  fork(): Rng {
    return new Rng(Math.floor(this.next() * 0xffffffff))
  }
}
