import { beforeEach, describe, expect, it } from 'vitest'
import { realmOrdinal, type RealmPosition } from '../data/realms'
import { hasSkill, SKILLS } from '../data/skills'
import { SHOWCASE, SHOWCASE_COUNT, stepTitle } from '../data/showcase'
import { loopBeat, ShowcaseDirector, type ShowcaseActions } from '../ShowcaseDirector'

function recorder(): ShowcaseActions & {
  casts: string[]
  melees: number
  flight: boolean[]
  meditate: boolean[]
  breakthroughs: number
  targets: number
  restores: number
  realms: RealmPosition[]
  announced: Array<{ title: string; index: number }>
} {
  const r = {
    casts: [] as string[],
    melees: 0,
    flight: [] as boolean[],
    meditate: [] as boolean[],
    breakthroughs: 0,
    targets: 0,
    restores: 0,
    realms: [] as RealmPosition[],
    announced: [] as Array<{ title: string; index: number }>,
    cast(id: string) {
      r.casts.push(id)
    },
    melee() {
      r.melees++
    },
    setFlight(on: boolean) {
      r.flight.push(on)
    },
    setMeditate(on: boolean) {
      r.meditate.push(on)
    },
    breakthroughFx() {
      r.breakthroughs++
    },
    refreshTargets() {
      r.targets++
    },
    restore() {
      r.restores++
    },
    setRealm(realm: RealmPosition) {
      r.realms.push(realm)
    },
    announce(step: Parameters<ShowcaseActions['announce']>[0], index: number) {
      r.announced.push({ title: stepTitle(step), index })
    },
  }
  return r
}

const dt = 1 / 60

