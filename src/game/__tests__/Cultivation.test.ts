import { describe, expect, it } from 'vitest'
import { Rng } from '@/core/Rng'
import { Cultivation } from '../Cultivation'
import { Inventory } from '../Inventory'
import { REALM, tierCount, tuViForNextTier, type RealmPosition } from '../data/realms'

const START: RealmPosition = { major: REALM.LUYEN_KHI, tier: 0 }

function alwaysSucceed(): Rng {
  const r = new Rng(1)
  r.next = () => 0
  return r
}

function alwaysFail(): Rng {
  const r = new Rng(1)
  r.next = () => 0.999999
  return r
}

/** Đưa lên đỉnh Luyện Khí bằng cách cộng Tu Vi. */
function raiseToCap(c: Cultivation): void {
  let guard = 0
  while (!c.atCap && guard++ < 100) c.gainTuVi(c.tuViNeeded)
}

describe('đường cong Tu Vi', () => {
  it('tăng đơn điệu qua các tầng Luyện Khí', () => {
    let prev = 0
    for (let tier = 0; tier < tierCount(REALM.LUYEN_KHI) - 1; tier++) {
      const need = tuViForNextTier({ major: REALM.LUYEN_KHI, tier })
      expect(need).toBeGreaterThan(prev)
      prev = need
    }
  })

  it('ba tầng cuối là BÌNH CẢNH — chậm hẳn so với đà tăng thường', () => {
    // Đây là thứ tạo áp lực đi tìm đan dược thay vì cứ đánh quái mãi
    const last = tierCount(REALM.LUYEN_KHI) - 1
    const beforeBottleneck = tuViForNextTier({ major: REALM.LUYEN_KHI, tier: last - 5 })
    const inBottleneck = tuViForNextTier({ major: REALM.LUYEN_KHI, tier: last - 3 })
    // Nếu chỉ theo đà 1.42^n thì hai tầng cách nhau chỉ gấp ~2 lần
    expect(inBottleneck / beforeBottleneck).toBeGreaterThan(3)
  })

  it('tầng cuối của đại cảnh giới trả về Infinity — chỉ đột phá được', () => {
    const last = tierCount(REALM.LUYEN_KHI) - 1
    expect(tuViForNextTier({ major: REALM.LUYEN_KHI, tier: last })).toBe(Infinity)
  })
})

describe('Cultivation — tích Tu Vi', () => {
  it('lên tầng khi đủ Tu Vi', () => {
    const c = new Cultivation(START)
    const need = c.tuViNeeded
    const r = c.gainTuVi(need)
    expect(r.tiersGained).toBe(1)
    expect(c.realm.tier).toBe(1)
  })

  it('GIỮ LẠI phần Tu Vi vượt mốc cho tầng sau', () => {
    // Giết boss cho nhiều Tu Vi thì phải lên được nhiều tầng; bỏ phần dư sẽ làm
    // người chơi mất phần thưởng mà không hiểu vì sao
    const c = new Cultivation(START)
    const need = c.tuViNeeded
    c.gainTuVi(need + 5)
    expect(c.realm.tier).toBe(1)
    expect(c.tuVi).toBe(5)
  })

  it('một cú Tu Vi lớn lên được nhiều tầng liền', () => {
    const c = new Cultivation(START)
    const r = c.gainTuVi(100000)
    expect(r.tiersGained).toBeGreaterThan(3)
  })

  it('DỪNG ở đỉnh đại cảnh giới, không tự vượt sang cảnh giới sau', () => {
    const c = new Cultivation(START)
    c.gainTuVi(1e9)
    expect(c.realm.major).toBe(REALM.LUYEN_KHI)
    expect(c.atCap).toBe(true)
    expect(c.tierProgress).toBe(1)
  })

  it('bỏ qua lượng âm hoặc bằng 0', () => {
    const c = new Cultivation(START)
    c.gainTuVi(-50)
    expect(c.tuVi).toBe(0)
    expect(c.realm.tier).toBe(0)
  })

  it('toạ thiền tăng Tu Vi đều và cuối cùng lên tầng', () => {
    const c = new Cultivation(START)
    let gained = 0
    for (let i = 0; i < 60 * 60; i++) gained += c.meditate(1 / 60).tiersGained
    expect(gained).toBeGreaterThan(0)
  })

  it('toạ thiền ở đỉnh thì không làm gì', () => {
    const c = new Cultivation(START)
    raiseToCap(c)
    const before = c.realm.tier
    c.meditate(10)
    expect(c.realm.tier).toBe(before)
  })
})

