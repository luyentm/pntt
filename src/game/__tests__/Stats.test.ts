import { describe, expect, it } from 'vitest'
import { Rng } from '@/core/Rng'
import {
  REALM,
  realmGapFactor,
  realmName,
  realmPower,
  tierCount,
  type RealmPosition,
} from '../data/realms'
import {
  ELEMENT_ADVANTAGE,
  ELEMENT_DISADVANTAGE,
  MIN_DAMAGE,
  computeDamage,
  deriveStats,
  elementFactor,
  type BaseStats,
} from '../Stats'

const base: BaseStats = {
  sinhLuc: 100,
  linhLuc: 50,
  cong: 10,
  phong: 5,
  thanThuc: 8,
  toc: 4.3,
  bao: 0,
  baoMult: 1.8,
  element: 'vo',
}

/** RNG luôn trả về 0 -> chance(p) đúng khi p > 0, dùng để buộc bạo kích. */
function alwaysRng(): Rng {
  const r = new Rng(1)
  r.next = () => 0
  return r
}

/** RNG luôn trả về gần 1 -> không bao giờ bạo kích. */
function neverRng(): Rng {
  const r = new Rng(1)
  r.next = () => 0.999999
  return r
}

describe('thang cảnh giới', () => {
  it('Luyện Khí có 13 tầng, Trúc Cơ 3, Kết Đan 4', () => {
    expect(tierCount(REALM.LUYEN_KHI)).toBe(13)
    expect(tierCount(REALM.TRUC_CO)).toBe(3)
    expect(tierCount(REALM.KET_DAN)).toBe(4)
  })

  it('tên cảnh giới đọc được', () => {
    expect(realmName({ major: REALM.LUYEN_KHI, tier: 6 })).toBe('Luyện Khí kỳ tầng 7')
    expect(realmName({ major: REALM.TRUC_CO, tier: 0 })).toBe('Trúc Cơ kỳ sơ kỳ')
    expect(realmName({ major: REALM.KET_DAN, tier: 3 })).toBe('Kết Đan kỳ đại thành')
  })

  it('sức mạnh tăng đơn điệu qua mọi tầng của mọi cảnh giới', () => {
    let prev = -Infinity
    for (let major = 0; major <= REALM.KET_DAN; major++) {
      for (let tier = 0; tier < tierCount(major); tier++) {
        const power = realmPower({ major, tier })
        expect(power).toBeGreaterThan(prev)
        prev = power
      }
    }
  })

  it('kẹp chỉ số ngoài phạm vi thay vì trả undefined', () => {
    expect(() => realmName({ major: 99, tier: 99 })).not.toThrow()
    expect(() => realmName({ major: -5, tier: -5 })).not.toThrow()
    expect(realmPower({ major: 99, tier: 99 })).toBeGreaterThan(0)
  })
})

describe('luật chênh lệch cảnh giới', () => {
  it('cùng cảnh giới thì không đổi gì', () => {
    expect(realmGapFactor(REALM.LUYEN_KHI, REALM.LUYEN_KHI)).toBe(1)
  })

  it('đánh lên một đại cảnh giới bị giảm rất nặng', () => {
    const f = realmGapFactor(REALM.LUYEN_KHI, REALM.TRUC_CO)
    expect(f).toBeLessThan(0.3)
    expect(f).toBeGreaterThan(0)
  })

  it('càng chênh nhiều càng giảm mạnh, nhưng không bao giờ về 0', () => {
    const one = realmGapFactor(REALM.LUYEN_KHI, REALM.TRUC_CO)
    const two = realmGapFactor(REALM.LUYEN_KHI, REALM.KET_DAN)
    expect(two).toBeLessThan(one)
    expect(two).toBeGreaterThan(0)
    // Chênh 3 bậc trở lên vẫn phải gọt được một chút
    expect(realmGapFactor(0, REALM.KET_DAN)).toBeGreaterThan(0)
  })

  it('đánh xuống thì áp đảo nhưng có trần', () => {
    expect(realmGapFactor(REALM.TRUC_CO, REALM.LUYEN_KHI)).toBeGreaterThan(1)
    expect(realmGapFactor(REALM.KET_DAN, 0)).toBeLessThanOrEqual(3)
  })
})

describe('ngũ hành', () => {
  it('tương khắc theo đúng vòng Kim-Mộc-Thổ-Thuỷ-Hoả', () => {
    expect(elementFactor('kim', 'moc')).toBe(ELEMENT_ADVANTAGE)
    expect(elementFactor('moc', 'tho')).toBe(ELEMENT_ADVANTAGE)
    expect(elementFactor('tho', 'thuy')).toBe(ELEMENT_ADVANTAGE)
    expect(elementFactor('thuy', 'hoa')).toBe(ELEMENT_ADVANTAGE)
    expect(elementFactor('hoa', 'kim')).toBe(ELEMENT_ADVANTAGE)
  })

  it('bị khắc thì chịu bất lợi', () => {
    expect(elementFactor('moc', 'kim')).toBe(ELEMENT_DISADVANTAGE)
    expect(elementFactor('kim', 'hoa')).toBe(ELEMENT_DISADVANTAGE)
  })

  it('cùng hệ, hoặc không liên quan, thì trung tính', () => {
    expect(elementFactor('kim', 'kim')).toBe(1)
    expect(elementFactor('kim', 'thuy')).toBe(1)
  })

  it('vô thuộc tính không khắc ai và không bị khắc', () => {
    for (const e of ['kim', 'moc', 'thuy', 'hoa', 'tho', 'vo'] as const) {
      expect(elementFactor('vo', e)).toBe(1)
      expect(elementFactor(e, 'vo')).toBe(1)
    }
  })
})

