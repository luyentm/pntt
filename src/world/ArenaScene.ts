import { Mesh, PointLight, Vector3, type BufferGeometry, type Object3D } from 'three'
import { canCraft, craft } from '@/game/Alchemy'
import { clearSave, saveGame, type SaveData, type SaveStorage } from '@/game/SaveGame'
import { ShowcaseDirector, type ShowcaseActions } from '@/game/ShowcaseDirector'
import { WaveDirector, type WaveActions } from '@/game/WaveDirector'
import { BreakthroughTrial, type TrialOutcome } from '@/game/BreakthroughTrial'
import { unitDef, type BossPhase } from '@/game/data/units'
import { rollDrops, tuViReward } from '@/game/data/dropTables'
import { itemDef } from '@/game/data/items'
import { REALM, majorRealm } from '@/game/data/realms'
import { recipeById } from '@/game/data/recipes'
import { BossBar } from '@/ui/BossBar'
import { ShowcasePanel } from '@/ui/ShowcasePanel'
import { Hud } from '@/ui/Hud'
import { KeyHints } from '@/ui/KeyHints'
import { SkillBar } from '@/ui/SkillBar'
import { TrialOverlay } from '@/ui/TrialOverlay'
import { WaveBanner } from '@/ui/WaveBanner'
import { WorldBars } from '@/ui/WorldBars'
import { AlchemyPanel, type AlchemyHost } from '@/ui/panels/AlchemyPanel'
import { CultivationPanel, type CultivationHost } from '@/ui/panels/CultivationPanel'
import { InventoryPanel, type InventoryHost } from '@/ui/panels/InventoryPanel'
import type { Panel } from '@/ui/panels/Panel'
import { Vfx } from '@/vfx/Vfx'
import { Crowd } from './Crowd'
import { PickupSystem } from './Pickups'
import { SwordStorm } from './SwordStorm'
import { CombatWorld } from './CombatWorld'
import { ProjectileSystem } from './Projectile'
import { Agent, type AgentContext } from './Agent'
import type { Combatant, Side } from './Combatant'
import { Palette } from '@/art/Palette'
import { PropBatch } from '@/art/PropBatch'
import { buildBoulder, buildGroundMarker, buildStoneFloor, buildTargetMarker } from '@/art/props/nature'
import { bambooGeometry, pineGeometry, rockGeometry } from '@/art/props/geometries'
import {
  buildAlchemyAltar,
  buildSectGate,
  buildStoneLantern,
  buildStonePillar,
} from '@/art/props/sect'
import { materials } from '@/render/Materials'
import { CollisionWorld, type StaticBody } from './Collision'
import { Player } from './Player'
import { START_REALM } from '@/game/data/player'
import { Terrain } from './Terrain'
import type { GameScene, SceneContext, SceneDebugActions } from './Scene'

const FLOOR_RADIUS = 6.2
const PILLAR_RING = 9.2
const LANTERN_RING = 7.4
const GATE_DISTANCE = 15

/**
 * Khe hở tối thiểu giữa hai vật cản, tính bằng world unit.
 * Phải lớn hơn ĐƯỜNG KÍNH nhân vật (0.52) để không bao giờ sinh ra cái khe mà
 * người chơi lách vào rồi kẹt cứng — đó là cách phòng thật sự cho trường hợp
 * kẹt sâu mà CollisionWorld.resolve() không giải hết trong một frame.
 */
const MIN_PASSAGE = 0.8

/**
 * Giãn cách tự lưu, giây.
 *
 * Có tự lưu theo thời gian BÊN CẠNH lưu theo mốc quan trọng (lên tầng, đột phá,
 * dẹp xong đợt): nếu chỉ lưu theo mốc thì một người chơi cày Tu Vi mười phút mà
 * chưa lên tầng nào, đóng tab là mất trắng cả mười phút đó.
 */
const AUTO_SAVE_SECONDS = 25

/** Số quái nền muốn giữ quanh rừng. */
const AMBIENT_TARGET = 10
/**
 * Giãn cách hồi sinh quái nền, giây.
 *
 * Có hồi sinh vì nếu không thì sau khi dọn 10 con đầu là hết hẳn thứ để cày
 * giữa hai đợt — mà "chuẩn bị giữa hai đợt" chính là chỗ vòng lặp tu luyện của
 * M5 sống. Nhưng CHỈ hồi sinh khi không có đợt nào đang chạy: thêm quái vào
 * giữa một đợt vừa làm loãng độ khó vừa làm điều kiện dẹp xong khó đọc.
 */
const AMBIENT_RESPAWN = 7

/** Sơn môn Thất Huyền Môn: cổng phái, luyện võ trường, đài luyện đan, rừng tùng và bụi tre. */
export class ArenaScene implements GameScene {
  readonly name = 'Thất Huyền Môn — Luyện võ trường'

  readonly collision = new CollisionWorld()
  terrain!: Terrain
  player!: Player
  combat!: CombatWorld
  projectiles!: ProjectileSystem
  readonly agents: Agent[] = []

  pickups!: PickupSystem
  /** Thanh Trúc Phong Vân Kiếm — 33 thanh trong một InstancedMesh. */
  swords!: SwordStorm
  /** Bộ điều phối "Thất Huyền Môn thủ trận". */
  readonly director = new WaveDirector()
  /** Bộ điều phối chế độ trình diễn thần thông. */
  readonly showcase = new ShowcaseDirector()
  /** Đang ở chế độ trình diễn. */
  demoMode = false
  /** Tổng thời gian đã chơi của lượt này, giây. */
  playTime = 0
  /** Chỗ lưu. main gán localStorage vào; test gán bản giả. */
  storage: SaveStorage | null = null

  private ctx!: SceneContext
  private readonly objects: Object3D[] = []
  private marker?: Mesh
  private targetMarker?: Mesh
  private readonly cursor = new Vector3()
  private vfx!: Vfx
  private hud!: Hud
  private skillBar!: SkillBar
  private bars!: WorldBars
  private hints!: KeyHints
  private agentCtx!: AgentContext
  private lastHp = -1
  private lastMp = -1
  private respawnTimer = 0
  private godMode = false

  /** Màn thử dẫn khí khi đột phá — chỉ có một, do màn điều khiển. */
  private readonly trial = new BreakthroughTrial()
  private trialUi!: TrialOverlay
  private culPanel!: CultivationPanel
  private invPanel!: InventoryPanel
  private alcPanel!: AlchemyPanel
  private panels: Panel[] = []

  /**
   * Id những con đã trả thưởng.
   *
   * Cần vì `dead` còn đúng suốt mấy giây diễn cảnh chết: không đánh dấu thì mỗi
   * bước fixed lại rơi thêm một lượt vật phẩm, và người chơi nhận hàng trăm Tu
   * Vi từ một con quái. Id được dọn trong reap() nên tập này không phình mãi.
   */
  private readonly rewarded = new Set<number>()

