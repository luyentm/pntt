import { Group } from 'three'
import { beforeEach, describe, expect, it } from 'vitest'
import { EventBus } from '@/core/EventBus'
import type { GameEvents } from '@/core/events'
import { Rng } from '@/core/Rng'
import { REALM, type RealmPosition } from '@/game/data/realms'
import { deriveStats, type BaseStats } from '@/game/Stats'
import { Combatant, isHostile, type CombatantView, type Side } from '../Combatant'
import { CombatWorld } from '../CombatWorld'

const base: BaseStats = {
  sinhLuc: 100,
  linhLuc: 20,
  cong: 10,
  phong: 0,
  thanThuc: 5,
  toc: 4,
  bao: 0,
  baoMult: 2,
  element: 'vo',
}

/** View giả: ghi lại đã được yêu cầu diễn cảnh gì, không cần đồ hoạ. */
class FakeView implements CombatantView {
  readonly root = new Group()
  readonly height = 1
  readonly calls: string[] = []
  showIdle(): void {
    this.calls.push('idle')
  }
  showMove(): void {
    this.calls.push('move')
  }
  showAttack(): void {
    this.calls.push('attack')
  }
  showHurt(): void {
    this.calls.push('hurt')
  }
  showDie(): void {
    this.calls.push('die')
  }
  update(): void {}
}

const realm: RealmPosition = { major: REALM.LUYEN_KHI, tier: 0 }

function makeCombatant(side: Side, x: number, z: number, radius = 0.3): Combatant {
  const c = new Combatant(side, deriveStats(base, realm), realm, radius, new FakeView())
  c.place(x, z, 0, 0)
  return c
}

/** RNG không bao giờ bạo kích, để sát thương xác định. */
function steadyRng(): Rng {
  const r = new Rng(1)
  r.next = () => 0.999999
  return r
}

describe('isHostile', () => {
  it('quái thù với người chơi và đồng môn, không thù đồng loại', () => {
    expect(isHostile('enemy', 'player')).toBe(true)
    expect(isHostile('enemy', 'ally')).toBe(true)
    expect(isHostile('enemy', 'enemy')).toBe(false)
  })

  it('người chơi và đồng môn chỉ thù quái', () => {
    expect(isHostile('player', 'enemy')).toBe(true)
    expect(isHostile('player', 'ally')).toBe(false)
    expect(isHostile('ally', 'player')).toBe(false)
  })
})

describe('CombatWorld — hitbox hình quạt', () => {
  let bus: EventBus<GameEvents>
  let world: CombatWorld
  let attacker: Combatant

  beforeEach(() => {
    bus = new EventBus<GameEvents>()
    world = new CombatWorld(bus, steadyRng())
    // Hướng 0 = nhìn về +Z (quy ước của cả game)
    attacker = makeCombatant('player', 0, 0)
    world.add(attacker)
  })

  it('trúng mục tiêu ở phía trước', () => {
    const foe = makeCombatant('enemy', 0, 1.2)
    world.add(foe)
    world.rebuildIndex()
    const out: Combatant[] = []
    expect(world.queryCone(attacker, 0, 0.85, 2, out)).toBe(1)
    expect(out[0]).toBe(foe)
  })

  it('KHÔNG trúng mục tiêu ở phía sau lưng', () => {
    // Đây là lý do dùng hình quạt thay vì hình tròn: đứng sau lưng mà vẫn trúng
    // thì việc quay người và né đều mất ý nghĩa
    world.add(makeCombatant('enemy', 0, -1.2))
    world.rebuildIndex()
    const out: Combatant[] = []
    expect(world.queryCone(attacker, 0, 0.85, 2, out)).toBe(0)
  })

  it('KHÔNG trúng mục tiêu ngoài tầm', () => {
    world.add(makeCombatant('enemy', 0, 6))
    world.rebuildIndex()
    const out: Combatant[] = []
    expect(world.queryCone(attacker, 0, 0.85, 2, out)).toBe(0)
  })

  it('tôn trọng góc quạt: hẹp thì bỏ mục tiêu lệch bên', () => {
    // Lệch 60 độ so với hướng nhìn
    const angle = Math.PI / 3
    world.add(makeCombatant('enemy', Math.sin(angle) * 1.5, Math.cos(angle) * 1.5, 0.05))
    world.rebuildIndex()
    const out: Combatant[] = []
    // Quạt rộng (80 độ) thì trúng
    expect(world.queryCone(attacker, 0, 1.4, 2.5, out)).toBe(1)
    // Quạt hẹp (17 độ) thì không
    expect(world.queryCone(attacker, 0, 0.3, 2.5, out)).toBe(0)
  })

  it('mục tiêu TO ở rìa quạt vẫn trúng — nới góc theo bán kính của nó', () => {
    // Không có phần nới này thì một con boss to đứng sát cạnh vẫn lọt khỏi đòn,
    // trái hoàn toàn với trực giác của người chơi
    const angle = 0.8
    const dist = 1.5
    const big = makeCombatant('enemy', Math.sin(angle) * dist, Math.cos(angle) * dist, 0.9)
    world.add(big)
    world.rebuildIndex()
    const out: Combatant[] = []
    expect(world.queryCone(attacker, 0, 0.55, 3, out)).toBe(1)
  })

  it('không tự đánh mình và không đánh đồng đội', () => {
    world.add(makeCombatant('ally', 0, 1))
    world.rebuildIndex()
    const out: Combatant[] = []
    expect(world.queryCone(attacker, 0, 1.4, 3, out)).toBe(0)
  })

  it('bỏ qua mục tiêu đã chết', () => {
    const foe = makeCombatant('enemy', 0, 1)
    foe.dead = true
    world.add(foe)
    world.rebuildIndex()
    const out: Combatant[] = []
    expect(world.queryCone(attacker, 0, 1.4, 3, out)).toBe(0)
  })
})

