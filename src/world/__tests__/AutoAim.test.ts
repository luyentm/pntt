import { Group } from 'three'
import { beforeEach, describe, expect, it } from 'vitest'
import { EventBus } from '@/core/EventBus'
import type { GameEvents } from '@/core/events'
import { Rng } from '@/core/Rng'
import { REALM, type RealmPosition } from '@/game/data/realms'
import { deriveStats, type BaseStats } from '@/game/Stats'
import { AutoAim, AUTO_AIM_RANGE } from '../AutoAim'
import { Combatant, type CombatantView, type Side } from '../Combatant'
import { CombatWorld } from '../CombatWorld'

const base: BaseStats = {
  sinhLuc: 100,
  linhLuc: 0,
  cong: 5,
  phong: 0,
  thanThuc: 1,
  toc: 4,
  bao: 0,
  baoMult: 1,
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

const realm: RealmPosition = { major: REALM.LUYEN_KHI, tier: 0 }

describe('AutoAim', () => {
  let world: CombatWorld
  let aim: AutoAim
  let me: Combatant

  function add(side: Side, x: number, z: number): Combatant {
    const c = new Combatant(side, deriveStats(base, realm), realm, 0.3, new FakeView())
    c.place(x, z, 0, 0)
    world.add(c)
    return c
  }

  /** Chọn lại mục tiêu với hướng ưu tiên là +Z (đang chạy về trước). */
  function pick(dirX = 0, dirZ = 1): Combatant | null {
    world.rebuildIndex()
    return aim.update(me, world, AUTO_AIM_RANGE, dirX, dirZ)
  }

  beforeEach(() => {
    world = new CombatWorld(new EventBus<GameEvents>(), new Rng(1))
    aim = new AutoAim()
    me = add('player', 0, 0)
  })

  it('không có địch thì không có mục tiêu', () => {
    add('ally', 0, 2)
    expect(pick()).toBeNull()
    expect(aim.target).toBeNull()
  })

  it('KHÔNG nhắm đồng môn', () => {
    const ally = add('ally', 0, 1)
    const foe = add('enemy', 0, 5)
    expect(pick()).toBe(foe)
    expect(aim.target).not.toBe(ally)
  })

  it('ưu tiên con nằm theo hướng đang chạy, không phải con gần nhất', () => {
    // Đây là điều người chơi mong đợi: chạy về phía nào thì đánh phía đó
    const ahead = add('enemy', 0, 3)
    add('enemy', 2, 0) // gần hơn nhưng ở bên sườn
    expect(pick(0, 1)).toBe(ahead)
  })

  it('không bấm phím nào thì lấy hướng đang nhìn làm hướng ưu tiên', () => {
    me.facing = Math.PI / 2 // nhìn về +X
    const side = add('enemy', 3, 0)
    add('enemy', 0, 2)
    expect(pick(0, 0)).toBe(side)
  })

  describe('dính mục tiêu', () => {
    it('con khác nhích gần hơn một chút thì KHÔNG đổi mục tiêu', () => {
      // Lỗi kinh điển của "chọn con gần nhất": đang đánh dở một con thì con khác
      // nhích lại gần hơn 10cm, đòn tiếp theo quay sang nó, và không con nào chết
      const first = add('enemy', 0, 3)
      expect(pick()).toBe(first)

      const sneaky = add('enemy', 0, 2.9)
      expect(pick()).toBe(first)
      expect(pick()).toBe(first)
      expect(aim.target).not.toBe(sneaky)
    })

    it('nhưng con RÕ RÀNG hợp lý hơn thì vẫn đổi', () => {
      const far = add('enemy', 0, 9)
      expect(pick()).toBe(far)
      const close = add('enemy', 0, 1.2)
      expect(pick()).toBe(close)
    })

    it('mục tiêu chết thì bỏ ngay và chọn con khác', () => {
      const first = add('enemy', 0, 3)
      const second = add('enemy', 0, 6)
      expect(pick()).toBe(first)
      first.dead = true
      expect(pick()).toBe(second)
    })

    it('mục tiêu chạy ra ngoài tầm thì bỏ', () => {
      const foe = add('enemy', 0, 3)
      expect(pick()).toBe(foe)
      foe.place(0, AUTO_AIM_RANGE * 2, 0, 0)
      expect(pick()).toBeNull()
    })

    it('có vùng trễ: mục tiêu ở ngay ngoài mép tầm vẫn được giữ', () => {
      // Bỏ đúng ở mép tầm sẽ làm mục tiêu nhấp nháy vào/ra khi con quái đi
      // lảng vảng quanh mép
      const foe = add('enemy', 0, AUTO_AIM_RANGE - 0.5)
      expect(pick()).toBe(foe)
      foe.place(0, AUTO_AIM_RANGE + 0.6, 0, 0)
      expect(aim.update(me, world, AUTO_AIM_RANGE, 0, 1)).toBe(foe)
    })
  })

  describe('angleTo', () => {
    it('không có mục tiêu thì trả null', () => {
      expect(aim.angleTo(me)).toBeNull()
    })

    it('trả đúng góc tới mục tiêu', () => {
      add('enemy', 0, 4)
      pick()
      expect(aim.angleTo(me)).toBeCloseTo(0, 5) // +Z là góc 0

      aim.clear()
      const east = add('enemy', 4, 0)
      east.place(4, 0, 0, 0)
      world.rebuildIndex()
      aim.update(me, world, AUTO_AIM_RANGE, 1, 0)
      expect(aim.angleTo(me)).toBeCloseTo(Math.PI / 2, 5) // +X
    })

    it('mục tiêu đứng chồng lên người thì trả null, không trả góc rác', () => {
      const on = add('enemy', 0, 0)
      pick()
      expect(aim.target).toBe(on)
      expect(aim.angleTo(me)).toBeNull()
    })
  })

  it('clear bỏ mục tiêu', () => {
    add('enemy', 0, 3)
    pick()
    expect(aim.target).not.toBeNull()
    aim.clear()
    expect(aim.target).toBeNull()
  })
})