  /** Còn bấy nhiêu giây nữa thì tự lưu. */
  private autoSaveTimer = AUTO_SAVE_SECONDS
  private ambientTimer = AMBIENT_RESPAWN
  private crowd!: Crowd
  private showcasePanel!: ShowcasePanel
  private readonly showcaseActions: ShowcaseActions = {
    cast: (slot) => {
      const p = this.player
      // Xoá hồi chiêu của ĐÚNG ô này rồi mới gọi: showreel phải diễn được cả
      // Thanh Trúc Phong Vân Kiếm (hồi 22 giây) trong một bước 9 giây
      p.caster.clearCooldown(slot)
      p.castSlot(slot, this.combat, this.projectiles, this.swords)
    },
    melee: () => this.player.triggerAttack(),
    setFlight: (on) => this.player.setFlying(on),
    setMeditate: (on) => this.player.setMeditating(on),
    breakthroughFx: () => {
      const p = this.player
      this.ctx.bus.emit('cultivation:breakthrough', {
        success: true,
        realmName: p.cultivation.name,
        chance: 1,
        x: p.pos.x,
        y: p.y,
        z: p.pos.z,
      })
    },
    refreshDummies: () => this.spawnDummies(),
    announce: (step, index, total) => this.showcasePanel.setStep(step, index, total),
  }
  private bossBar!: BossBar
  private banner!: WaveBanner
  /** Tướng của đợt hiện tại, nếu đang có. */
  private boss: Agent | null = null
  private readonly waveActions: WaveActions = {
    spawnGroup: (group) => {
      for (let i = 0; i < group.count; i++) {
        const p = this.ctx.rng.inAnnulus(group.ringMin, group.ringMax)
        const agent = this.spawnAgent(group.id, p.x, p.z, this.ctx.rng)
        agent.waveTag = true
        if (agent.isBoss) this.setBoss(agent)
      }
    },
    spawnAllies: (count) => {
      for (let i = 0; i < count; i++) {
        // Sinh ở phía cổng phái: đệ tử đi từ trong sơn môn ra, không từ trên trời
        const p = this.ctx.rng.inAnnulus(2, 5)
        this.spawnAgent('deTu', p.x, GATE_DISTANCE - 4 + p.z, this.ctx.rng, 'ally')
      }
    },
    clearEnemies: () => {
      for (const agent of this.agents) {
        if (agent.combatant.side !== 'enemy' || agent.combatant.dead) continue
        // Xoá thẳng, KHÔNG qua strike(): đây là dọn sân sau một đợt thất bại,
        // không phải người chơi hạ được chúng — trả thưởng ở đây là cho Tu Vi
        // miễn phí mỗi lần chết
        agent.combatant.dead = true
        agent.combatant.deadFor = 99
        this.rewarded.add(agent.combatant.id)
      }
      this.setBoss(null)
    },
    announce: (text, kind) => {
      const wave = this.director.current
      if (kind === 'wave') this.banner.flash(wave?.name ?? 'Khởi trận', text, 2.4, 'wave')
      else this.ctx.bus.emit('toast', { text, kind: kind === 'good' ? 'good' : 'bad' })
    },
    bossWave: (unitId) => {
      if (unitId === null) this.setBoss(null)
    },
  }

  /** Điều khiển debug — bảng lil-gui đọc từ đây. */
  readonly debug: SceneDebugActions = {
    spawnEnemies: (id, count) => {
      for (let i = 0; i < count; i++) {
        // Sinh quanh người chơi nhưng chừa khoảng để không đè lên đầu
        const p = this.ctx.rng.inAnnulus(4, 11)
        this.spawnAgent(id, this.player.pos.x + p.x, this.player.pos.z + p.z, this.ctx.rng)
      }
    },
    killAllEnemies: () => {
      for (const agent of this.agents) {
        if (agent.combatant.dead) continue
        this.combat.strike(this.player.combatant, agent.combatant, 99999)
      }
    },
    healPlayer: () => {
      const me = this.player.combatant
      me.hp = me.stats.maxSinhLuc
      this.player.linhLuc = me.stats.maxLinhLuc
    },
    setGodMode: (on) => {
      this.godMode = on
    },
    enemyCount: () => this.agents.length,
    aliveEnemyCount: () => this.combat.countAlive('enemy'),
    addTuVi: (amount) => {
      this.player.gainTuVi(amount)
    },
    giveItem: (id, count) => {
      this.player.inventory.add(id, count)
      this.ctx.bus.emit('toast', { text: `+${count} ${itemDef(id).name}`, kind: 'good' })
    },
    jumpToMajor: (major) => {
      // Bỏ qua cả đan dược lẫn phép roll — đây là công cụ để tôi kiểm tra cân
      // bằng ở Trúc Cơ / Kết Đan, không phải một đường chơi
      const realm = this.player.cultivation.realm
      realm.major = major
      realm.tier = 0
      this.player.cultivation.tuVi = 0
      this.player.refreshStats()
      this.ctx.bus.emit('cultivation:breakthrough', {
        success: true,
        realmName: this.player.cultivation.name,
        chance: 1,
        x: this.player.pos.x,
        y: this.player.y,
        z: this.player.pos.z,
      })
    },
    realmLabel: () => this.player.cultivation.name,
    startWave: () => {
      this.director.start(this.waveActions)
    },
    jumpToWave: (index) => {
      // Dọn sạch đợt đang chạy trước, nếu không thì quái của đợt cũ trộn vào đợt
      // mới và không đợt nào kết thúc được
      this.waveActions.clearEnemies()
      this.director.state = 'cleared'
      this.director.index = Math.max(0, Math.min(this.director.total - 1, index))
      this.director.start(this.waveActions)
    },
    waveLabel: () => `${this.director.index + 1}/${this.director.total} · ${this.director.state}`,
  }