describe('CombatWorld — gây sát thương', () => {
  let bus: EventBus<GameEvents>
  let world: CombatWorld
  let attacker: Combatant
  let foe: Combatant

  beforeEach(() => {
    bus = new EventBus<GameEvents>()
    world = new CombatWorld(bus, steadyRng())
    attacker = makeCombatant('player', 0, 0)
    foe = makeCombatant('enemy', 0, 1)
    world.add(attacker)
    world.add(foe)
  })

  it('trừ máu và bật miễn thương', () => {
    const before = foe.hp
    const r = world.strike(attacker, foe, 1)
    expect(r).not.toBeNull()
    expect(foe.hp).toBeLessThan(before)
    expect(foe.invuln).toBeGreaterThan(0)
  })

  it('Giá Y Thần Công nhân vào sát thương của mọi đòn', () => {
    // Nhân ở `strike` chứ không trong một chiêu cụ thể: trong nguyên tác nó là
    // sức mạnh của cả người, nên nó phải ăn vào nhát kiếm, pháp vực, phi kiếm
    // và đàn kiếm trúc như nhau. Test ở đây vì đây là cửa duy nhất cả bốn đi qua.
    const thuong = world.strike(attacker, foe, 1)!.amount
    foe.hp = foe.stats.maxSinhLuc
    foe.invuln = 0

    attacker.effects.apply('giaY', 8, 0.6, attacker.id)
    const donGiaY = world.strike(attacker, foe, 1)!.amount

    expect(donGiaY).toBeCloseTo(thuong * 1.6, 5)
  })

  it('BỎ QUA đòn khi mục tiêu đang miễn thương', () => {
    // Nếu không có chốt này thì một đòn có thể trừ máu nhiều lần khi có nhiều
    // nguồn sát thương trúng cùng frame (đòn chém + phi kiếm + độc)
    world.strike(attacker, foe, 1)
    const afterFirst = foe.hp
    expect(world.strike(attacker, foe, 1)).toBeNull()
    expect(foe.hp).toBe(afterFirst)
  })

  it('hết miễn thương thì lại trúng được', () => {
    world.strike(attacker, foe, 1)
    const afterFirst = foe.hp
    for (let i = 0; i < 20; i++) foe.tickTimers(1 / 60)
    expect(foe.invuln).toBe(0)
    expect(world.strike(attacker, foe, 1)).not.toBeNull()
    expect(foe.hp).toBeLessThan(afterFirst)
  })

  it('đủ sát thương thì chết, và diễn cảnh chết', () => {
    const events: string[] = []
    bus.on('combat:death', () => events.push('death'))
    world.strike(attacker, foe, 1000)
    expect(foe.dead).toBe(true)
    expect(foe.hp).toBe(0)
    expect(events).toEqual(['death'])
    expect((foe.view as FakeView).calls).toContain('die')
  })

  it('không đánh được mục tiêu đã chết', () => {
    foe.dead = true
    expect(world.strike(attacker, foe, 1)).toBeNull()
  })

  it('phát sự kiện trúng đòn kèm đủ thông tin cho VFX và UI', () => {
    const seen: GameEvents['combat:hit'][] = []
    bus.on('combat:hit', (e) => seen.push(e))
    world.strike(attacker, foe, 1)
    expect(seen).toHaveLength(1)
    const e = seen[0]!
    expect(e.amount).toBeGreaterThan(0)
    expect(e.targetSide).toBe('enemy')
    expect(e.realmFactor).toBe(1)
    expect(Number.isFinite(e.x)).toBe(true)
    expect(Number.isFinite(e.y)).toBe(true)
  })

  it('đẩy lùi theo hướng từ kẻ đánh tới mục tiêu', () => {
    world.strike(attacker, foe, 1, { knockback: 5 })
    // Mục tiêu ở +Z so với kẻ đánh -> phải bị đẩy về +Z
    expect(foe.knockVz).toBeGreaterThan(0)
    expect(Math.abs(foe.knockVx)).toBeLessThan(1e-6)
  })

  it('đòn không gây choáng khi mục tiêu chết — xác không giật', () => {
    world.strike(attacker, foe, 1000, { stagger: 0.5 })
    expect(foe.stagger).toBe(0)
  })
})

