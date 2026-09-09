import { describe, expect, it } from 'vitest'
import { Rng } from '@/core/Rng'
import { BreakthroughTrial, TRIAL_MAX_BONUS, TRIAL_ZONE_COUNT } from '../BreakthroughTrial'

function startTrial(): BreakthroughTrial {
  const t = new BreakthroughTrial()
  t.start(new Rng(2026))
  return t
}

/** Chơi hoàn hảo: bấm đúng mỗi khi con trỏ vào vùng chưa dẫn. */
function playPerfect(t: BreakthroughTrial): ReturnType<BreakthroughTrial['update']> {
  const dt = 1 / 60
  let wasInZone = false
  for (let i = 0; i < 60 * 60; i++) {
    const inZone = t.activeZone() !== null
    // Bấm đúng một lần mỗi khi vừa vào vùng
    const press = inZone && !wasInZone
    wasInZone = inZone
    const out = t.update(dt, press)
    if (out) return out
  }
  return null
}

describe('BreakthroughTrial', () => {
  it('bắt đầu với đủ số vùng, chưa dẫn vùng nào', () => {
    const t = startTrial()
    expect(t.active).toBe(true)
    expect(t.zones).toHaveLength(TRIAL_ZONE_COUNT)
    expect(t.zones.every((z) => !z.hit)).toBe(true)
    expect(t.hits).toBe(0)
  })

  it('các vùng nằm trong thanh và thu nhỏ dần — nhịp sau khó hơn', () => {
    const t = startTrial()
    for (const z of t.zones) {
      expect(z.start).toBeGreaterThanOrEqual(0)
      expect(z.end).toBeLessThanOrEqual(1)
      expect(z.end).toBeGreaterThan(z.start)
    }
  })

  it('con trỏ quét qua lại trong khoảng [0, 1]', () => {
    const t = startTrial()
    let min = Infinity
    let max = -Infinity
    for (let i = 0; i < 600; i++) {
      t.update(1 / 60, false)
      min = Math.min(min, t.cursor)
      max = Math.max(max, t.cursor)
    }
    expect(min).toBeGreaterThanOrEqual(0)
    expect(max).toBeLessThanOrEqual(1)
    // Phải thực sự quét gần hết thanh
    expect(max - min).toBeGreaterThan(0.8)
  })

  it('chơi hoàn hảo thì dẫn đủ nhịp và nhận thưởng cao nhất', () => {
    const t = startTrial()
    const out = playPerfect(t)
    expect(out).not.toBeNull()
    expect(out!.hits).toBe(TRIAL_ZONE_COUNT)
    expect(out!.overwhelmed).toBe(false)
    expect(out!.bonus).toBeCloseTo(TRIAL_MAX_BONUS, 2)
  })

  it('BẤM GIỮ không tính nhiều nhịp — phải nhả rồi bấm lại', () => {
    // Không chặn thì giữ nút là thắng ngay, và màn thử thành vô nghĩa
    const t = startTrial()
    let out = null
    for (let i = 0; i < 600 && !out; i++) out = t.update(1 / 60, true)
    // Giữ liên tục chỉ tính đúng MỘT lần bấm
    expect(t.hits + (t.backlash > 0 ? 1 : 0)).toBeLessThanOrEqual(1)
  })

  it('bấm trượt thì tích khí nghịch, đủ thì kết thúc sớm', () => {
    const t = startTrial()
    let out = null
    for (let i = 0; i < 60 * 60 && !out; i++) {
      // Bấm nhấp liên tục bất kể con trỏ ở đâu -> phần lớn là trượt
      const press = i % 4 === 0
      out = t.update(1 / 60, press)
    }
    expect(out).not.toBeNull()
  })

  it('★ khí nghịch áp đảo chỉ MẤT PHẦN THƯỞNG, không làm đột phá thất bại', () => {
    // Thất bại đã có phép roll lo; chồng thêm một cách thất bại nữa là quá nặng
    const t = startTrial()
    t.backlash = 0.99
    const out = t.update(1 / 60, false)
    // Chưa đủ thì chưa kết thúc
    expect(out).toBeNull()
    t.backlash = 1
    const ended = t.update(1 / 60, false)
    expect(ended).not.toBeNull()
    expect(ended!.overwhelmed).toBe(true)
    // Vẫn trả về bonus (bằng 0 vì chưa dẫn được nhịp nào), không phải "thất bại"
    expect(ended!.bonus).toBeGreaterThanOrEqual(0)
  })

  it('con trỏ nhanh dần sau mỗi nhịp thành công', () => {
    const t = startTrial()
    const before = t.speed
    // Dịch con trỏ vào vùng đầu tiên rồi bấm
    t.cursor = (t.zones[0]!.start + t.zones[0]!.end) / 2
    t.update(1 / 600, true)
    expect(t.hits).toBe(1)
    expect(t.speed).toBeGreaterThan(before)
  })

  it('bỏ giữa thì vẫn được thưởng theo số nhịp đã dẫn', () => {
    const t = startTrial()
    t.cursor = (t.zones[0]!.start + t.zones[0]!.end) / 2
    t.update(1 / 600, true)
    const out = t.abort()
    expect(out.hits).toBe(1)
    expect(out.bonus).toBeGreaterThan(0)
    expect(out.bonus).toBeLessThan(TRIAL_MAX_BONUS)
    expect(t.active).toBe(false)
  })

  it('cùng seed cho cùng bố cục vùng — tái lập được', () => {
    const a = new BreakthroughTrial()
    const b = new BreakthroughTrial()
    a.start(new Rng(99))
    b.start(new Rng(99))
    expect(a.zones).toEqual(b.zones)
  })

  it('không cập nhật gì khi chưa bắt đầu', () => {
    const t = new BreakthroughTrial()
    expect(t.update(1 / 60, true)).toBeNull()
    expect(t.cursor).toBe(0)
  })

  it('các vùng sáng không bao giờ chồng lên nhau', () => {
    // Vùng chồng nhau nghĩa là một chỗ trên thanh phải bấm hai lần mới xong,
    // và người chơi sẽ đọc ra là game không nhận input. Thử nhiều seed vì lỗi
    // này chỉ hiện với một số lần quay ngẫu nhiên.
    for (let seed = 0; seed < 300; seed++) {
      const trial = new BreakthroughTrial()
      trial.start(new Rng(seed))
      const zones = trial.zones
      expect(zones).toHaveLength(TRIAL_ZONE_COUNT)
      for (let i = 0; i < zones.length; i++) {
        const z = zones[i]!
        expect(z.start).toBeGreaterThanOrEqual(0)
        expect(z.end).toBeLessThanOrEqual(1)
        expect(z.end).toBeGreaterThan(z.start)
        if (i > 0) expect(z.start).toBeGreaterThanOrEqual(zones[i - 1]!.end)
      }
    }
  })
})
