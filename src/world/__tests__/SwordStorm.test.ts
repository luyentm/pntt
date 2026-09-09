import { Group, Scene } from 'three'
import { beforeEach, describe, expect, it } from 'vitest'
import { EventBus } from '@/core/EventBus'
import type { GameEvents } from '@/core/events'
import { Rng } from '@/core/Rng'
import { REALM, type RealmPosition } from '@/game/data/realms'
import { deriveStats, type BaseStats } from '@/game/Stats'
import { Combatant, type CombatantView, type Side } from '../Combatant'
import { CombatWorld } from '../CombatWorld'
import { SwordStorm, SWORD_CAPACITY } from '../SwordStorm'

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

const SPEC = {
  radius: 3,
  mult: 0.55,
  duration: 5,
  knockback: 0,
  stagger: 0,
  count: 36,
  hitInterval: 0.3,
}

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

  it('bộ đủ là 72 thanh, đúng nguyên tác', () => {
    expect(SWORD_CAPACITY).toBe(72)
  })

  it('số kiếm bay ra theo spec, và luôn làm tròn xuống bội của ba', () => {
    // Ba vòng đồng tâm: số lẻ để lại một vòng thiếu chỗ, và chỗ thiếu đó quay
    // vòng vòng quanh người thành một khoảng hở — mắt đọc ra là lỗi
    const me = makeCombatant('player', 0, 0)
    world.add(me)
    storm.cast(me, { ...SPEC, count: 12 })
    expect(storm.swordCount).toBe(12)
    storm.cast(me, { ...SPEC, count: 25 })
    expect(storm.swordCount).toBe(24)
  })

  it('không bao giờ vượt quá sức chứa của InstancedMesh', () => {
    // Vượt trần thì `setMatrixAt` ghi ra ngoài buffer — three không ném lỗi,
    // nó chỉ âm thầm bỏ qua, nên đây là dạng hỏng không có gì báo
    const me = makeCombatant('player', 0, 0)
    world.add(me)
    storm.cast(me, { ...SPEC, count: 500 })
    expect(storm.swordCount).toBeLessThanOrEqual(SWORD_CAPACITY)
  })

  it('sát thương KHÔNG đổi theo số kiếm', () => {
    // Số kiếm nói về cảnh giới qua mật độ hình ảnh, không qua sát thương: nhân
    // nó vào đòn thì Nguyên Anh ăn gấp sáu Kết Đan chỉ vì đội hình dày hơn, và
    // luật chênh lệch cảnh giới bị đếm hai lần
    function damageWith(count: number): number {
      const w = new CombatWorld(bus, new Rng(1))
      const st = new SwordStorm(new Scene(), w, bus)
      const me = makeCombatant('player', 0, 0)
      const foe = makeCombatant('enemy', 1.2, 0)
      w.add(me)
      w.add(foe)
      st.cast(me, { ...SPEC, count })
      const dt = 1 / 60
      for (let i = 0; i < Math.round(7 / dt); i++) {
        w.rebuildIndex()
        st.fixedUpdate(dt)
      }
      return foe.stats.maxSinhLuc - foe.hp
    }
    expect(damageWith(72)).toBe(damageWith(12))
  })

  it('Đại Diễn Quyết làm đàn kiếm đánh mạnh hơn và bay lâu hơn', () => {
    // Đây là chỗ Đại Diễn Quyết phải hiện ra rõ nhất: trong nguyên tác nó là
    // công pháp cho phép điều khiển nhiều pháp bảo cùng lúc, và bản mệnh pháp
    // bảo của Hàn Lập chính là đàn kiếm trúc này.
    function tongSatThuong(spec: typeof SPEC): { mat: number; keoDai: number } {
      const w = new CombatWorld(bus, new Rng(1))
      const st = new SwordStorm(new Scene(), w, bus)
      const me = makeCombatant('player', 0, 0)
      const foe = makeCombatant('enemy', 1.2, 0)
      w.add(me)
      w.add(foe)
      st.cast(me, spec)
      const dt = 1 / 60
      let keoDai = 0
      for (let i = 0; i < Math.round(12 / dt); i++) {
        w.rebuildIndex()
        st.fixedUpdate(dt)
        if (st.isActive) keoDai += dt
      }
      return { mat: foe.stats.maxSinhLuc - foe.hp, keoDai }
    }

    const thuong = tongSatThuong(SPEC)
    const boost = 1.5
    const daiDien = tongSatThuong({
      ...SPEC,
      mult: SPEC.mult * boost,
      duration: SPEC.duration * boost,
    })

    expect(daiDien.keoDai).toBeGreaterThan(thuong.keoDai * 1.4)
    // Mạnh hơn cả do mỗi nhịp nặng hơn, cả do có thêm nhịp — nên hơn hẳn 1.5 lần
    expect(daiDien.mat).toBeGreaterThan(thuong.mat * 1.5)
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
