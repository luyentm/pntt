import { Mesh, MathUtils, Vector3 } from 'three'
import { CAST, FLY, MEDITATE } from '@/anim/clips/combat'
import { flyingSwordGeometry } from '@/art/props/swords'
import { buildChibi, chibiRadius, type Chibi } from '@/art/buildChibi'
import type { Input } from '@/core/Input'
import { MouseBtn } from '@/core/Input'
import {
  ATTACK_STEPS,
  COMBO_CHAIN_WINDOW,
  HAN_LAP_BASE,
  HAN_LAP_LOOK,
  START_REALM,
  type AttackStep,
} from '@/game/data/player'
import { REALM, realmOrdinal, type RealmPosition } from '@/game/data/realms'
import { itemDef } from '@/game/data/items'
import { Cultivation } from '@/game/Cultivation'
import { loadoutFor } from '@/game/Loadout'
import type { SkillDef } from '@/game/data/skills'
import { Inventory } from '@/game/Inventory'
import { deriveStats } from '@/game/Stats'
import { materials } from '@/render/Materials'
import type { IsoCamera } from '@/render/IsoCamera'
import type { EventBus } from '@/core/EventBus'
import type { GameEvents } from '@/core/events'
import { AutoAim, AUTO_AIM_RANGE } from './AutoAim'
import type { CollisionWorld } from './Collision'
import { Combatant } from './Combatant'
import type { CombatWorld } from './CombatWorld'
import type { ProjectileSystem } from './Projectile'
import type { SwordStorm } from './SwordStorm'
import { SkillCaster } from './SkillCaster'
import type { HeightField } from './Terrain'
import { ChibiView } from './views'

/** Tốc độ chạy mặc định (world unit / giây) — lấy từ chỉ số nền. */
const WALK_MULTIPLIER = 0.42
const ACCEL = 26
const DECEL = 34
/** Rad/giây. Đủ nhanh để thấy nhạy, đủ chậm để cú quay người còn đọc được. */
const TURN_RATE = 13
/** Quay nhanh hơn nhiều khi ra đòn, để đòn đánh đi đúng hướng con trỏ. */
const ATTACK_TURN_RATE = 26

/**
 * Hỗ trợ ngắm: lúc bắt đầu đòn, nếu có địch trong tầm và nằm trong nửa góc này
 * so với hướng đang ngắm, thì tự chỉnh hướng vào nó.
 *
 * Cần thiết vì ngắm hoàn toàn theo con trỏ rất dễ trượt: người chơi đang bấm
 * WASD chạy thì tay chuột không theo kịp, và một đòn chém trượt vì lệch 10 độ
 * đọc ra là "game không nhận input" chứ không phải "mình ngắm sai".
 * Vẫn giữ nửa góc HẸP (60 độ) để việc quay người và chọn mục tiêu còn ý nghĩa.
 */
const AIM_ASSIST_ARC = Math.PI / 3
/** Nhân vào tầm đòn để tìm mục tiêu hỗ trợ ngắm. */
const AIM_ASSIST_REACH = 1.7

/** Giới hạn mềm của bản đồ — không cho đi mãi vào trong sương. */
const WORLD_RADIUS = 70

// ---------- Ngự Kiếm Phi Hành (mở ở Trúc Cơ) ----------
/** Cao độ bay so với mặt đất. */
const FLY_ALTITUDE = 2.05
/** Tốc độ bốc lên và tốc độ rơi xuống (unit/giây). */
const FLY_RISE = 3.4
const FLY_DROP = 5.4
/** Bay nhanh hơn đi bộ bấy nhiêu lần. */
const FLY_SPEED_MULT = 1.62
/**
 * Linh lực tốn mỗi giây khi đang bay, tính theo PHẦN của tổng linh lực.
 *
 * Không phải một hằng số tuyệt đối: linh lực tối đa tăng theo cảnh giới, nên
 * một con số cố định sẽ khiến phi hành gần như miễn phí ở Kết Đan (bay được 15
 * phút liền) và mất hẳn tính chất "phải cân nhắc khi nào nên bay". Theo phần
 * trăm thì ở mọi cảnh giới đều bay được khoảng 45 giây một hơi.
 */
const FLY_COST_FRACTION = 0.022
/**
 * Cao hơn mốc này thì bỏ qua va chạm với vật cản tĩnh.
 * Thấp hơn mốc thì vẫn bị chặn, nên lúc vừa nhấc lên không xuyên qua tảng đá.
 */
const FLY_CLEARANCE = 0.85
/** Khoảng cách thời gian giữa hai vệt gió. */
const FLY_TRAIL_INTERVAL = 0.13
/** Cảnh giới tối thiểu để ngự kiếm phi hành. */
const FLY_REALM: RealmPosition = { major: REALM.TRUC_CO, tier: 0 }

type AttackPhase = 'none' | 'windup' | 'recover'

