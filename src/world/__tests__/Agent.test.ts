import { Scene } from 'three'
import { beforeEach, describe, expect, it } from 'vitest'
import { EventBus } from '@/core/EventBus'
import type { GameEvents } from '@/core/events'
import { Rng } from '@/core/Rng'
import { unitDef, type BossPhase } from '@/game/data/units'
import { REALM, type RealmPosition } from '@/game/data/realms'
import { HAN_LAP_BASE } from '@/game/data/player'
import { deriveStats, type BaseStats } from '@/game/Stats'
import { Agent, type AgentContext } from '../Agent'
import { CollisionWorld } from '../Collision'
import { Combatant, type CombatantView, type Side } from '../Combatant'
import { CombatWorld } from '../CombatWorld'
import { ProjectileSystem } from '../Projectile'
import { Group } from 'three'

const flatGround = { heightAt: () => 0 }

const dummyBase: BaseStats = {
  sinhLuc: 900,
  linhLuc: 0,
  cong: 1,
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

const realm: RealmPosition = { major: REALM.KET_DAN, tier: 3 }

/**
 * Bao cát ĐÃ nằm trong world.
 *
 * Phải tự add vào world: `nearestHostile` chỉ tìm trong chỉ mục của CombatWorld,
 * nên một combatant chỉ tạo ra mà không add sẽ vô hình với mọi AI — và bài test
 * sẽ "qua" chỉ vì chẳng có gì đánh ai.
 *
 * Cảnh giới để cao và bằng nhau để luật chênh cảnh giới không làm nhiễu số đo.
 */
function dummyIn(world: CombatWorld, side: Side, x: number, z: number): Combatant {
  const c = new Combatant(side, deriveStats(dummyBase, realm), realm, 0.3, new FakeView())
  c.place(x, z, 0, 0)
  world.add(c)
  return c
}

const dt = 1 / 60

describe('Agent', () => {
  let bus: EventBus<GameEvents>
  let world: CombatWorld
  let ctx: AgentContext
  let phases: Array<{ index: number; phase: BossPhase }>

  beforeEach(() => {
    bus = new EventBus<GameEvents>()
    world = new CombatWorld(bus, new Rng(7))
    phases = []
    ctx = {
      world,
      collision: new CollisionWorld(),
      ground: flatGround,
      rng: new Rng(7),
      projectiles: new ProjectileSystem(new Scene(), world, new Rng(7), 16),
      onBossPhase: (_a, phase, index) => phases.push({ index, phase }),
    }
  })

  function make(id: string, x = 0, z = 0, side: Side = 'enemy'): Agent {
    const a = new Agent(unitDef(id), x, z, flatGround, new Rng(3), side)
    world.add(a.combatant)
    return a
  }

  function run(a: Agent, seconds: number): void {
    for (let i = 0; i < Math.round(seconds / dt); i++) {
      world.rebuildIndex()
      a.fixedUpdate(dt, ctx)
    }
  }

  describe('phe', () => {
    it('sinh ở phe ally thì KHÔNG coi người chơi là mục tiêu', () => {
      const ally = make('deTu', 0, 0, 'ally')
      const player = dummyIn(world, 'player', 1, 0)
      run(ally, 2)
      expect(player.hp).toBe(player.stats.maxSinhLuc)
    })

    it('cùng một def sinh ở phe enemy thì đánh người chơi', () => {
      const foe = make('deTu', 0, 0, 'enemy')
      const player = dummyIn(world, 'player', 1, 0)
      run(foe, 2)
      expect(player.hp).toBeLessThan(player.stats.maxSinhLuc)
    })

    it('đệ tử đồng môn đánh ma đạo', () => {
      const ally = make('deTu', 0, 0, 'ally')
      const foe = dummyIn(world, 'enemy', 1, 0)
      run(ally, 2)
      expect(foe.hp).toBeLessThan(foe.stats.maxSinhLuc)
    })
  })

  describe('trạng thái gắn vào đòn đánh', () => {
    it('Độc Thù dán trúng độc lên mục tiêu', () => {
      const foe = make('docThu', 0, 0)
      const player = dummyIn(world, 'player', 0.8, 0)
      run(foe, 2)
      expect(player.effects.has('trungDoc')).toBe(true)
    })

    it('Mặc Đại Phu làm chậm mục tiêu', () => {
      const boss = make('macDaiPhu', 0, 0)
      const player = dummyIn(world, 'player', 1.2, 0)
      run(boss, 2)
      expect(player.effects.has('chamLai')).toBe(true)
    })
  })

  describe('đánh xa', () => {
    it('ma đạo tán tu phóng phi hành khí, KHÔNG quét hình quạt', () => {
      let swings = 0
      bus.on('combat:swing', () => swings++)
      const caster = make('maDaoTanTu', 0, 0)
      // Đứng trong tầm bắn (8.5) nhưng ngoài mọi tầm cận chiến
      const player = dummyIn(world, 'player', 7, 0)
      run(caster, 3)

      expect(ctx.projectiles.activeCount).toBeGreaterThan(0)
      // Vệt chém ở đây sẽ nói dối người chơi rằng vừa có đòn cận chiến
      expect(swings).toBe(0)
      expect(player.hp).toBe(player.stats.maxSinhLuc) // phi phù còn đang bay
    })
  })

  describe('phase của tướng', () => {
    it('quái thường không có phase', () => {
      const foe = make('yeuThu')
      run(foe, 1)
      expect(foe.isBoss).toBe(false)
      expect(foe.phaseIndex).toBe(-1)
      expect(phases).toHaveLength(0)
    })

    it('tướng vào phase 0 ngay khi bắt đầu', () => {
      const boss = make('macDaiPhu')
      run(boss, 0.1)
      expect(boss.isBoss).toBe(true)
      expect(boss.phaseIndex).toBe(0)
      expect(phases.map((p) => p.index)).toEqual([0])
    })

    it('xuống dưới mốc sinh lực thì sang phase sau, mỗi phase báo đúng một lần', () => {
      const boss = make('macDaiPhu')
      run(boss, 0.1)
      const max = boss.combatant.stats.maxSinhLuc

      boss.combatant.hp = max * 0.6 // dưới 0.66
      run(boss, 0.1)
      expect(boss.phaseIndex).toBe(1)
      expect(boss.phase?.name).toBe('Khu thi')

      run(boss, 1) // chạy thêm: KHÔNG được báo lại
      expect(phases.filter((p) => p.index === 1)).toHaveLength(1)

      boss.combatant.hp = max * 0.2 // dưới 0.3
      run(boss, 0.1)
      expect(boss.phaseIndex).toBe(2)
      expect(boss.phase?.name).toBe('Huyết sát')
      expect(phases.map((p) => p.index)).toEqual([0, 1, 2])
    })

    it('phase KHÔNG lùi lại khi tướng được hồi máu', () => {
      // Cho lùi thì một lần hồi máu sẽ gọi thêm một lượt tay sai nữa, và sân đấu
      // đầy quái mà người chơi không hiểu vì sao
      const boss = make('macDaiPhu')
      const max = boss.combatant.stats.maxSinhLuc
      boss.combatant.hp = max * 0.2
      run(boss, 0.1)
      expect(boss.phaseIndex).toBe(2)

      boss.combatant.hp = max
      run(boss, 1)
      expect(boss.phaseIndex).toBe(2)
      expect(phases.filter((p) => p.index < 2)).toHaveLength(0)
    })

    it('phase sau đánh dồn hơn phase đầu', () => {
      function hitsIn(hpFraction: number, seconds: number): number {
        const local = new EventBus<GameEvents>()
        const w = new CombatWorld(local, new Rng(7))
        const c: AgentContext = { ...ctx, world: w, onBossPhase: () => {} }
        const boss = new Agent(unitDef('macDaiPhu'), 0, 0, flatGround, new Rng(3))
        w.add(boss.combatant)
        const victim = dummyIn(w, 'player', 1.2, 0)
        boss.combatant.hp = boss.combatant.stats.maxSinhLuc * hpFraction
        let hits = 0
        local.on('combat:hit', (e) => {
          if (!e.dot) hits++
        })
        for (let i = 0; i < Math.round(seconds / dt); i++) {
          w.rebuildIndex()
          // Giữ nguyên mốc sinh lực để không tự sang phase khác giữa phép đo
          boss.combatant.hp = boss.combatant.stats.maxSinhLuc * hpFraction
          victim.hp = victim.stats.maxSinhLuc
          boss.fixedUpdate(dt, c)
        }
        return hits
      }
      // 'Huyết sát' có cooldownMult 0.62 nên trong cùng thời gian phải ra nhiều
      // đòn hơn 'Đoạt xá' — kèm cả đòn quét vòng của phase đó
      expect(hitsIn(0.2, 8)).toBeGreaterThan(hitsIn(0.95, 8))
    })

    it('đòn quét vòng của phase cuối trúng cả mục tiêu ngoài tầm đánh thường', () => {
      const boss = make('macDaiPhu')
      // Ngoài tầm 2.1 nhưng trong bán kính quét 4.2
      const far = dummyIn(world, 'player', 3.6, 0)
      boss.combatant.hp = boss.combatant.stats.maxSinhLuc * 0.2

      let areas = 0
      bus.on('skill:area', (e) => {
        if (e.skillId === 'bossSlam') areas++
      })
      run(boss, 6)
      expect(areas).toBeGreaterThan(0)
      expect(far.hp).toBeLessThan(far.stats.maxSinhLuc)
    })

    it('đòn quét vòng KHÔNG đánh đồng bọn của tướng', () => {
      const boss = make('macDaiPhu')
      const minion = dummyIn(world, 'enemy', 2, 0)
      boss.combatant.hp = boss.combatant.stats.maxSinhLuc * 0.2
      run(boss, 6)
      expect(minion.hp).toBe(minion.stats.maxSinhLuc)
    })
  })

  describe('Ma Đạo Trúc Cơ — bài học chênh lệch cảnh giới', () => {
    /** Số nhát Hàn Lập ở cảnh giới `realm` cần để hạ một đơn vị. */
    function hitsToKill(unitId: string, playerRealm: RealmPosition): number {
      const bus2 = new EventBus<GameEvents>()
      const w = new CombatWorld(bus2, new Rng(1))
      const target = new Agent(unitDef(unitId), 0, 0, flatGround, new Rng(3))
      w.add(target.combatant)
      const player = new Combatant(
        'player',
        // Bạo kích 0: cần số xác định, không phải một phép đo may rủi
        deriveStats({ ...HAN_LAP_BASE, bao: 0 }, playerRealm),
        playerRealm,
        0.26,
        new FakeView(),
      )
      player.place(1, 0, 0, 0)
      w.add(player)

      let hits = 0
      while (!target.combatant.dead && hits < 5000) {
        w.rebuildIndex()
        target.combatant.invuln = 0
        w.strike(player, target.combatant, 1)
        hits++
      }
      return hits
    }

    const dinhLuyenKhi: RealmPosition = { major: REALM.LUYEN_KHI, tier: 12 }
    const soTrucCo: RealmPosition = { major: REALM.TRUC_CO, tier: 0 }

    it('MỘT lần đột phá làm nó dễ đi khoảng mười lần', () => {
      // Đây là mechanic đặc trưng nhất của PNTT, và là bài học của cả bản demo:
      // không farm thời gian để bù được một đại cảnh giới. Kiểm bằng CÙNG MỘT
      // con quái ở hai cảnh giới của người chơi — so với một con quái khác thì
      // số liệu bị lẫn cả chênh lệch sinh lực và phòng ngự của hai con.
      const before = hitsToKill('maDaoTrucCo', dinhLuyenKhi)
      const after = hitsToKill('maDaoTrucCo', soTrucCo)
      expect(before / after).toBeGreaterThan(8)
    })

    it('ở đỉnh Luyện Khí là một bức tường, ở Trúc Cơ là một trận đánh được', () => {
      // Bức tường phải TAN sau khi đột phá. Nếu không thì nó không còn là bài
      // học mà là một cánh cửa khoá.
      expect(hitsToKill('maDaoTrucCo', dinhLuyenKhi)).toBeGreaterThan(100)
      expect(hitsToKill('maDaoTrucCo', soTrucCo)).toBeLessThan(30)
    })

    it('so với quái cùng cảnh giới thì tốn hơn hai chục lần số nhát', () => {
      const sameRealm = hitsToKill('maDaoTanTu', dinhLuyenKhi)
      const oneUp = hitsToKill('maDaoTrucCo', dinhLuyenKhi)
      expect(oneUp / sameRealm).toBeGreaterThan(15)
    })

    it('Mặc Đại Phu bất khả thi ở Luyện Khí, và là một trận thật ở Trúc Cơ', () => {
      expect(hitsToKill('macDaiPhu', dinhLuyenKhi)).toBeGreaterThan(300)
      const atTrucCo = hitsToKill('macDaiPhu', soTrucCo)
      expect(atTrucCo).toBeGreaterThan(30)
      expect(atTrucCo).toBeLessThan(150)
    })

    it('cả hai tướng đều ở đại cảnh giới cao hơn Luyện Khí', () => {
      for (const id of ['maDaoTrucCo', 'macDaiPhu']) {
        expect(unitDef(id).realm.major).toBeGreaterThan(REALM.LUYEN_KHI)
      }
    })
  })
})
