import { Vector3, type Object3D } from 'three'
import { Palette } from '@/art/Palette'
import {
  buildFloatingRing,
  buildLuyenKiemDai,
  buildTargetSocket,
  buildTerraceHalo,
} from '@/art/props/training'
import { buildStoneLantern, buildStonePillar } from '@/art/props/sect'
import { buildGroundMarker, buildTargetMarker } from '@/art/props/nature'
import { ShowcaseDirector, type ShowcaseActions } from '@/game/ShowcaseDirector'
import type { RealmPosition } from '@/game/data/realms'
import { Hud } from '@/ui/Hud'
import { ShowcasePanel } from '@/ui/ShowcasePanel'
import { SkillBar } from '@/ui/SkillBar'
import { WorldBars } from '@/ui/WorldBars'
import { Vfx, WING_TRAIL } from '@/vfx/Vfx'
import { CollisionWorld } from './Collision'
import { CombatWorld } from './CombatWorld'
import { FLAT_GROUND } from './Terrain'
import { Player } from './Player'
import { ProjectileSystem } from './Projectile'
import { SwordStorm, SWORD_CAPACITY } from './SwordStorm'
import { TrainingTarget, type TargetKind } from './TrainingTarget'
import type { GameScene, SceneContext } from './Scene'

/** Bán kính đài. Người chơi không ra khỏi được vòng này. */
const TERRACE_RADIUS = 13
/** Khoảng cách camera gần nhất cho phép ở màn này — xem mục `load`. */
const CLOSE_DISTANCE = 5
/** Vành cột đá quanh đài. */
const PILLAR_RING = 11.6
const LANTERN_RING = 12.4

/**
 * Vệt đuôi lúc chạy bộ: mảnh và mờ. Cùng thông số với màn đấu trường — hai màn
 * dùng chung một nhân vật thì vệt của nhân vật đó phải giống hệt nhau.
 */
const RUN_TRAIL = {
  head: Palette.vetVang,
  tail: Palette.vetLuc,
  width: 0.13,
  life: 0.3,
  opacity: 0.5,
}
const FLY_TRAIL = { head: Palette.vetVang, tail: Palette.vetLuc, width: 0.34, life: 0.62 }
const SWORD_TRAIL = { head: 0xdcf46e, tail: 0x2f9e55, width: 0.1, life: 0.26, opacity: 0.85 }

/** Ba vòng bia: gần cho cận chiến, giữa cho pháp vực, xa cho phi hành khí. */
const TARGET_RINGS: ReadonlyArray<{
  kind: TargetKind
  radius: number
  count: number
  /** Máu nhân thêm — vòng ngoài dày hơn vì chiêu tầm xa mạnh hơn chiêu cận chiến. */
  hp: number
}> = [
  { kind: 'mocNhan', radius: 2.6, count: 4, hp: 1 },
  { kind: 'mocNhan', radius: 5.4, count: 6, hp: 1.6 },
  { kind: 'biaDa', radius: 8.6, count: 8, hp: 2.4 },
]

/**
 * Luyện Kiếm Đài — màn trình diễn thần thông.
 *
 * Là một `GameScene` RIÊNG chứ không phải một cờ trong `ArenaScene`, và đó là
 * quyết định đáng ghi lại. Chế độ trình diễn cũ sống nhờ một biến `demoMode`
 * chạy xuyên qua đấu trường: mỗi nhánh gameplay của màn đó — đợt sóng, quái
 * nền, nhặt đồ, tự lưu, hồi sinh — đều phải mọc thêm một câu hỏi "có đang trình
 * diễn không". Đó là bảy chỗ có thể quên, mà quên chỗ nào thì hỏng chỗ đó theo
 * kiểu im lặng: một con quái nền lang thang vào giữa lúc đang diễn Tam Diễm
 * Phiến, hoặc cảnh giới Nguyên Anh của chế độ xem bị ghi đè lên bản lưu thật.
 *
 * Tách ra thì màn này KHÔNG CÓ những hệ đó để mà quên. Nó có đúng bốn thứ: một
 * nhân vật, một đài đá, một vòng bia gỗ, và bộ điều phối.
 *
 * KHÔNG có sinh vật nào trong màn. Bia là mộc nhân và bia đá — vẫn là combatant
 * phe địch nên mọi chiêu ăn vào đủ cả đẩy lùi, đóng băng, thiêu đốt và số sát
 * thương bay lên, nhưng không con nào tự đi lại hay đánh trả.
 */