describe('ShowcaseDirector', () => {
  let d: ShowcaseDirector

  beforeEach(() => {
    d = new ShowcaseDirector()
  })

  function run(a: ShowcaseActions, seconds: number): void {
    for (let i = 0; i < Math.round(seconds / dt); i++) d.fixedUpdate(dt, a)
  }

  describe('bảng kịch bản', () => {
    it('mọi chiêu trong kịch bản đều có thật', () => {
      for (const step of SHOWCASE) {
        if (step.action.kind !== 'skill') continue
        expect(hasSkill(step.action.id), stepTitle(step)).toBe(true)
      }
    })

    it('kịch bản diễn ĐỦ mọi chiêu trong bảng, không sót chiêu nào', () => {
      // Chế độ này tồn tại để show thần thông — sót một chiêu là sót đúng thứ
      // người chơi vào đây để xem. Kiểm theo ID nên thêm chiêu mà quên thêm
      // bước trình diễn là đỏ ngay, không âm thầm biến mất.
      const shown = new Set(
        SHOWCASE.flatMap((s) => (s.action.kind === 'skill' ? [s.action.id] : [])),
      )
      for (const def of SKILLS) expect(shown.has(def.id), def.name).toBe(true)
    })

    it('mỗi bước diễn ở cảnh giới ĐỦ CAO để chiêu đó mở được', () => {
      // Diễn một chiêu Nguyên Anh ở thân Kết Đan thì `tryCast` từ chối im lặng,
      // và bước đó thành một thẻ chữ với sân trống — không có gì báo lỗi
      for (const step of SHOWCASE) {
        if (step.action.kind !== 'skill') continue
        const id = step.action.id
        const skill = SKILLS.find((d) => d.id === id)!
        expect(
          realmOrdinal(step.realm) >= realmOrdinal(skill.requiredRealm),
          `${skill.name} diễn ở cảnh giới quá thấp`,
        ).toBe(true)
      }
    })

    it('các chương đi theo thứ tự cảnh giới, không nhảy lùi', () => {
      let prev = -1
      const seen = new Set<string>()
      for (const step of SHOWCASE) {
        if (seen.has(step.chapter)) continue
        seen.add(step.chapter)
        expect(step.realm.major, step.chapter).toBeGreaterThan(prev)
        prev = step.realm.major
      }
    })

    it('có cả ba năng lực ngoài thanh pháp thuật', () => {
      const kinds = new Set(SHOWCASE.map((s) => s.action.kind))
      for (const kind of ['melee', 'flight', 'meditate', 'breakthrough']) {
        expect(kinds.has(kind as never), kind).toBe(true)
      }
    })

    it('mỗi bước đủ dài để đọc chú thích', () => {
      for (const step of SHOWCASE) {
        expect(step.duration, stepTitle(step)).toBeGreaterThan(2)
        expect(step.note.length, stepTitle(step)).toBeGreaterThan(10)
      }
    })

    it('nhịp lặp của mọi bước đều đủ thưa để xem hết một lần thi triển', () => {
      // Nhịp dưới nửa giây thì chiêu sau đè lên chiêu trước và cả hai thành một
      // đám sáng; nhịp trên mười giây thì người xem ngồi nhìn sân trống
      for (const step of SHOWCASE) {
        expect(loopBeat(step), stepTitle(step)).toBeGreaterThanOrEqual(0.5)
        expect(loopBeat(step), stepTitle(step)).toBeLessThanOrEqual(10)
      }
    })
  })

  it('chưa chọn bước nào thì không diễn gì', () => {
    const a = recorder()
    run(a, 30)
    expect(a.casts).toHaveLength(0)
    expect(a.melees).toBe(0)
    expect(a.announced).toHaveLength(0)
  })

  it('chọn một bước thì báo ngay, nhưng CHỜ đọc rồi mới diễn', () => {
    // Chữ và chiêu nổ cùng lúc thì mắt bị chia hai chỗ, không đọc được cái nào
    const a = recorder()
    d.select(0, a)
    expect(a.announced).toEqual([{ title: stepTitle(SHOWCASE[0]!), index: 0 }])
    run(a, 0.5)
    expect(a.melees).toBe(0)
    run(a, 0.6)
    expect(a.melees).toBeGreaterThan(0)
  })

  it('bước có repeatEvery thì diễn lặp lại theo nhịp', () => {
    const a = recorder()
    d.select(0, a)
    run(a, SHOWCASE[0]!.duration - 0.1)
    // 6 giây, chờ 0.9, nhịp 0.5 -> khoảng 10 lần
    expect(a.melees).toBeGreaterThan(6)
    expect(a.melees).toBeLessThan(14)
  })

  describe('lặp mãi một bước', () => {
    it('KHÔNG tự sang bước sau khi hết thời lượng', () => {
      // Đây là lý do bộ điều phối này được viết lại: xem kỹ một chiêu là việc
      // ngắm, phải lặp tới khi người xem chán chứ không tới khi đồng hồ hết
      const a = recorder()
      d.select(0, a)
      run(a, SHOWCASE[0]!.duration * 4)
      expect(d.index).toBe(0)
      expect(a.announced).toHaveLength(1)
    })

    it('bước KHÔNG khai repeatEvery vẫn lặp, theo đúng duration', () => {
      const a = recorder()
      const idx = SHOWCASE.findIndex((s) => s.action.kind === 'skill' && !s.repeatEvery)
      const step = SHOWCASE[idx]!
      d.select(idx, a)
      run(a, step.duration * 3 + 1)
      // Nhịp đầu sau 0,9 giây rồi cứ mỗi `duration` một nhịp
      expect(a.casts.length).toBeGreaterThanOrEqual(3)
      expect(a.casts.length).toBeLessThanOrEqual(5)
      expect(new Set(a.casts).size).toBe(1)
    })

    it('bù đầy sinh lực và linh lực TRƯỚC mỗi nhịp', () => {
      // Không bù thì Giá Y Thần Công (đốt 18% máu mỗi lần) tự giết nhân vật sau
      // vài chục vòng lặp, và ngự kiếm phi hành thì rơi khi cạn linh lực
      const a = recorder()
      d.select(0, a)
      run(a, SHOWCASE[0]!.duration * 2)
      expect(a.restores).toBe(a.melees)
    })

    it('trạng thái bật/tắt được gọi lại mỗi nhịp, không tắt giữa chừng', () => {
      const a = recorder()
      const idx = SHOWCASE.findIndex((s) => s.action.kind === 'flight')
      d.select(idx, a)
      run(a, SHOWCASE[idx]!.duration * 2 + 1)
      expect(a.flight.length).toBeGreaterThan(1)
      expect(a.flight.every((on) => on)).toBe(true)
    })
  })

  describe('đổi bước', () => {
    it('next / prev lật bước và lặp bước mới', () => {
      const a = recorder()
      d.select(0, a)
      d.next(a)
      expect(d.index).toBe(1)
      d.prev(a)
      expect(d.index).toBe(0)
      d.prev(a)
      expect(d.index).toBe(SHOWCASE_COUNT - 1) // vòng lại
    })

    it('chưa chọn gì thì next vào bước đầu, prev vào bước cuối', () => {
      const a = recorder()
      d.next(a)
      expect(d.index).toBe(0)
      d.reset()
      d.prev(a)
      expect(d.index).toBe(SHOWCASE_COUNT - 1)
    })

    it('TẮT trạng thái kéo dài khi rời bước', () => {
      // Bay và toạ thiền là bật/tắt, không phải một cú nổ. Không tắt khi rời
      // bước thì nhân vật vẫn lơ lửng trong lúc màn diễn chiêu khác.
      const a = recorder()
      const idx = SHOWCASE.findIndex((s) => s.action.kind === 'flight')
      d.select(idx, a)
      run(a, 1.2)
      expect(a.flight).toContain(true)
      d.next(a)
      expect(a.flight.at(-1)).toBe(false)
    })

    it('toạ thiền cũng được tắt khi rời bước', () => {
      const a = recorder()
      const idx = SHOWCASE.findIndex((s) => s.action.kind === 'meditate')
      d.select(idx, a)
      run(a, 1.2)
      expect(a.meditate).toContain(true)
      d.next(a)
      expect(a.meditate.at(-1)).toBe(false)
    })

    it('bước nào có cờ thì dựng lại bia tập', () => {
      const a = recorder()
      let withTargets = 0
      SHOWCASE.forEach((step, i) => {
        if (step.refreshTargets) withTargets++
        d.select(i, a)
      })
      expect(a.targets).toBe(withTargets)
    })

    it('đặt cảnh giới TRƯỚC khi dựng bia ở mỗi bước', () => {
      // Máu bia suy từ cảnh giới người chơi: dựng trước rồi mới nâng cảnh giới
      // thì cả vòng bia mỏng đi một bậc và chết ngay nhịp quét đầu
      const order: string[] = []
      const a = recorder()
      const spy: ShowcaseActions = {
        ...a,
        setRealm: () => order.push('realm'),
        refreshTargets: () => order.push('targets'),
      }
      d.select(
        SHOWCASE.findIndex((s) => s.refreshTargets),
        spy,
      )
      expect(order).toEqual(['realm', 'targets'])
    })

    it('select kẹp về khoảng hợp lệ', () => {
      const a = recorder()
      d.select(999, a)
      expect(d.index).toBe(SHOWCASE_COUNT - 1)
      d.select(-5, a)
      expect(d.index).toBe(0)
    })
  })

  it('reset về trạng thái chưa chọn gì', () => {
    const a = recorder()
    d.select(3, a)
    run(a, 10)
    d.reset()
    expect(d.index).toBe(-1)
    expect(d.current).toBeNull()
    const before = a.casts.length + a.melees
    run(a, 20)
    expect(a.casts.length + a.melees).toBe(before)
  })
})
