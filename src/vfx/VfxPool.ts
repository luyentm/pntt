/**
 * Hồ đối tượng cho hiệu ứng.
 *
 * VFX là thứ sinh/huỷ nhiều nhất trong một game hành động — mỗi đòn đánh là vài
 * mesh. Cấp phát mới mỗi lần sẽ làm GC chạy giữa lúc combat và gây giật rất dễ
 * thấy. Hồ cấp phát sẵn toàn bộ một lần rồi tái sử dụng: không sinh rác lúc chơi.
 *
 * Khi hồ cạn thì GIÀNH LẠI phần tử cũ nhất thay vì lớn thêm — hiệu ứng lâu nhất
 * bị cắt sớm còn tốt hơn là tụt fps hoặc sinh rác đúng lúc đông quái nhất.
 */
export interface Poolable {
  active: boolean
  age: number
  life: number
}

export class VfxPool<T extends Poolable> {
  private readonly items: T[] = []

  constructor(capacity: number, factory: (index: number) => T) {
    for (let i = 0; i < capacity; i++) this.items.push(factory(i))
  }

  get all(): readonly T[] {
    return this.items
  }

  get activeCount(): number {
    let n = 0
    for (const it of this.items) if (it.active) n++
    return n
  }

  /** Lấy một phần tử rảnh, hoặc giành lại phần tử đã chạy lâu nhất. */
  acquire(): T {
    for (const it of this.items) {
      if (!it.active) {
        it.active = true
        it.age = 0
        return it
      }
    }
    let oldest = this.items[0] as T
    for (const it of this.items) {
      if (it.age / Math.max(it.life, 1e-4) > oldest.age / Math.max(oldest.life, 1e-4)) oldest = it
    }
    oldest.age = 0
    oldest.active = true
    return oldest
  }

  /** Tăng tuổi và tắt phần tử hết hạn. `onUpdate` nhận tiến độ 0..1. */
  update(dt: number, onUpdate: (item: T, progress: number) => void, onRetire: (item: T) => void): void {
    for (const it of this.items) {
      if (!it.active) continue
      it.age += dt
      if (it.age >= it.life) {
        it.active = false
        onRetire(it)
        continue
      }
      onUpdate(it, it.age / it.life)
    }
  }

  releaseAll(onRetire: (item: T) => void): void {
    for (const it of this.items) {
      if (!it.active) continue
      it.active = false
      onRetire(it)
    }
  }
}
