import {
  Group,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
  type Scene,
} from 'three'
import { bambooSwordGeometry } from '@/art/props/swords'
import type { EventBus } from '@/core/EventBus'
import type { GameEvents } from '@/core/events'
import { materials } from '@/render/Materials'
import { isHostile, type Combatant } from './Combatant'
import type { CombatWorld } from './CombatWorld'

/** Số kiếm — 33 thanh, đúng như trong truyện. */
export const SWORD_COUNT = 33
/** Ba vòng, mỗi vòng 11 thanh: 33 = 3 × 11. */
const RINGS = 3
const PER_RING = SWORD_COUNT / RINGS
/**
 * Độ nghiêng của lưỡi kiếm quanh trục bay, radian.
 *
 * Gần vuông góc chứ không nằm ngang. Lưỡi kiếm là một khối bẹt, để nằm ngang
 * thì từ góc iso nó đọc ra là một que gỗ rơi trên đất; dựng đứng lên thì thấy
 * được mặt cắt lưỡi và cả đàn kiếm mới ra dáng đang bay chém.
 */
const BANK = 1.2

/** Thời gian kiếm tụ lại quanh người trước khi toả ra. */
const GATHER = 0.5
/** Thời gian đàn kiếm bung từ chỗ tụ ra bán kính vòng. */
const EXPAND = 0.55
/** Khoảng cách giữa hai lần gây sát thương cho cùng một mục tiêu. */
const HIT_INTERVAL = 0.3
/** Lưỡi kiếm với ra ngoài vòng bay bấy nhiêu. */
const BLADE_REACH = 0.7
/**
 * Giãn cách giữa hai lần phát sự kiện hình ảnh, giây.
 *
 * TÁCH khỏi nhịp gây sát thương (0,1 giây). Sát thương cần nhịp dày để cảm giác
 * đàn kiếm đang quét liên tục, nhưng hình ảnh thì không: phát `skill:area` mười
 * lần mỗi giây suốt 5 giây là 50 vụ nổ pháp vực chồng lên nhau, khoảng 1500 hạt
 * và 50 vết cháy — vừa che kín màn hình vừa làm hồ vết đất đảo liên tục.
 */
const FX_INTERVAL = 0.6

export interface SwordStormSpec {
  /** Bán kính vòng quét lớn nhất. */
  radius: number
  /** Hệ số sát thương mỗi lần quét trúng. */
  mult: number
  /** Tổng thời gian chiêu tồn tại, kể cả lúc tụ. */
  duration: number
  knockback: number
  stagger: number
}

interface Target {
  combatant: Combatant
  cooldown: number
}

/**
 * Thanh Trúc Phong Vân Kiếm — chiêu biểu tượng của Hàn Lập, mở ở Kết Đan.
 *
 * 33 thanh kiếm trúc bay vây quanh người thi triển rồi loang ra thành vòng quét.
 *
 * Nằm trong MỘT InstancedMesh: 33 thanh kiếm là 33 draw call nếu làm rời, mà
 * chiêu này còn phải phát được giữa lúc đại chiến ở M7. Vòng quay tính bằng
 * lượng giác trên CPU cho mỗi instance — 33 phép tính mỗi frame là không đáng kể
 * so với việc phải viết shader riêng.
 *
 * Sát thương KHÔNG theo từng thanh kiếm mà theo VÒNG QUÉT, có nhịp HIT_INTERVAL
 * cho mỗi mục tiêu. Nếu tính theo từng thanh thì một con quái đứng đúng chỗ sẽ
 * ăn 33 đòn trong một frame và chết tức khắc bất kể cảnh giới — phá vỡ luật
 * chênh lệch cảnh giới, thứ quan trọng nhất của cả hệ chiến đấu.
 */
export class SwordStorm {
  readonly group = new Group()
  private readonly mesh: InstancedMesh
  private readonly matrix = new Matrix4()
  private readonly position = new Vector3()
  private readonly quaternion = new Quaternion()
  private readonly scale = new Vector3()
  private readonly spinAxis = new Vector3(0, 1, 0)
  private readonly tiltAxis = new Vector3(1, 0, 0)
  /** Trục bay của lưỡi kiếm trong không gian riêng của nó. */
  private readonly bankAxis = new Vector3(0, 0, 1)
  private readonly tilt = new Quaternion()