  load(ctx: SceneContext): void {
    this.ctx = ctx
    const { three, rng, camera } = ctx

    this.terrain = new Terrain(rng, {
      size: 240,
      segments: 72,
      flatRadius: 11,
      rollRadius: 46,
      amplitude: 5.5,
    })
    this.add(this.terrain.mesh)
    this.add(buildStoneFloor(FLOOR_RADIUS))

    this.placeArchitecture(rng)
    this.placeVegetation(rng)

    this.player = new Player()
    this.player.setGround(this.terrain)
    // Xuất hiện ở cổng phái, mặt hướng vào luyện võ trường
    this.player.spawn(0, GATE_DISTANCE - 5, Math.PI)
    this.add(this.player.chibi.root)

    this.marker = buildGroundMarker(0.52)
    this.add(this.marker)
    this.targetMarker = buildTargetMarker(0.6)
    this.targetMarker.visible = false
    this.add(this.targetMarker)

    this.combat = new CombatWorld(ctx.bus, rng)
    this.combat.add(this.player.combatant)
    this.player.attachBus(ctx.bus)
    this.projectiles = new ProjectileSystem(three, this.combat, rng)
    this.swords = new SwordStorm(three, this.combat, ctx.bus)

    this.agentCtx = {
      world: this.combat,
      collision: this.collision,
      ground: this.terrain,
      rng,
      projectiles: this.projectiles,
      onBossPhase: (agent, phase, index) => this.onBossPhase(agent, phase, index),
    }

    this.pickups = new PickupSystem(three)
    // Vật phẩm vào túi ngay khi bị hút tới — hệ vật phẩm không biết Player tồn tại
    this.pickups.onCollect = (id, count) => {
      this.player.inventory.add(id, count)
      ctx.bus.emit('item:pickup', { id, count })
      const def = itemDef(id)
      this.vfx.floats.spawn(
        this.player.pos.x,
        this.player.y + 1.5,
        this.player.pos.z,
        `${def.name} ×${count}`,
        'info',
      )
    }

    const uiRoot = document.getElementById('ui-root')
    if (!uiRoot) throw new Error('ArenaScene: thiếu #ui-root')
    this.vfx = new Vfx(three, uiRoot, ctx.bus, rng)
    this.hud = new Hud(uiRoot, ctx.bus)
    this.hud.setRealm(this.player.realm)
    this.skillBar = new SkillBar(uiRoot, ctx.bus)
    this.bars = new WorldBars(uiRoot)
    this.hints = new KeyHints(uiRoot)
    this.bossBar = new BossBar(uiRoot)
    this.banner = new WaveBanner(uiRoot)
    this.showcasePanel = new ShowcasePanel(uiRoot)
    // Bấm vào một dòng trong danh sách là nhảy tới chiêu đó, và CHUYỂN sang tự
    // chơi: người chơi vừa chọn tay thì họ muốn xem cái đó, không muốn showreel
    // lôi đi sau vài giây
    this.showcasePanel.onPick = (index) => {
      this.showcase.jumpTo(index, this.showcaseActions)
      this.showcase.playing = false
      this.showcasePanel.setPlaying(false)
    }
    this.buildPanels(uiRoot)

    // Lớp quân hậu cảnh: đệ tử Thất Huyền Môn chống ma đạo ở vòng ngoài.
    // Đặt ở phía -X, đối diện cổng phái (cổng ở +Z), nên khi người chơi từ cổng
    // tiến vào sân là đang tiến VỀ PHÍA trận đánh.
    this.crowd = new Crowd(
      three,
      [
        { robe: Palette.aoDeTu, trim: Palette.vienAo, skin: Palette.daNguoi },
        { robe: Palette.aoMaDao, trim: Palette.maHuyet, skin: 0xd8bfa0 },
      ],
      64,
    )
    // Vòng 32–43 và cung hẹp: đây là chỗ ĐỌC ĐƯỢC. Rải 58 cặp trên nửa vòng
    // rộng 34–52 thì mật độ quá thấp, từ trong sân nhìn ra chỉ thấy vài cái đốm
    // — mà cảm giác "đại chiến" đến từ MẬT ĐỘ, không từ diện tích. Vẫn nằm ngoài
    // vòng sinh quái của đợt (tối đa 30) nên không ai nhầm chúng là mục tiêu.
    this.crowd.layout(rng, this.terrain, {
      radiusMin: 32,
      radiusMax: 43,
      arcFrom: Math.PI * 0.74,
      arcTo: Math.PI * 1.36,
      pairs: 58,
    })

    // Vụ nổ của phi hành khí: hệ phi hành khí không biết VFX tồn tại, chỉ gọi hook
    this.projectiles.onExplode = (x, y, z, radius, spec) => {
      this.vfx.spawnExplosion(x, y, z, radius, spec.element)
    }

    // Vệt chém do VFX vẽ khi nghe sự kiện, nên hệ chiến đấu không biết VFX tồn tại
    ctx.bus.on('combat:swing', (e) => {
      this.vfx.spawnSlash(
        e.x,
        e.y,
        e.z,
        e.facing,
        e.radius,
        e.side === 'player' ? Palette.linh : Palette.maHuyet,
      )
    })
    // Lưu ngay ở các mốc đáng lưu, không đợi hết chu kỳ tự lưu
    ctx.bus.on('cultivation:breakthrough', () => this.save(this.nowMs()))
    ctx.bus.on('cultivation:tierUp', () => {
      this.autoSaveTimer = Math.min(this.autoSaveTimer, 2)
    })
    ctx.bus.on('flight:toggle', ({ active }) => {
      ctx.bus.emit('toast', {
        text: active ? 'Ngự Kiếm Phi Hành' : 'Hạ kiếm',
        kind: 'info',
      })
    })
    ctx.bus.on('combat:hit', () => {
      // Thanh máu chỉ hiện cho con vừa bị đánh — xem WorldBars
      for (const c of this.combat.all) {
        if (c.invuln > 0 && c.side !== 'player') this.bars.notifyHit(c)
      }
    })

    // Quái nền quanh rừng để giữa hai đợt vẫn cày Tu Vi được. Chúng KHÔNG mang
    // cờ waveTag nên không tính vào điều kiện dẹp xong đợt.
    this.spawnAmbient(rng)

    camera.snapTo(this.player.pos.x, this.player.y + 0.9, this.player.pos.z)
    three.updateMatrixWorld(true)
    ctx.bus.emit('scene:loaded', { name: this.name })
  }

  /**
   * Dựng ba bảng và nối chúng vào người chơi.
   *
   * Các bảng nhận GETTER chứ không nhận giá trị: stat và cảnh giới đổi ngay giữa
   * lúc bảng đang mở (đột phá, uống đan), nên chụp giá trị một lần lúc dựng sẽ
   * làm bảng nói sai mà không có gì báo.
   */
  private buildPanels(uiRoot: HTMLElement): void {
    const player = this.player
    this.trialUi = new TrialOverlay(uiRoot)

    const culHost: CultivationHost = {
      get cultivation() {
        return player.cultivation
      },
      get inventory() {
        return player.inventory
      },
      get stats() {
        return player.combatant.stats
      },
      requestBreakthrough: () => this.startTrial(),
      drinkLinhNhu: () => this.drinkLinhNhu(),
    }
    const invHost: InventoryHost = {
      get inventory() {
        return player.inventory
      },
      useItem: (id) => {
        const msg = player.useItem(id)
        if (msg) this.ctx.bus.emit('toast', { text: msg, kind: 'good' })
        return msg
      },
    }
    const alcHost: AlchemyHost = {
      get inventory() {
        return player.inventory
      },
      get realm() {
        return player.realm
      },
      get thanThuc() {
        return player.combatant.stats.thanThuc
      },
      get linhLuc() {
        return player.linhLuc
      },
      craftRecipe: (id) => this.craftRecipe(id),
    }

    this.culPanel = new CultivationPanel(uiRoot, culHost)
    this.invPanel = new InventoryPanel(uiRoot, invHost)
    this.alcPanel = new AlchemyPanel(uiRoot, alcHost)
    this.panels = [this.culPanel, this.invPanel, this.alcPanel]
  }

  private closePanels(): void {
    for (const panel of this.panels) panel.hide()
  }

  /** Mở một bảng và đóng các bảng khác — không bao giờ mở hai bảng cùng lúc. */
  private togglePanel(target: Panel): void {
    const wasOpen = target.isOpen
    this.closePanels()
    if (!wasOpen) target.show()
  }

  private drinkLinhNhu(): number {
    const gained = this.player.drinkLinhNhu()
    if (gained > 0) {
      this.ctx.bus.emit('toast', { text: `Uống Tiểu Bình: +${gained} Tu Vi`, kind: 'good' })
    } else {
      this.ctx.bus.emit('toast', { text: 'Tiểu Bình chưa đủ linh nhũ', kind: 'bad' })
    }
    return gained
  }

  private craftRecipe(id: string): void {
    const recipe = recipeById(id)
    const player = this.player
    const thanThuc = player.combatant.stats.thanThuc
    const check = canCraft(recipe, player.inventory, player.realm, thanThuc, player.linhLuc)
    if (!check.ok) {
      this.ctx.bus.emit('toast', { text: 'Chưa luyện được đan này', kind: 'bad' })
      return
    }
    const result = craft(
      recipe,
      player.inventory,
      player.realm,
      thanThuc,
      player.linhLuc,
      this.ctx.rng,
    )
    // Linh lực do màn trừ, không phải do Alchemy: luật luyện đan là hàm thuần
    // để test được, còn linh lực là trạng thái của người chơi
    player.linhLuc = Math.max(0, player.linhLuc - result.linhLucSpent)
    this.ctx.bus.emit('toast', {
      text: result.success
        ? `Luyện thành ${itemDef(result.output).name} ×${result.outputCount}`
        : 'Đan lô nổ — hoàn lại một nửa nguyên liệu',
      kind: result.success ? 'good' : 'bad',
    })
  }