describe('deriveStats', () => {
  it('stat tăng theo cảnh giới', () => {
    const low = deriveStats(base, { major: REALM.LUYEN_KHI, tier: 0 })
    const high = deriveStats(base, { major: REALM.KET_DAN, tier: 3 })
    expect(high.cong).toBeGreaterThan(low.cong * 10)
    expect(high.maxSinhLuc).toBeGreaterThan(low.maxSinhLuc * 10)
  })

  it('TỐC không tăng theo cảnh giới', () => {
    // Nếu tốc độ cũng nhân theo cảnh giới thì tới Kết Đan nhân vật chạy nhanh
    // gấp hơn 20 lần và không màn nào chơi được nữa
    const low = deriveStats(base, { major: REALM.LUYEN_KHI, tier: 0 })
    const high = deriveStats(base, { major: REALM.KET_DAN, tier: 3 })
    expect(high.toc).toBe(low.toc)
    expect(high.toc).toBe(base.toc)
  })
})

describe('computeDamage', () => {
  const luyenKhi: RealmPosition = { major: REALM.LUYEN_KHI, tier: 5 }
  const trucCo: RealmPosition = { major: REALM.TRUC_CO, tier: 0 }

  function actor(realm: RealmPosition = luyenKhi, over: Partial<BaseStats> = {}) {
    return { stats: deriveStats({ ...base, ...over }, realm), realm }
  }

  it('sát thương dương và tỉ lệ với skillMult', () => {
    const a = actor()
    const d = actor()
    const one = computeDamage(a, d, 1, neverRng()).amount
    const two = computeDamage(a, d, 2, neverRng()).amount
    expect(one).toBeGreaterThan(0)
    expect(two / one).toBeCloseTo(2, 1)
  })

  it('phòng ngự giảm sát thương nhưng KHÔNG BAO GIỜ về 0', () => {
    const a = actor()
    const tanky = { stats: deriveStats({ ...base, phong: 100000 }, luyenKhi), realm: luyenKhi }
    const dmg = computeDamage(a, tanky, 1, neverRng()).amount
    // Đây là lỗi cân bằng kinh điển của công thức trừ thẳng: đủ phòng là bất tử
    expect(dmg).toBeGreaterThanOrEqual(MIN_DAMAGE)
  })

  it('bạo kích nhân đúng hệ số', () => {
    const a = actor(luyenKhi, { bao: 1, baoMult: 2 })
    const d = actor()
    const critted = computeDamage(a, d, 1, alwaysRng())
    const normal = computeDamage(actor(luyenKhi, { bao: 0 }), d, 1, neverRng())
    expect(critted.crit).toBe(true)
    expect(critted.amount / normal.amount).toBeCloseTo(2, 1)
  })

  it('đánh lên một đại cảnh giới: hệ số chênh được áp đúng', () => {
    const weak = actor(luyenKhi)
    const strongDefender = { stats: deriveStats(base, trucCo), realm: trucCo }
    const upward = computeDamage(weak, strongDefender, 1, neverRng())
    expect(upward.realmFactor).toBeLessThan(0.2)
    expect(upward.realmFactor).toBeGreaterThan(0)
  })

  it('★ vực thẳm cảnh giới: cần hơn 10 lần số đòn, nhưng không phải vô vọng', () => {
    // Test này kiểm tra Ý ĐỊNH THIẾT KẾ chứ không phải một tỉ lệ tuỳ ý:
    // "chênh một đại cảnh giới là vực thẳm, không phải một bước".
    // Số đòn cần để hạ mới là thứ người chơi thực sự cảm nhận — nó gộp cả
    // sát thương giảm, phòng ngự cao hơn VÀ sinh lực nhiều hơn của đối phương.
    const weak = actor(luyenKhi)

    const sameFoe = { stats: deriveStats(base, luyenKhi), realm: luyenKhi }
    const strongFoe = { stats: deriveStats(base, trucCo), realm: trucCo }

    const hitsSame =
      sameFoe.stats.maxSinhLuc / computeDamage(weak, sameFoe, 1, neverRng()).amount
    const hitsStrong =
      strongFoe.stats.maxSinhLuc / computeDamage(weak, strongFoe, 1, neverRng()).amount

    const wall = hitsStrong / hitsSame
    expect(wall).toBeGreaterThan(10)
    // Nhưng phải còn gọt được: nếu vô hạn thì "lấy nhiều đánh ít" và đan dược
    // đều mất ý nghĩa, và người chơi không thấy mình đang làm gì cả
    expect(wall).toBeLessThan(80)
  })

  it('đánh xuống một đại cảnh giới thì áp đảo', () => {
    const strong = actor(trucCo)
    const weakFoe = { stats: deriveStats(base, luyenKhi), realm: luyenKhi }
    const r = computeDamage(strong, weakFoe, 1, neverRng())
    expect(r.realmFactor).toBeGreaterThan(1)
    expect(r.amount).toBeGreaterThan(weakFoe.stats.maxSinhLuc * 0.3)
  })

  it('ngũ hành khắc chế được phản ánh trong kết quả', () => {
    const kim = actor(luyenKhi, { element: 'kim' })
    const moc = { stats: deriveStats({ ...base, element: 'moc' }, luyenKhi), realm: luyenKhi }
    const r = computeDamage(kim, moc, 1, neverRng())
    expect(r.elementFactor).toBe(ELEMENT_ADVANTAGE)
  })

  it('sát thương làm tròn về số nguyên — UI không hiện số thập phân', () => {
    const r = computeDamage(actor(), actor(), 1.37, neverRng())
    expect(Number.isInteger(r.amount)).toBe(true)
  })
})
