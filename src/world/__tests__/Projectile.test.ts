import { Group, Scene } from 'three'
import { beforeEach, describe, expect, it } from 'vitest'
import { EventBus } from '@/core/EventBus'
import type { GameEvents } from '@/core/events'
import { Rng } from '@/core/Rng'
import { REALM, type RealmPosition } from '@/game/data/realms'
import { deriveStats, type BaseStats } from '@/game/Stats'
import { CollisionWorld } from '../Collision'
import { Combatant, type CombatantView, type Side } from '../Combatant'
import { CombatWorld } from '../CombatWorld'
import { ProjectileSystem, type ProjectileSpec } from '../Projectile'
import type { HeightField } from '../Terrain'

const base: BaseStats = {
  sinhLuc: 200,
  linhLuc: 50,
  cong: 12,
  phong: 0,
  thanThuc: 10,
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

/** Mặt đất phẳng — để test không phụ thuộc địa hình. */
const flatGround: HeightField = { heightAt: () => 0 }

const realm: RealmPosition = { major: REALM.LUYEN_KHI, tier: 5 }

function makeCombatant(side: Side, x: number, z: number): Combatant {
  const c = new Combatant(side, deriveStats(base, realm), realm, 0.3, new FakeView())
  c.place(x, z, 0, 0)
  return c
}

const straightSpec: ProjectileSpec = {
  look: 'hoaCau',
  behavior: 'thang',
  speed: 10,
  radius: 0.4,
  scale: 0.7,
  lifetime: 2,
  mult: 1,
  knockback: 0,
  stagger: 0,
  pierce: 1,
  element: 'vo',
}

describe('ProjectileSystem', () => {
  let bus: EventBus<GameEvents>
  let world: CombatWorld
  let sys: ProjectileSystem
  let collision: CollisionWorld
  let shooter: Combatant

  /** Chạy mô phỏng, dựng lại chỉ mục mỗi bước như scene thật làm. */
  function run(seconds: number): void {
    const dt = 1 / 60
    for (let i = 0; i < Math.ceil(seconds / dt); i++) {
      world.rebuildIndex()
      sys.fixedUpdate(dt, collision, flatGround)
    }
  }

  beforeEach(() => {
    bus = new EventBus<GameEvents>()
    const rng = new Rng(7)
    rng.next = () => 0.999999
    world = new CombatWorld(bus, rng)
    collision = new CollisionWorld()
    sys = new ProjectileSystem(new Scene(), world, rng, 16)
    shooter = makeCombatant('player', 0, 0)
    world.add(shooter)
  })

  it('bắn ra thì có một viên hoạt động', () => {
    sys.fire(shooter, straightSpec, 0, 1)
    expect(sys.activeCount).toBe(1)
  })

  it('bỏ qua hướng bằng 0 thay vì sinh viên đứng yên vĩnh viễn', () => {
    sys.fire(shooter, straightSpec, 0, 0)
    expect(sys.activeCount).toBe(0)
  })

  it('trúng địch trên đường bay', () => {
    const foe = makeCombatant('enemy', 0, 5)
    world.add(foe)
    sys.fire(shooter, straightSpec, 0, 1)
    run(1)
    expect(foe.hp).toBeLessThan(foe.stats.maxSinhLuc)
  })

  it('KHÔNG trúng đồng môn — dùng isHostile, không phải so sánh side thô', () => {
    // Bug đã từng có thật: `c.side !== owner.side` cho ra true với 'ally' vs
    // 'player', nên mọi phi hành khí bắn trúng cả đồng đội. Ở đại chiến thì
    // người chơi sẽ tự diệt sạch quân mình.
    const ally = makeCombatant('ally', 0, 5)
    world.add(ally)
    sys.fire(shooter, straightSpec, 0, 1)
    run(1)
    expect(ally.hp).toBe(ally.stats.maxSinhLuc)
  })

  it('không tự bắn chính mình', () => {
    sys.fire(shooter, straightSpec, 0, 1)
    run(0.3)
    expect(shooter.hp).toBe(shooter.stats.maxSinhLuc)
  })

  it('pierce = 1 thì tan sau một mục tiêu', () => {
    const a = makeCombatant('enemy', 0, 3)
    const b = makeCombatant('enemy', 0, 6)
    world.add(a)
    world.add(b)
    sys.fire(shooter, straightSpec, 0, 1)
    run(1.2)
    expect(a.hp).toBeLessThan(a.stats.maxSinhLuc)
    expect(b.hp).toBe(b.stats.maxSinhLuc)
    expect(sys.activeCount).toBe(0)
  })

  it('pierce > 1 thì xuyên qua nhiều mục tiêu', () => {
    const spec: ProjectileSpec = { ...straightSpec, pierce: 3 }
    const a = makeCombatant('enemy', 0, 3)
    const b = makeCombatant('enemy', 0, 6)
    world.add(a)
    world.add(b)
    sys.fire(shooter, spec, 0, 1)
    run(1.5)
    expect(a.hp).toBeLessThan(a.stats.maxSinhLuc)
    expect(b.hp).toBeLessThan(b.stats.maxSinhLuc)
  })

  it('mỗi mục tiêu chỉ trúng MỘT lần cho một viên', () => {
    // Không chốt thì viên đi qua sẽ trừ máu mỗi frame nó còn chồng lên mục tiêu
    const spec: ProjectileSpec = { ...straightSpec, pierce: 5, speed: 2 }
    const foe = makeCombatant('enemy', 0, 1.5)
    world.add(foe)
    sys.fire(shooter, spec, 0, 1)
    run(1.5)
    const damage = foe.stats.maxSinhLuc - foe.hp
    const oneHit = Math.round(shooter.stats.cong * spec.mult)
    expect(damage).toBeLessThan(oneHit * 1.6)
  })

  it('hết thời gian thì tự tan', () => {
    sys.fire(shooter, { ...straightSpec, lifetime: 0.3 }, 0, 1)
    run(0.5)
    expect(sys.activeCount).toBe(0)
  })

  it('trúng vật cản tĩnh thì tan', () => {
    collision.addStatic(0, 4, 1)
    sys.fire(shooter, straightSpec, 0, 1)
    run(1)
    expect(sys.activeCount).toBe(0)
  })

  it('nổ lan gây sát thương cho địch quanh điểm nổ', () => {
    const spec: ProjectileSpec = {
      ...straightSpec,
      explodeRadius: 3,
      explodeMult: 1,
    }
    const direct = makeCombatant('enemy', 0, 5)
    const splash = makeCombatant('enemy', 2, 5)
    world.add(direct)
    world.add(splash)
    sys.fire(shooter, spec, 0, 1)
    run(1)
    expect(direct.hp).toBeLessThan(direct.stats.maxSinhLuc)
    // Con bên cạnh không bị trúng trực tiếp, chỉ bị sát thương lan
    expect(splash.hp).toBeLessThan(splash.stats.maxSinhLuc)
  })

  it('nổ lan KHÔNG trúng đồng môn', () => {
    const spec: ProjectileSpec = { ...straightSpec, explodeRadius: 4, explodeMult: 1 }
    const foe = makeCombatant('enemy', 0, 5)
    const ally = makeCombatant('ally', 1.5, 5)
    world.add(foe)
    world.add(ally)
    sys.fire(shooter, spec, 0, 1)
    run(1)
    expect(ally.hp).toBe(ally.stats.maxSinhLuc)
  })

  it('áp trạng thái khi trúng', () => {
    const spec: ProjectileSpec = {
      ...straightSpec,
      onHit: { kind: 'thieuDot', duration: 4, magnitude: 5 },
    }
    const foe = makeCombatant('enemy', 0, 4)
    world.add(foe)
    sys.fire(shooter, spec, 0, 1)
    run(1)
    expect(foe.effects.has('thieuDot')).toBe(true)
  })

  it('phi kiếm quay về: bay ra rồi trở lại chỗ chủ và được thu hồi', () => {
    const spec: ProjectileSpec = {
      ...straightSpec,
      look: 'kiem',
      behavior: 'hoiKiem',
      pierce: 4,
      outRange: 5,
      lifetime: 6,
      speed: 12,
    }
    sys.fire(shooter, spec, 0, 1)
    run(0.3)
    expect(sys.activeCount).toBe(1)
    // Đủ thời gian bay ra 5 unit rồi quay về
    run(2)
    expect(sys.activeCount).toBe(0)
  })

  it('ngũ hành của CHIÊU được dùng, không phải của người thi triển', () => {
    // Hàn Lập thuộc Mộc vẫn bắn được Hoả Cầu, và nó phải khắc theo hệ Hoả
    const events: GameEvents['combat:hit'][] = []
    bus.on('combat:hit', (e) => events.push(e))

    shooter.stats.element = 'moc'
    const kimFoe = makeCombatant('enemy', 0, 4)
    kimFoe.stats.element = 'moc'
    world.add(kimFoe)

    // Kim khắc Mộc -> phải thấy lợi thế, dù người bắn là Mộc (Mộc vs Mộc = trung tính)
    sys.fire(shooter, { ...straightSpec, element: 'kim' }, 0, 1)
    run(1)
    expect(events).toHaveLength(1)
    expect(events[0]!.elementFactor).toBeGreaterThan(1.1)
    // Và ngũ hành của người bắn phải được TRẢ LẠI sau đó
    expect(shooter.stats.element).toBe('moc')
  })

  it('clear() thu hồi hết', () => {
    sys.fire(shooter, straightSpec, 0, 1)
    sys.fire(shooter, straightSpec, 1, 0)
    expect(sys.activeCount).toBe(2)
    sys.clear()
    expect(sys.activeCount).toBe(0)
  })
})
