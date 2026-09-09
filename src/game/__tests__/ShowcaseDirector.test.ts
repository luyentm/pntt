import { beforeEach, describe, expect, it } from 'vitest'
import { realmOrdinal, type RealmPosition } from '../data/realms'
import { hasSkill, SKILLS } from '../data/skills'
import { SHOWCASE, SHOWCASE_COUNT, stepTitle } from '../data/showcase'
import { ShowcaseDirector, type ShowcaseActions } from '../ShowcaseDirector'

function recorder(): ShowcaseActions & {
  casts: string[]
  melees: number
  flight: boolean[]
  meditate: boolean[]
  breakthroughs: number
  targets: number
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
  })

  it('chưa bấm bắt đầu thì không diễn gì', () => {
    const a = recorder()
    run(a, 30)
    expect(a.casts).toHaveLength(0)
    expect(a.melees).toBe(0)
  })

  it('bắt đầu thì báo bước đầu ngay, nhưng CHỜ đọc rồi mới diễn', () => {
    // Chữ và chiêu nổ cùng lúc thì mắt bị chia hai chỗ, không đọc được cái nào
    const a = recorder()
    d.start(a)
    expect(a.announced).toEqual([{ title: stepTitle(SHOWCASE[0]!), index: 0 }])
    run(a, 0.5)
    expect(a.melees).toBe(0)
    run(a, 0.6)
    expect(a.melees).toBeGreaterThan(0)
  })

  it('bước có repeatEvery thì diễn lặp lại theo nhịp', () => {
    const a = recorder()
    d.start(a)
    run(a, SHOWCASE[0]!.duration - 0.1)
    // 6 giây, chờ 0.9, nhịp 0.5 -> khoảng 10 lần
    expect(a.melees).toBeGreaterThan(6)
    expect(a.melees).toBeLessThan(14)
  })

  it('hết thời lượng thì tự sang bước sau', () => {
    const a = recorder()
    d.start(a)
    run(a, SHOWCASE[0]!.duration + 0.1)
    expect(d.index).toBe(1)
    expect(a.announced.at(-1)).toEqual({ title: stepTitle(SHOWCASE[1]!), index: 1 })
  })

  it('TẮT trạng thái kéo dài khi rời bước', () => {
    // Bay và toạ thiền là bật/tắt, không phải một cú nổ. Không tắt khi rời bước
    // thì nhân vật vẫn lơ lửng trong lúc showreel diễn chiêu khác.
    const a = recorder()
    const flightIndex = SHOWCASE.findIndex((s) => s.action.kind === 'flight')
    d.jumpTo(flightIndex, a)
    d.playing = true
    run(a, 1.2)
    expect(a.flight).toContain(true)
    run(a, SHOWCASE[flightIndex]!.duration)
    expect(a.flight.at(-1)).toBe(false)
  })

  it('toạ thiền cũng được tắt khi rời bước', () => {
    const a = recorder()
    const idx = SHOWCASE.findIndex((s) => s.action.kind === 'meditate')
    d.jumpTo(idx, a)
    d.playing = true
    run(a, 1.2)
    expect(a.meditate).toContain(true)
    run(a, SHOWCASE[idx]!.duration)
    expect(a.meditate.at(-1)).toBe(false)
  })

  it('bước nào có cờ thì dựng lại bia tập', () => {
    const a = recorder()
    const withTargets = SHOWCASE.filter((s) => s.refreshTargets).length
    d.start(a)
    for (const step of SHOWCASE) run(a, step.duration + 0.05)
    expect(a.targets).toBeGreaterThanOrEqual(withTargets)
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
    d.jumpTo(
      SHOWCASE.findIndex((s) => s.refreshTargets),
      spy,
    )
    expect(order).toEqual(['realm', 'targets'])
  })

  it('chạy hết kịch bản rồi quay lại bước đầu', () => {
    const a = recorder()
    d.start(a)
    for (const step of SHOWCASE) run(a, step.duration + 0.05)
    expect(d.index).toBe(0)
    expect(a.casts.length).toBeGreaterThan(0)
    expect(a.breakthroughs).toBeGreaterThan(0)
  })

  describe('điều khiển tay', () => {
    it('next / prev lật bước cả khi đang dừng', () => {
      const a = recorder()
      expect(d.playing).toBe(false)
      d.next(a)
      expect(d.index).toBe(1)
      d.prev(a)
      expect(d.index).toBe(0)
      d.prev(a)
      expect(d.index).toBe(SHOWCASE_COUNT - 1) // vòng lại
    })

    it('toggle đổi giữa tự chạy và tự chơi', () => {
      const a = recorder()
      d.toggle(a)
      expect(d.playing).toBe(true)
      d.toggle(a)
      expect(d.playing).toBe(false)
      run(a, 20)
      const before = a.casts.length + a.melees
      run(a, 20)
      expect(a.casts.length + a.melees).toBe(before) // dừng là dừng hẳn
    })

    it('dừng showreel thì tắt luôn trạng thái kéo dài của bước đang diễn', () => {
      const a = recorder()
      d.jumpTo(SHOWCASE.findIndex((s) => s.action.kind === 'flight'), a)
      d.start(a)
      run(a, 1.2)
      d.stop(a)
      expect(a.flight.at(-1)).toBe(false)
    })

    it('jumpTo kẹp về khoảng hợp lệ', () => {
      const a = recorder()
      d.jumpTo(999, a)
      expect(d.index).toBe(SHOWCASE_COUNT - 1)
      d.jumpTo(-5, a)
      expect(d.index).toBe(0)
    })
  })

  it('reset về trạng thái ban đầu', () => {
    const a = recorder()
    d.start(a)
    run(a, 10)
    d.reset()
    expect(d.index).toBe(0)
    expect(d.playing).toBe(false)
  })
})
