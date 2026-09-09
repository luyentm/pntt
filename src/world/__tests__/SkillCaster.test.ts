import { Group, Scene } from 'three'
import { beforeEach, describe, expect, it } from 'vitest'
import { EventBus } from '@/core/EventBus'
import type { GameEvents } from '@/core/events'
import { Rng } from '@/core/Rng'
import { REALM, type RealmPosition } from '@/game/data/realms'
import { SKILLS } from '@/game/data/skills'
import { deriveStats, type BaseStats } from '@/game/Stats'
import { Combatant, type CombatantView, type Side } from '../Combatant'
import { CombatWorld } from '../CombatWorld'
import { ProjectileSystem } from '../Projectile'
import { SkillCaster } from '../SkillCaster'

const base: BaseStats = {
  sinhLuc: 100,
  linhLuc: 200,
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

/** Cảnh giới đủ cao để mở hết mọi chiêu trong bảng. */
const HIGH: RealmPosition = { major: REALM.KET_DAN, tier: 3 }
const START: RealmPosition = { major: REALM.LUYEN_KHI, tier: 0 }

function slotOf(id: string): number {
  const i = SKILLS.findIndex((s) => s.id === id)
  if (i < 0) throw new Error(`không có chiêu ${id}`)
  return i
}

function makeCombatant(side: Side, x: number, z: number, realm = HIGH): Combatant {
  const c = new Combatant(side, deriveStats(base, realm), realm, 0.3, new FakeView())
  c.place(x, z, 0, 0)
  return c
}

/** Chạy caster đủ lâu để chiêu phát ra và hồi xong. */
function runCast(caster: SkillCaster, ctx: Parameters<SkillCaster['fixedUpdate']>[1], seconds = 1.2) {
  const dt = 1 / 60
  for (let i = 0; i < Math.ceil(seconds / dt); i++) caster.fixedUpdate(dt, ctx)
}

describe('SkillCaster', () => {
  let bus: EventBus<GameEvents>
  let world: CombatWorld
  let projectiles: ProjectileSystem
  let me: Combatant
  let caster: SkillCaster
  let ctx: Parameters<SkillCaster['fixedUpdate']>[1]

  beforeEach(() => {
    bus = new EventBus<GameEvents>()
    const rng = new Rng(1)
    rng.next = () => 0.999999 // không bạo kích
    world = new CombatWorld(bus, rng)
    projectiles = new ProjectileSystem(new Scene(), world, rng, 8)
    me = makeCombatant('player', 0, 0)
    world.add(me)
    caster = new SkillCaster(me, bus)
    ctx = { world, projectiles, cursorX: 0, cursorZ: 0 }
  })

  describe('cổng mở theo cảnh giới', () => {
    it('lúc mới nhập môn chỉ mở được chiêu đầu tiên', () => {
      // Đây là phần thưởng cụ thể của việc tu luyện: đột phá thì mở chiêu mới
      expect(caster.isUnlocked(slotOf('nguKiem'), START)).toBe(true)
      expect(caster.isUnlocked(slotOf('thienLoiPhu'), START)).toBe(false)
      expect(caster.isUnlocked(slotOf('bangPhongPhu'), START)).toBe(false)
    })

    it('cảnh giới cao thì mở hết', () => {
      for (let i = 0; i < SKILLS.length; i++) {
        expect(caster.isUnlocked(i, HIGH)).toBe(true)
      }
    })

    it('từ chối thi triển chiêu chưa mở, và NÓI RÕ lý do', () => {
      const r = caster.tryCast(slotOf('thienLoiPhu'), START, 999, ctx)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.reason).toMatch(/cảnh giới/)
    })
  })

  describe('linh lực và hồi chiêu', () => {
    it('từ chối khi không đủ linh lực', () => {
      const r = caster.tryCast(0, HIGH, 0, ctx)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.reason).toMatch(/linh lực/i)
    })

    it('trả về đúng giá linh lực để bên gọi trừ', () => {
      const slot = slotOf('nguKiem')
      const r = caster.tryCast(slot, HIGH, 999, ctx)
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.cost).toBe(SKILLS[slot]!.linhLucCost)
    })

    it('bật hồi chiêu ngay lúc bấm, không đợi chiêu phát', () => {
      // Đợi tới lúc phát mới bật thì người chơi bấm dồn sẽ phát nhiều lần
      const slot = slotOf('nguKiem')
      caster.tryCast(slot, HIGH, 999, ctx)
      expect(caster.cooldownLeft(slot)).toBeGreaterThan(0)
    })

    it('không thi triển lại được khi đang hồi', () => {
      const slot = slotOf('nguKiem')
      caster.tryCast(slot, HIGH, 999, ctx)
      runCast(caster, ctx, 0.6)
      const r = caster.tryCast(slot, HIGH, 999, ctx)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.reason).toMatch(/đang hồi/)
    })

    it('hồi xong thì thi triển lại được', () => {
      const slot = slotOf('nguKiem')
      caster.tryCast(slot, HIGH, 999, ctx)
      runCast(caster, ctx, SKILLS[slot]!.cooldown + 0.3)
      expect(caster.cooldownLeft(slot)).toBe(0)
      expect(caster.tryCast(slot, HIGH, 999, ctx).ok).toBe(true)
    })

    it('không thi triển chiêu khác khi đang thi triển', () => {
      caster.tryCast(slotOf('nguKiem'), HIGH, 999, ctx)
      const r = caster.tryCast(slotOf('hoaCau'), HIGH, 999, ctx)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.reason).toMatch(/đang thi triển/i)
    })

    it('bị đóng băng thì không thi triển được', () => {
      me.effects.apply('dongBang', 2, 0)
      const r = caster.tryCast(0, HIGH, 999, ctx)
      expect(r.ok).toBe(false)
    })

    it('bị choáng GIỮA lúc dẫn khí thì chiêu bị phá, nhưng vẫn mất hồi chiêu', () => {
      // Nếu không mất hồi chiêu thì bị đánh gián đoạn lại thành có lợi
      const slot = slotOf('hoaCau')
      caster.tryCast(slot, HIGH, 999, ctx)
      me.stagger = 0.5
      caster.fixedUpdate(1 / 60, ctx)
      expect(caster.isCasting).toBe(false)
      expect(caster.cooldownLeft(slot)).toBeGreaterThan(0)
    })
  })

  describe('Kim Quang Thuẫn', () => {
    it('dựng khiên với độ mạnh suy từ Thần Thức', () => {
      const slot = slotOf('kimQuangThuan')
      const action = SKILLS[slot]!.action
      if (action.type !== 'hoTro') throw new Error('sai loại chiêu')

      caster.tryCast(slot, HIGH, 999, ctx)
      runCast(caster, ctx)

      const shield = me.effects.find('khien')
      expect(shield).toBeDefined()
      // Suy từ Thần Thức nên khiên tự lên theo cảnh giới, không thành vô nghĩa ở Kết Đan
      expect(shield!.magnitude).toBe(Math.round(me.stats.thanThuc * action.magnitudeFromThanThuc))
    })

    it('khiên mạnh hơn hẳn khi cảnh giới cao hơn', () => {
      const slot = slotOf('kimQuangThuan')
      caster.tryCast(slot, HIGH, 999, ctx)
      runCast(caster, ctx)
      const high = me.effects.find('khien')!.magnitude

      const low = makeCombatant('player', 0, 0, START)
      const lowCaster = new SkillCaster(low, bus)
      lowCaster.tryCast(slot, HIGH, 999, ctx)
      runCast(lowCaster, ctx)
      expect(high).toBeGreaterThan(low.effects.find('khien')!.magnitude * 5)
    })
  })

  describe('Thiên Lôi Phù (pháp vực)', () => {
    it('gây sát thương cho địch trong vùng tại chỗ ngắm', () => {
      const foe = makeCombatant('enemy', 0, 6)
      world.add(foe)
      world.rebuildIndex()

      const before = foe.hp
      caster.tryCast(slotOf('thienLoiPhu'), HIGH, 999, { ...ctx, cursorX: 0, cursorZ: 6 })
      runCast(caster, ctx)
      expect(foe.hp).toBeLessThan(before)
    })

    it('KHÔNG gây sát thương cho địch ngoài vùng', () => {
      const near = makeCombatant('enemy', 0, 6)
      const far = makeCombatant('enemy', 0, 9.5)
      world.add(near)
      world.add(far)
      world.rebuildIndex()

      caster.tryCast(slotOf('thienLoiPhu'), HIGH, 999, { ...ctx, cursorX: 0, cursorZ: 6 })
      runCast(caster, ctx)
      expect(near.hp).toBeLessThan(near.stats.maxSinhLuc)
      expect(far.hp).toBe(far.stats.maxSinhLuc)
    })

    it('không đánh trúng đồng đội', () => {
      const ally = makeCombatant('ally', 0, 6)
      world.add(ally)
      world.rebuildIndex()
      caster.tryCast(slotOf('thienLoiPhu'), HIGH, 999, { ...ctx, cursorX: 0, cursorZ: 6 })
      runCast(caster, ctx)
      expect(ally.hp).toBe(ally.stats.maxSinhLuc)
    })

    it('KẸP về tầm tối đa thay vì mất chiêu khi ngắm quá xa', () => {
      // Người chơi nhắm hơi xa thì chiêu nên rơi ở xa nhất có thể, chứ không
      // nên biến mất — mất chiêu đọc ra là "game không nhận input"
      const events: GameEvents['skill:area'][] = []
      bus.on('skill:area', (e) => events.push(e))
      const slot = slotOf('thienLoiPhu')
      const action = SKILLS[slot]!.action
      if (action.type !== 'phapVuc') throw new Error('sai loại chiêu')

      caster.tryCast(slot, HIGH, 999, { ...ctx, cursorX: 0, cursorZ: 100 })
      runCast(caster, ctx)

      expect(events).toHaveLength(1)
      expect(Math.hypot(events[0]!.x, events[0]!.z)).toBeCloseTo(action.castRange, 3)
    })

    it('CHỐT điểm ngắm lúc bấm, không đọc lại lúc chiêu phát', () => {
      // Nếu đọc lại thì rê chuột trong lúc dẫn khí sẽ làm chiêu đi theo chuột,
      // và cảm giác điều khiển trở nên trơn tuột không có sức nặng
      const events: GameEvents['skill:area'][] = []
      bus.on('skill:area', (e) => events.push(e))

      caster.tryCast(slotOf('thienLoiPhu'), HIGH, 999, { ...ctx, cursorX: 0, cursorZ: 6 })
      // Rê chuột sang chỗ khác hoàn toàn trong lúc đang dẫn khí
      runCast(caster, { ...ctx, cursorX: -9, cursorZ: -9 })

      expect(events).toHaveLength(1)
      expect(events[0]!.z).toBeCloseTo(6, 3)
    })
  })

  describe('Băng Phong Phù', () => {
    it('đóng băng địch trong vùng', () => {
      const foe = makeCombatant('enemy', 0, 5)
      world.add(foe)
      world.rebuildIndex()
      caster.tryCast(slotOf('bangPhongPhu'), HIGH, 999, { ...ctx, cursorX: 0, cursorZ: 5 })
      runCast(caster, ctx)
      expect(foe.effects.has('dongBang')).toBe(true)
      expect(foe.effectiveSpeed()).toBe(0)
    })
  })

  describe('Phong Độn Thuật', () => {
    it('bật lướt và MIỄN THƯƠNG suốt cú lướt', () => {
      // Miễn thương chính là công dụng của chiêu: một nút né đòn, không phải
      // chỉ là đi nhanh
      caster.tryCast(slotOf('phongDon'), HIGH, 999, ctx)
      runCast(caster, ctx, 0.1)
      expect(caster.dash.active).toBe(true)
      expect(me.invuln).toBeGreaterThan(0)
      expect(Math.hypot(caster.dash.vx, caster.dash.vz)).toBeGreaterThan(0)
    })

    it('lướt kết thúc và vận tốc về 0', () => {
      caster.tryCast(slotOf('phongDon'), HIGH, 999, ctx)
      runCast(caster, ctx, 1)
      expect(caster.dash.active).toBe(false)
      expect(caster.dash.vx).toBe(0)
      expect(caster.dash.vz).toBe(0)
    })

    it('lướt đi theo hướng nhân vật đang nhìn', () => {
      me.facing = Math.PI / 2 // nhìn về +X
      caster.tryCast(slotOf('phongDon'), HIGH, 999, ctx)
      runCast(caster, ctx, 0.06)
      expect(caster.dash.vx).toBeGreaterThan(0)
      expect(Math.abs(caster.dash.vz)).toBeLessThan(Math.abs(caster.dash.vx) * 0.1)
    })
  })

  describe('phi hành khí', () => {
    it('Ngự Kiếm Thuật bắn ra một viên', () => {
      expect(projectiles.activeCount).toBe(0)
      caster.tryCast(slotOf('nguKiem'), HIGH, 999, ctx)
      runCast(caster, ctx, 0.3)
      expect(projectiles.activeCount).toBe(1)
    })
  })

  it('reset() xoá hết hồi chiêu và trạng thái lướt', () => {
    caster.tryCast(slotOf('nguKiem'), HIGH, 999, ctx)
    caster.reset()
    expect(caster.cooldownLeft(slotOf('nguKiem'))).toBe(0)
    expect(caster.isCasting).toBe(false)
    expect(caster.dash.active).toBe(false)
  })
})