/** Nội suy góc theo đường ngắn nhất, có giới hạn bước. */
function turnToward(from: number, to: number, maxStep: number): number {
  let d = to - from
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  if (Math.abs(d) <= maxStep) return to
  return from + Math.sign(d) * maxStep
}

export class Player {
  readonly chibi: Chibi
  readonly combatant: Combatant
  caster!: SkillCaster
  readonly cultivation = new Cultivation(START_REALM)
  readonly inventory = new Inventory()
  /** Đang toạ thiền — mất khả năng di chuyển, đổi lấy Tu Vi. */
  meditating = false
  /**
   * Đang nhập định để đột phá.
   *
   * Khác `meditating`: toạ thiền do người chơi giữ phím và nhả ra là xong, còn
   * nhập định do màn thử dẫn khí điều khiển — chỉ ArenaScene mới được mở và
   * đóng nó, vì nó phải khớp với vòng đời của màn thử.
   */
  entranced = false

  private ground: HeightField | null = null
  private bus: EventBus<GameEvents> | null = null
  private readonly cursor = new Vector3()
  private vx = 0
  private vz = 0
  private speed = 0

  /** Linh lực hiện tại. Chưa tiêu vào đâu tới M4, nhưng đã hồi để HUD nói thật. */
  linhLuc = 0

  /**
   * Tự ngắm thay cho ngắm bằng chuột. Bật mặc định.
   *
   * Vẫn giữ đường ngắm bằng chuột phía sau một công tắc trong Cài đặt chứ không
   * xoá: nó vẫn là cách ngắm chính xác nhất khi người chơi muốn chọn đúng một
   * con trong đám, chỉ là không nên là mặc định.
   */
  autoAim = true
  readonly aim = new AutoAim()

  /** Đang cưỡi phi kiếm. */
  flying = false
  /** Cao độ hiện tại trên mặt đất — nội suy nên lúc lên/xuống thấy được. */
  private flyHeight = 0
  private flyTrailTimer = 0
  /** Phi kiếm dưới chân. Con của chibi.root nên tự bám vị trí và hướng nhân vật. */
  private readonly sword: Mesh

  private phase: AttackPhase = 'none'
  private comboStep = 0
  private phaseTimer = 0
  private chainTimer = 0
  private queuedAttack = false

  /** Hướng đi mong muốn của bước này, đã quy theo góc camera. */
  private moveDirX = 0
  private moveDirZ = 0

  /** Ô nào giữ chiêu nào — tính lại mỗi lần cảnh giới đổi. */
  private slots: ReadonlyArray<SkillDef | null> = []

  private readonly forward = new Vector3()
  private readonly right = new Vector3()
  private readonly aimPoint = new Vector3()
  private readonly hitBuffer: Combatant[] = []

  constructor() {
    this.chibi = buildChibi({
      name: 'HanLap',
      height: 1,
      detail: 'full',
      ...HAN_LAP_LOOK,
    })
    const stats = deriveStats(HAN_LAP_BASE, this.cultivation.realm)
    this.combatant = new Combatant(
      'player',
      stats,
      this.cultivation.realm,
      chibiRadius(1),
      new ChibiView(this.chibi),
    )
    this.combatant.view.showIdle()
    this.linhLuc = stats.maxLinhLuc
    this.slots = loadoutFor(this.cultivation.realm)

    // Gắn vào chibi.root, KHÔNG vào xương: phi kiếm phải đứng yên dưới chân
    // trong khi thân người nhấp nhô theo clip. Gắn vào xương thì kiếm cũng
    // nhấp nhô, và mất luôn cảm giác người đang đứng trên một vật rắn.
    this.sword = new Mesh(
      flyingSwordGeometry(),
      materials.flat(0xffffff, { vertexColors: true }),
    )
    this.sword.name = 'phiKiem'
    this.sword.position.set(0, -0.05, 0.04)
    this.sword.visible = false
    this.sword.castShadow = false
    this.chibi.root.add(this.sword)
  }

  /** Đã tới Trúc Cơ chưa — cổng mở của Ngự Kiếm Phi Hành. */
  get canFly(): boolean {
    return realmOrdinal(this.cultivation.realm) >= realmOrdinal(FLY_REALM)
  }

  /** Gắn bus để thi triển pháp thuật. Phải gọi trước fixedUpdate. */
  attachBus(bus: EventBus<GameEvents>): void {
    this.bus = bus
    this.caster = new SkillCaster(this.combatant, bus)
  }

  /**
   * Cảnh giới. Là VIEW vào `cultivation.realm`, không phải bản sao — nếu giữ
   * hai bản thì đột phá xong sẽ có chỗ đọc cảnh giới cũ và stat lệch âm thầm.
   */
  get realm(): RealmPosition {
    return this.cultivation.realm
  }

  get pos(): { x: number; z: number } {
    return this.combatant.pos
  }

  get y(): number {
    return this.combatant.y
  }

  get radius(): number {
    return this.combatant.radius
  }

  get isAttacking(): boolean {
    return this.phase !== 'none'
  }

