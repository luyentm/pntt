import { isHostile, type Combatant } from './Combatant'
import type { CombatWorld } from './CombatWorld'

/** Tầm tìm mục tiêu mặc định. */
export const AUTO_AIM_RANGE = 11

/**
 * Một radian lệch hướng "đắt" bằng bấy nhiêu world unit khoảng cách.
 *
 * 1.7 nghĩa là: con cách 3 unit ngay trước mặt được chọn thay cho con cách 2
 * unit ở bên sườn (3 + 0 = 3, so với 2 + 1.7×1.57 ≈ 4.7). Đó là điều người chơi
 * mong đợi — họ đang chạy về phía nào thì đánh phía đó.
 */
const ANGLE_WEIGHT = 1.7

/**
 * Điểm cộng cho mục tiêu ĐANG nhắm, tính bằng world unit.
 *
 * Đây là phần quan trọng nhất của cả tệp. Chọn thuần "gần nhất" gây ra đúng cái
 * lỗi ai cũng gặp: đang đánh dở một con thì một con khác nhích lại gần hơn 10cm,
 * đòn tiếp theo quay sang nó, và không con nào chết. Có điểm dính thì mục tiêu
 * chỉ đổi khi con mới RÕ RÀNG hợp lý hơn.
 */
const STICKY_BONUS = 2.4

/**
 * Nhân vào tầm khi xét bỏ mục tiêu.
 *
 * Bỏ mục tiêu ở đúng mép tầm sẽ làm nó nhấp nháy vào/ra khi con quái đi lảng
 * vảng quanh mép — vùng trễ này khiến việc bắt và việc bỏ xảy ra ở hai mép khác
 * nhau.
 */
const DROP_HYSTERESIS = 1.25

/** Góc lệch nhỏ nhất theo đường ngắn nhất, luôn dương. */
function angleGap(a: number, b: number): number {
  let d = a - b
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return Math.abs(d)
}

/**
 * Tự ngắm.
 *
 * Có vì điều khiển bằng chuột đòi người chơi làm ba việc cùng lúc: bấm WASD để
 * đi, kéo chuột phải để xoay camera, và giữ con trỏ đúng trên con quái. Ở góc
 * iso xoay được thì việc thứ ba gần như không làm nổi, và một nhát chém trượt vì
 * lệch mười độ đọc ra là "game không nhận input" chứ không phải "mình ngắm sai".
 *
 * Tách thành lớp riêng chứ không nhét vào Player vì việc CHỌN MỤC TIÊU là một
 * luật có thể sai theo nhiều cách tinh vi (đổi mục tiêu quá nhạy, đổi quá chậm,
 * bỏ mục tiêu ở mép tầm), và ở đây thì kiểm được từng cách một mà không cần
 * đồ hoạ hay input.
 */
export class AutoAim {
  /** Mục tiêu đang nhắm, hoặc null. */
  target: Combatant | null = null

  private readonly buffer: Combatant[] = []

  /**
   * Chọn lại mục tiêu.
   *
   * @param preferDirX hướng ưu tiên (thường là hướng đang đi). Độ dài 0 thì
   *   dùng hướng nhân vật đang nhìn.
   */
  update(
    me: Combatant,
    world: CombatWorld,
    range: number,
    preferDirX: number,
    preferDirZ: number,
  ): Combatant | null {
    const current = this.target
    if (current && (!current.alive || this.distTo(me, current) > range * DROP_HYSTERESIS)) {
      this.target = null
    }

    const preferAngle =
      Math.hypot(preferDirX, preferDirZ) > 1e-4 ? Math.atan2(preferDirX, preferDirZ) : me.facing

    // Truy vấn ở bán kính NGOÀI để mục tiêu đang nhắm còn tìm lại được, nhưng
    // chỉ BẮT mục tiêu mới trong bán kính trong. Đó chính là vùng trễ: bắt và bỏ
    // xảy ra ở hai mép khác nhau.
    //
    // Cần một vòng lặp duy nhất cho cả hai việc — bản đầu tiên của tôi giữ mục
    // tiêu qua bước kiểm tra rồi lại ghi đè bằng kết quả truy vấn ở bán kính
    // trong, nên vùng trễ không có tác dụng gì (test bắt được).
    const count = world.queryCircle(
      me.pos.x,
      me.pos.z,
      range * DROP_HYSTERESIS,
      this.buffer,
      (c) => c.alive && isHostile(me.side, c.side),
    )

    let best: Combatant | null = null
    let bestScore = Infinity
    for (let i = 0; i < count; i++) {
      const c = this.buffer[i] as Combatant
      const dx = c.pos.x - me.pos.x
      const dz = c.pos.z - me.pos.z
      const dist = Math.hypot(dx, dz)
      // Ngoài bán kính trong thì chỉ được GIỮ, không được bắt mới
      if (dist > range && c !== this.target) continue
      // Con đang chồng lên người thì không có hướng để so — cứ tính là thẳng trước
      const gap = dist > 1e-4 ? angleGap(Math.atan2(dx, dz), preferAngle) : 0
      let score = dist + gap * ANGLE_WEIGHT
      if (c === this.target) score -= STICKY_BONUS
      if (score < bestScore) {
        bestScore = score
        best = c
      }
    }

    this.target = best
    return best
  }

  /** Góc từ `me` tới mục tiêu, hoặc null nếu không có mục tiêu / đang chồng nhau. */
  angleTo(me: Combatant): number | null {
    const t = this.target
    if (!t) return null
    const dx = t.pos.x - me.pos.x
    const dz = t.pos.z - me.pos.z
    if (Math.hypot(dx, dz) < 1e-4) return null
    return Math.atan2(dx, dz)
  }

  clear(): void {
    this.target = null
  }

  private distTo(me: Combatant, other: Combatant): number {
    return Math.hypot(other.pos.x - me.pos.x, other.pos.z - me.pos.z)
  }
}