export class SwordTerraceScene implements GameScene {
  readonly name = 'luyenKiemDai'
  /** Chuột trái kéo là xoay camera — ở đây nó không còn là nút đánh. */
  readonly orbitOnLeftDrag = true

  readonly collision = new CollisionWorld()
  readonly showcase = new ShowcaseDirector()
  player!: Player
  combat!: CombatWorld
  projectiles!: ProjectileSystem
  swords!: SwordStorm
  readonly targets: TrainingTarget[] = []

  private ctx!: SceneContext
  private readonly objects: Object3D[] = []
  private readonly cursor = new Vector3()
  /** Bộ đệm toạ độ đầu cánh — tránh cấp phát mỗi khung. */
  private readonly wingTip = new Vector3()
  private vfx!: Vfx
  private hud!: Hud
  private skillBar!: SkillBar
  private bars!: WorldBars
  private panel!: ShowcasePanel
  private marker?: Object3D
  private targetMarker?: Object3D
  private halo?: Object3D
  private floatRing?: Object3D
  private lastHp = -1
  private lastMp = -1
  private elapsed = 0
  /** Trần zoom cũ, trả lại lúc rời màn — camera dùng chung cho cả ba màn. */
  private prevMinDistance = 0

  private readonly actions: ShowcaseActions = {
    // Không xoá hồi chiêu ở đây: `load` đã bật `caster.noCooldown`, nên diễn
    // được cả Thái Ất Thanh Sơn Quyết (hồi 40 giây) trong một bước 9 giây, và
    // người xem tự bấm chiêu cũng không phải chờ
    cast: (id) => {
      this.player.castSkill(id, this.combat, this.projectiles, this.swords)
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
    refreshTargets: () => this.spawnTargets(),
    setRealm: (realm) => this.setRealm(realm),
    restore: () => this.restore(),
    announce: (step, index, total) => this.panel.setStep(step, index, total),
  }

  load(ctx: SceneContext): void {
    this.ctx = ctx
    const { three, rng, camera } = ctx

    this.add(buildLuyenKiemDai(TERRACE_RADIUS))
    this.halo = buildTerraceHalo(TERRACE_RADIUS + 0.4)
    this.add(this.halo)
    this.floatRing = buildFloatingRing(TERRACE_RADIUS + 2.6, 12)
    this.add(this.floatRing)
    this.placeRim(rng)

    this.player = new Player()
    // Đài PHẲNG tuyệt đối, không dùng Terrain: địa hình gợn sóng làm số sát
    // thương và bia đứng lệch cao độ nhau vài phần mười unit, và ở một màn để
    // ĐO thì mọi chênh lệch không giải thích được đều là nhiễu
    this.player.setGround(FLAT_GROUND)
    this.player.spawn(0, 0, 0)
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

    const uiRoot = document.getElementById('ui-root')
    if (!uiRoot) throw new Error('SwordTerraceScene: thiếu #ui-root')
    this.vfx = new Vfx(three, uiRoot, ctx.bus, rng)
    this.hud = new Hud(uiRoot, ctx.bus)
    this.skillBar = new SkillBar(uiRoot, ctx.bus)
    this.bars = new WorldBars(uiRoot)
    this.panel = new ShowcasePanel(uiRoot)
    this.panel.onPick = (index) => this.showcase.select(index, this.actions)

    this.projectiles.onExplode = (x, y, z, radius, spec) => {
      this.vfx.spawnExplosion(x, y, z, radius, spec.element)
    }
    this.projectiles.onTrailPath = (serial, x, y, z, spec) => {
      this.vfx.follow(`proj:${serial}`, true, x, y, z, this.vfx.projectileTrail(spec.element))
    }
    this.projectiles.onTrailEnd = (serial) => {
      this.vfx.follow(`proj:${serial}`, false, 0, 0, 0)
    }
    this.swords.onSwordTrail = (seat, x, y, z) => {
      this.vfx.follow(`sword:${seat}`, true, x, y, z, SWORD_TRAIL)
    }
    this.swords.onSwordsEnd = () => {
      // Thả HẾT sức chứa chứ không chỉ số kiếm của lượt vừa rồi: lượt trước có
      // thể đông hơn lượt này, và vệt của những chỗ ngồi thừa sẽ treo lại giữa
      // không khí cho tới lần nào đó tình cờ đông bằng
      for (let seat = 0; seat < SWORD_CAPACITY; seat++) {
        this.vfx.follow(`sword:${seat}`, false, 0, 0, 0)
      }
    }
    ctx.bus.on('combat:swing', (e) => {
      this.vfx.spawnSlash(e.x, e.y, e.z, e.facing, e.radius, e.side)
    })
    ctx.bus.on('combat:hit', () => {
      for (const c of this.combat.all) {
        if (c.invuln > 0 && c.side !== 'player') this.bars.notifyHit(c)
      }
    })

    // Linh lực và hồi chiêu miễn phí: màn này để XEM chiêu, chờ hồi 40 giây là
    // chờ vô nghĩa. Cổng `phase !== 'none'` vẫn chặn chiêu chồng lên nhau.
    this.player.caster.freeCast = true
    this.player.caster.noCooldown = true
    // Chuột trái ở đây là nút XOAY CAMERA, nên nó không được ra đòn nữa: kéo
    // một vòng quanh nhân vật mà mỗi lần kéo lại chém ra ba nhát thì vừa che
    // mất chiêu đang diễn vừa đánh sập vòng bia. Muốn chém tay thì còn `J`.
    this.player.mouseAttack = false

    this.showcase.reset()
    this.showcase.select(0, this.actions)
    this.panel.show()

    // Cho zoom sát hơn hẳn lượt chơi. Ở đây chỉ có MỘT vật đáng nhìn và không
    // có gì đánh lén từ sau lưng, nên khoảng cách tối thiểu không cần chừa tầm
    // nhìn chiến thuật — 5 unit là đủ gần để đếm nếp áo Hàn Lập và nhìn rõ
    // đường đi của từng thanh kiếm trúc.
    this.prevMinDistance = camera.minDistance
    camera.minDistance = CLOSE_DISTANCE
    camera.snapTo(0, 0.9, 0)
    three.updateMatrixWorld(true)
    ctx.bus.emit('scene:loaded', { name: this.name })
  }

  /** Cột đá và đèn quanh vành đài. */
  private placeRim(rng: SceneContext['rng']): void {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8
      const pillar = buildStonePillar(rng, 3.8)
      pillar.position.set(Math.cos(a) * PILLAR_RING, 0, Math.sin(a) * PILLAR_RING)
      this.add(pillar)
      // Cột là vật CHẶN thật: không có nó thì đàn kiếm và phi hành khí bay
      // xuyên qua chỗ đáng ra phải va, và người xem không đọc được tầm chiêu
      this.collision.addStatic(pillar.position.x, pillar.position.z, 0.42)
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      const lantern = buildStoneLantern(1.5)
      lantern.position.set(Math.cos(a) * LANTERN_RING, 0, Math.sin(a) * LANTERN_RING)
      this.add(lantern)
    }
  }

