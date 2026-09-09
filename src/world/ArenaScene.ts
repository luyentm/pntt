import { Mesh, PlaneGeometry, Vector3, type BufferGeometry, type Object3D } from 'three'
import { Palette } from '@/art/Palette'
import { paint } from '@/art/geo'
import {
  buildBoulder,
  buildGroundMarker,
  buildPine,
  buildRock,
  buildStoneFloor,
  buildStonePillar,
} from '@/art/props/nature'
import { materials } from '@/render/Materials'
import { CollisionWorld, type StaticBody } from './Collision'
import { arenaGroundHeight } from './groundHeight'
import { Player } from './Player'
import type { GameScene, SceneContext } from './Scene'

/** Đất phải rộng hơn hẳn tầm sương mù (far = 100) để rìa bản đồ tan vào sương. */
const GROUND_SIZE = 240
const GROUND_SEGMENTS = 68

const FLOOR_RADIUS = 6.2
const PILLAR_RING = 8.6

/**
 * Khe hở tối thiểu giữa hai vật cản, tính bằng world unit.
 * Phải lớn hơn ĐƯỜNG KÍNH nhân vật (0.52) để không bao giờ sinh ra cái khe mà
 * người chơi lách vào rồi kẹt cứng — đó là cách phòng thật sự cho trường hợp
 * kẹt sâu mà CollisionWorld.resolve() không giải hết trong một frame.
 */
const MIN_PASSAGE = 0.8

export class ArenaScene implements GameScene {
  readonly name = 'Luyện võ trường Thất Huyền Môn'

  readonly collision = new CollisionWorld()
  player!: Player

  private ctx!: SceneContext
  private readonly objects: Object3D[] = []
  private marker?: Mesh
  private readonly cursor = new Vector3()

  load(ctx: SceneContext): void {
    this.ctx = ctx
    const { three, rng, camera } = ctx

    this.add(this.buildGround())
    this.add(buildStoneFloor(FLOOR_RADIUS))

    // Bốn cột đá quanh sàn — mốc thị giác, và linh châu để kiểm tra bloom
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4
      const x = Math.cos(a) * PILLAR_RING
      const z = Math.sin(a) * PILLAR_RING
      const pillar = buildStonePillar(rng, 4.4)
      pillar.position.set(x, arenaGroundHeight(x, z), z)
      this.add(pillar)
      this.collision.addStatic(x, z, 0.55)
    }

    // Đặt vật cản theo thứ tự TO TRƯỚC NHỎ SAU: vật to cần nhiều chỗ hơn nên
    // phải được chọn vị trí khi bản đồ còn trống.
    for (let i = 0; i < 12; i++) {
      const radius = rng.float(1.1, 2.2)
      const spot = this.tryPlace(rng, 16, 55, radius * 0.9)
      if (!spot) continue
      const boulder = buildBoulder(rng, radius)
      boulder.position.set(spot.x, arenaGroundHeight(spot.x, spot.z), spot.z)
      this.add(boulder)
      this.collision.addStatic(spot.x, spot.z, radius * 0.9)
    }

    // Rừng tùng vòng ngoài. Va chạm chỉ lấy phần thân (0.36) chứ không lấy tán —
    // nếu lấy cả tán thì người chơi bị chặn bởi những bức tường vô hình rất rộng.
    for (let i = 0; i < 84; i++) {
      const spot = this.tryPlace(rng, 14, 60, 0.36)
      if (!spot) continue
      const pine = buildPine(rng, rng.float(2.6, 5.4))
      pine.position.set(spot.x, arenaGroundHeight(spot.x, spot.z), spot.z)
      this.add(pine)
      this.collision.addStatic(spot.x, spot.z, 0.36)
    }