  /** Tốc độ di chuyển thực tế của khung vừa rồi, world unit mỗi giây. */
  get moveSpeed(): number {
    return this.speed
  }

  /** Độ cao so với mặt đất do phi hành, 0 khi đứng đất. */
  get altitude(): number {
    return this.flyHeight
  }

  /** Gắn nguồn cao độ. Phải gọi trước spawn(). */
  setGround(ground: HeightField): void {
    this.ground = ground
  }

  private groundHeight(x: number, z: number): number {
    return this.ground ? this.ground.heightAt(x, z) : 0
  }

  /**
   * Ô nào giữ chiêu nào ở cảnh giới hiện tại.
   *
   * Tính lại trong `refreshStats` chứ không tính mỗi khung: nó chỉ đổi khi cảnh
   * giới đổi, mà `loadoutFor` quét cả bảng pháp thuật — chạy nó 60 lần một giây
   * để nhận về đúng một kết quả là lãng phí không có lý do.
   */
  get loadout(): ReadonlyArray<SkillDef | null> {
    return this.slots
  }

  /** Cập nhật stat và thanh pháp thuật sau khi đột phá cảnh giới (M5). */
  refreshStats(): void {
    const hpRatio = this.combatant.hp / Math.max(1, this.combatant.stats.maxSinhLuc)
    const mpRatio = this.linhLuc / Math.max(1, this.combatant.stats.maxLinhLuc)
    this.combatant.stats = deriveStats(HAN_LAP_BASE, this.cultivation.realm)
    this.combatant.realm = this.cultivation.realm
    // Giữ TỈ LỆ chứ không giữ con số: đột phá mà máu vẫn 30/1200 thì vô nghĩa
    this.combatant.hp = Math.max(1, Math.round(this.combatant.stats.maxSinhLuc * hpRatio))
    this.linhLuc = Math.round(this.combatant.stats.maxLinhLuc * mpRatio)
    this.slots = loadoutFor(this.cultivation.realm)
  }

  /** Hồi sinh đầy máu tại chỗ chỉ định. */
  revive(x: number, z: number, facing = 0): void {
    this.combatant.dead = false
    this.combatant.deadFor = 0
    this.combatant.hp = this.combatant.stats.maxSinhLuc
    this.linhLuc = this.combatant.stats.maxLinhLuc
    this.combatant.stagger = 0
    this.combatant.invuln = 1.2
    this.combatant.knockVx = 0
    this.combatant.knockVz = 0
    this.spawn(x, z, facing)
    this.combatant.view.showIdle()
  }

  spawn(x: number, z: number, facing = 0): void {
    this.flying = false
    this.flyHeight = 0
    this.sword.visible = false
    this.combatant.place(x, z, this.groundHeight(x, z), facing)
    this.vx = 0
    this.vz = 0
    this.speed = 0
    this.phase = 'none'
    this.comboStep = 0
    this.chainTimer = 0
    this.queuedAttack = false
    this.caster?.reset()
  }