  /**
   * Bốn chỗ đặt đèn lạnh cho bộ stylized — chân bốn cột đá.
   *
   * Ở đây chứ không trong bảng debug vì màn mới là nơi biết cột đá đứng đâu.
   */
  get coolSpots(): ReadonlyArray<{ x: number; y: number; z: number }> {
    return [0, 1, 2, 3].map((i) => {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4
      return { x: Math.cos(a) * PILLAR_RING, y: 1.4, z: Math.sin(a) * PILLAR_RING }
    })
  }

  /** Đặt cảnh giới cho chiêu sắp diễn. Đổi cảnh giới thì bù đầy luôn hai thanh. */
  private setRealm(realm: RealmPosition): void {
    const p = this.player
    if (p.cultivation.realm.major !== realm.major || p.cultivation.realm.tier !== realm.tier) {
      p.cultivation.realm.major = realm.major
      p.cultivation.realm.tier = realm.tier
      p.cultivation.tuVi = 0
      p.refreshStats()
      this.hud.setRealm(p.realm)
    }
    this.restore()
  }

  /**
   * Bù đầy sinh lực và linh lực.
   *
   * Gọi trước MỖI nhịp diễn chứ không chỉ lúc đổi chiêu, vì chiêu lặp vô hạn:
   * Giá Y Thần Công đốt 18% máu mỗi lần thi triển và ngự kiếm phi hành đốt 2,2%
   * linh lực mỗi giây, nên xem một chiêu vài phút là hai thanh cạn đáy — nhân
   * vật rơi khỏi kiếm giữa chừng, và người xem đọc ra là một cái lỗi chứ không
   * phải cái giá của chiêu. Bù ngay TRƯỚC nhịp nên cú tụt vẫn thấy rõ đúng lúc.
   */
  private restore(): void {
    const p = this.player
    p.combatant.hp = p.combatant.stats.maxSinhLuc
    p.linhLuc = p.combatant.stats.maxLinhLuc
  }