  private active = false
  private age = 0
  private spec: SwordStormSpec = { radius: 6, mult: 1, duration: 5, knockback: 0, stagger: 0 }
  private owner: Combatant | null = null
  private readonly targets: Target[] = []
  private readonly buffer: Combatant[] = []
  private hitTimer = 0
  private fxTimer = 0

  constructor(
    scene: Scene,
    private readonly world: CombatWorld,
    private readonly bus: EventBus<GameEvents>,
  ) {
    this.group.name = 'swordStorm'
    this.mesh = new InstancedMesh(
      bambooSwordGeometry(),
      materials.flat(0xffffff, { vertexColors: true }),
      SWORD_COUNT,
    )
    this.mesh.instanceMatrix.setUsage(35048) // DynamicDrawUsage
    this.mesh.frustumCulled = false
    this.mesh.castShadow = false
    this.mesh.visible = false
    this.group.add(this.mesh)
    scene.add(this.group)
  }

  get isActive(): boolean {
    return this.active
  }

  /** Phát chiêu. Phát lại khi đang chạy thì làm mới, không xếp hàng hai lượt. */
  cast(owner: Combatant, spec: SwordStormSpec): void {
    this.active = true
    this.age = 0
    this.hitTimer = 0
    this.fxTimer = 0
    this.owner = owner
    this.spec = spec
    this.targets.length = 0
    this.mesh.visible = true
  }

  /**
   * Bán kính đàn kiếm đang bay.
   *
   * Bung từ chỗ tụ ra bán kính vòng rồi GIỮ, không loang ra mãi. Thử cho loang
   * ra tới 7 unit trước: 33 thanh kiếm rải trên một vòng lớn nhìn ra là một đống
   * que bay tản mát, và người chơi không còn điều khiển được gì. Giữ vòng chặt
   * thì đàn kiếm đặc, đọc ra là một khối vũ khí — và quan trọng hơn: người chơi
   * LÁI được nó bằng cách đi bộ, nên chiêu thành ra có kỹ năng chứ không phải
   * một nút gây sát thương.
   */
  private currentRadius(): number {
    if (this.age < GATHER) {
      // Lúc tụ: kiếm quay sát người, vòng quét chưa mở
      return 0.9 + (this.age / GATHER) * 0.4
    }
    const t = Math.min(1, (this.age - GATHER) / EXPAND)
    const eased = 1 - (1 - t) ** 2
    return 1.3 + eased * (this.spec.radius - 1.3)
  }

  fixedUpdate(dt: number): void {
    if (!this.active) return
    const owner = this.owner
    if (!owner || owner.dead) {
      this.stop()
      return
    }

    this.age += dt
    if (this.age >= this.spec.duration) {
      this.stop()
      return
    }

    for (const t of this.targets) t.cooldown -= dt

    // Hai đồng hồ riêng: sát thương quét dày (0,1 giây một lượt) để cảm giác
    // đàn kiếm đang chém liên tục, còn hình ảnh thưa hơn nhiều. Đếm cả hai Ở
    // ĐÂY vì đây là chỗ duy nhất có `dt` thật — trừ theo hằng số trong
    // `strikeRing` sẽ sai đơn vị, vì hàm đó được gọi mỗi 0,1 giây chứ không mỗi
    // `HIT_INTERVAL`.
    this.fxTimer -= dt
    this.hitTimer -= dt
    if (this.hitTimer > 0) return
    this.hitTimer = 0.1

    const hits = this.strikeRing(owner)
    if (hits === 0 || this.fxTimer > 0) return
    this.fxTimer = FX_INTERVAL
    this.bus.emit('skill:area', {
      x: owner.pos.x,
      y: owner.y,
      z: owner.pos.z,
      radius: this.currentRadius() + BLADE_REACH,
      element: 'moc',
      skillId: 'thanhTrucPhongVan',
    })
  }