  /** Nhịp fixed 60Hz. */
  fixedUpdate(
    dt: number,
    input: Input,
    camera: IsoCamera,
    collision: CollisionWorld,
    world: CombatWorld,
    projectiles: ProjectileSystem,
    swords: SwordStorm,
  ): void {
    const me = this.combatant
    const dot = me.tickTimers(dt)
    if (dot > 0) {
      world.applyDirectDamage(me, dot, me.effects.has('thieuDot') ? 'thieuDot' : 'trungDoc')
    }

    // Trường Xuân Công: hồi linh lực liên tục. Trong truyện đây chính là ưu thế
    // lớn nhất của công pháp này — tu luyện và hồi phục nhanh hơn người khác.
    const regen = this.meditating ? 0.12 : 0.035
    this.linhLuc = Math.min(me.stats.maxLinhLuc, this.linhLuc + me.stats.maxLinhLuc * regen * dt)

    // Tiểu Bình tự tích linh nhũ, kể cả khi đang đánh nhau — đúng như trong truyện
    this.cultivation.tickLinhNhu(dt)

    if (me.dead) {
      // Chết thì rơi khỏi phi kiếm — applyMotion sẽ hạ dần cao độ về mặt đất
      this.flying = false
      this.flyHeight = Math.max(0, this.flyHeight - FLY_DROP * dt)
      this.sword.visible = false
      this.applyMotion(dt, 0, 0, collision)
      return
    }

    if (this.entranced) {
      // Nhập định: đứng yên, không đánh, không thi triển. Vẫn ăn đòn được —
      // đó chính là chỗ căng của màn thử: đột phá giữa bãi quái là tự tìm khổ.
      this.applyMotion(dt, 0, 0, collision)
      // Vẫn nhịp bộ thi triển để hồi chiêu tiếp tục chạy trong lúc nhập định.
      // An toàn vì beginTrance() đã reset nó và trong lúc nhập định không đọc
      // phím pháp thuật, nên không thể có chiêu nào đang chờ phát.
      this.caster.fixedUpdate(dt, {
        world,
        projectiles,
        swords,
        cursorX: me.pos.x,
        cursorZ: me.pos.z,
      })
      return
    }

    // Ghi nhận lệnh đánh và GIỮ LẠI, không bỏ.
    // Người chơi luôn bấm hơi sớm; nếu bỏ lệnh bấm trong lúc đang hồi đòn thì
    // combo hay bị "rơi nhát" và cảm giác điều khiển thành ì.
    //
    // GIỮ cũng đánh, không chỉ BẤM. Hai lý do:
    //  - Đó là điều người chơi ARPG mong đợi: giữ chuột là chém liên tục.
    //  - Nếu chỉ nhận lúc bấm thì hành vi không nhất quán: khi cửa sổ mất rồi
    //    lấy lại focus, `releaseAll()` xoá trạng thái phím nên sự kiện auto-repeat
    //    tiếp theo bị tính là một lần bấm mới và đòn tự phát. Nhận cả trạng thái
    //    giữ thì hai đường đi cho ra cùng một kết quả.
    const attackPressed = input.mouseWasPressed(MouseBtn.Left) || input.wasPressed('KeyJ')
    const attackHeld = input.mouseIsDown(MouseBtn.Left) || input.isDown('KeyJ')
    if (attackPressed || (attackHeld && this.phase === 'none')) {
      this.queuedAttack = true
    }

    if (me.immobilized) {
      // Trúng đòn hoặc bị đóng băng thì đòn đang ra bị huỷ
      this.phase = 'none'
      this.chainTimer = 0
      this.applyMotion(dt, 0, 0, collision)
      this.combatant.view.showMove(this.speed)
      return
    }

    this.updateMeditation(dt, input)
    if (this.meditating) {
      // Toạ thiền thì không làm gì khác: đó là cái giá của việc tu luyện nhanh
      this.applyMotion(dt, 0, 0, collision)
      return
    }

    this.updateFlight(dt, input)
    // Hướng đi tính MỘT LẦN ở đây rồi dùng lại cho cả tự ngắm và di chuyển:
    // tự ngắm cần biết người chơi đang chạy về đâu, mà nó chạy trước bước di
    // chuyển, nên nếu để updateMovement tự tính thì tự ngắm phải tính lại
    this.computeMoveDir(input, camera)
    if (this.autoAim) {
      this.aim.update(me, world, AUTO_AIM_RANGE, this.moveDirX, this.moveDirZ)
    } else {
      this.aim.clear()
    }
    this.updateAim(input, camera, dt)
    this.updateSkills(dt, input, camera, world, projectiles, swords)
    // Đang cưỡi kiếm thì không chém: hai chân đang đứng trên chính thanh kiếm
    // đó. Đây là cái giá thật của phi hành — đổi đòn đánh gần lấy tốc độ, tầm
    // nhìn và khả năng vượt địa hình, nên bay không phải là lựa chọn luôn đúng.
    if (this.flying) {
      this.queuedAttack = false
      this.phase = 'none'
    } else {
      this.updateAttack(dt, world)
    }
    this.updateMovement(dt, input, camera, collision)

    // Lúc bay thì clip FLY giữ nguyên, không để clip di chuyển ghi đè
    if (this.phase === 'none' && !this.caster.isCasting && !this.flying) {
      this.combatant.view.showMove(this.speed)
    }
  }

  /**
   * Ngự Kiếm Phi Hành: bấm `Space` để lên/xuống.
   *
   * Là một CHẾ ĐỘ DI CHUYỂN, không phải một ô pháp thuật: nó đổi hẳn cách đi
   * lại (bay qua rừng, qua đá, nhanh hơn) nên nếu nhét vào ô skill có hồi chiêu
   * thì cảm giác "vừa đột phá Trúc Cơ là cả thế giới nhỏ lại" sẽ không còn.
   */
  private updateFlight(dt: number, input: Input): void {
    const me = this.combatant

    if (input.wasPressed('Space')) {
      if (this.flying) {
        this.stopFlying()
      } else if (!this.canFly) {
        this.bus?.emit('skill:failed', { reason: 'Phải tới Trúc Cơ mới ngự kiếm phi hành' })
      } else if (this.linhLuc < this.flyCostPerSecond() * 2) {
        this.bus?.emit('skill:failed', { reason: 'Không đủ linh lực để ngự kiếm' })
      } else {
        this.startFlying()
      }
    }

    if (this.flying) {
      this.linhLuc = Math.max(0, this.linhLuc - this.flyCostPerSecond() * dt)
      // Hết linh lực hoặc bị đánh choáng thì RƠI. Đây là chỗ nguy của phi hành:
      // bay giữa bãi quái mà ăn một đòn choáng là mất luôn thế bay.
      if (this.linhLuc <= 0 || me.stagger > 0) this.stopFlying()
    }

    const target = this.flying ? FLY_ALTITUDE : 0
    const rate = this.flying ? FLY_RISE : FLY_DROP
    if (this.flyHeight < target) this.flyHeight = Math.min(target, this.flyHeight + rate * dt)
    else if (this.flyHeight > target) this.flyHeight = Math.max(target, this.flyHeight - rate * dt)

    this.sword.visible = this.flyHeight > 0.02

    if (this.flying && this.speed > 1.4) {
      this.flyTrailTimer -= dt
      if (this.flyTrailTimer <= 0) {
        this.flyTrailTimer = FLY_TRAIL_INTERVAL
        this.bus?.emit('flight:trail', {
          x: me.pos.x,
          y: me.y,
          z: me.pos.z,
          facing: me.facing,
        })
      }
    }
  }