    for (let i = 0; i < 60; i++) {
      const radius = rng.float(0.3, 0.95)
      // Đá nhỏ thì bước qua được nên không cần chỗ trống, chỉ đá to mới chặn
      const blocking = radius > 0.55
      const spot = blocking ? this.tryPlace(rng, 9, 62, radius * 0.85) : rng.inAnnulus(9, 62)
      if (!spot) continue
      const rock = buildRock(rng, radius)
      rock.position.x = spot.x
      rock.position.z = spot.z
      rock.position.y += arenaGroundHeight(spot.x, spot.z)
      this.add(rock)
      if (blocking) this.collision.addStatic(spot.x, spot.z, radius * 0.85)
    }

    this.player = new Player()
    this.player.spawn(0, 2.4, Math.PI)
    this.add(this.player.chibi.root)

    this.marker = buildGroundMarker(0.7)
    this.add(this.marker)

    camera.snapTo(this.player.pos.x, this.player.y + 0.9, this.player.pos.z)
    three.updateMatrixWorld(true)
    ctx.bus.emit('scene:loaded', { name: this.name })
  }

  /**
   * Tìm một vị trí trống cho vật cản bán kính `radius`, chừa khe MIN_PASSAGE.
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
      if (this.collision.query(p.x, p.z, radius + MIN_PASSAGE, found) === 0) return p
    }
    return null
  }

  /** Mặt đất lấy độ cao từ `arenaGroundHeight` — cùng hàm mà bàn chân dùng. */
  private buildGround(): Mesh {
    const geo = new PlaneGeometry(GROUND_SIZE, GROUND_SIZE, GROUND_SEGMENTS, GROUND_SEGMENTS)
    geo.rotateX(-Math.PI / 2)

    const pos = geo.getAttribute('position')
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, arenaGroundHeight(pos.getX(i), pos.getZ(i)))
    }
    geo.computeVertexNormals()

    // Màu theo độ cao: chỗ trũng cỏ đậm, chỗ cao cỏ khô — gợi sườn núi
    const painted: BufferGeometry = paint(geo, Palette.co)
    const colors = painted.getAttribute('color')
    const p2 = painted.getAttribute('position')
    const lo = { r: 0.29, g: 0.48, b: 0.31 } // coDam
    const mid = { r: 0.43, g: 0.62, b: 0.39 } // co
    const hi = { r: 0.6, g: 0.65, b: 0.39 } // coKho
    for (let i = 0; i < p2.count; i++) {
      const t = Math.min(1, Math.max(0, (p2.getY(i) + 2.6) / 6.2))
      const a = t < 0.5 ? lo : mid
      const b = t < 0.5 ? mid : hi
      const k = t < 0.5 ? t * 2 : (t - 0.5) * 2
      colors.setXYZ(i, a.r + (b.r - a.r) * k, a.g + (b.g - a.g) * k, a.b + (b.b - a.b) * k)
    }

    const mesh = new Mesh(painted, materials.flat(0xffffff, { vertexColors: true }))
    mesh.name = 'ground'
    mesh.receiveShadow = true
    return mesh
  }

  private add(obj: Object3D): void {
    this.ctx.three.add(obj)
    this.objects.push(obj)
  }

  fixedUpdate(dt: number): void {
    const { input, camera } = this.ctx
    this.player.fixedUpdate(dt, input, camera, this.collision)
    camera.follow(this.player.pos.x, this.player.y + 0.9, this.player.pos.z)
  }

  render(_alpha: number, frameDt: number): void {
    const { input, camera } = this.ctx
    this.player.render(frameDt)

    if (this.marker) {
      if (camera.screenToGround(input.pointerNdcX, input.pointerNdcY, this.cursor, this.player.y)) {
        // Nhấc lên chút để vòng sáng không bị z-fight với mặt đất
        this.marker.position.set(this.cursor.x, this.cursor.y + 0.04, this.cursor.z)
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
    this.objects.length = 0
    this.collision.clear()
    this.ctx.bus.emit('scene:unloaded', { name: this.name })
  }
}