  /** Quét một lượt. Trả về số mục tiêu THẬT SỰ bị trừ máu lượt này. */
  private strikeRing(owner: Combatant): number {
    // Đoạn tụ kiếm là BÁO TRƯỚC, không gây sát thương: cộng với 0.6 giây dẫn
    // khí, địch có hơn một giây để chạy ra khỏi vòng. Chặn theo `age` chứ không
    // theo bán kính — bán kính lúc tụ đã là 0.9..1.3 nên lấy nó làm mốc thì con
    // quái đứng sát người vẫn ăn đòn ngay từ lúc kiếm chưa toả ra.
    if (this.age < GATHER) return 0
    const radius = this.currentRadius() + BLADE_REACH

    // PHẢI dùng isHostile: với người chơi thì 'ally' !== 'player' là true, nên
    // phép so sánh thô sẽ biến chiêu này thành quét sạch cả đồng môn ở M7
    const count = this.world.queryCircle(
      owner.pos.x,
      owner.pos.z,
      radius,
      this.buffer,
      (c) => c.alive && isHostile(owner.side, c.side),
    )

    const savedElement = owner.stats.element
    owner.stats.element = 'moc'
    let struck = 0
    for (let i = 0; i < count; i++) {
      const victim = this.buffer[i] as Combatant
      const entry = this.targets.find((t) => t.combatant === victim)
      if (entry) {
        if (entry.cooldown > 0) continue
        entry.cooldown = HIT_INTERVAL
      } else {
        this.targets.push({ combatant: victim, cooldown: HIT_INTERVAL })
      }
      struck++
      // Bỏ miễn thương do đòn trước để nhịp quét của chiêu này quyết định,
      // không phải cửa sổ miễn thương của một đòn chém không liên quan
      victim.invuln = 0
      this.world.strike(owner, victim, this.spec.mult, {
        knockback: this.spec.knockback,
        stagger: this.spec.stagger,
      })
    }
    owner.stats.element = savedElement
    return struck
  }

  /** Nhịp frame: chỉ xoay 33 ma trận, không có luật chơi ở đây. */
  render(_frameDt: number): void {
    if (!this.active || !this.owner) return
    const owner = this.owner
    const radius = this.currentRadius()
    const fade = Math.min(1, this.age / 0.18)
    const spin = this.age * 2.6

    for (let i = 0; i < SWORD_COUNT; i++) {
      // Ba vòng ĐỀU, hai vòng ngoài quay ngược vòng giữa.
      // Rải 33 thanh tự do thì nhìn ra là một đống que bay lộn xộn; chia thành
      // vòng đều và cho quay ngược nhau thì đọc ra ngay là một ĐỘI HÌNH — đây
      // là bản mệnh pháp khí do người tu điều khiển, không phải mảnh vỡ.
      const ring = Math.floor(i / PER_RING)
      const seat = i % PER_RING
      const dir = ring === 1 ? -1 : 1
      const angle =
        (seat / PER_RING) * Math.PI * 2 + dir * spin * (1 + ring * 0.16) + ring * 0.29
      const r = radius * (0.9 + ring * 0.05)
      const y = owner.y + 0.24 + ring * 0.66 + Math.sin(this.age * 4.4 + i) * 0.11

      this.position.set(
        owner.pos.x + Math.cos(angle) * r,
        y,
        owner.pos.z + Math.sin(angle) * r,
      )

      // Mũi chỉ theo tiếp tuyến của vòng, rồi NGHIÊNG quanh chính trục bay đó
      this.quaternion.setFromAxisAngle(this.spinAxis, -angle + (dir > 0 ? Math.PI / 2 : -Math.PI / 2))
      this.tilt.setFromAxisAngle(this.bankAxis, BANK * dir)
      this.quaternion.multiply(this.tilt)
      this.tilt.setFromAxisAngle(this.tiltAxis, -0.12)
      this.quaternion.multiply(this.tilt)

      this.scale.setScalar(0.95 * fade)
      this.matrix.compose(this.position, this.quaternion, this.scale)
      this.mesh.setMatrixAt(i, this.matrix)
    }
    this.mesh.instanceMatrix.needsUpdate = true
  }

  stop(): void {
    this.active = false
    this.owner = null
    this.targets.length = 0
    this.mesh.visible = false
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    this.group.removeFromParent()
  }
}