describe('Tiểu Bình — linh nhũ', () => {
  it('tích theo thời gian và có trần', () => {
    const c = new Cultivation(START)
    c.tickLinhNhu(1000)
    expect(c.linhNhuFraction).toBe(1)
  })

  it('uống được thì đổi thành Tu Vi và làm rỗng bình', () => {
    const c = new Cultivation(START)
    c.tickLinhNhu(1000)
    const gained = c.drinkLinhNhu()
    expect(gained).toBeGreaterThan(0)
    expect(c.linhNhu).toBe(0)
  })

  it('bình rỗng thì không cho gì', () => {
    const c = new Cultivation(START)
    expect(c.drinkLinhNhu()).toBe(0)
  })

  it('giá trị quy theo MỐC CỦA TẦNG nên không vô dụng ở tầng cao', () => {
    // Nếu cho một con số cố định thì Tiểu Bình thành vô nghĩa về sau, trong khi
    // trong truyện nó có ích suốt hành trình
    const low = new Cultivation(START)
    low.tickLinhNhu(1000)
    const lowGain = low.drinkLinhNhu()

    const high = new Cultivation({ major: REALM.LUYEN_KHI, tier: 8 })
    high.tickLinhNhu(1000)
    const highGain = high.drinkLinhNhu()

    expect(highGain).toBeGreaterThan(lowGain * 3)
  })
})

describe('đột phá đại cảnh giới', () => {
  function atCapWithPill(): { c: Cultivation; inv: Inventory } {
    const c = new Cultivation(START)
    raiseToCap(c)
    const inv = new Inventory()
    inv.add('trucCoDan', 1)
    return { c, inv }
  }

  it('chưa đủ Tu Vi thì không cho đột phá', () => {
    const c = new Cultivation(START)
    const check = c.canBreakthrough(new Inventory())
    expect(check.ok).toBe(false)
    expect(check.block).toBe('chuaDuTuVi')
  })

  it('đủ Tu Vi nhưng thiếu đan dược thì không cho, và NÓI RÕ cần gì', () => {
    const c = new Cultivation(START)
    raiseToCap(c)
    const check = c.canBreakthrough(new Inventory())
    expect(check.ok).toBe(false)
    expect(check.block).toBe('thieuDanDuoc')
    expect(check.needPill).toBe('trucCoDan')
  })

  it('đủ Tu Vi và có Trúc Cơ Đan thì cho phép', () => {
    const { c, inv } = atCapWithPill()
    expect(c.canBreakthrough(inv).ok).toBe(true)
  })

  it('thành công thì lên Trúc Cơ sơ kỳ và TIÊU đan dược', () => {
    const { c, inv } = atCapWithPill()
    const r = c.attemptBreakthrough(inv, alwaysSucceed())
    expect(r.success).toBe(true)
    expect(c.realm.major).toBe(REALM.TRUC_CO)
    expect(c.realm.tier).toBe(0)
    expect(inv.count('trucCoDan')).toBe(0)
  })

  it('thất bại cũng TIÊU đan dược — nếu không thì thử vô hạn miễn phí', () => {
    const { c, inv } = atCapWithPill()
    const r = c.attemptBreakthrough(inv, alwaysFail())
    expect(r.success).toBe(false)
    expect(inv.count('trucCoDan')).toBe(0)
  })

  it('thất bại KHÔNG tụt đại cảnh giới và KHÔNG chết', () => {
    // Quyết định thiết kế có chủ ý: cơ chế xoá sạch nhiều giờ chơi làm người
    // chơi không dám thử, mà thứ đáng nhớ ở đây là khoảnh khắc vượt qua
    const { c, inv } = atCapWithPill()
    c.attemptBreakthrough(inv, alwaysFail())
    expect(c.realm.major).toBe(REALM.LUYEN_KHI)
    expect(c.realm.tier).toBeGreaterThanOrEqual(0)
  })

  it('thất bại thì tụt một tầng nhỏ — mất mát thật nhưng lấy lại được', () => {
    const { c, inv } = atCapWithPill()
    const capTier = c.realm.tier
    c.attemptBreakthrough(inv, alwaysFail())
    expect(c.realm.tier).toBe(capTier - 1)
    expect(c.atCap).toBe(false)
  })

  it('★ THƯƠNG TÌNH: mỗi lần thất bại tăng tỉ lệ lần sau, không bao giờ kẹt cứng', () => {
    const c = new Cultivation(START)
    raiseToCap(c)
    const inv = new Inventory()
    inv.add('trucCoDan', 20)

    const chances: number[] = []
    for (let attempt = 0; attempt < 4; attempt++) {
      raiseToCap(c)
      chances.push(c.successChance())
      c.attemptBreakthrough(inv, alwaysFail())
    }

    // Tỉ lệ phải tăng đơn điệu
    for (let i = 1; i < chances.length; i++) {
      expect(chances[i]!).toBeGreaterThan(chances[i - 1]!)
    }
    // Và tiến tới gần chắc chắn
    expect(c.successChance()).toBeGreaterThan(0.9)
  })

  it('thành công thì XOÁ chuỗi thất bại', () => {
    const c = new Cultivation(START)
    const inv = new Inventory()
    inv.add('trucCoDan', 5)
    raiseToCap(c)
    c.attemptBreakthrough(inv, alwaysFail())
    expect(c.failStreak).toBe(1)
    raiseToCap(c)
    c.attemptBreakthrough(inv, alwaysSucceed())
    expect(c.failStreak).toBe(0)
  })

  it('tỉ lệ không bao giờ đạt 100% — vẫn còn chỗ cho vận may', () => {
    const c = new Cultivation(START)
    c.failStreak = 99
    expect(c.successChance()).toBeLessThan(1)
  })

  it('đi được cả đường Luyện Khí -> Trúc Cơ -> Kết Đan', () => {
    // Đây là bài kiểm tra cho toàn bộ vòng tu luyện của bản demo
    const c = new Cultivation(START)
    const inv = new Inventory()
    inv.add('trucCoDan', 1)
    inv.add('ngungDan', 1)
    const rng = alwaysSucceed()

    raiseToCap(c)
    expect(c.attemptBreakthrough(inv, rng).success).toBe(true)
    expect(c.realm.major).toBe(REALM.TRUC_CO)

    raiseToCap(c)
    expect(c.canBreakthrough(inv).needPill).toBeUndefined()
    expect(c.attemptBreakthrough(inv, rng).success).toBe(true)
    expect(c.realm.major).toBe(REALM.KET_DAN)

    expect(c.name).toContain('Kết Đan')
  })

  it('tới đỉnh thang thì báo daToiDinh thay vì cho đột phá tiếp', () => {
    const c = new Cultivation({ major: REALM.KET_DAN, tier: 0 })
    raiseToCap(c)
    expect(c.canBreakthrough(new Inventory()).block).toBe('daToiDinh')
  })

  it('gọi attemptBreakthrough khi chưa đủ điều kiện thì BÁO LỖI, không im lặng', () => {
    const c = new Cultivation(START)
    expect(() => c.attemptBreakthrough(new Inventory(), alwaysSucceed())).toThrow()
  })
})

