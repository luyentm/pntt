import { Mesh, Vector3, type BufferGeometry, type Object3D } from 'three'
import { enemyDef } from '@/game/data/enemies'
import { Hud } from '@/ui/Hud'
import { WorldBars } from '@/ui/WorldBars'
import { Vfx } from '@/vfx/Vfx'
import { CombatWorld } from './CombatWorld'
import { Enemy, type EnemyContext } from './Enemy'
import type { Combatant } from './Combatant'
import { Palette } from '@/art/Palette'
import { PropBatch } from '@/art/PropBatch'
import { buildBoulder, buildGroundMarker, buildStoneFloor } from '@/art/props/nature'
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

/** Sơn môn Thất Huyền Môn: cổng phái, luyện võ trường, đài luyện đan, rừng tùng và bụi tre. */
export class ArenaScene implements GameScene {
  readonly name = 'Thất Huyền Môn — Luyện võ trường'

  readonly collision = new CollisionWorld()
  terrain!: Terrain
  player!: Player
  combat!: CombatWorld
  readonly enemies: Enemy[] = []

  private ctx!: SceneContext
  private readonly objects: Object3D[] = []
  private marker?: Mesh
  private readonly cursor = new Vector3()
  private vfx!: Vfx
  private hud!: Hud
  private bars!: WorldBars
  private enemyCtx!: EnemyContext
  private lastHp = -1
  private lastMp = -1
  private respawnTimer = 0
  private godMode = false

  /** Điều khiển debug — bảng lil-gui đọc từ đây. */
  readonly debug: SceneDebugActions = {
    spawnEnemies: (id, count) => {
      for (let i = 0; i < count; i++) {
        // Sinh quanh người chơi nhưng chừa khoảng để không đè lên đầu
        const p = this.ctx.rng.inAnnulus(4, 11)
        this.spawnEnemy(id, this.player.pos.x + p.x, this.player.pos.z + p.z, this.ctx.rng)
      }
    },
    killAllEnemies: () => {
      for (const enemy of this.enemies) {
        if (enemy.combatant.dead) continue
        this.combat.strike(this.player.combatant, enemy.combatant, 99999)
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
    enemyCount: () => this.enemies.length,
    aliveEnemyCount: () => this.combat.countAlive('enemy'),
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

    this.combat = new CombatWorld(ctx.bus, rng)
    this.combat.add(this.player.combatant)

    this.enemyCtx = {
      world: this.combat,
      collision: this.collision,
      ground: this.terrain,
      rng,
    }

    const uiRoot = document.getElementById('ui-root')
    if (!uiRoot) throw new Error('ArenaScene: thiếu #ui-root')
    this.vfx = new Vfx(three, uiRoot, ctx.bus, rng)
    this.hud = new Hud(uiRoot, ctx.bus)
    this.hud.setRealm(this.player.realm)
    this.bars = new WorldBars(uiRoot)

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
    ctx.bus.on('combat:hit', () => {
      // Thanh máu chỉ hiện cho con vừa bị đánh — xem WorldBars
      for (const c of this.combat.all) {
        if (c.invuln > 0 && c.side !== 'player') this.bars.notifyHit(c)
      }
    })

    this.spawnWave(rng)

    camera.snapTo(this.player.pos.x, this.player.y + 0.9, this.player.pos.z)
    three.updateMatrixWorld(true)
    ctx.bus.emit('scene:loaded', { name: this.name })
  }

  /** Rải quái quanh luyện võ trường. */
  private spawnWave(rng: SceneContext['rng']): void {
    for (let i = 0; i < 9; i++) {
      const p = rng.inAnnulus(9, 24)
      this.spawnEnemy('yeuThu', p.x, p.z, rng)
    }
    for (let i = 0; i < 4; i++) {
      const p = rng.inAnnulus(15, 30)
      this.spawnEnemy('hacLang', p.x, p.z, rng)
    }
  }

  spawnEnemy(id: string, x: number, z: number, rng: SceneContext['rng']): Enemy {
    const enemy = new Enemy(enemyDef(id), x, z, this.terrain, rng)
    this.enemies.push(enemy)
    this.combat.add(enemy.combatant)
    this.ctx.three.add(enemy.combatant.root)
    return enemy
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

    this.player.fixedUpdate(dt, input, camera, this.collision, this.combat)
    for (const enemy of this.enemies) enemy.fixedUpdate(dt, this.enemyCtx)

    // Tách đàn SAU khi mọi thứ đã di chuyển, để không con nào bị xử lý hai lần
    this.combat.resolveCrowding()
    for (const enemy of this.enemies) enemy.combatant.applyTransform()
    this.player.combatant.applyTransform()

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
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i] as Enemy
      if (!removedSet.has(enemy.combatant)) continue
      this.ctx.three.remove(enemy.combatant.root)
      this.enemies.splice(i, 1)
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
    for (const enemy of this.enemies) enemy.render(frameDt)

    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null
    const w = canvas?.clientWidth ?? window.innerWidth
    const h = canvas?.clientHeight ?? window.innerHeight
    this.vfx.update(frameDt, camera.camera, w, h)
    this.bars.update(frameDt, this.combat.all, camera.camera, w, h)

    if (this.marker) {
      if (camera.screenToGround(input.pointerNdcX, input.pointerNdcY, this.cursor, this.player.y)) {
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
    for (const enemy of this.enemies) this.ctx.three.remove(enemy.combatant.root)
    this.enemies.length = 0
    this.objects.length = 0
    this.collision.clear()
    this.combat.clear()
    this.vfx.dispose()
    this.hud.dispose()
    this.bars.dispose()
    this.ctx.bus.emit('scene:unloaded', { name: this.name })
  }
}