  /**
   * Bắt đầu đột phá: vào nhập định và mở màn thử dẫn khí.
   * Chưa tiêu đan dược ở đây — đan chỉ mất khi thật sự thử ở cuối màn.
   */
  private startTrial(): void {
    if (this.trial.active) return
    const player = this.player
    const c = player.cultivation
    const check = c.canBreakthrough(player.inventory)
    if (!check.ok) {
      const pill = check.needPill
      this.ctx.bus.emit('toast', {
        text:
          check.block === 'chuaDuTuVi'
            ? 'Tu Vi chưa tới đỉnh cảnh giới'
            : check.block === 'thieuDanDuoc'
              ? `Thiếu ${pill ? itemDef(pill).name : 'đan dược'}`
              : 'Đã tới cảnh giới cao nhất',
        kind: 'bad',
      })
      return
    }
    this.closePanels()
    this.trial.start(this.ctx.rng)
    player.beginTrance()
    this.trialUi.open(this.trial, majorRealm(c.realm.major + 1).name)
  }

  private updateTrial(dt: number): void {
    if (!this.trial.active) return
    const me = this.player.combatant

    // Bị đánh gián đoạn thì HUỶ hẳn, KHÔNG tiêu đan dược. Trong truyện thì bị
    // quấy giữa lúc đột phá là tai hoạ, nhưng ở đây một viên Trúc Cơ Đan là mấy
    // chục phút đi gom nguyên liệu — mất nó vì một con yêu thử chạy ngang thì
    // người chơi sẽ không bao giờ dám đột phá ngoài chỗ đã dọn sạch.
    if (me.dead || me.stagger > 0) {
      this.trial.abort()
      this.trialUi.close()
      this.player.endTrance()
      this.ctx.bus.emit('toast', { text: 'Bị đánh gián đoạn — dẫn khí tan', kind: 'bad' })
      return
    }

    const outcome = this.trial.update(dt, this.ctx.input.isDown('Space'))
    if (outcome) this.resolveBreakthrough(outcome)
  }

  private resolveBreakthrough(outcome: TrialOutcome): void {
    this.trialUi.close()
    this.player.endTrance()

    const player = this.player
    const c = player.cultivation
    const check = c.canBreakthrough(player.inventory, outcome.bonus)
    if (!check.ok) {
      this.ctx.bus.emit('toast', { text: 'Điều kiện đột phá không còn đủ', kind: 'bad' })
      return
    }

    const result = c.attemptBreakthrough(player.inventory, this.ctx.rng, outcome.bonus)
    // Gọi cả khi thất bại: thất bại làm tụt một tầng nhỏ nên stat cũng phải theo
    player.refreshStats()
    if (result.success) {
      // Đột phá xong hồi đầy: đây là khoảnh khắc thưởng, và cũng để người chơi
      // không vừa lên cảnh giới đã chết vì còn 12 máu của trước đó
      player.combatant.hp = player.combatant.stats.maxSinhLuc
      player.linhLuc = player.combatant.stats.maxLinhLuc
    }

    this.ctx.bus.emit('cultivation:breakthrough', {
      success: result.success,
      realmName: c.name,
      chance: result.chance,
      x: player.pos.x,
      y: player.y,
      z: player.pos.z,
    })
    this.ctx.bus.emit('toast', {
      text: result.success
        ? `Đột phá thành công — ${c.name}`
        : `Đột phá thất bại (${Math.round(result.chance * 100)}%) — lần sau dễ hơn`,
      kind: result.success ? 'good' : 'bad',
    })
  }

  /**
   * Trả thưởng cho những con vừa chết: Tu Vi chắc chắn, vật phẩm may rủi.
   * Vật phẩm bật ra từ chỗ xác nằm nên người chơi nối được "con này rơi ra cái này".
   */
  private grantRewards(): void {
    const rng = this.ctx.rng
    for (const agent of this.agents) {
      const c = agent.combatant
      if (!c.dead || this.rewarded.has(c.id)) continue
      this.rewarded.add(c.id)
      // Chỉ QUÁI mới cho Tu Vi và vật phẩm. Không có dòng này thì từ lúc có đệ
      // tử đồng môn, mỗi đồng môn tử trận lại rơi ra linh thảo và cho người chơi
      // Tu Vi — vừa sai về nghĩa, vừa biến "để đồng môn chết" thành cách farm.
      if (c.side !== 'enemy') continue

      this.player.gainTuVi(tuViReward(agent.def.id))
      for (const drop of rollDrops(agent.def.id, rng)) {
        this.pickups.spawn(drop.id, drop.count, c.pos.x, c.y, c.pos.z, rng)
      }
    }
  }

  /**
   * Nhịp chế độ thủ trận.
   *
   * Số quái sống được đếm NGAY TẠI ĐÂY rồi mới đưa vào bộ điều phối, không dùng
   * lại con số của bước trước — bộ điều phối có cờ chặn riêng cho việc đó, nhưng
   * đưa số cũ vào vẫn làm đợt kết thúc trễ một bước.
   */
  private updateWaves(dt: number, input: SceneContext['input']): void {
    // Đang đột phá thì không nhận lệnh khởi trận: người chơi đang bấm SPACE dẫn
    // khí, không nên vô tình mở một đợt quái lên đầu mình
    if (!this.trial.active && input.wasPressed('Enter') && this.director.canStart) {
      this.director.start(this.waveActions)
    }

    // Đệ tử đồng môn đi theo người chơi: dời điểm neo là đủ, không cần thêm
    // trạng thái nào vào máy trạng thái của Agent
    for (const agent of this.agents) {
      if (agent.combatant.side === 'ally') {
        agent.setHome(this.player.pos.x, this.player.pos.z)
      }
    }

    this.director.fixedUpdate(
      dt,
      this.aliveWaveEnemies(),
      this.player.combatant.dead,
      this.waveActions,
    )
  }

  /** Bù dần quái nền về mức mục tiêu, chỉ khi không có đợt nào đang chạy. */
  private updateAmbient(dt: number): void {
    if (this.director.state === 'fighting' || this.director.state === 'announcing') return
    this.ambientTimer -= dt
    if (this.ambientTimer > 0) return
    this.ambientTimer = AMBIENT_RESPAWN

    let ambient = 0
    for (const agent of this.agents) {
      if (!agent.waveTag && agent.combatant.side === 'enemy' && !agent.combatant.dead) ambient++
    }
    if (ambient >= AMBIENT_TARGET) return

    // Sinh ở vòng xa và theo cảnh giới người chơi: ở Trúc Cơ thì yêu thử chỉ còn
    // là một nhát chém, nên quái nền phải lên theo, không thì cày thành vô nghĩa
    const rng = this.ctx.rng
    const major = this.player.cultivation.realm.major
    const pool = major >= REALM.KET_DAN
      ? ['thietGiapThi', 'maDaoTanTu', 'hacLang']
      : major >= REALM.TRUC_CO
        ? ['hacLang', 'docThu', 'maDaoTanTu']
        : ['yeuThu', 'yeuThu', 'hacLang', 'docThu']
    const p = rng.inAnnulus(20, 34)
    this.spawnAgent(rng.pick(pool), p.x, p.z, rng)
  }

  /**
   * Tự lưu theo thời gian.
   *
   * KHÔNG lưu trong lúc đang đánh dở một đợt hoặc đang đột phá: ghi vào giữa
   * một trạng thái tạm sẽ tạo ra bản lưu mà mở lại thì người chơi đứng giữa
   * đợt 4 với sân trống, hoặc đang nhập định mà màn thử đã mất.
   */
  private updateAutoSave(dt: number): void {
    this.autoSaveTimer -= dt
    if (this.autoSaveTimer > 0) return
    if (this.trial.active || this.director.state === 'fighting' || this.director.state === 'announcing') {
      // Chưa tới lúc yên — thử lại sau vài giây thay vì bỏ hẳn lượt lưu này
      this.autoSaveTimer = 4
      return
    }
    this.save(this.nowMs())
  }