describe('lưu và nạp', () => {
  it('phục hồi đúng trạng thái tu luyện', () => {
    const c = new Cultivation(START)
    c.gainTuVi(200)
    c.tickLinhNhu(30)
    c.failStreak = 2
    const restored = Cultivation.fromJSON(c.toJSON())
    expect(restored.realm).toEqual(c.realm)
    expect(restored.tuVi).toBe(c.tuVi)
    expect(restored.failStreak).toBe(2)
    expect(restored.linhNhu).toBeCloseTo(c.linhNhu)
  })

  describe('toạ thiền và bình cảnh', () => {
    /** Số giây toạ thiền suông để đi từ tầng `from` sang tầng sau. */
    function secondsForTier(tier: number): number {
      const c = new Cultivation({ major: REALM.LUYEN_KHI, tier })
      let seconds = 0
      while (c.realm.tier === tier && seconds < 100000) {
        c.meditate(1)
        seconds++
      }
      return seconds
    }

    it('ba tầng bình cảnh cuối Luyện Khí toạ thiền LÂU hơn hẳn tầng đầu', () => {
      // Đây là một lỗi thiết kế đã có thật: lượng hồi từng tính theo PHẦN TRĂM
      // mốc của tầng, nên mốc bị chia lại đúng bằng lượng hồi và mọi tầng đều
      // mất đúng 36 giây — kể cả ba tầng cố tình đắt gấp 2,7 lần. Cả cơ chế
      // bình cảnh bị vô hiệu, và toạ thiền suông đi hết Luyện Khí trong 7 phút,
      // nhanh hơn đánh quái 5 lần.
      const early = secondsForTier(0)
      const bottleneck = secondsForTier(10)
      expect(bottleneck).toBeGreaterThan(early * 5)
    })

    it('toạ thiền nhanh hơn ở cảnh giới cao — nhưng không bù nổi mốc lớn hơn', () => {
      const luyenKhi = new Cultivation({ major: REALM.LUYEN_KHI, tier: 0 })
      const trucCo = new Cultivation({ major: REALM.TRUC_CO, tier: 0 })
      expect(trucCo.meditateRate).toBeGreaterThan(luyenKhi.meditateRate)
    })

    it('toạ thiền suông đi hết Luyện Khí phải mất hơn 15 phút', () => {
      // Nếu nhanh hơn thế thì đường chơi tối ưu là ngồi giữ F trong góc, và cả
      // vòng lặp đánh quái → rơi vật phẩm → luyện đan mất ý nghĩa
      const c = new Cultivation({ major: REALM.LUYEN_KHI, tier: 0 })
      let seconds = 0
      while (!c.atCap && seconds < 100000) {
        c.meditate(1)
        seconds++
      }
      expect(seconds).toBeGreaterThan(15 * 60)
    })

    it('một bình Tiểu Bình đầy cho dưới một nửa mốc của tầng', () => {
      const c = new Cultivation({ major: REALM.LUYEN_KHI, tier: 5 })
      const needed = c.tuViNeeded
      c.linhNhu = 100
      expect(c.drinkLinhNhu()).toBeLessThan(needed * 0.5)
    })
  })
})
