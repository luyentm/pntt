import {
  BoxGeometry,
  Mesh,
  PlaneGeometry,
  Vector3,
  type BufferGeometry,
  type Object3D,
} from 'three'
import { Palette } from '@/art/Palette'
import { paint } from '@/art/geo'
import {
  buildBoulder,
  buildGroundMarker,
  buildPine,
  buildPlatform,
  buildRock,
  buildStonePillar,
} from '@/art/props/nature'
import { MouseBtn } from '@/core/Input'
import { materials } from '@/render/Materials'
import type { GameScene, SceneContext } from './Scene'

// Đất phải rộng hơn hẳn tầm sương mù (far = 100) để rìa bản đồ tan vào sương
// chứ không hiện thành một đường cắt thẳng khi người chơi hạ camera xuống thấp.
const GROUND_SIZE = 240
const GROUND_SEGMENTS = 68

/**
 * Luyện võ trường Thất Huyền Môn.
 *
 * M0: chỉ là mặt đất + prop để đánh giá hình ảnh (viền, bóng, sương mù, bảng màu).
 * M2 sẽ thay mặt đất tạm ở đây bằng `Terrain.ts` có heightfield thật.
 */
export class ArenaScene implements GameScene {
  readonly name = 'Luyện võ trường Thất Huyền Môn'

  private ctx!: SceneContext
  private readonly objects: Object3D[] = []
  private marker?: Mesh
  private testCube?: Mesh
  private readonly cursor = new Vector3()
  private elapsed = 0

  load(ctx: SceneContext): void {
    this.ctx = ctx
    const { three, rng, camera } = ctx

    this.add(this.buildGround())

    const platform = buildPlatform(8, 0.55)
    this.add(platform)

    // Bốn cột đá quanh đài — vừa là mốc thị giác vừa để kiểm tra bloom của linh châu
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4
      const pillar = buildStonePillar(rng, 4.6)
      pillar.position.set(Math.cos(a) * 10.5, 0, Math.sin(a) * 10.5)
      this.add(pillar)
    }

    // Rừng tùng vòng ngoài — thưa dần vào giữa để không che đài
    for (let i = 0; i < 90; i++) {
      const p = rng.inAnnulus(16, 62)
      const pine = buildPine(rng, rng.float(2.6, 5.2))
      pine.position.set(p.x, 0, p.z)
      this.add(pine)
    }

    for (let i = 0; i < 70; i++) {
      const p = rng.inAnnulus(11, 64)
      const rock = buildRock(rng, rng.float(0.3, 0.9))
      rock.position.x = p.x
      rock.position.z = p.z
      this.add(rock)
    }

    for (let i = 0; i < 10; i++) {
      const p = rng.inAnnulus(20, 55)
      const boulder = buildBoulder(rng, rng.float(1.1, 2.2))
      boulder.position.set(p.x, 0, p.z)
      this.add(boulder)
    }

    // Khối kiểm tra: xoay liên tục để xác nhận vòng lặp đang chạy, và là vật thể
    // có cạnh sắc rõ nhất để soi chất lượng nét viền
    const cubeGeo = paint(new BoxGeometry(1.6, 1.6, 1.6), Palette.kim)
    this.testCube = new Mesh(cubeGeo, materials.flat(0xffffff, { vertexColors: true }))
    this.testCube.position.set(0, 2.2, 0)
    this.testCube.castShadow = true
    this.add(this.testCube)

    this.marker = buildGroundMarker(0.7)
    this.add(this.marker)

    camera.snapTo(0, 1, 0)
    three.updateMatrixWorld(true)
    ctx.bus.emit('scene:loaded', { name: this.name })
  }

  /**
   * Mặt đất tạm: mặt phẳng chia ô, nhấp nhô bằng tổng vài hàm sin.
   * Sin thay vì noise vì M0 chỉ cần bề mặt không phẳng lì để soi nét viền và
   * đổ bóng — địa hình thật (noise + walkable mask) là việc của M2.
   */
  private buildGround(): Mesh {
    const geo = new PlaneGeometry(GROUND_SIZE, GROUND_SIZE, GROUND_SEGMENTS, GROUND_SEGMENTS)
    geo.rotateX(-Math.PI / 2)

    const pos = geo.getAttribute('position')
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      const d = Math.hypot(x, z)
      // Giữ vùng giữa (bán kính < 12) gần như phẳng để đài và nhân vật đứng vững
      const flatten = Math.min(1, Math.max(0, (d - 12) / 18))
      const h =
        (Math.sin(x * 0.045) * Math.cos(z * 0.038) * 4.2 +
          Math.sin(x * 0.11 + 1.7) * Math.cos(z * 0.093 - 0.6) * 1.5 +
          Math.sin(x * 0.21 - 0.4) * Math.cos(z * 0.19 + 1.1) * 0.5) *
        flatten
      pos.setY(i, h)
    }
    geo.computeVertexNormals()

    // Màu theo độ cao: chỗ trũng cỏ đậm, chỗ cao cỏ khô — gợi sườn núi
    const painted: BufferGeometry = paint(geo, Palette.co)
    const colors = painted.getAttribute('color')
    const p2 = painted.getAttribute('position')
    for (let i = 0; i < p2.count; i++) {
      const y = p2.getY(i)
      const t = Math.min(1, Math.max(0, (y + 2.6) / 6.2))
      // Nội suy thủ công giữa coDam -> co -> coKho
      const lo = { r: 0.29, g: 0.48, b: 0.31 } // coDam
      const mid = { r: 0.43, g: 0.62, b: 0.39 } // co
      const hi = { r: 0.6, g: 0.65, b: 0.39 } // coKho
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
    this.elapsed += dt
    const { input, camera } = this.ctx

    // M0: chuột trái đặt điểm ngắm camera — tạm thay cho di chuyển nhân vật (M1)
    if (input.mouseIsDown(MouseBtn.Left)) {
      if (camera.screenToGround(input.pointerNdcX, input.pointerNdcY, this.cursor)) {
        camera.follow(this.cursor.x, 1, this.cursor.z)
      }
    }
  }

  render(_alpha: number, frameDt: number): void {
    const { input, camera } = this.ctx

    if (this.testCube) {
      this.testCube.rotation.y += frameDt * 0.9
      this.testCube.rotation.x += frameDt * 0.35
      this.testCube.position.y = 2.2 + Math.sin(this.elapsed * 1.6) * 0.28
    }

    if (this.marker) {
      if (camera.screenToGround(input.pointerNdcX, input.pointerNdcY, this.cursor)) {
        // Nhấc lên chút để vòng sáng không bị z-fight với mặt đất
        this.marker.position.set(this.cursor.x, this.cursor.y + 0.03, this.cursor.z)
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
    this.ctx.bus.emit('scene:unloaded', { name: this.name })
  }
}