  /** Linh lực tốn mỗi giây khi bay, ở cảnh giới hiện tại. */
  private flyCostPerSecond(): number {
    return this.combatant.stats.maxLinhLuc * FLY_COST_FRACTION
  }

  private startFlying(): void {
    this.flying = true
    this.meditating = false
    this.phase = 'none'
    this.chainTimer = 0
    this.queuedAttack = false
    this.flyTrailTimer = 0
    this.chibi.animator.clearOverlay()
    this.chibi.animator.play(FLY, 0.18)
    this.chibi.animator.timeScale = 1
    this.bus?.emit('flight:toggle', { active: true })
  }

  private stopFlying(): void {
    if (!this.flying) return
    this.flying = false
    this.combatant.view.showIdle()
    this.bus?.emit('flight:toggle', { active: false })
  }

  /** Đọc phím 1..6 và cập nhật bộ thi triển. */
  private updateSkills(
    dt: number,
    input: Input,
    camera: IsoCamera,
    world: CombatWorld,
    projectiles: ProjectileSystem,
    swords: SwordStorm,
  ): void {
    const me = this.combatant
    // Điểm ngắm: mục tiêu tự ngắm nếu có, không thì điểm dưới con trỏ chiếu ở
    // đúng cao độ chân nhân vật
    camera.screenToGround(input.pointerNdcX, input.pointerNdcY, this.cursor, me.y)
    const target = this.autoAim ? this.aim.target : null
    const ctx = {
      world,
      projectiles,
      swords,
      cursorX: target ? target.pos.x : this.cursor.x,
      cursorZ: target ? target.pos.z : this.cursor.z,
      dashDirX: this.moveDirX,
      dashDirZ: this.moveDirZ,
    }

    const slot = input.skillPressed()
    const pressedId = slot >= 0 ? (this.slots[slot]?.id ?? null) : null
    if (pressedId) {
      // Quay mặt về điểm ngắm TRƯỚC khi thi triển: chiêu bay theo hướng nhân vật
      this.faceAim(ctx.cursorX, ctx.cursorZ)
      const result = this.caster.tryCast(pressedId, this.realm, this.linhLuc, ctx)
      if (result.ok) {
        this.linhLuc -= result.cost
        // Thi triển thì bỏ đòn đánh đang ra — không cho vừa chém vừa niệm chú
        this.phase = 'none'
        this.chainTimer = 0
        this.queuedAttack = false
        this.chibi.animator.clearOverlay()
        this.chibi.animator.play(CAST, 0.06)
        this.chibi.animator.timeScale = 1
      } else if (this.bus) {
        this.bus.emit('skill:failed', { reason: result.reason })
      }
    }

    this.caster.fixedUpdate(dt, ctx)
  }

  /** Quay tức thì về điểm ngắm — dùng lúc bắt đầu thi triển pháp thuật. */
  private faceAim(x: number, z: number): void {
    const me = this.combatant
    const dx = x - me.pos.x
    const dz = z - me.pos.z
    if (Math.hypot(dx, dz) < 0.3) return
    me.facing = Math.atan2(dx, dz)
  }

  /** Vào nhập định để đột phá. ArenaScene gọi khi màn thử bắt đầu. */
  beginTrance(): void {
    this.entranced = true
    this.meditating = false
    this.stopFlying()
    this.phase = 'none'
    this.chainTimer = 0
    this.queuedAttack = false
    this.caster.reset()
    this.chibi.animator.clearOverlay()
    this.chibi.animator.play(MEDITATE, 0.25)
    this.chibi.animator.timeScale = 1
  }

  /** Ra khỏi nhập định. */
  endTrance(): void {
    if (!this.entranced) return
    this.entranced = false
    this.combatant.view.showIdle()
  }