  /**
   * Mốc thời gian thật, ms. Chỉ dùng cho dấu thời gian của bản lưu — không bao
   * giờ dùng trong mô phỏng, nơi mọi thứ phải xác định theo seed.
   */
  private nowMs(): number {
    return typeof performance !== 'undefined' ? Date.now() : 0
  }

  /** Đọc phím mở bảng và các lệnh tu luyện. */
  private updateCultivationInput(): void {
    const { input } = this.ctx
    // Trong lúc nhập định thì mọi phím khác bị bỏ qua: chỉ còn SPACE để dẫn khí
    if (this.trial.active) return

    if (input.wasPressed('KeyC')) this.togglePanel(this.culPanel)
    if (input.wasPressed('KeyI')) this.togglePanel(this.invPanel)
    if (input.wasPressed('KeyK')) this.togglePanel(this.alcPanel)
    if (input.wasPressed('Escape')) {
      // Esc là "lùi một bước": có bảng đang mở thì đóng bảng, không thì mở menu
      // tạm dừng. Nếu Esc luôn mở menu thì người chơi đang xem túi đồ phải bấm
      // hai lần mới quay lại được trận.
      const anyOpen = this.panels.some((panel) => panel.isOpen)
      if (anyOpen) this.closePanels()
      else this.ctx.bus.emit('game:pauseRequest', {})
    }
    if (input.wasPressed('KeyG')) this.drinkLinhNhu()
    if (input.wasPressed('KeyB')) this.startTrial()
  }

  /** Quái nền rải quanh rừng — nguồn Tu Vi giữa hai đợt. */
  private spawnAmbient(rng: SceneContext['rng']): void {
    for (let i = 0; i < 7; i++) {
      const p = rng.inAnnulus(16, 30)
      this.spawnAgent('yeuThu', p.x, p.z, rng)
    }
    for (let i = 0; i < 3; i++) {
      const p = rng.inAnnulus(22, 34)
      this.spawnAgent('hacLang', p.x, p.z, rng)
    }
  }

  /** Gói trạng thái cần lưu. */
  captureSave(): Omit<SaveData, 'version' | 'savedAt'> {
    return {
      cultivation: this.player.cultivation.toJSON(),
      inventory: this.player.inventory.toJSON(),
      wave: {
        index: this.director.index,
        cleared: this.director.cleared,
        deaths: this.director.deaths,
      },
      playTime: this.playTime,
    }
  }

  /** Ghi ngay. Trả về false nếu không lưu được (localStorage bị chặn). */
  save(now: number): boolean {
    this.autoSaveTimer = AUTO_SAVE_SECONDS
    if (!this.storage) return false
    const ok = saveGame(this.storage, this.captureSave(), now)
    this.ctx.bus.emit('game:saved', { ok })
    return ok
  }

  /**
   * Nạp một bản lưu vào màn đang chạy.
   *
   * KHÔNG dựng lại màn: quái, prop và địa hình đều sinh từ seed cố định nên
   * chúng đã đúng rồi. Chỉ có tiến độ của người chơi là thứ cần thay.
   */
  applySave(data: SaveData): void {
    this.player.cultivation.loadFrom(data.cultivation)
    this.player.inventory.clear()
    for (const [id, count] of Object.entries(data.inventory)) {
      // Bỏ qua id không còn tồn tại thay vì làm sập cả lượt nạp
      try {
        this.player.inventory.add(id, count)
      } catch {
        continue
      }
    }
    // PHẢI tính lại stat ngay: sinh lực tối đa vừa đổi theo cảnh giới của bản lưu
    this.player.refreshStats()
    this.player.combatant.hp = this.player.combatant.stats.maxSinhLuc
    this.player.linhLuc = this.player.combatant.stats.maxLinhLuc

    this.director.reset()
    this.director.index = Math.min(this.director.total - 1, data.wave.index)
    this.director.cleared = data.wave.cleared
    this.director.deaths = data.wave.deaths
    this.playTime = data.playTime
    this.autoSaveTimer = AUTO_SAVE_SECONDS
    this.hud.setRealm(this.player.realm)
  }

  /** Bắt đầu lượt mới: xoá bản lưu và đưa tiến độ về mốc ban đầu. */
  resetProgress(): void {
    if (this.storage) clearSave(this.storage)
    this.player.cultivation.loadFrom({
      major: START_REALM.major,
      tier: START_REALM.tier,
      tuVi: 0,
      failStreak: 0,
      linhNhu: 0,
      totalTuVi: 0,
    })
    this.player.inventory.clear()
    this.player.refreshStats()
    this.player.combatant.hp = this.player.combatant.stats.maxSinhLuc
    this.player.linhLuc = this.player.combatant.stats.maxLinhLuc
    this.director.reset()
    this.playTime = 0
    this.waveActions.clearEnemies()
    this.player.revive(0, GATE_DISTANCE - 5, Math.PI)
    this.hud.setRealm(this.player.realm)
  }

  /** Cảnh giới mở hết thần thông: Kết Đan, để cả 7 chiêu và phi hành đều dùng được. */
  private static readonly DEMO_REALM = { major: REALM.KET_DAN, tier: 2 }

  /**
   * Vào chế độ trình diễn.
   *
   * KHÔNG dựng lại màn: địa hình, prop và ánh sáng đã đúng rồi. Chỉ đổi ba thứ —
   * cảnh giới của người chơi, ai đang có mặt trên sân, và ai đang điều khiển
   * nhân vật.
   */
  enterDemo(): void {
    if (this.demoMode) return
    this.demoMode = true

    const p = this.player
    p.cultivation.loadFrom({
      major: ArenaScene.DEMO_REALM.major,
      tier: ArenaScene.DEMO_REALM.tier,
      tuVi: 0,
      failStreak: 0,
      linhNhu: 0,
      totalTuVi: 0,
    })
    p.refreshStats()
    p.combatant.hp = p.combatant.stats.maxSinhLuc
    p.linhLuc = p.combatant.stats.maxLinhLuc
    p.caster.freeCast = true
    p.caster.reset()
    this.godMode = true

    // Dọn sân: showreel cần một sân trống rồi tự dựng bia đỡ theo từng bước
    this.director.reset()
    this.waveActions.clearEnemies()
    this.reap()
    p.revive(0, 4, Math.PI)

    this.banner.hide()
    this.bossBar.hide()
    this.closePanels()
    this.hud.setRealm(p.realm)
    this.showcasePanel.show()
    this.showcase.reset()
    this.spawnDummies()
    this.showcase.start(this.showcaseActions)
    this.showcasePanel.setPlaying(true)
  }

  /** Ra khỏi chế độ trình diễn và trả màn về trạng thái chơi thật. */
  exitDemo(): void {
    if (!this.demoMode) return
    this.demoMode = false
    this.showcase.stop(this.showcaseActions)
    this.showcase.reset()
    this.showcasePanel.hide()
    this.player.caster.freeCast = false
    this.player.caster.reset()
    this.godMode = false
    this.waveActions.clearEnemies()
    this.reap()
  }

