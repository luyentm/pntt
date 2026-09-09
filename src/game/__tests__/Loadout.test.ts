import { describe, expect, it } from 'vitest'
import { loadoutFor, nextForSlot, slotKeyLabel, SLOT_COUNT } from '../Loadout'
import { REALM, realmOrdinal, type RealmPosition } from '../data/realms'
import { SKILLS, skillDef } from '../data/skills'

const at = (major: number, tier: number): RealmPosition => ({ major, tier })
const NHAP_MON = at(REALM.LUYEN_KHI, 0)
const LK_DINH = at(REALM.LUYEN_KHI, 12)
const TRUC_CO = at(REALM.TRUC_CO, 2)
const KET_DAN = at(REALM.KET_DAN, 3)
const NGUYEN_ANH = at(REALM.NGUYEN_ANH, 3)

function idsOf(realm: RealmPosition): Array<string | null> {
  return loadoutFor(realm).map((d) => d?.id ?? null)
}

describe('Loadout', () => {
  it('luôn trả về đúng mười ô', () => {
    for (const realm of [NHAP_MON, LK_DINH, TRUC_CO, KET_DAN, NGUYEN_ANH]) {
      expect(loadoutFor(realm)).toHaveLength(SLOT_COUNT)
    }
  })

  it('không bao giờ đặt vào ô một chiêu chưa đủ cảnh giới', () => {
    for (const realm of [NHAP_MON, LK_DINH, TRUC_CO, KET_DAN, NGUYEN_ANH]) {
      for (const def of loadoutFor(realm)) {
        if (!def) continue
        expect(
          realmOrdinal(realm) >= realmOrdinal(def.requiredRealm),
          `${def.name} lọt vào ô ở ${realm.major}/${realm.tier}`,
        ).toBe(true)
      }
    }
  })

  it('mới nhập môn thì chỉ có Ngự Kiếm Thuật', () => {
    const ids = idsOf(NHAP_MON).filter(Boolean)
    expect(ids).toEqual(['nguKiem'])
  })

  it('mọi chiêu đều tới lượt được vào ô ở một cảnh giới nào đó', () => {
    // Một chiêu không bao giờ vào ô là một chiêu người chơi không có đường nào
    // dùng tới trong lượt chơi — nó chỉ còn tồn tại trong Luyện Kiếm Đài
    const ever = new Set<string>()
    for (const realm of [NHAP_MON, LK_DINH, TRUC_CO, KET_DAN, NGUYEN_ANH]) {
      for (const def of loadoutFor(realm)) if (def) ever.add(def.id)
    }
    for (const def of SKILLS) expect(ever.has(def.id), def.name).toBe(true)
  })

  it('★ đột phá KHÔNG làm trượt phím: chiêu mới chiếm đúng ô của chiêu cũ', () => {
    // Đây là lý do `Loadout` tồn tại. Lấy "mười chiêu mới nhất" thì mỗi lần đột
    // phá là mọi phím bấm trượt đi một ô, và người chơi đã quen tay bỗng bấm
    // sai hết — dạng khó chịu mà không ai kịp nhận ra nguyên nhân.
    const lk = idsOf(LK_DINH)
    const na = idsOf(NGUYEN_ANH)

    expect(lk[0]).toBe('nguKiem')
    expect(na[0]).toBe('canhKimKiemKhi')

    expect(lk[1]).toBe('phongDon')
    expect(na[1]).toBe('phongLoiSi')

    expect(lk[2]).toBe('hoaCau')
    expect(na[2]).toBe('tamDiemPhien')

    // Và cặp chiếm chỗ luôn cùng VAI TRÒ: phím 2 mãi mãi là "né", phím 3 mãi
    // mãi là "đốt". Đó mới là thứ giữ được trí nhớ cơ bắp qua bốn cảnh giới.
    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      const before = lk[slot]
      const after = na[slot]
      if (!before || !after || before === after) continue
      expect(skillDef(after).role, `ô ${slot}`).toBe(skillDef(before).role)
    }
  })

  it('cùng ô thì chiêu cảnh giới CAO hơn thắng, không phải chiêu đứng sau', () => {
    const ketDan = idsOf(KET_DAN)
    // Đại Diễn Quyết (Kết Đan) chiếm ô của Giá Y Thần Công (Luyện Khí)
    expect(ketDan).toContain('daiDienQuyet')
    expect(ketDan).not.toContain('giaYThanCong')
  })

  it('nextForSlot cho biết ô này sẽ mở ra chiêu gì, và chỉ chiêu GẦN NHẤT', () => {
    const slot = skillDef('nguKiem').slot
    // Ở Luyện Khí, ô này đã có Ngự Kiếm; chiêu tiếp theo của nó là Canh Kim
    expect(nextForSlot(slot, LK_DINH)?.id).toBe('canhKimKiemKhi')
    // Ở đỉnh thang thì không còn gì để chờ
    expect(nextForSlot(slot, NGUYEN_ANH)).toBeNull()
  })

  it('nhãn phím đọc ra 1…9 rồi 0', () => {
    expect(slotKeyLabel(0)).toBe('1')
    expect(slotKeyLabel(8)).toBe('9')
    expect(slotKeyLabel(9)).toBe('0')
  })
})