  /**
   * Toạ thiền: giữ `F` khi đang đứng yên.
   *
   * Tự thoát ngay khi có input di chuyển hoặc khi bị đánh — người chơi không
   * bao giờ nên bị kẹt trong trạng thái bất lực mà phải bấm thêm nút để thoát.
   */
  private updateMeditation(dt: number, input: Input): void {
    const wantsMeditate = input.isDown('KeyF')
    const moving = input.moveAxis().x !== 0 || input.moveAxis().z !== 0

    if (this.meditating) {
      if (!wantsMeditate || moving || this.combatant.stagger > 0) {
        this.meditating = false
        this.combatant.view.showIdle()
        return
      }
      const result = this.cultivation.meditate(dt)
      if (result.tiersGained > 0 && this.bus) {
        this.onTierUp(result.tiersGained)
      }
      return
    }

    if (wantsMeditate && !moving && this.speed < 0.3 && !this.isAttacking && !this.caster.isCasting) {
      this.meditating = true
      this.stopFlying()
      this.chibi.animator.clearOverlay()
      this.chibi.animator.play(MEDITATE, 0.2)
      this.chibi.animator.timeScale = 1
    }
  }

  /**
   * Thi triển một chiêu theo ID, không qua bàn phím.
   *
   * Nhận ID chứ không nhận ô, và đó là điều làm Luyện Kiếm Đài diễn được CẢ
   * MƯỜI BẢY chiêu: thanh pháp thuật chỉ có mười ô nên bảy chiêu bị chiêu cảnh
   * giới cao chiếm chỗ, và nếu bộ trình diễn cũng đi qua ô thì bảy chiêu đó
   * không có đường nào gọi ra được.
   *
   * Không giả lập một lần bấm phím vì bàn phím được đọc trong `fixedUpdate`,
   * còn bộ trình diễn lại chạy TRƯỚC bước đó — lệnh giả sẽ trôi mất một bước
   * hoặc phát hai lần.
   */
  castSkill(
    id: string,
    world: CombatWorld,
    projectiles: ProjectileSystem,
    swords: SwordStorm,
  ): boolean {
    const me = this.combatant
    const target = this.autoAim ? this.aim.target : null
    const ctx = {
      world,
      projectiles,
      swords,
      cursorX: target ? target.pos.x : me.pos.x + Math.sin(me.facing) * 6,
      cursorZ: target ? target.pos.z : me.pos.z + Math.cos(me.facing) * 6,
      dashDirX: this.moveDirX,
      dashDirZ: this.moveDirZ,
    }
    this.faceAim(ctx.cursorX, ctx.cursorZ)
    const result = this.caster.tryCast(id, this.realm, this.linhLuc, ctx)
    if (!result.ok) return false
    this.linhLuc -= result.cost
    this.phase = 'none'
    this.chainTimer = 0
    this.queuedAttack = false
    this.chibi.animator.clearOverlay()
    this.chibi.animator.play(CAST, 0.06)
    this.chibi.animator.timeScale = 1
    return true
  }

  /** Ra một nhát đánh theo lệnh của mã. Dùng cho chế độ trình diễn. */
  triggerAttack(): void {
    this.queuedAttack = true
  }

  /** Bật/tắt phi hành theo lệnh của mã, bỏ qua điều kiện linh lực. */
  setFlying(on: boolean): void {
    if (on === this.flying) return
    if (on) this.startFlying()
    else this.stopFlying()
  }

  /** Bật/tắt toạ thiền theo lệnh của mã. */
  setMeditating(on: boolean): void {
    if (on === this.meditating) return
    if (on) {
      this.meditating = true
      this.stopFlying()
      this.chibi.animator.clearOverlay()
      this.chibi.animator.play(MEDITATE, 0.2)
      this.chibi.animator.timeScale = 1
    } else {
      this.meditating = false
      this.combatant.view.showIdle()
    }
  }

  /** Cộng Tu Vi từ nguồn ngoài (giết quái, đan dược, linh thạch). */
  gainTuVi(amount: number): void {
    const result = this.cultivation.gainTuVi(amount)
    if (result.tiersGained > 0) this.onTierUp(result.tiersGained)
  }

  private onTierUp(tiers: number): void {
    // Stat phải tính lại NGAY: nếu đợi tới frame sau thì có một frame nhân vật
    // đã lên tầng mà vẫn đánh bằng sức của tầng cũ
    this.refreshStats()
    this.bus?.emit('cultivation:tierUp', {
      realmName: this.cultivation.name,
      tiers,
      x: this.combatant.pos.x,
      y: this.combatant.y,
      z: this.combatant.pos.z,
    })
  }

  /** Uống hết Tiểu Bình. Trả về Tu Vi nhận được. */
  drinkLinhNhu(): number {
    const before = this.cultivation.realm.tier
    const gained = this.cultivation.drinkLinhNhu()
    if (this.cultivation.realm.tier > before) {
      this.onTierUp(this.cultivation.realm.tier - before)
    }
    return gained
  }