describe('CombatWorld — tách đàn và tìm mục tiêu', () => {
  let world: CombatWorld

  beforeEach(() => {
    world = new CombatWorld(new EventBus<GameEvents>(), steadyRng())
  })

  it('tách hai combatant đang chồng nhau', () => {
    // Không có bước này thì cả đàn quái xếp thành một cột và chỉ thấy một con
    const a = makeCombatant('enemy', 0, 0, 0.4)
    const b = makeCombatant('enemy', 0.2, 0, 0.4)
    world.add(a)
    world.add(b)

    const before = Math.hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z)
    for (let step = 0; step < 40; step++) {
      world.rebuildIndex()
      world.resolveCrowding()
    }
    const after = Math.hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z)
    expect(after).toBeGreaterThan(before)
    expect(after).toBeGreaterThanOrEqual(0.8 - 1e-3)
  })

  it('tách đối xứng — không con nào bị đẩy hết phần', () => {
    const a = makeCombatant('enemy', -0.1, 0, 0.4)
    const b = makeCombatant('enemy', 0.1, 0, 0.4)
    world.add(a)
    world.add(b)
    world.rebuildIndex()
    world.resolveCrowding()
    // Trung điểm phải giữ nguyên
    expect((a.pos.x + b.pos.x) / 2).toBeCloseTo(0, 6)
  })

  it('nearestHostile chọn kẻ địch GẦN NHẤT', () => {
    const me = makeCombatant('player', 0, 0)
    const far = makeCombatant('enemy', 0, 8)
    const near = makeCombatant('enemy', 0, 2)
    world.add(me)
    world.add(far)
    world.add(near)
    world.rebuildIndex()
    expect(world.nearestHostile(me, 20)).toBe(near)
  })

  it('nearestHostile trả null khi ngoài tầm phát hiện', () => {
    const me = makeCombatant('player', 0, 0)
    world.add(me)
    world.add(makeCombatant('enemy', 0, 40))
    world.rebuildIndex()
    expect(world.nearestHostile(me, 10)).toBeNull()
  })

  it('dọn xác sau khi hết thời gian, nhưng KHÔNG dọn người chơi', () => {
    const me = makeCombatant('player', 0, 0)
    const foe = makeCombatant('enemy', 0, 2)
    world.add(me)
    world.add(foe)
    me.dead = true
    foe.dead = true
    me.deadFor = 999
    foe.deadFor = 999
    const removed = world.reapCorpses()
    expect(removed).toEqual([foe])
    expect(world.all).toContain(me)
  })
})

describe('Combatant — bộ đếm và đẩy lùi', () => {
  it('choáng và miễn thương giảm dần rồi về 0', () => {
    const c = makeCombatant('enemy', 0, 0)
    c.stagger = 0.2
    c.invuln = 0.1
    for (let i = 0; i < 20; i++) c.tickTimers(1 / 60)
    expect(c.stagger).toBe(0)
    expect(c.invuln).toBe(0)
  })

  it('đẩy lùi tắt dần và về ĐÚNG 0, không rê mãi', () => {
    const c = makeCombatant('enemy', 0, 0)
    c.addKnockback(1, 0, 6)
    expect(c.knockVx).toBeGreaterThan(0)
    for (let i = 0; i < 120; i++) c.tickTimers(1 / 60)
    // Phải bằng chính xác 0: nếu chỉ tiến tới 0 thì nhân vật trôi vô hạn với
    // vận tốc cực nhỏ và không bao giờ thật sự đứng yên
    expect(c.knockVx).toBe(0)
    expect(c.knockVz).toBe(0)
  })

  it('đẩy lùi cộng dồn khi trúng liên tiếp', () => {
    const c = makeCombatant('enemy', 0, 0)
    c.addKnockback(1, 0, 3)
    const first = c.knockVx
    c.addKnockback(1, 0, 3)
    expect(c.knockVx).toBeGreaterThan(first)
  })

  it('addKnockback bỏ qua hướng bằng 0 thay vì sinh NaN', () => {
    const c = makeCombatant('enemy', 0, 0)
    c.addKnockback(0, 0, 5)
    expect(c.knockVx).toBe(0)
    expect(Number.isNaN(c.knockVx)).toBe(false)
  })

  it('hpFraction luôn trong [0, 1] kể cả khi máu âm', () => {
    const c = makeCombatant('enemy', 0, 0)
    c.hp = -50
    expect(c.hpFraction).toBe(0)
    c.hp = c.stats.maxSinhLuc * 3
    expect(c.hpFraction).toBe(1)
  })
})