  /**
   * Dựng lại vòng bia.
   *
   * Xoá thẳng chứ không cho chết diễn cảnh: bước mới cần một sân sạch NGAY, và
   * mười tám cái xác đang đổ chồng lên vòng bia mới thì bước sau đọc ra là một
   * đống đổ nát chứ không phải một bài trình diễn.
   */
  private spawnTargets(): void {
    for (const t of this.targets) {
      this.combat.remove(t.combatant)
      this.ctx.three.remove(t.root)
    }
    this.targets.length = 0

    const realm = this.player.realm
    for (const ring of TARGET_RINGS) {
      for (let i = 0; i < ring.count; i++) {
        const a = (i / ring.count) * Math.PI * 2 + (ring.radius > 4 ? Math.PI / ring.count : 0)
        const x = Math.cos(a) * ring.radius
        const z = Math.sin(a) * ring.radius
        const target = new TrainingTarget(ring.kind, realm, ring.hp)
        // Quay mặt VÀO TÂM: mặt trước của mộc nhân và mặt khắc chữ của bia đều
        // hướng về chỗ Hàn Lập đứng, nên mọi đòn đều đánh vào mặt hứng
        target.place(x, z, 0, Math.atan2(-x, -z))
        this.targets.push(target)
        this.combat.add(target.combatant)
        this.ctx.three.add(target.root)

        const socket = buildTargetSocket(0.44)
        socket.position.set(x, 0.05, z)
        this.ctx.three.add(socket)
        this.objects.push(socket)
      }
    }
  }

  private add(obj: Object3D): void {
    this.ctx.three.add(obj)
    this.objects.push(obj)
  }

  /**
   * Đọc phím của màn trình diễn.
   *
   * Dùng `Q` / `E`, KHÔNG dùng `Space` và mũi tên: `Space` đã là phím ngự kiếm
   * phi hành và mũi tên đã là phím di chuyển. Chồng lên nhau thì một lần bấm
   * `Space` vừa đổi chiêu vừa cất nhân vật lên trời.
   */
  private readInput(): void {
    const { input } = this.ctx
    if (input.wasPressed('KeyE')) this.showcase.next(this.actions)
    if (input.wasPressed('KeyQ')) this.showcase.prev(this.actions)
    if (input.wasPressed('Escape')) this.ctx.bus.emit('game:pauseRequest', {})
  }