  /** Dùng một vật phẩm trong túi. Trả về mô tả kết quả, hoặc null nếu không dùng được. */
  useItem(id: string): string | null {
    if (!this.inventory.has(id)) return null
    const def = itemDef(id)
    const me = this.combatant

    switch (def.use.type) {
      case 'tuVi':
        this.inventory.remove(id)
        this.gainTuVi(def.use.amount)
        return `+${def.use.amount} Tu Vi`
      case 'hoiSinhLuc': {
        if (me.hp >= me.stats.maxSinhLuc) return null
        this.inventory.remove(id)
        const healed = Math.min(def.use.amount, me.stats.maxSinhLuc - me.hp)
        me.hp += healed
        return `+${Math.round(healed)} Sinh Lực`
      }
      case 'hoiLinhLuc': {
        if (this.linhLuc >= me.stats.maxLinhLuc) return null
        this.inventory.remove(id)
        const restored = Math.min(def.use.amount, me.stats.maxLinhLuc - this.linhLuc)
        this.linhLuc += restored
        return `+${Math.round(restored)} Linh Lực`
      }
      default:
        // Đan dược đột phá không "dùng" trực tiếp — nó được tiêu trong lúc đột phá
        return null
    }
  }

  /** Trong lúc ra đòn thì quay theo con trỏ chuột — ngắm bằng chuột như ARPG. */
  private updateAim(input: Input, camera: IsoCamera, dt: number): void {
    if (this.phase !== 'windup') return
    const me = this.combatant

    if (this.autoAim) {
      const angle = this.aim.angleTo(me)
      if (angle === null) return
      me.facing = turnToward(me.facing, angle, ATTACK_TURN_RATE * dt)
      return
    }

    if (!camera.screenToGround(input.pointerNdcX, input.pointerNdcY, this.aimPoint, me.y)) return
    const dx = this.aimPoint.x - me.pos.x
    const dz = this.aimPoint.z - me.pos.z
    if (Math.hypot(dx, dz) < 0.25) return
    me.facing = turnToward(me.facing, Math.atan2(dx, dz), ATTACK_TURN_RATE * dt)
  }

  private currentStep(): AttackStep {
    return ATTACK_STEPS[Math.min(this.comboStep, ATTACK_STEPS.length - 1)] as AttackStep
  }

  private updateAttack(dt: number, world: CombatWorld): void {
    if (this.chainTimer > 0) this.chainTimer = Math.max(0, this.chainTimer - dt)

    if (this.phase === 'none') {
      if (this.queuedAttack) {
        this.queuedAttack = false
        // Còn trong cửa sổ nối thì sang nhát tiếp, hết thì về nhát 1
        this.comboStep = this.chainTimer > 0 ? (this.comboStep + 1) % ATTACK_STEPS.length : 0
        this.beginStep(world)
      }
      return
    }

    this.phaseTimer -= dt

    if (this.phase === 'windup' && this.phaseTimer <= 0) {
      this.resolveSwing(world)
      this.phase = 'recover'
      this.phaseTimer = this.currentStep().recover
      this.chainTimer = COMBO_CHAIN_WINDOW
      return
    }

    if (this.phase === 'recover' && this.phaseTimer <= 0) {
      this.phase = 'none'
      if (this.queuedAttack) {
        this.queuedAttack = false
        this.comboStep = this.chainTimer > 0 ? (this.comboStep + 1) % ATTACK_STEPS.length : 0
        this.beginStep(world)
      }
    }
  }

  private beginStep(world: CombatWorld): void {
    const step = this.currentStep()
    this.phase = 'windup'
    this.phaseTimer = step.windup
    this.applyAimAssist(world, step)
    this.combatant.view.showAttack(this.comboStep)
  }

  /** Chỉnh hướng vào địch gần nhất nếu nó đã nằm trong góc ngắm. */
  private applyAimAssist(world: CombatWorld, step: AttackStep): void {
    const me = this.combatant

    // Tự ngắm: quay HẲN vào mục tiêu, không giới hạn góc. Giới hạn góc là để
    // tôn trọng hướng người chơi đang ngắm bằng chuột — mà ở chế độ tự ngắm thì
    // người chơi không ngắm gì cả, nên giữ nó lại chỉ làm đòn chém ra sau lưng.
    if (this.autoAim) {
      const angle = this.aim.angleTo(me)
      if (angle !== null) me.facing = angle
      return
    }

    const reach = (step.range + me.radius) * AIM_ASSIST_REACH
    const foe = world.nearestHostile(me, reach)
    if (!foe) return

    const dx = foe.pos.x - me.pos.x
    const dz = foe.pos.z - me.pos.z
    const dist = Math.hypot(dx, dz)
    if (dist < 1e-4) return

    const desired = Math.atan2(dx, dz)
    let delta = desired - me.facing
    while (delta > Math.PI) delta -= Math.PI * 2
    while (delta < -Math.PI) delta += Math.PI * 2
    // Ngoài góc hỗ trợ thì tôn trọng hướng người chơi đang ngắm
    if (Math.abs(delta) > AIM_ASSIST_ARC) return

    me.facing = desired
  }

