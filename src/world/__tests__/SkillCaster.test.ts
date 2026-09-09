import { Group, Scene } from 'three'
import { beforeEach, describe, expect, it } from 'vitest'
import { EventBus } from '@/core/EventBus'
import type { GameEvents } from '@/core/events'
import { Rng } from '@/core/Rng'
import { REALM, type RealmPosition } from '@/game/data/realms'
import { SKILLS, skillDef } from '@/game/data/skills'
import { deriveStats, type BaseStats } from '@/game/Stats'
import { Combatant, type CombatantView, type Side } from '../Combatant'
import { CombatWorld } from '../CombatWorld'
import { ProjectileSystem } from '../Projectile'
import { SwordStorm } from '../SwordStorm'
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
/** Đỉnh thang — mở được cả những chiêu Nguyên Anh. */
const TOP: RealmPosition = { major: REALM.NGUYEN_ANH, tier: 3 }
const START: RealmPosition = { major: REALM.LUYEN_KHI, tier: 0 }

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
  let swords: SwordStorm
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
    swords = new SwordStorm(new Scene(), world, bus)
    ctx = { world, projectiles, swords, cursorX: 0, cursorZ: 0 }
  })

  describe('cổng mở theo cảnh giới', () => {
    it('lúc mới nhập môn chỉ mở được chiêu đầu tiên', () => {
      // Đây là phần thưởng cụ thể của việc tu luyện: đột phá thì mở chiêu mới
      expect(caster.isUnlocked('nguKiem', START)).toBe(true)
      expect(caster.isUnlocked('thienLoiPhu', START)).toBe(false)
      expect(caster.isUnlocked('bangPhongPhu', START)).toBe(false)
    })

    it('cảnh giới cao thì mở hết', () => {
      for (const def of SKILLS) {
        expect(caster.isUnlocked(def.id, TOP), def.name).toBe(true)
      }
    })

    it('từ chối thi triển chiêu chưa mở, và NÓI RÕ lý do', () => {
      const r = caster.tryCast('thienLoiPhu', START, 999, ctx)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.reason).toMatch(/cảnh giới/)
    })
  })

  describe('linh lực và hồi chiêu', () => {
    it('từ chối khi không đủ linh lực', () => {
      const r = caster.tryCast('nguKiem', HIGH, 0, ctx)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.reason).toMatch(/linh lực/i)
    })

    it('trả về đúng giá linh lực để bên gọi trừ', () => {
      const slot = 'nguKiem'
      const r = caster.tryCast(slot, HIGH, 999, ctx)
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.cost).toBe(skillDef(slot).linhLucCost)
    })

    it('bật hồi chiêu ngay lúc bấm, không đợi chiêu phát', () => {
      // Đợi tới lúc phát mới bật thì người chơi bấm dồn sẽ phát nhiều lần
      const slot = 'nguKiem'
      caster.tryCast(slot, HIGH, 999, ctx)
      expect(caster.cooldownLeft(slot)).toBeGreaterThan(0)
    })

    it('không thi triển lại được khi đang hồi', () => {
      const slot = 'nguKiem'
      caster.tryCast(slot, HIGH, 999, ctx)
      runCast(caster, ctx, 0.6)
      const r = caster.tryCast(slot, HIGH, 999, ctx)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.reason).toMatch(/đang hồi/)
    })

    it('hồi xong thì thi triển lại được', () => {
      const slot = 'nguKiem'
      caster.tryCast(slot, HIGH, 999, ctx)
      runCast(caster, ctx, skillDef(slot).cooldown + 0.3)
      expect(caster.cooldownLeft(slot)).toBe(0)
      expect(caster.tryCast(slot, HIGH, 999, ctx).ok).toBe(true)
    })

    it('không thi triển chiêu khác khi đang thi triển', () => {
      caster.tryCast('nguKiem', HIGH, 999, ctx)
      const r = caster.tryCast('hoaCau', HIGH, 999, ctx)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.reason).toMatch(/đang thi triển/i)
    })

    it('bị đóng băng thì không thi triển được', () => {
      me.effects.apply('dongBang', 2, 0)
      const r = caster.tryCast('nguKiem', HIGH, 999, ctx)
      expect(r.ok).toBe(false)
    })

    it('noCooldown: thi triển lại được ngay khi vừa thu thế xong', () => {
      // Chế độ trình diễn để XEM chiêu — chờ hồi 22 giây của Thanh Trúc Phong
      // Vân Kiếm ở đó là chờ vô nghĩa
      const slot = 'thanhTrucPhongVan'
      caster.noCooldown = true

      caster.tryCast(slot, HIGH, 999, ctx)
      expect(caster.cooldownLeft(slot)).toBe(0)

      const def = skillDef(slot)
      runCast(caster, ctx, def.castTime + def.recover + 0.1)
      expect(caster.isCasting).toBe(false)
      expect(caster.tryCast(slot, HIGH, 999, ctx).ok).toBe(true)
    })

    it('noCooldown vẫn KHÔNG cho chiêu chồng lên nhau', () => {
      // Cổng chống chồng chiêu là `phase`, không phải hồi chiêu — bỏ hồi chiêu
      // không được phép biến showreel thành một tràng chiêu đè lên nhau
      caster.noCooldown = true
      caster.tryCast('nguKiem', HIGH, 999, ctx)
      const r = caster.tryCast('hoaCau', HIGH, 999, ctx)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.reason).toMatch(/đang thi triển/i)
    })

    it('bị choáng GIỮA lúc dẫn khí thì chiêu bị phá, nhưng vẫn mất hồi chiêu', () => {
      // Nếu không mất hồi chiêu thì bị đánh gián đoạn lại thành có lợi
      const slot = 'hoaCau'
      caster.tryCast(slot, HIGH, 999, ctx)
      me.stagger = 0.5
      caster.fixedUpdate(1 / 60, ctx)
      expect(caster.isCasting).toBe(false)
      expect(caster.cooldownLeft(slot)).toBeGreaterThan(0)
    })
  })

  describe('Kim Quang Thuẫn', () => {
    it('dựng khiên với độ mạnh suy từ Thần Thức', () => {
      const slot = 'kimQuangThuan'
      const action = skillDef(slot).action
      if (action.type !== 'hoTro') throw new Error('sai loại chiêu')
      const perThanThuc = action.magnitudeFromThanThuc
      if (!perThanThuc) throw new Error('Kim Quang Thuẫn phải suy độ mạnh từ Thần Thức')

      caster.tryCast(slot, HIGH, 999, ctx)
      runCast(caster, ctx)

      const shield = me.effects.find('khien')
      expect(shield).toBeDefined()
      // Suy từ Thần Thức nên khiên tự lên theo cảnh giới, không thành vô nghĩa ở Kết Đan
      expect(shield!.magnitude).toBe(Math.round(me.stats.thanThuc * perThanThuc))
    })

    it('khiên mạnh hơn hẳn khi cảnh giới cao hơn', () => {
      const slot = 'kimQuangThuan'
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
      caster.tryCast('thienLoiPhu', HIGH, 999, { ...ctx, cursorX: 0, cursorZ: 6 })
      runCast(caster, ctx)
      expect(foe.hp).toBeLessThan(before)
    })

    it('KHÔNG gây sát thương cho địch ngoài vùng', () => {
      const near = makeCombatant('enemy', 0, 6)
      const far = makeCombatant('enemy', 0, 9.5)
      world.add(near)
      world.add(far)
      world.rebuildIndex()

      caster.tryCast('thienLoiPhu', HIGH, 999, { ...ctx, cursorX: 0, cursorZ: 6 })
      runCast(caster, ctx)
      expect(near.hp).toBeLessThan(near.stats.maxSinhLuc)
      expect(far.hp).toBe(far.stats.maxSinhLuc)
    })

    it('không đánh trúng đồng đội', () => {
      const ally = makeCombatant('ally', 0, 6)
      world.add(ally)
      world.rebuildIndex()
      caster.tryCast('thienLoiPhu', HIGH, 999, { ...ctx, cursorX: 0, cursorZ: 6 })
      runCast(caster, ctx)
      expect(ally.hp).toBe(ally.stats.maxSinhLuc)
    })

    it('KẸP về tầm tối đa thay vì mất chiêu khi ngắm quá xa', () => {
      // Người chơi nhắm hơi xa thì chiêu nên rơi ở xa nhất có thể, chứ không
      // nên biến mất — mất chiêu đọc ra là "game không nhận input"
      const events: GameEvents['skill:area'][] = []
      bus.on('skill:area', (e) => events.push(e))
      const slot = 'thienLoiPhu'
      const action = skillDef(slot).action
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

      caster.tryCast('thienLoiPhu', HIGH, 999, { ...ctx, cursorX: 0, cursorZ: 6 })
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
      caster.tryCast('bangPhongPhu', HIGH, 999, { ...ctx, cursorX: 0, cursorZ: 5 })
      runCast(caster, ctx)
      expect(foe.effects.has('dongBang')).toBe(true)
      expect(foe.effectiveSpeed()).toBe(0)
    })
  })

  describe('Phong Độn Thuật', () => {
    it('bật lướt và MIỄN THƯƠNG suốt cú lướt', () => {
      // Miễn thương chính là công dụng của chiêu: một nút né đòn, không phải
      // chỉ là đi nhanh
      caster.tryCast('phongDon', HIGH, 999, ctx)
      runCast(caster, ctx, 0.1)
      expect(caster.dash.active).toBe(true)
      expect(me.invuln).toBeGreaterThan(0)
      expect(Math.hypot(caster.dash.vx, caster.dash.vz)).toBeGreaterThan(0)
    })

    it('lướt kết thúc và vận tốc về 0', () => {
      caster.tryCast('phongDon', HIGH, 999, ctx)
      runCast(caster, ctx, 1)
      expect(caster.dash.active).toBe(false)
      expect(caster.dash.vx).toBe(0)
      expect(caster.dash.vz).toBe(0)
    })

    it('không bấm hướng nào thì lướt theo hướng đang nhìn', () => {
      me.facing = Math.PI / 2 // nhìn về +X
      caster.tryCast('phongDon', HIGH, 999, ctx)
      runCast(caster, ctx, 0.06)
      expect(caster.dash.vx).toBeGreaterThan(0)
      expect(Math.abs(caster.dash.vz)).toBeLessThan(Math.abs(caster.dash.vx) * 0.1)
    })

    it('lướt theo HƯỚNG ĐANG ĐI, không theo hướng đang nhìn', () => {
      // Bắt buộc từ khi có tự ngắm: ở chế độ đó hướng nhìn LUÔN chỉ vào con
      // quái, mà Phong Độn Thuật là nút NÉ ĐÒN. Lướt thẳng vào con vừa vung đòn
      // thì nó thành nút tự sát, đúng lúc người chơi bấm nó để thoát.
      me.facing = 0 // nhìn về +Z
      const away = { ...ctx, dashDirX: 0, dashDirZ: -1 } // bấm lùi về -Z
      caster.tryCast('phongDon', HIGH, 999, away)
      runCast(caster, away, 0.06)
      expect(caster.dash.vz).toBeLessThan(0)
      expect(Math.abs(caster.dash.vx)).toBeLessThan(Math.abs(caster.dash.vz) * 0.1)
    })

    it('hướng đi được chuẩn hoá — bấm chéo không lướt xa hơn bấm thẳng', () => {
      const straight = { ...ctx, dashDirX: 0, dashDirZ: 1 }
      caster.tryCast('phongDon', HIGH, 999, straight)
      runCast(caster, straight, 0.06)
      const speedStraight = Math.hypot(caster.dash.vx, caster.dash.vz)

      caster.reset()
      // Vector chéo chưa chuẩn hoá, độ dài ~1.41
      const diagonal = { ...ctx, dashDirX: 1, dashDirZ: 1 }
      caster.tryCast('phongDon', HIGH, 999, diagonal)
      runCast(caster, diagonal, 0.06)
      const speedDiagonal = Math.hypot(caster.dash.vx, caster.dash.vz)

      expect(speedDiagonal).toBeCloseTo(speedStraight, 4)
    })
  })

  describe('ba chiêu đặc trưng — Giá Y, Thực Kim Trùng, Đại Diễn', () => {
    it('Giá Y Thần Công đốt đúng 18% sinh lực tối đa và lên trạng thái', () => {
      const slot = 'giaYThanCong'
      const action = skillDef(slot).action
      if (action.type !== 'hoTro') throw new Error('sai loại chiêu')
      const hpTruoc = me.hp

      caster.tryCast(slot, HIGH, 999, ctx)
      runCast(caster, ctx)

      const burn = Math.round(me.stats.maxSinhLuc * (action.sinhLucCostFrac ?? 0))
      expect(burn).toBeGreaterThan(0)
      expect(me.hp).toBe(hpTruoc - burn)
      expect(me.effects.find('giaY')?.magnitude).toBe(action.magnitudeFlat)
    })

    it('Giá Y Thần Công không bao giờ tự giết người thi triển', () => {
      // Một chiêu mà bấm lúc gần chết là chết luôn thì đọc ra là lỗi game, không
      // phải là "cái giá phải trả" — và người chơi không có cách nào biết trước
      me.hp = 2
      caster.tryCast('giaYThanCong', HIGH, 999, ctx)
      runCast(caster, ctx)
      expect(me.hp).toBeGreaterThanOrEqual(1)
      expect(me.dead).toBe(false)
      expect(me.effects.has('giaY')).toBe(true)
    })

    it('Giá Y Thần Công KHÔNG suy tỉ lệ theo Thần Thức', () => {
      // Suy theo Thần Thức thì tới Kết Đan nó thành cộng vài nghìn phần trăm.
      // Cảnh giới mở chiêu (hậu kỳ Luyện Khí) so với Kết Đan là chênh 8 lần
      // thần thức, nên nếu có nhân theo thần thức thì hai số này không thể bằng.
      const MO_CHIEU: RealmPosition = { major: REALM.LUYEN_KHI, tier: 9 }
      caster.tryCast('giaYThanCong', HIGH, 999, ctx)
      runCast(caster, ctx)
      const cao = me.effects.find('giaY')!.magnitude

      const thapNguoi = makeCombatant('player', 0, 0, MO_CHIEU)
      const thap = new SkillCaster(thapNguoi, bus)
      thap.tryCast('giaYThanCong', MO_CHIEU, 999, ctx)
      runCast(thap, ctx)

      expect(thapNguoi.stats.thanThuc).toBeLessThan(me.stats.thanThuc / 4)
      expect(thapNguoi.effects.find('giaY')!.magnitude).toBe(cao)
    })

    it('Thực Kim Trùng gieo độc mạnh theo CÔNG, không phải một hằng số', () => {
      const slot = 'thucKimTrung'
      const action = skillDef(slot).action
      if (action.type !== 'phapVuc' || !action.onHit) throw new Error('sai loại chiêu')
      const foe = makeCombatant('enemy', 0, 5)
      world.add(foe)
      world.rebuildIndex()

      caster.tryCast(slot, HIGH, 999, { ...ctx, cursorX: 0, cursorZ: 5 })
      runCast(caster, { ...ctx, cursorX: 0, cursorZ: 5 })

      const doc = foe.effects.find('trungDoc')
      expect(doc).toBeDefined()
      const mong = Math.round(
        action.onHit.magnitude + me.stats.cong * (action.onHit.magnitudeFromCong ?? 0),
      )
      expect(doc!.magnitude).toBe(mong)
      // Và phần suy từ công phải là phần LỚN, nếu không thì nó vẫn là hằng số
      expect(mong).toBeGreaterThan(action.onHit.magnitude * 2)
    })

    it('Đại Diễn Quyết làm Kim Quang Thuẫn mạnh thêm 50%', () => {
      const shieldSlot = 'kimQuangThuan'
      caster.tryCast(shieldSlot, HIGH, 999, ctx)
      runCast(caster, ctx)
      const thuong = me.effects.find('khien')!.magnitude
      me.effects.clear()

      const boost = new SkillCaster(me, bus)
      boost.tryCast('daiDienQuyet', HIGH, 999, ctx)
      runCast(boost, ctx)
      const daiDien = me.effects.find('daiDien')!.magnitude
      boost.tryCast(shieldSlot, HIGH, 999, ctx)
      runCast(boost, ctx)

      expect(me.effects.find('khien')!.magnitude).toBe(Math.round(thuong * (1 + daiDien)))
    })
  })

  describe('phi hành khí', () => {
    it('Ngự Kiếm Thuật bắn ra một viên', () => {
      expect(projectiles.activeCount).toBe(0)
      caster.tryCast('nguKiem', HIGH, 999, ctx)
      runCast(caster, ctx, 0.3)
      expect(projectiles.activeCount).toBe(1)
    })
  })

  it('reset() xoá hết hồi chiêu và trạng thái lướt', () => {
    caster.tryCast('nguKiem', HIGH, 999, ctx)
    caster.reset()
    expect(caster.cooldownLeft('nguKiem')).toBe(0)
    expect(caster.isCasting).toBe(false)
    expect(caster.dash.active).toBe(false)
  })
})