  fixedUpdate(dt: number): void {
    const { input, camera, bus } = this.ctx
    this.elapsed += dt
    this.combat.rebuildIndex()

    this.readInput()
    this.showcase.fixedUpdate(dt, this.actions)

    this.player.fixedUpdate(
      dt,
      input,
      camera,
      this.collision,
      this.combat,
      this.projectiles,
      this.swords,
    )
    // Kẹp trong lòng đài. Đơn giản hơn hẳn việc dựng một vành va chạm: vành
    // tròn ghép từ hình tròn tĩnh thì luôn có kẽ hở giữa hai hình, mà một cú
    // Phong Lôi Sí dài 10,5 unit thì tìm ra kẽ hở đó ngay lần lướt đầu tiên.
    const p = this.player.combatant
    const d = Math.hypot(p.pos.x, p.pos.z)
    const limit = TERRACE_RADIUS - 0.7
    if (d > limit) {
      p.pos.x = (p.pos.x / d) * limit
      p.pos.z = (p.pos.z / d) * limit
    }

    for (const t of this.targets) {
      const dot = t.fixedUpdate(dt)
      if (dot > 0) {
        const kind = t.combatant.effects.has('thieuDot') ? 'thieuDot' : 'trungDoc'
        this.combat.applyDirectDamage(t.combatant, dot, kind)
      }
    }

    this.projectiles.fixedUpdate(dt, this.collision, FLAT_GROUND)
    this.swords.fixedUpdate(dt)
    this.combat.resolveCrowding()
    this.player.combatant.applyTransform()

    this.publishVitals(bus)
    camera.follow(this.player.pos.x, this.player.y + 0.9, this.player.pos.z)
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

  render(_alpha: number, frameDt: number): void {
    const { input, camera } = this.ctx
    this.player.render(frameDt)
    for (const t of this.targets) t.render(frameDt)
    this.swords.render(frameDt)

    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null
    const w = canvas?.clientWidth ?? window.innerWidth
    const h = canvas?.clientHeight ?? window.innerHeight

    const pl = this.player
    const alive = pl.combatant.alive
    this.vfx.follow(
      'player:run',
      alive && !pl.flying && pl.moveSpeed > 2.4,
      pl.pos.x,
      pl.y + 0.22,
      pl.pos.z,
      RUN_TRAIL,
    )
    this.vfx.follow('player:fly', alive && pl.flying, pl.pos.x, pl.y + 0.05, pl.pos.z, FLY_TRAIL)
    this.followWings(alive)
    if (alive) {
      this.vfx.footAuraStep(
        frameDt,
        pl.pos.x,
        pl.y,
        pl.pos.z,
        pl.combatant.facing,
        pl.moveSpeed,
        pl.flying,
      )
    }

    this.vfx.update(frameDt, camera.camera, w, h)
    this.bars.update(frameDt, this.combat.all, camera.camera, w, h)
    this.skillBar.update(frameDt, pl.caster, pl.realm, pl.linhLuc, pl.loadout)
    this.hud.setCultivation(pl.cultivation)

    const me = pl.combatant
    const shield = me.effects.find('khien')
    this.vfx.shield.update(
      frameDt,
      shield !== undefined && !me.dead,
      me.pos.x,
      me.y,
      me.pos.z,
      me.radius * 2.05,
      shield ? Math.min(1, shield.magnitude / Math.max(1, me.stats.thanThuc * 5.5)) : 0,
    )

    // Vành đá lơ lửng quay rất chậm — đủ để đài "sống", không đủ để hút mắt
    if (this.floatRing) this.floatRing.rotation.y = this.elapsed * 0.045
    if (this.halo) {
      const pulse = 0.9 + Math.sin(this.elapsed * 1.3) * 0.1
      this.halo.scale.set(pulse, 1, pulse)
    }

    if (this.targetMarker) {
      const target = pl.autoAim ? pl.aim.target : null
      if (target && !me.dead) {
        this.targetMarker.position.set(target.pos.x, target.y + 0.06, target.pos.z)
        this.targetMarker.visible = true
      } else {
        this.targetMarker.visible = false
      }
    }

    if (this.marker) {
      if (camera.screenToGround(input.pointerNdcX, input.pointerNdcY, this.cursor, pl.y)) {
        this.marker.position.set(this.cursor.x, 0.07, this.cursor.z)
        this.marker.visible = true
      } else {
        this.marker.visible = false
      }
    }
  }

  /**
   * Vệt lôi ở hai đầu cánh Phong Lôi Sí.
   *
   * Lấy toạ độ đầu cánh trong không gian WORLD, không tính lại từ vị trí nhân
   * vật: đầu cánh treo dưới xương thân qua hai lớp `Group` đang xoay theo nhịp
   * vỗ, nên chỉ ma trận world mới biết nó đang ở đâu. Cộng một khoảng lệch cố
   * định vào vị trí nhân vật thì vệt bám vào một điểm đứng yên bên cạnh cánh.
   */
  private followWings(alive: boolean): void {
    const pl = this.player
    // Phải có cả ĐANG BAY LƯỚT, không chỉ "cánh đang xoè".
    //
    // Cánh vỗ tại chỗ thì đầu cánh chạy đi chạy lại trên một cung ngắn, và vệt
    // dài 0,3 giây cuộn chồng lên chính nó thành một ĐỐM SÁNG ĐẶC — hai khối
    // trắng hai bên vai, che kín đúng đôi cánh mà nó đang cố tôn lên. Vệt là
    // thứ nói "vật này đang lao qua không gian"; đứng yên thì nó không có gì
    // để nói. Ngưỡng 2,4 lấy đúng ngưỡng của vệt chạy bộ.
    const on = alive && pl.wingsOut && pl.moveSpeed > 2.4
    for (const side of [-1, 1]) {
      const key = side > 0 ? 'wing:L' : 'wing:R'
      if (!on) {
        this.vfx.follow(key, false, 0, 0, 0)
        continue
      }
      pl.wingTip(side, this.wingTip)
      this.vfx.follow(key, true, this.wingTip.x, this.wingTip.y, this.wingTip.z, WING_TRAIL)
    }
  }

  unload(): void {
    // Trả lại trần zoom: camera là của `Game`, không của màn — để nguyên 5 thì
    // quay về đấu trường vẫn zoom sát được vào gáy nhân vật và mất hết tầm nhìn
    const { camera } = this.ctx
    camera.minDistance = this.prevMinDistance
    camera.distance = Math.max(camera.distance, this.prevMinDistance)

    for (const obj of this.objects) obj.removeFromParent()
    this.objects.length = 0
    for (const t of this.targets) t.root.removeFromParent()
    this.targets.length = 0
    this.projectiles.dispose()
    this.swords.dispose()
    this.vfx.dispose()
    this.hud.dispose()
    this.skillBar.dispose()
    this.bars.dispose()
    this.panel.dispose()
    this.collision.clear()
  }
}
