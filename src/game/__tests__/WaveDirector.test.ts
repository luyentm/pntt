import { beforeEach, describe, expect, it } from 'vitest'
import { WAVES, type SpawnGroup } from '../data/waves'
import { UNITS } from '../data/units'
import { WaveDirector, type WaveActions } from '../WaveDirector'

/** Ghi lại mọi yêu cầu mà bộ điều phối gửi ra, không làm gì thật. */
function recorder(): WaveActions & {
  groups: SpawnGroup[]
  allies: number
  cleared: number
  announces: Array<{ text: string; kind: string }>
  bossOn: Array<string | null>
} {
  const r = {
    groups: [] as SpawnGroup[],
    allies: 0,
    cleared: 0,
    announces: [] as Array<{ text: string; kind: string }>,
    bossOn: [] as Array<string | null>,
    spawnGroup(g: SpawnGroup) {
      r.groups.push(g)
    },
    spawnAllies(n: number) {
      r.allies += n
    },
    clearEnemies() {
      r.cleared++
    },
    announce(text: string, kind: string) {
      r.announces.push({ text, kind })
    },
    bossWave(id: string | null) {
      r.bossOn.push(id)
    },
  }
  return r
}

const dt = 1 / 60

describe('WaveDirector', () => {
  let d: WaveDirector

  beforeEach(() => {
    d = new WaveDirector()
  })

  /** Chạy tới khi trạng thái đổi, hoặc quá `maxSeconds` thì dừng. */
  function run(alive: number, playerDead: boolean, a: WaveActions, seconds: number): void {
    for (let i = 0; i < Math.round(seconds / dt); i++) d.fixedUpdate(dt, alive, playerDead, a)
  }

  it('mọi id trong bảng đợt đều là đơn vị có thật', () => {
    // Lỗi chính tả ở đây chỉ nổ ra giữa lúc đang chơi, khi đợt đó tới
    for (const wave of WAVES) {
      for (const g of wave.groups) {
        expect(UNITS[g.id], `${wave.name} → ${g.id}`).toBeDefined()
        expect(g.count).toBeGreaterThan(0)
        expect(g.ringMax).toBeGreaterThanOrEqual(g.ringMin)
      }
      if (wave.boss) {
        expect(UNITS[wave.boss], `${wave.name} → boss ${wave.boss}`).toBeDefined()
        // Đợt tướng phải thật sự sinh con tướng đó ra
        expect(wave.groups.some((g) => g.id === wave.boss)).toBe(true)
        expect(UNITS[wave.boss]!.boss, `${wave.boss} phải có bảng phase`).toBeDefined()
      }
    }
  })

  it('không tự chạy — phải bấm khởi trận mới sinh quái', () => {
    const a = recorder()
    run(0, false, a, 30)
    expect(d.state).toBe('idle')
    expect(a.groups).toHaveLength(0)
  })

  it('bấm khởi trận thì báo trước rồi mới sinh quái', () => {
    const a = recorder()
    expect(d.start(a)).toBe(true)
    expect(d.state).toBe('announcing')
    expect(a.groups).toHaveLength(0) // còn đang báo, chưa sinh

    run(1, false, a, 2.5)
    expect(d.state).toBe('fighting')
    expect(a.groups).toEqual(WAVES[0]!.groups)
  })

  it('bấm lần hai trong lúc đang đánh thì không có tác dụng', () => {
    const a = recorder()
    d.start(a)
    run(1, false, a, 2.5)
    const before = a.groups.length
    expect(d.start(a)).toBe(false)
    expect(a.groups).toHaveLength(before)
  })

  it('dẹp hết quái thì sang trạng thái chờ, KHÔNG tự mở đợt sau', () => {
    const a = recorder()
    d.start(a)
    run(3, false, a, 2.5)   // còn quái -> vẫn đánh
    expect(d.state).toBe('fighting')
    run(0, false, a, 1)     // hết quái
    expect(d.state).toBe('cleared')
    expect(d.index).toBe(1)

    const before = a.groups.length
    run(0, false, a, 60)    // chờ rất lâu
    expect(a.groups).toHaveLength(before) // vẫn không tự sinh
  })

  it('người chơi bị hạ giữa đợt: đợt thất bại, dẹp sạch quái, KHÔNG mất đợt', () => {
    const a = recorder()
    d.start(a)
    run(5, false, a, 2.5)
    expect(d.index).toBe(0)

    d.fixedUpdate(dt, 5, true, a)
    expect(d.state).toBe('failed')
    expect(a.cleared).toBe(1)
    expect(d.deaths).toBe(1)

    run(5, false, a, 3.2)
    // Về lại trạng thái chờ với ĐÚNG đợt vừa thất bại, không bị đẩy sang đợt sau
    expect(d.state).toBe('cleared')
    expect(d.index).toBe(0)
  })

  it('bị hạ ngay trong lúc đang báo trước cũng tính là thất bại', () => {
    // Nếu chỉ kiểm tra ở trạng thái 'fighting' thì đợt vẫn sinh quái lên một cái xác
    const a = recorder()
    d.start(a)
    d.fixedUpdate(dt, 0, true, a)
    expect(d.state).toBe('failed')
    expect(a.groups).toHaveLength(0)
  })

  it('đợt tướng bật rồi tắt thanh máu tướng', () => {
    const a = recorder()
    // Nhảy tới đợt tướng cuối
    d.index = WAVES.length - 1
    d.start(a)
    run(1, false, a, 2.5)
    expect(a.bossOn.at(-1)).toBe(WAVES.at(-1)!.boss)

    run(0, false, a, 1)
    expect(d.state).toBe('victory')
    expect(a.bossOn.at(-1)).toBeNull()
  })

  it('đi hết cả 6 đợt thì thắng', () => {
    const a = recorder()
    for (let w = 0; w < WAVES.length; w++) {
      expect(d.start(a)).toBe(true)
      run(1, false, a, 2.5)     // còn quái -> đang đánh
      expect(d.state).toBe('fighting')
      run(0, false, a, 0.5)     // dẹp xong
    }
    expect(d.state).toBe('victory')
    expect(d.cleared).toBe(WAVES.length)
    // Tổng số nhóm sinh ra bằng tổng của cả bảng đợt
    expect(a.groups).toHaveLength(WAVES.reduce((n, w) => n + w.groups.length, 0))
    expect(a.allies).toBe(WAVES.reduce((n, w) => n + w.allies, 0))
  })

  it('thắng rồi thì bấm khởi trận không còn tác dụng', () => {
    const a = recorder()
    d.index = WAVES.length - 1
    d.start(a)
    run(1, false, a, 2.5)
    run(0, false, a, 0.5)
    expect(d.state).toBe('victory')
    expect(d.start(a)).toBe(false)
  })

  it('reset đưa về trạng thái ban đầu', () => {
    const a = recorder()
    d.start(a)
    run(1, false, a, 2.5)
    run(0, false, a, 0.5)
    d.reset()
    expect(d.state).toBe('idle')
    expect(d.index).toBe(0)
    expect(d.cleared).toBe(0)
    expect(d.deaths).toBe(0)
  })

  it('KHÔNG dẹp đợt bằng con số 0 cũ của bước trước khi vừa sinh quái', () => {
    // Màn đếm số quái sống TRƯỚC khi gọi vào đây, nên ngay sau lúc sinh nó vẫn
    // đưa vào số 0 của bước trước. Không chặn thì cả 6 đợt chạy hết trong hai
    // giây mà không con quái nào kịp xuất hiện.
    const a = recorder()
    d.start(a)
    run(0, false, a, 2.5)          // hết báo trước -> sinh quái, vẫn nhận alive = 0
    expect(d.state).toBe('fighting')
    expect(d.index).toBe(0)
    run(0, false, a, 5)            // vẫn 0 vì màn chưa cập nhật
    expect(d.state).toBe('fighting')

    run(2, false, a, 0.1)          // giờ mới thấy quái
    run(0, false, a, 0.1)          // rồi mới dẹp được
    expect(d.state).toBe('cleared')
  })
})
