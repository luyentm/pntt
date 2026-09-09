import { describe, expect, it } from 'vitest'
import { REALM, realmOrdinal, type RealmPosition } from '../data/realms'
import { SKILLS, skillDamage, skillDef, soKiemTruc } from '../data/skills'
import { SLOT_COUNT } from '../Loadout'
import { SWORD_CAPACITY } from '@/world/SwordStorm'

describe('bảng pháp thuật', () => {
  it('id không trùng nhau', () => {
    const ids = new Set(SKILLS.map((s) => s.id))
    expect(ids.size).toBe(SKILLS.length)
  })

  it('mọi chiêu đều nằm trong mười ô hợp lệ', () => {
    for (const def of SKILLS) {
      expect(def.slot, def.name).toBeGreaterThanOrEqual(0)
      expect(def.slot, def.name).toBeLessThan(SLOT_COUNT)
    }
  })

  it('không có hai chiêu CÙNG ô và CÙNG cảnh giới', () => {
    // Đây là điều kiện để `loadoutFor` xác định: cùng ô thì chiêu cảnh giới cao
    // hơn thắng, mà bằng nhau thì kết quả phụ thuộc thứ tự mảng — tức đảo hai
    // dòng trong bảng là đổi phím bấm của người chơi, im lặng.
    const seen = new Map<string, string>()
    for (const def of SKILLS) {
      const key = `${def.slot}:${realmOrdinal(def.requiredRealm)}`
      const other = seen.get(key)
      expect(other, `${def.name} đụng ô với ${other}`).toBeUndefined()
      seen.set(key, def.name)
    }
  })

  it('mọi chiêu đều khai pháp bảo và xuất xứ', () => {
    // Thẻ giới thiệu ở Luyện Kiếm Đài đọc thẳng hai trường này; để rỗng thì thẻ
    // có một ô trống mà không có gì báo
    for (const def of SKILLS) {
      expect(def.phapBao.ten.length, def.name).toBeGreaterThan(0)
      expect(def.phapBao.note.length, def.name).toBeGreaterThan(10)
      expect(def.nguonGoc.length, def.name).toBeGreaterThan(10)
      expect(def.hanTu.length, def.name).toBeGreaterThan(1)
    }
  })

  it('bốn đại cảnh giới đều có chiêu', () => {
    const majors = new Set(SKILLS.map((s) => s.requiredRealm.major))
    for (const m of [REALM.LUYEN_KHI, REALM.TRUC_CO, REALM.KET_DAN, REALM.NGUYEN_ANH]) {
      expect(majors.has(m), String(m)).toBe(true)
    }
  })
})

