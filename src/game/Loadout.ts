import { realmOrdinal, type RealmPosition } from './data/realms'
import { SKILLS, type SkillDef } from './data/skills'

/** Số ô trên thanh pháp thuật. Phím `1`…`9` rồi `0`. */
export const SLOT_COUNT = 10

/**
 * Ô nào giữ chiêu nào, tính theo cảnh giới hiện tại.
 *
 * Bảng pháp thuật có 17 chiêu mà thanh chỉ có 10 ô, nên phải chọn. Cách chọn ở
 * đây KHÔNG phải "lấy mười chiêu mới nhất": làm vậy thì mỗi lần đột phá là mọi
 * phím bấm trượt đi một ô, và người chơi đã quen tay bỗng bấm sai hết — dạng
 * khó chịu mà không ai kịp nhận ra nguyên nhân.
 *
 * Thay vào đó mỗi chiêu tự khai một Ô CỐ ĐỊNH trong `SkillDef.slot`, và nhiều
 * chiêu được phép dùng chung một ô. Đột phá thì chiêu cảnh giới cao hơn CHIẾM
 * CHỖ chiêu cũ trên đúng phím đó — mà cặp chiếm chỗ luôn là hai thứ cùng vai:
 *
 *   phím 1  Ngự Kiếm Thuật   → Canh Kim Kiếm Khí     (đòn bắn thẳng)
 *   phím 2  Phong Độn Thuật  → Phong Lôi Sí          (thân pháp)
 *   phím 3  Hoả Cầu Thuật    → Tam Diễm Phiến        (hệ Hoả)
 *   phím 5  Thiên Lôi Phù    → Thái Ất Thanh Sơn     (đòn nặng đặt tại con trỏ)
 *   phím 6  Băng Phong Phù   → Thiên Nhất Chân Thuỷ  (đóng băng)
 *   phím 7  Giá Y Thần Công  → Đại Diễn Quyết        (tự bùng sức mạnh)
 *   phím 9  Ngũ Hành Trận Kỳ → Nguyên Từ Thần Quang  (khống chế cả vùng)
 *
 * Nên một người chơi đi hết Luyện Khí tới Nguyên Anh vẫn giữ nguyên trí nhớ cơ
 * bắp: phím 3 luôn là "đốt", phím 2 luôn là "né". Chỉ có thứ ra khỏi tay là đổi.
 */
export function loadoutFor(realm: RealmPosition): ReadonlyArray<SkillDef | null> {
  const slots: Array<SkillDef | null> = new Array(SLOT_COUNT).fill(null)
  const rank: number[] = new Array(SLOT_COUNT).fill(-1)
  const here = realmOrdinal(realm)

  for (const def of SKILLS) {
    const need = realmOrdinal(def.requiredRealm)
    if (need > here) continue
    const i = def.slot
    // Cùng ô thì chiêu YÊU CẦU CẢNH GIỚI CAO HƠN thắng, không phải chiêu đứng
    // sau trong mảng: thứ tự mảng là chuyện trình bày, có thể đổi bất cứ lúc nào
    if (need <= (rank[i] as number)) continue
    rank[i] = need
    slots[i] = def
  }
  return slots
}

/**
 * Chiêu CHƯA MỞ mà sẽ chiếm ô này ở cảnh giới kế tiếp, nếu có.
 *
 * Thanh pháp thuật hiện nó dạng mờ kèm cảnh giới cần thiết. Ẩn đi thì phần
 * thưởng của việc tu luyện thành một điều ngạc nhiên mà không ai chờ đợi — mà
 * người chơi phải THẤY TRƯỚC mình sẽ được gì thì mới có lý do đột phá.
 */
export function nextForSlot(slot: number, realm: RealmPosition): SkillDef | null {
  const here = realmOrdinal(realm)
  let best: SkillDef | null = null
  for (const def of SKILLS) {
    if (def.slot !== slot) continue
    const need = realmOrdinal(def.requiredRealm)
    if (need <= here) continue
    if (!best || need < realmOrdinal(best.requiredRealm)) best = def
  }
  return best
}

/** Ký tự phím của một ô: `1`…`9` rồi `0`. */
export function slotKeyLabel(slot: number): string {
  return String((slot + 1) % 10)
}
