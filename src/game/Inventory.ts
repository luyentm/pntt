import { itemDef, type ItemDef } from './data/items'

export interface Stack {
  id: string
  count: number
}

/**
 * Túi đồ.
 *
 * Lưu theo tổng số lượng của từng loại chứ không theo từng ô: giới hạn `stack`
 * chỉ dùng để HIỂN THỊ (chia thành mấy ô), không dùng để giới hạn cất. Túi đầy
 * làm mất vật phẩm rơi ra là một cơ chế gây bực mà không thêm gì cho trò chơi
 * này — người chơi tới đây để tu tiên, không phải để quản lý ô túi.
 */
export class Inventory {
  private readonly counts = new Map<string, number>()

  get entries(): Stack[] {
    return [...this.counts.entries()]
      .filter(([, count]) => count > 0)
      .map(([id, count]) => ({ id, count }))
  }

  /** Số loại vật phẩm khác nhau đang có. */
  get size(): number {
    let n = 0
    for (const c of this.counts.values()) if (c > 0) n++
    return n
  }

  count(id: string): number {
    return this.counts.get(id) ?? 0
  }

  has(id: string, amount = 1): boolean {
    return this.count(id) >= amount
  }

  add(id: string, amount = 1): void {
    if (amount <= 0) return
    // Kiểm tra id có thật, nếu không thì lỗi chính tả sẽ âm thầm tạo ra vật
    // phẩm ma mà chẳng bao giờ dùng được
    itemDef(id)
    this.counts.set(id, this.count(id) + amount)
  }

  /** Trả về true nếu trừ được đủ. Không đủ thì KHÔNG trừ gì cả. */
  remove(id: string, amount = 1): boolean {
    if (amount <= 0) return true
    const current = this.count(id)
    if (current < amount) return false
    this.counts.set(id, current - amount)
    return true
  }

  /**
   * Trừ nhiều loại cùng lúc, theo nguyên tắc TẤT CẢ HOẶC KHÔNG GÌ.
   * Cần cho luyện đan: thiếu một nguyên liệu thì không được ăn mất các nguyên
   * liệu khác.
   */
  removeAll(needs: readonly Stack[]): boolean {
    for (const need of needs) {
      if (!this.has(need.id, need.count)) return false
    }
    for (const need of needs) this.remove(need.id, need.count)
    return true
  }

  /** Danh sách vật phẩm theo nhóm, đã sắp theo bậc phẩm giảm dần. */
  byKind(kind: ItemDef['kind']): Stack[] {
    return this.entries
      .filter((s) => itemDef(s.id).kind === kind)
      .sort((a, b) => itemDef(b.id).tier - itemDef(a.id).tier)
  }

  clear(): void {
    this.counts.clear()
  }

  /** Dạng lưu vào save game. */
  toJSON(): Record<string, number> {
    const out: Record<string, number> = {}
    for (const [id, count] of this.counts) if (count > 0) out[id] = count
    return out
  }

  static fromJSON(data: Record<string, number>): Inventory {
    const inv = new Inventory()
    for (const [id, count] of Object.entries(data)) {
      // Bỏ qua id không còn tồn tại thay vì làm hỏng cả save: bảng vật phẩm
      // sẽ đổi giữa các phiên bản, save cũ vẫn phải nạp được
      if (ITEM_EXISTS(id)) inv.counts.set(id, count)
    }
    return inv
  }
}

function ITEM_EXISTS(id: string): boolean {
  try {
    itemDef(id)
    return true
  } catch {
    return false
  }
}