describe('số liệu sát thương suy từ action', () => {
  it('chiêu hỗ trợ và thân pháp báo không sát thương', () => {
    for (const id of ['kimQuangThuan', 'giaYThanCong', 'daiDienQuyet', 'phongDon', 'phongLoiSi']) {
      expect(skillDamage(skillDef(id)).bac, id).toBe('khong')
    }
  })

  it('trận pháp không gây một điểm sát thương nào', () => {
    // Trong nguyên tác trận pháp luôn để GIỮ NGƯỜI. Cho nó sát thương thì nó
    // thành một Thiên Lôi Phù to hơn và mất hẳn bản sắc.
    const d = skillDamage(skillDef('nguHanhTranKy'))
    expect(d.tong).toBe(0)
    expect(d.bac).toBe('khong')
  })

  it('loạt bắn nhân số đòn lên, không chỉ đếm một viên', () => {
    const def = skillDef('canhKimKiemKhi')
    if (def.action.type !== 'phiHanh' || !def.action.volley) throw new Error('sai loại chiêu')
    const d = skillDamage(def)
    expect(d.soDon).toBe(def.action.volley.count)
    expect(d.tong).toBeCloseTo(def.action.spec.mult * def.action.volley.count, 5)
  })

  it('pháp vực nhiều nhịp cộng đủ cả ba nhịp', () => {
    const def = skillDef('tamDiemPhien')
    if (def.action.type !== 'phapVuc') throw new Error('sai loại chiêu')
    const d = skillDamage(def)
    expect(d.soDon).toBe(3)
    expect(d.tong).toBeGreaterThan(def.action.mult * 3)
  })

  it('sát thương theo thời gian được quy về hệ số công, không bỏ qua', () => {
    // Thực Kim Trùng đòn đầu gần như không thấy gì — nếu bảng chỉ đọc đòn đầu
    // thì nó bị xếp cùng bậc với một chiêu vô hại, đúng ngược với sự thật
    const d = skillDamage(skillDef('thucKimTrung'))
    expect(d.theoThoiGian).toBeGreaterThan(d.moiDon)
    expect(d.bac).not.toBe('khong')
  })

  it('đàn kiếm trừ đoạn tụ kiếm ra khỏi số nhịp quét', () => {
    // Gần một giây đầu đàn kiếm quay sát người và KHÔNG chém ai; tính cả đoạn
    // đó thì con số trên thẻ cao hơn thứ mục tiêu thật sự phải chịu
    const def = skillDef('thanhTrucPhongVan')
    if (def.action.type !== 'kiemVu') throw new Error('sai loại chiêu')
    const d = skillDamage(def)
    expect(d.soDon).toBeLessThan(def.action.duration / def.action.hitInterval)
    expect(d.soDon).toBeGreaterThan(8)
  })

  it('Thái Ất Thanh Sơn là đòn nặng nhất trong bảng', () => {
    const top = [...SKILLS].sort((a, b) => skillDamage(b).tong - skillDamage(a).tong)[0]
    expect(top?.id).toBe('thaiAtThanhSon')
    expect(skillDamage(skillDef('thaiAtThanhSon')).bac).toBe('huyDiet')
  })

  it('bậc sát thương tăng dần theo cảnh giới ở chiêu công kích', () => {
    // Không phải một quy tắc trang trí: nếu một chiêu Nguyên Anh yếu hơn chiêu
    // Luyện Khí thì cả cái thang cảnh giới không còn nghĩa gì
    const best = (major: number): number =>
      Math.max(
        0,
        ...SKILLS.filter((s) => s.requiredRealm.major === major && s.role === 'congKich').map(
          (s) => skillDamage(s).tong,
        ),
      )
    expect(best(REALM.TRUC_CO)).toBeGreaterThan(0)
    expect(best(REALM.KET_DAN)).toBeGreaterThan(best(REALM.TRUC_CO))
    expect(best(REALM.NGUYEN_ANH)).toBeGreaterThan(best(REALM.KET_DAN))
  })
})

describe('số kiếm trúc theo cảnh giới', () => {
  const at = (major: number, tier: number): RealmPosition => ({ major, tier })

  it('hai mốc nguyên tác nói thẳng: 24 ở Kết Đan hậu kỳ, 72 ở Nguyên Anh', () => {
    expect(soKiemTruc(at(REALM.KET_DAN, 2))).toBe(24)
    expect(soKiemTruc(at(REALM.NGUYEN_ANH, 0))).toBe(72)
  })

  it('tăng đơn điệu và không bao giờ vượt bộ đủ', () => {
    let prev = 0
    for (const pos of [
      at(REALM.KET_DAN, 0),
      at(REALM.KET_DAN, 1),
      at(REALM.KET_DAN, 2),
      at(REALM.KET_DAN, 3),
      at(REALM.NGUYEN_ANH, 0),
      at(REALM.NGUYEN_ANH, 3),
    ]) {
      const n = soKiemTruc(pos)
      expect(n).toBeGreaterThanOrEqual(prev)
      expect(n).toBeLessThanOrEqual(SWORD_CAPACITY)
      prev = n
    }
  })

  it('mọi mốc đều chia hết cho ba — đội hình là ba vòng đồng tâm', () => {
    for (let tier = 0; tier < 4; tier++) {
      expect(soKiemTruc(at(REALM.KET_DAN, tier)) % 3).toBe(0)
      expect(soKiemTruc(at(REALM.NGUYEN_ANH, tier)) % 3).toBe(0)
    }
  })
})
