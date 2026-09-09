/**
 * Va chạm cho ARPG mặt đất: mọi thứ là hình TRÒN trên mặt phẳng XZ.
 *
 * Không dùng physics engine vì bài toán không cần: nhân vật và quái đều đi trên
 * đất, không có vật thể chồng đống hay khớp nối. Đổi lại được ba thứ đáng giá —
 * nhẹ hơn ~1 MB wasm, không cần khởi tạo async, và hoàn toàn xác định nên
 * viết test được cho công thức đẩy.
 */

export interface StaticBody {
  readonly id: number
  x: number
  z: number
  radius: number
}

/** Kích thước ô của spatial hash. */
const CELL = 5
/** Dịch chỉ số ô sang dương để gộp được thành một khoá số nguyên. */
const KEY_OFFSET = 4096
const KEY_STRIDE = 8192

function cellKey(cx: number, cz: number): number {
  return (cx + KEY_OFFSET) * KEY_STRIDE + (cz + KEY_OFFSET)
}

export class CollisionWorld {
  private readonly cells = new Map<number, StaticBody[]>()
  private readonly bodies: StaticBody[] = []
  /** Dấu thời điểm cho từng body để lọc trùng khi một body nằm ở nhiều ô. */
  private stamps: Int32Array = new Int32Array(0)
  private queryId = 0

  get count(): number {
    return this.bodies.length
  }

  addStatic(x: number, z: number, radius: number): StaticBody {
    const body: StaticBody = { id: this.bodies.length, x, z, radius }
    this.bodies.push(body)

    // Ghi vào MỌI ô mà hình tròn phủ tới, nhờ vậy truy vấn chỉ cần xét các ô
    // bao quanh nó — đúng với cả tảng đá lớn hơn một ô
    const minX = Math.floor((x - radius) / CELL)
    const maxX = Math.floor((x + radius) / CELL)
    const minZ = Math.floor((z - radius) / CELL)
    const maxZ = Math.floor((z + radius) / CELL)
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cz = minZ; cz <= maxZ; cz++) {
        const key = cellKey(cx, cz)
        let list = this.cells.get(key)
        if (!list) {
          list = []
          this.cells.set(key, list)
        }
        list.push(body)
      }
    }

    if (this.stamps.length < this.bodies.length) {
      const grown = new Int32Array(Math.max(64, this.bodies.length * 2))
      grown.set(this.stamps)
      this.stamps = grown
    }
    return body
  }

  /** Tìm các vật cản tĩnh giao với hình tròn. Ghi vào `out`, trả về số lượng. */
  query(x: number, z: number, radius: number, out: StaticBody[]): number {
    const stamp = ++this.queryId
    let n = 0

    const minX = Math.floor((x - radius) / CELL)
    const maxX = Math.floor((x + radius) / CELL)
    const minZ = Math.floor((z - radius) / CELL)
    const maxZ = Math.floor((z + radius) / CELL)

    for (let cx = minX; cx <= maxX; cx++) {
      for (let cz = minZ; cz <= maxZ; cz++) {
        const list = this.cells.get(cellKey(cx, cz))
        if (!list) continue
        for (const body of list) {
          if (this.stamps[body.id] === stamp) continue
          this.stamps[body.id] = stamp
          const dx = body.x - x
          const dz = body.z - z
          const reach = body.radius + radius
          if (dx * dx + dz * dz <= reach * reach) out[n++] = body
        }
      }
    }
    return n
  }

  /**
   * Đẩy hình tròn ra khỏi các vật cản. Trả về true nếu có hiệu chỉnh.
   *
   * Cộng DỒN các hiệu chỉnh rồi áp một lần mỗi vòng (Jacobi), không đẩy tuần tự
   * từng vật cản (Gauss-Seidel). Lý do: khi kẹt giữa hai vật cản đối diện, đẩy
   * tuần tự sẽ nhảy qua nhảy lại — ra khỏi cái này thì lún vào cái kia — nên hội
   * tụ rất chậm và đường đi zig-zag. Cộng dồn thì hai lực ngang triệt tiêu nhau
   * và thể động được đẩy thẳng ra theo khe, đơn điệu và nhanh hơn nhiều.
   *
   * KHÔNG bảo đảm thoát hết trong một lần gọi ở các trường hợp kẹt sâu (hai vật
   * cản chồng lấn nhau). Điều đó chấp nhận được vì resolve() chạy mỗi frame nên
   * phần lún còn lại được đẩy tiếp ở frame sau. Cách phòng thật sự là đừng sinh
   * ra vật cản chồng lấn khi dựng màn (xem ArenaScene.tryPlace).
   */
  resolve(pos: { x: number; z: number }, radius: number): boolean {
    const found: StaticBody[] = []
    let moved = false

    for (let iter = 0; iter < 4; iter++) {
      const n = this.query(pos.x, pos.z, radius, found)
      if (n === 0) break

      let sumX = 0
      let sumZ = 0
      let hits = 0

      for (let i = 0; i < n; i++) {
        const body = found[i] as StaticBody
        let dx = pos.x - body.x
        let dz = pos.z - body.z
        const reach = body.radius + radius
        let dist = Math.hypot(dx, dz)

        if (dist >= reach) continue

        if (dist < 1e-5) {
          // Trùng tâm hoàn toàn: không suy ra được hướng đẩy, chọn một hướng cố định
          dx = 1
          dz = 0
          dist = 1
        }
        const push = reach - dist
        sumX += (dx / dist) * push
        sumZ += (dz / dist) * push
        hits++
      }

      if (hits === 0) break
      pos.x += sumX
      pos.z += sumZ
      moved = true
    }
    return moved
  }

  clear(): void {
    this.cells.clear()
    this.bodies.length = 0
    this.queryId = 0
  }
}