  /**
   * Dựng lại vòng bia đỡ.
   *
   * Bia đỡ là `passive` nên không đánh trả — nhưng vẫn là phe địch, nên mọi
   * chiêu vẫn ăn vào chúng đủ cả đẩy lùi, đóng băng và thiêu đốt. Nếu để chúng
   * đánh trả thì mỗi bước trình diễn sẽ bị một con quái xông vào cắn ngang.
   */
  private spawnDummies(): void {
    for (const agent of this.agents) {
      if (agent.combatant.side !== 'enemy') continue
      agent.combatant.dead = true
      agent.combatant.deadFor = 99
      this.rewarded.add(agent.combatant.id)
    }
    this.reap()

    const rng = this.ctx.rng
    const p = this.player
    // Ba lớp bia: gần cho đòn cận chiến, giữa cho pháp vực, xa cho phi hành khí
    const rings: ReadonlyArray<[string, number, number]> = [
      ['yeuThu', 2.4, 4],
      ['hacLang', 5.2, 5],
      ['thietGiapThi', 8.2, 4],
    ]
    for (const [id, radius, count] of rings) {
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + rng.float(-0.2, 0.2)
        const agent = this.spawnAgent(
          id,
          p.pos.x + Math.cos(a) * radius,
          p.pos.z + Math.sin(a) * radius,
          rng,
        )
        agent.passive = true
        // Máu rất cao: bia đỡ chết ngay thì bước sau không còn gì để diễn vào
        agent.combatant.hp = agent.combatant.stats.maxSinhLuc * 40
      }
    }
  }

  /**
   * Đọc phím của chế độ trình diễn.
   *
   * Dùng `P` / `Q` / `E` chứ KHÔNG dùng Space và mũi tên: Space đã là phím ngự
   * kiếm phi hành và mũi tên đã là phím di chuyển. Chồng lên nhau thì một lần
   * bấm Space vừa lật showreel vừa cất nhân vật lên trời.
   *
   * Và `Esc` phải bắt Ở ĐÂY: đường Esc thường nằm trong `updateCultivationInput`,
   * mà hàm đó không chạy ở chế độ trình diễn — nên không bắt lại thì không có
   * cách nào ra khỏi chế độ này bằng bàn phím.
   */
  private updateShowcaseInput(): void {
    const { input } = this.ctx
    if (input.wasPressed('KeyP')) {
      this.showcase.toggle(this.showcaseActions)
      this.showcasePanel.setPlaying(this.showcase.playing)
    }
    if (input.wasPressed('KeyE')) this.showcase.next(this.showcaseActions)
    if (input.wasPressed('KeyQ')) this.showcase.prev(this.showcaseActions)
    if (input.wasPressed('Escape')) this.ctx.bus.emit('game:pauseRequest', {})

    // Vẫn cho tự thi triển bằng 1…7 trong lúc showreel đang chạy — bấm một chiêu
    // là chuyển sang tự chơi, vì rõ ràng người chơi muốn tự làm
    if (input.skillPressed() >= 0 && this.showcase.playing) {
      this.showcase.playing = false
      this.showcasePanel.setPlaying(false)
    }
  }

  /** Bật/tắt thanh máu tướng. `null` = hết đợt tướng. */
  private setBoss(agent: Agent | null): void {
    this.boss = agent
    if (agent?.def.boss) this.bossBar.show(agent.def.boss)
    else this.bossBar.hide()
  }

  /** Số quái CỦA ĐỢT còn sống — điều kiện dẹp xong đợt chỉ đếm những con này. */
  private aliveWaveEnemies(): number {
    let n = 0
    for (const agent of this.agents) {
      if (agent.waveTag && agent.combatant.side === 'enemy' && !agent.combatant.dead) n++
    }
    return n
  }

  /**
   * Tướng vào phase mới: gọi tay sai, rung camera, báo tên phase.
   *
   * Tay sai sinh ở đây chứ không trong Agent: Agent không được biết tới scene,
   * và việc "thêm một thực thể vào thế giới" là việc của màn.
   */
  private onBossPhase(agent: Agent, phase: BossPhase, index: number): void {
    if (index === 0) return // phase mở đầu không phải một sự kiện

    this.ctx.bus.emit('camera:shake', { magnitude: 0.42, duration: 0.5 })
    this.vfx.floats.spawn(
      agent.combatant.pos.x,
      agent.combatant.y + agent.combatant.view.height + 0.5,
      agent.combatant.pos.z,
      phase.name,
      'crit',
    )
    this.ctx.bus.emit('toast', { text: `${agent.def.name}: ${phase.name}`, kind: 'bad' })

    const summon = phase.summon
    if (!summon) return
    for (let i = 0; i < summon.count; i++) {
      const p = this.ctx.rng.inAnnulus(2.4, 4.5)
      const minion = this.spawnAgent(
        summon.id,
        agent.combatant.pos.x + p.x,
        agent.combatant.pos.z + p.z,
        this.ctx.rng,
      )
      // Tay sai của tướng CÓ tính vào đợt: nếu không thì người chơi hạ tướng
      // xong là đợt kết thúc và lũ tay sai còn lại đứng đó đánh mãi
      minion.waveTag = true
      this.vfx.spawnExplosion(minion.combatant.pos.x, minion.combatant.y + 0.4, minion.combatant.pos.z, 1.6, 'moc')
    }
  }

  spawnAgent(id: string, x: number, z: number, rng: SceneContext['rng'], side: Side = 'enemy'): Agent {
    const agent = new Agent(unitDef(id), x, z, this.terrain, rng, side)
    this.agents.push(agent)
    this.combat.add(agent.combatant)
    this.ctx.three.add(agent.combatant.root)
    return agent
  }

  private groundAt(x: number, z: number): number {
    return this.terrain.heightAt(x, z)
  }

  private placeArchitecture(rng: SceneContext['rng']): void {
    // Cổng phái ở phía +Z, quay mặt vào giữa.
    // Cao 3.2 chứ không 5.2: kiến trúc phải theo tỉ lệ CHIBI, không theo tỉ lệ
    // người thật. Nhân vật cao 1.1 nên cổng 5.2 cao gần 5 lần đầu người, nhìn
    // vào thấy nhân vật bé xíu như con sâu — mà chibi thì phải là trung tâm.
    const gate = buildSectGate(5, 3.2)
    gate.position.set(0, this.groundAt(0, GATE_DISTANCE), GATE_DISTANCE)
    gate.rotation.y = Math.PI
    this.add(gate)
    // Hai trụ cổng chặn đường, chừa lối đi ở giữa
    this.collision.addStatic(-3.2, GATE_DISTANCE, 0.55)
    this.collision.addStatic(3.2, GATE_DISTANCE, 0.55)

    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4
      const x = Math.cos(a) * PILLAR_RING
      const z = Math.sin(a) * PILLAR_RING
      // Cao 2.9 chứ không 4.4: cùng lý do như cổng phái — theo tỉ lệ chibi.
      // Cột cao 4.4 vừa làm nhân vật trông bé xíu, vừa chắn mất khung hình khi
      // camera quay tới phía nó.
      const pillar = buildStonePillar(rng, 2.9)
      pillar.position.set(x, this.groundAt(x, z), z)
      this.add(pillar)
      this.collision.addStatic(x, z, 0.55)
    }

    // Đèn đá xen giữa các cột, lệch pha 1/8 vòng
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      const x = Math.cos(a) * LANTERN_RING
      const z = Math.sin(a) * LANTERN_RING
      const lantern = buildStoneLantern(1.6)
      lantern.position.set(x, this.groundAt(x, z), z)
      lantern.rotation.y = -a
      this.add(lantern)
      this.collision.addStatic(x, z, 0.32)
    }

    // Đài luyện đan lệch sang một bên, chừa giữa sân trống để đánh nhau
    const altarX = -10.5
    const altarZ = -7
    const altar = buildAlchemyAltar()
    altar.position.set(altarX, this.groundAt(altarX, altarZ), altarZ)
    this.add(altar)
    this.collision.addStatic(altarX, altarZ, 1.62)

    // Hai nguồn sáng điểm làm ĐIỂM NHẤN, không phải để soi cảnh.
    //
    // Ánh sáng đều khắp thì không có chỗ nào đáng nhìn. Một đốm lửa ấm ở đài
    // luyện đan và một quầng linh khí lạnh giữa sân cho cảnh hai cực nhiệt độ, và
    // mắt tự đi từ cực này sang cực kia. `distance` đặt hẹp nên chúng không rọi
    // ra cả bản đồ — chỉ vùng quanh chính nó sáng lên.
    const brazier = new PointLight(Palette.luaDan, 3.4, 9, 2)
    brazier.position.set(altarX, this.groundAt(altarX, altarZ) + 1.5, altarZ)
    this.add(brazier)

    // Quầng linh khí trên mặt sân: nó cũng là thứ tách chân nhân vật khỏi nền đá
    const courtyard = new PointLight(Palette.linh, 2.2, 16, 2.2)
    courtyard.position.set(0, this.groundAt(0, 0) + 3.4, 0)
    this.add(courtyard)
  }

  private placeVegetation(rng: SceneContext['rng']): void {
    const propMaterial = materials.flat(0xffffff, { vertexColors: true })

    // Vật cản TO đặt trước: vật to cần nhiều chỗ nên phải chọn khi bản đồ còn trống
    for (let i = 0; i < 14; i++) {
      const radius = rng.float(1.1, 2.2)
      const spot = this.tryPlace(rng, 18, 56, radius * 0.9)
      if (!spot) continue
      const boulder = buildBoulder(rng, radius)
      boulder.position.set(spot.x, this.groundAt(spot.x, spot.z), spot.z)
      this.add(boulder)
      this.collision.addStatic(spot.x, spot.z, radius * 0.9)
    }

    // Rừng tùng: 3 biến thể geometry -> 3 batch -> 3 draw call cho gần 100 cây.
    // Va chạm chỉ lấy phần thân (0.36) chứ không lấy tán — lấy cả tán thì người
    // chơi bị chặn bởi những bức tường vô hình rất rộng.
    const pineBatches = [0, 1, 2].map(
      (v) => new PropBatch(pineGeometry(v), propMaterial, `pine${v}`),
    )
    for (let i = 0; i < 96; i++) {
      const spot = this.tryPlace(rng, 17, 62, 0.36)
      if (!spot) continue
      const batch = pineBatches[i % 3] as PropBatch
      batch.add(
        spot.x,
        this.groundAt(spot.x, spot.z),
        spot.z,
        rng.float(0, Math.PI * 2),
        rng.float(2.7, 5.6),
      )
      this.collision.addStatic(spot.x, spot.z, 0.36)
    }
    for (const batch of pineBatches) this.addBatch(batch)

    // Bụi tre thành khóm ở một góc — tre là cảnh đặc trưng của sơn môn tu tiên,
    // và cũng là vật liệu của Thanh Trúc Phong Vân Kiếm ở M5
    const bambooBatches = [0, 1, 2].map(
      (v) => new PropBatch(bambooGeometry(v), propMaterial, `bamboo${v}`),
    )
    const groveX = 17
    const groveZ = -16
    for (let i = 0; i < 74; i++) {
      const off = rng.inAnnulus(0, 9)
      const x = groveX + off.x
      const z = groveZ + off.z
      if (Math.hypot(x, z) < 14) continue
      const batch = bambooBatches[i % 3] as PropBatch
      batch.add(x, this.groundAt(x, z), z, rng.float(0, Math.PI * 2), rng.float(0.7, 1.1), rng.float(2.6, 4.4))
      // Tre mảnh và mọc dày: cho đi xuyên qua, chặn thì khóm tre thành bức tường
    }
    for (const batch of bambooBatches) this.addBatch(batch)

    const rockBatches = [0, 1, 2].map(
      (v) => new PropBatch(rockGeometry(v), propMaterial, `rock${v}`),
    )
    for (let i = 0; i < 70; i++) {
      const radius = rng.float(0.3, 0.95)
      // Đá nhỏ thì bước qua được nên không cần chỗ trống, chỉ đá to mới chặn
      const blocking = radius > 0.55
      const spot = blocking ? this.tryPlace(rng, 10, 64, radius * 0.85) : rng.inAnnulus(10, 64)
      if (!spot) continue
      const batch = rockBatches[i % 3] as PropBatch
      batch.add(spot.x, this.groundAt(spot.x, spot.z), spot.z, rng.float(0, Math.PI * 2), radius)
      if (blocking) this.collision.addStatic(spot.x, spot.z, radius * 0.85)
    }
    for (const batch of rockBatches) this.addBatch(batch)
  }

  private addBatch(batch: PropBatch): void {
    const mesh = batch.build()
    if (mesh) this.add(mesh)
  }

  /**
   * Tìm một vị trí trống cho vật cản bán kính `radius`, chừa khe MIN_PASSAGE,
   * và chỉ nhận chỗ mà địa hình còn đi được.
   * Trả về null nếu thử hết `attempts` lần vẫn không có chỗ — khi đó bỏ qua vật
   * đó thay vì nhồi vào chỗ chật, nên mật độ prop tự giảm khi bản đồ đã đầy.
   */
  private tryPlace(
    rng: SceneContext['rng'],
    rMin: number,
    rMax: number,
    radius: number,
    attempts = 14,
  ): { x: number; z: number } | null {
    const found: StaticBody[] = []
    for (let i = 0; i < attempts; i++) {
      const p = rng.inAnnulus(rMin, rMax)
      if (!this.terrain.isWalkable(p.x, p.z)) continue
      if (this.collision.query(p.x, p.z, radius + MIN_PASSAGE, found) === 0) return p
    }
    return null
  }

  private add(obj: Object3D): void {
    this.ctx.three.add(obj)
    this.objects.push(obj)
  }

  fixedUpdate(dt: number): void {
    const { input, camera, bus } = this.ctx

    // Chỉ mục không gian phải dựng LẠI TRƯỚC mọi truy vấn của bước này, nếu
    // không thì hitbox sẽ tìm theo vị trí của frame trước
    this.combat.rebuildIndex()

    // God mode dùng chính cơ chế miễn thương đã có, thay vì thêm một nhánh
    // đặc biệt trong đường gây sát thương
    if (this.godMode) this.player.combatant.invuln = 1

    if (this.demoMode) {
      // Chế độ trình diễn thay HẲN phần thủ trận: không đợt, không quái nền,
      // không tự lưu (nó không phải một lượt chơi nên không có gì đáng lưu), và
      // không đếm thời gian chơi
      this.updateShowcaseInput()
      this.showcase.fixedUpdate(dt, this.showcaseActions)
      // Linh lực luôn đầy: chế độ này để XEM chiêu, không phải để quản tài nguyên
      this.player.linhLuc = this.player.combatant.stats.maxLinhLuc
    } else {
      this.playTime += dt
      this.updateCultivationInput()
      this.updateTrial(dt)
      this.updateWaves(dt, input)
      this.updateAmbient(dt)
      this.updateAutoSave(dt)
    }

    this.player.fixedUpdate(
      dt,
      input,
      camera,
      this.collision,
      this.combat,
      this.projectiles,
      this.swords,
    )
    for (const agent of this.agents) agent.fixedUpdate(dt, this.agentCtx)
    this.projectiles.fixedUpdate(dt, this.collision, this.terrain)
    this.swords.fixedUpdate(dt)
    this.pickups.fixedUpdate(dt, this.player.pos.x, this.player.pos.z, this.player.y, this.terrain)

    // Tách đàn SAU khi mọi thứ đã di chuyển, để không con nào bị xử lý hai lần
    this.combat.resolveCrowding()
    for (const agent of this.agents) agent.combatant.applyTransform()
    this.player.combatant.applyTransform()

    // Trả thưởng TRƯỚC khi dọn xác: reap() tháo con vật ra khỏi danh sách nên
    // sau đó không còn chỗ nào biết nó từng là con gì để quay bảng rơi
    this.grantRewards()
    this.reap()
    this.publishVitals(bus)
    this.handleDeath(dt)

    camera.follow(this.player.pos.x, this.player.y + 0.9, this.player.pos.z)
  }

  /** Tháo xác đã hết thời gian khỏi scene và khỏi danh sách quái. */
  private reap(): void {
    const removed = this.combat.reapCorpses()
    if (removed.length === 0) return
    const removedSet = new Set<Combatant>(removed)
    for (let i = this.agents.length - 1; i >= 0; i--) {
      const agent = this.agents[i] as Agent
      if (!removedSet.has(agent.combatant)) continue
      this.ctx.three.remove(agent.combatant.root)
      this.rewarded.delete(agent.combatant.id)
      if (this.boss === agent) this.setBoss(null)
      this.agents.splice(i, 1)
    }
  }

  /** Chỉ phát sự kiện khi số THỰC SỰ đổi — HUD không cần cập nhật 60 lần/giây. */
  private publishVitals(bus: SceneContext['bus']): void {
    const me = this.player.combatant
    const hp = Math.ceil(me.hp)
    const mp = Math.ceil(this.player.linhLuc)
    if (hp === this.lastHp && mp === this.lastMp) return
    this.lastHp = hp
    this.lastMp = mp
    bus.emit('player:vitals', {
      sinhLuc: me.hp,
      maxSinhLuc: me.stats.maxSinhLuc,
      linhLuc: this.player.linhLuc,
      maxLinhLuc: me.stats.maxLinhLuc,
    })
  }

  /**
   * M3: chết thì hồi sinh ở cổng phái sau 2.5 giây.
   * Màn hình thua và hình phạt tử vong là việc của M8; hiện tại hồi sinh nhanh
   * để việc thử combat không bị chặn.
   */
  private handleDeath(dt: number): void {
    if (!this.player.combatant.dead) {
      this.respawnTimer = 0
      return
    }
    this.respawnTimer += dt
    if (this.respawnTimer < 2.5) return
    this.respawnTimer = 0
    this.player.revive(0, GATE_DISTANCE - 5, Math.PI)
    this.ctx.bus.emit('toast', { text: 'Trọng thương, lui về cổng phái', kind: 'bad' })
  }

  render(_alpha: number, frameDt: number): void {
    const { input, camera } = this.ctx
    this.player.render(frameDt)
    for (const agent of this.agents) agent.render(frameDt)
    this.swords.render(frameDt)

    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null
    const w = canvas?.clientWidth ?? window.innerWidth
    const h = canvas?.clientHeight ?? window.innerHeight
    this.vfx.update(frameDt, camera.camera, w, h)
    this.bars.update(frameDt, this.combat.all, camera.camera, w, h)
    this.skillBar.update(frameDt, this.player.caster, this.player.realm, this.player.linhLuc)
    this.hud.setCultivation(this.player.cultivation)
    this.crowd.update(frameDt)
    // Ở chế độ trình diễn thì KHÔNG nhịp lớp phủ thủ trận.
    //
    // `WaveBanner.update()` tự chọn thẻ theo trạng thái bộ điều phối, và trạng
    // thái đó là 'idle' sau khi reset — nên nó dựng lại thẻ "bấm ENTER để khởi
    // trận" ngay khung sau khi vào chế độ trình diễn, đè lên đúng cái thẻ đang
    // giới thiệu chiêu. Gọi `hide()` một lần lúc vào là không đủ.
    if (this.demoMode) this.banner.hide()
    else this.banner.update(frameDt, this.director, this.aliveWaveEnemies())
    if (this.boss && this.bossBar.isVisible) {
      const c = this.boss.combatant
      this.bossBar.update(
        c.dead ? 0 : c.hp,
        c.stats.maxSinhLuc,
        this.boss.phaseIndex,
        this.boss.phase?.name ?? '',
      )
    }
    for (const panel of this.panels) panel.tick(frameDt)
    if (this.trialUi.isOpen) this.trialUi.update()

    // Khiên bám theo người chơi và mờ dần theo lượng còn hấp thụ được
    const me = this.player.combatant
    const shield = me.effects.find('khien')
    this.vfx.shield.update(
      frameDt,
      shield !== undefined && !me.dead,
      me.pos.x,
      me.y,
      me.pos.z,
      // 2.05 chứ không 3.2: khiên phải bọc SÁT người. Thử 3.2 thì bóng khiên
      // rộng 1.7 unit trùm kín cả nhân vật cao 1.1 và mấy con quái đứng cạnh —
      // mất luôn thứ quan trọng nhất là thấy được mình và địch đang ở đâu.
      me.radius * 2.05,
      shield ? Math.min(1, shield.magnitude / Math.max(1, me.stats.thanThuc * 5.5)) : 0,
    )

    // Vòng chỉ mục tiêu tự ngắm, bám dưới chân con đang bị nhắm
    if (this.targetMarker) {
      const target = this.player.autoAim ? this.player.aim.target : null
      if (target && !this.player.combatant.dead) {
        this.targetMarker.position.set(target.pos.x, target.y + 0.06, target.pos.z)
        // Vòng to theo con quái: cùng một vòng cho con yêu thử và cho Mặc Đại
        // Phu thì hoặc quá to hoặc quá nhỏ, và không đọc ra là đang chỉ vào nó
        const s = Math.max(1, target.radius / 0.3)
        this.targetMarker.scale.set(s, 1, s)
        this.targetMarker.visible = true
      } else {
        this.targetMarker.visible = false
      }
    }

    // Con trỏ mặt đất chỉ có nghĩa ở chế độ ngắm bằng chuột
    if (this.marker) {
      if (this.player.autoAim) {
        this.marker.visible = false
      } else if (camera.screenToGround(input.pointerNdcX, input.pointerNdcY, this.cursor, this.player.y)) {
        // Đặt theo cao độ THẬT của địa hình tại điểm đó, không theo mặt phẳng
        // chiếu — nếu không thì vòng sáng sẽ chìm vào đồi hoặc bay trên hố
        const y = this.terrain.heightAt(this.cursor.x, this.cursor.z)
        this.marker.position.set(this.cursor.x, y + 0.05, this.cursor.z)
        this.marker.visible = true
      } else {
        this.marker.visible = false
      }
    }
  }

  unload(): void {
    for (const obj of this.objects) {
      this.ctx.three.remove(obj)
      obj.traverse((child) => {
        if (child instanceof Mesh) (child.geometry as BufferGeometry).dispose()
      })
    }
    for (const agent of this.agents) this.ctx.three.remove(agent.combatant.root)
    this.agents.length = 0
    this.objects.length = 0
    this.collision.clear()
    this.combat.clear()
    this.projectiles.dispose()
    this.swords.dispose()
    this.pickups.dispose()
    this.rewarded.clear()
    this.vfx.dispose()
    this.hud.dispose()
    this.skillBar.dispose()
    this.bars.dispose()
    this.hints.dispose()
    this.showcasePanel.dispose()
    this.bossBar.dispose()
    this.banner.dispose()
    this.crowd.dispose()
    this.trialUi.dispose()
    for (const panel of this.panels) panel.dispose()
    this.panels = []
    this.ctx.bus.emit('scene:unloaded', { name: this.name })
  }
}
