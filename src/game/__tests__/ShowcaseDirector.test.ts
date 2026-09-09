import { beforeEach, describe, expect, it } from 'vitest'
import { SKILLS } from '../data/skills'
import { SHOWCASE, SHOWCASE_COUNT } from '../data/showcase'
import { ShowcaseDirector, type ShowcaseActions } from '../ShowcaseDirector'

function recorder(): ShowcaseActions & {
  casts: number[]
  melees: number
  flight: boolean[]
  meditate: boolean[]
  breakthroughs: number
  dummies: number
  announced: Array<{ title: string; index: number }>
} {
  const r = {
    casts: [] as number[],
    melees: 0,
    flight: [] as boolean[],
    meditate: [] as boolean[],
    breakthroughs: 0,
    dummies: 0,
    announced: [] as Array<{ title: string; index: number }>,
    cast(slot: number) {
      r.casts.push(slot)
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
    refreshDummies() {
      r.dummies++
    },
    announce(step: { title: string }, index: number) {
      r.announced.push({ title: step.title, index })
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
    it('mọi ô chiêu trong kịch bản đều có thật', () => {
      for (const step of SHOWCASE) {
        if (step.action.kind !== 'skill') continue
        expect(SKILLS[step.action.slot], step.title).toBeDefined()
      }
    })

    it('kịch bản diễn ĐỦ cả 7 chiêu, không sót ô nào', () => {
      // Chế độ này tồn tại để show thần thông — sót một chiêu là sót đúng thứ
      // người chơi vào đây để xem
      const shown = new Set(
        SHOWCASE.filter((s) => s.action.kind === 'skill').map((s) =>
          s.action.kind === 'skill' ? s.action.slot : -1,
        ),
      )
      expect(shown.size).toBe(SKILLS.length)
      for (let i = 0; i < SKILLS.length; i++) expect(shown.has(i), SKILLS[i]!.name).toBe(true)
    })

    it('có cả ba năng lực ngoài thanh pháp thuật', () => {
      const kinds = new Set(SHOWCASE.map((s) => s.action.kind))
      for (const kind of ['melee', 'flight', 'meditate', 'breakthrough']) {
        expect(kinds.has(kind as never), kind).toBe(true)
      }
    })

    it('mỗi bước đủ dài để đọc chú thích', () => {
      for (const step of SHOWCASE) {
        expect(step.duration, step.title).toBeGreaterThan(2)
        expect(step.note.length, step.title).toBeGreaterThan(10)
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
    expect(a.announced).toEqual([{ title: SHOWCASE[0]!.title, index: 0 }])
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
    expect(a.announced.at(-1)).toEqual({ title: SHOWCASE[1]!.title, index: 1 })
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

  it('bước nào có cờ thì dựng lại bia đỡ', () => {
    const a = recorder()
    const withDummies = SHOWCASE.filter((s) => s.refreshDummies).length
    d.start(a)
    for (const step of SHOWCASE) run(a, step.duration + 0.05)
    expect(a.dummies).toBeGreaterThanOrEqual(withDummies)
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
