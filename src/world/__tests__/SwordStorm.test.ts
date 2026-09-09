import { Group, Scene } from 'three'
import { beforeEach, describe, expect, it } from 'vitest'
import { EventBus } from '@/core/EventBus'
import type { GameEvents } from '@/core/events'
import { Rng } from '@/core/Rng'
import { REALM, type RealmPosition } from '@/game/data/realms'
import { deriveStats, type BaseStats } from '@/game/Stats'
import { Combatant, type CombatantView, type Side } from '../Combatant'
import { CombatWorld } from '../CombatWorld'
import { SwordStorm, SWORD_COUNT } from '../SwordStorm'

const base: BaseStats = {
  sinhLuc: 4000,
  linhLuc: 200,
  cong: 10,
  phong: 0,
  thanThuc: 5,
  toc: 4,
  bao: 0,
  baoMult: 2,
  element: 'vo',
}

class FakeView implements CombatantView {
  readonly root = new Group()
  readonly height = 1
  showIdle(): void {}
  showMove(): void {}
  showAttack(): void {}
  showHurt(): void {}
  showDie(): void {}
  update(): void {}
}

const realm: RealmPosition = { major: REALM.KET_DAN, tier: 0 }

function makeCombatant(side: Side, x: number, z: number): Combatant {
  const c = new Combatant(side, deriveStats(base, realm), realm, 0.3, new FakeView())
  c.place(x, z, 0, 0)
  return c
}

const SPEC = { radius: 3, mult: 0.55, duration: 5, knockback: 0, stagger: 0 }

describe('SwordStorm — Thanh Trúc Phong Vân Kiếm', () => {
  let world: CombatWorld
  let storm: SwordStorm
  let bus: EventBus<GameEvents>

  beforeEach(() => {
    bus = new EventBus<GameEvents>()
    // Rng không bao giờ bạo kích để sát thương xác định
    world = new CombatWorld(bus, new Rng(1))
    storm = new SwordStorm(new Scene(), world, bus)
  })

  function run(seconds: number): void {
    const dt = 1 / 60
    for (let i = 0; i < Math.round(seconds / dt); i++) {
      world.rebuildIndex()
      storm.fixedUpdate(dt)
    }
  }

  it('33 thanh kiếm', () => {
    expect(SWORD_COUNT).toBe(33)
  })

  it('tự tắt khi hết thời gian', () => {
    const me = makeCombatant('player', 0, 0)
    world.add(me)
    storm.cast(me, SPEC)
    expect(storm.isActive).toBe(true)
    run(SPEC.duration + 0.2)
    expect(storm.isActive).toBe(false)
  })

  it('KHÔNG gây sát thương trong lúc kiếm còn đang tụ', () => {
    const me = makeCombatant('player', 0, 0)
    const foe = makeCombatant('enemy', 0.6, 0)
    world.add(me)
    world.add(foe)
    storm.cast(me, SPEC)
    // 0.4 giây < GATHER: vòng quét chưa mở
    run(0.4)
    expect(foe.hp).toBe(foe.stats.maxSinhLuc)
  })

  it('gây sát thương theo NHỊP, không phải 33 đòn một frame', () => {
    const me = makeCombatant('player', 0, 0)
    const foe = makeCombatant('enemy', 1.2, 0)
    world.add(me)
    world.add(foe)

    let hits = 0
    bus.on('combat:hit', () => hits++)
    storm.cast(me, SPEC)
    run(SPEC.duration)

    // Nhịp 0.3 giây trong ~4.5 giây có vòng quét -> khoảng 15 nhịp.
    // Con số quan trọng ở đây là TRẦN: nếu tính theo từng thanh kiếm thì một
    // mục tiêu sẽ ăn hàng trăm đòn và chết bất kể cảnh giới.
    expect(hits).toBeGreaterThan(10)
    expect(hits).toBeLessThan(20)
  })

  it('chỉ quét trong tầm vòng kiếm — đứng ngoài thì không việc gì', () => {
    const me = makeCombatant('player', 0, 0)
    const inside = makeCombatant('enemy', 2.4, 0)
    const outside = makeCombatant('enemy', 6.8, 0)
    world.add(me)
    world.add(inside)
    world.add(outside)

    storm.cast(me, SPEC)
    run(SPEC.duration)

    expect(inside.hp).toBeLessThan(inside.stats.maxSinhLuc)
    // Vòng kiếm không loang ra mãi: đứng ngoài tầm là an toàn, nên chiêu này
    // đòi người chơi phải LÁI đàn kiếm vào chỗ có quái
    expect(outside.hp).toBe(outside.stats.maxSinhLuc)
  })

  it('KHÔNG đánh đồng môn — người chơi và ally cùng phe', () => {
    const me = makeCombatant('player', 0, 0)
    const ally = makeCombatant('ally', 1.4, 0)
    const foe = makeCombatant('enemy', 1.4, 0.4)
    world.add(me)
    world.add(ally)
    world.add(foe)

    storm.cast(me, SPEC)
    run(SPEC.duration)

    expect(ally.hp).toBe(ally.stats.maxSinhLuc)
    expect(me.hp).toBe(me.stats.maxSinhLuc)
    expect(foe.hp).toBeLessThan(foe.stats.maxSinhLuc)
  })

  it('tắt ngay khi người thi triển chết', () => {
    const me = makeCombatant('player', 0, 0)
    const foe = makeCombatant('enemy', 1.2, 0)
    world.add(me)
    world.add(foe)
    storm.cast(me, SPEC)
    run(1)
    const hpAfterOneSecond = foe.hp

    me.dead = true
    run(2)
    expect(storm.isActive).toBe(false)
    expect(foe.hp).toBe(hpAfterOneSecond)
  })
})