  private resolveSwing(world: CombatWorld): void {
    const me = this.combatant
    const step = this.currentStep()
    const radius = step.range + me.radius
    world.announceSwing(me, me.facing, radius)
    const count = world.queryCone(me, me.facing, step.arc, radius, this.hitBuffer)
    for (let i = 0; i < count; i++) {
      const victim = this.hitBuffer[i] as Combatant
      world.strike(me, victim, step.mult, {
        knockback: step.knockback,
        stagger: step.stagger,
      })
    }
  }

  /**
   * Quy input WASD về hướng trong thế giới, theo GÓC CAMERA.
   *
   * Theo góc camera chứ không theo trục thế giới: người chơi xoay camera thì "W"
   * phải luôn là "đi lên phía trên màn hình".
   *
   * Kết quả là vector ĐÃ chuẩn hoá, hoặc (0,0) khi không bấm gì.
   */
  private computeMoveDir(input: Input, camera: IsoCamera): void {
    const axis = input.moveAxis()
    camera.forwardOnGround(this.forward)
    camera.rightOnGround(this.right)
    const dx = this.right.x * axis.x + this.forward.x * -axis.z
    const dz = this.right.z * axis.x + this.forward.z * -axis.z
    const len = Math.hypot(dx, dz)
    if (len > 1e-4) {
      this.moveDirX = dx / len
      this.moveDirZ = dz / len
    } else {
      this.moveDirX = 0
      this.moveDirZ = 0
    }
  }

  private updateMovement(
    dt: number,
    input: Input,
    _camera: IsoCamera,
    collision: CollisionWorld,
  ): void {
    const dx = this.moveDirX
    const dz = this.moveDirZ

    const inputLen = Math.hypot(dx, dz)
    const walking = input.isDown('ShiftLeft') || input.isDown('ShiftRight')
    // Ra đòn thì chậm lại chứ KHÔNG đứng hẳn: đứng hẳn làm combat cứng như
    // xem phim, còn chậm lại vẫn giữ được sức nặng của đòn đánh
    const castScale = this.caster.activeSkill?.moveScale ?? 1
    const attackScale = (this.phase === 'none' ? 1 : this.currentStep().moveScale) * castScale
    const base =
      this.combatant.effectiveSpeed() *
      (walking ? WALK_MULTIPLIER : 1) *
      (this.flying ? FLY_SPEED_MULT : 1)
    const targetSpeed = inputLen > 1e-4 ? base * attackScale : 0

    if (inputLen > 1e-4) {
      const k = 1 - Math.exp(-ACCEL * dt)
      this.vx += (dx * targetSpeed - this.vx) * k
      this.vz += (dz * targetSpeed - this.vz) * k
      // Chỉ quay theo hướng đi khi KHÔNG ra đòn — lúc ra đòn thì con trỏ quyết định
      if (this.phase !== 'windup') {
        this.combatant.facing = turnToward(
          this.combatant.facing,
          Math.atan2(dx, dz),
          TURN_RATE * dt,
        )
      }
    } else {
      const k = 1 - Math.exp(-DECEL * dt)
      this.vx -= this.vx * k
      this.vz -= this.vz * k
    }

    this.applyMotion(dt, this.vx, this.vz, collision)
  }

  private applyMotion(dt: number, vx: number, vz: number, collision: CollisionWorld): void {
    const me = this.combatant
    if (vx === 0 && vz === 0) {
      const k = 1 - Math.exp(-DECEL * dt)
      this.vx -= this.vx * k
      this.vz -= this.vz * k
    }

    // Vận tốc lướt CỘNG THÊM vào vận tốc tự chủ, không thay thế: nhờ vậy vẫn
    // lái được hướng một chút trong lúc lướt
    const dash = this.caster?.dash
    const dashVx = dash?.active ? dash.vx : 0
    const dashVz = dash?.active ? dash.vz : 0

    me.pos.x += (this.vx + me.knockVx + dashVx) * dt
    me.pos.z += (this.vz + me.knockVz + dashVz) * dt

    // Đủ cao thì bay qua cây và đá; còn thấp thì vẫn bị chặn, nên lúc vừa nhấc
    // lên không có chuyện xuyên thẳng qua tảng đá đang đứng cạnh
    if (this.flyHeight < FLY_CLEARANCE) collision.resolve(me.pos, me.radius)

    const distFromCenter = Math.hypot(me.pos.x, me.pos.z)
    if (distFromCenter > WORLD_RADIUS) {
      const s = WORLD_RADIUS / distFromCenter
      me.pos.x *= s
      me.pos.z *= s
    }

    // Tốc độ THỰC TẾ sau va chạm, không phải tốc độ mong muốn: khi bị chặn bởi
    // tảng đá thì nhân vật phải đứng yên chứ không được chạy tại chỗ
    this.speed = MathUtils.clamp(Math.hypot(this.vx, this.vz), 0, 99)
    me.y = this.groundHeight(me.pos.x, me.pos.z) + this.flyHeight
    me.applyTransform()
  }

  /** Nhịp frame: chỉ animation, để chuyển động mượt hơn 60Hz. */
  render(frameDt: number): void {
    this.combatant.view.update(frameDt)
  }
}
