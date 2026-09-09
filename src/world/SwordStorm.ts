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

/**
 * Sức chứa của đàn kiếm — bộ ĐỦ là 72 thanh, đúng nguyên tác.
 *
 * Đây là sức chứa của InstancedMesh, KHÔNG phải số kiếm bay ra: số bay ra do
 * cảnh giới quyết định (xem `soKiemTruc` trong bảng pháp thuật) vì trong truyện
 * Hàn Lập Kết Đan sơ kỳ chỉ ngự nổi sáu bảy thanh, hậu kỳ hai bốn thanh, phải
 * tới Nguyên Anh mới điều được cả bộ. Cấp phát theo mức trần một lần rồi chỉ
 * đổi `mesh.count` là đổi số kiếm mà không tốn thêm draw call nào.
 */
export const SWORD_CAPACITY = 72
/** Một bộ cơ sở của pháp bảo này là 12 thanh — mọi mốc đều là bội của nó. */
export const SWORD_SET = 12
/** Ba vòng đồng tâm, quay ngược nhau. Mọi mốc số kiếm đều chia hết cho 3. */
const RINGS = 3
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
  /** Số thanh bay ra lượt này. Kẹp về `SWORD_CAPACITY`, làm tròn xuống bội của 3. */
  count: number
  /** Khoảng cách giữa hai lần một mục tiêu bị cùng đàn kiếm chém. */
  hitInterval: number
}

interface Target {
  combatant: Combatant
  cooldown: number
}

/**
 * Thanh Trúc Phong Vân Kiếm — bản mệnh pháp bảo của Hàn Lập, mở ở Kết Đan.
 *
 * Đàn kiếm trúc bay vây quanh người thi triển rồi loang ra thành vòng quét.
 * SỐ KIẾM không cố định: nó chính là thứ nói lên cảnh giới — xem `SWORD_CAPACITY`.
 *
 * Nằm trong MỘT InstancedMesh: 72 thanh kiếm là 72 draw call nếu làm rời, mà
 * chiêu này còn phải phát được giữa lúc đại chiến ở M7. Vòng quay tính bằng
 * lượng giác trên CPU cho mỗi instance — 72 phép tính mỗi frame là không đáng kể
 * so với việc phải viết shader riêng.
 *
 * Sát thương KHÔNG theo từng thanh kiếm mà theo VÒNG QUÉT, có nhịp
 * `spec.hitInterval` cho mỗi mục tiêu. Nếu tính theo từng thanh thì một con quái
 * đứng đúng chỗ sẽ ăn 72 đòn trong một frame và chết tức khắc bất kể cảnh giới
 * — phá vỡ luật chênh lệch cảnh giới, thứ quan trọng nhất của cả hệ chiến đấu.
 * Cùng lý do đó, số kiếm KHÔNG được nhân vào sát thương: nó đổi mật độ hình ảnh
 * và bề rộng đội hình, còn sức mạnh đã nằm ở `mult` và ở cảnh giới rồi.
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
  private spec: SwordStormSpec = {
    radius: 6,
    mult: 1,
    duration: 5,
    knockback: 0,
    stagger: 0,
    count: SWORD_CAPACITY,
    hitInterval: 0.3,
  }
  /** Số kiếm THẬT của lượt này, đã kẹp và làm tròn về bội của ba. */
  private count = SWORD_CAPACITY
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
      SWORD_CAPACITY,
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

  /**
   * Vị trí thanh kiếm thứ `seat` ở khung hình này. VFX vẽ vệt đuôi từ đây.
   *
   * Gọi trong `render`, không phải `fixedUpdate`: vệt là hình ảnh, và nhả theo
   * nhịp bước cố định 60Hz thì ở máy chạy trên 60fps đầu vệt sẽ giật lùi so với
   * thanh kiếm đã được nội suy.
   *
   * `seat` là chỗ trong ĐỘI HÌNH nên nó cố định suốt một lượt chiêu — đó là
   * danh tính mà vệt cần, và nó có sẵn nên không phải cấp số thứ tự như phi
   * hành khí.
   */
  onSwordTrail?: (seat: number, x: number, y: number, z: number) => void

  /**
   * Đàn kiếm vừa tan (hoặc vừa bị làm mới). VFX thả toàn bộ vệt.
   *
   * Phải gọi cả khi LÀM MỚI, không chỉ khi tan: phát lại lúc đang chạy thì đàn
   * kiếm nhảy về bán kính tụ, và vệt đang bám sẽ vẽ một vệt thẳng từ vành vòng
   * cũ về sát người — một bó nan hoa bắn vào tâm, không giống đàn kiếm đang bay.
   */
  onSwordsEnd?: () => void

  /** Phát chiêu. Phát lại khi đang chạy thì làm mới, không xếp hàng hai lượt. */
  cast(owner: Combatant, spec: SwordStormSpec): void {
    if (this.active) this.onSwordsEnd?.()
    this.active = true
    this.age = 0
    this.hitTimer = 0
    this.fxTimer = 0
    this.owner = owner
    this.spec = spec
    // Làm tròn XUỐNG bội của ba vì đội hình là ba vòng đều: một con số lẻ để lại
    // một vòng thiếu chỗ, và chỗ thiếu đó quay quanh người thành một khoảng hở
    // chạy vòng vòng — mắt đọc ra là lỗi chứ không phải đội hình
    const wanted = Math.max(RINGS, Math.min(SWORD_CAPACITY, Math.floor(spec.count)))
    this.count = wanted - (wanted % RINGS)
    this.mesh.count = this.count
    this.targets.length = 0
    this.mesh.visible = true
  }

  /** Số kiếm đang bay lượt này — test và VFX đọc để biết bao nhiêu vệt là đủ. */
  get swordCount(): number {
    return this.count
  }

  /**
   * Bán kính đàn kiếm đang bay.
   *
   * Bung từ chỗ tụ ra bán kính vòng rồi GIỮ, không loang ra mãi. Thử cho loang
   * ra tới 7 unit trước: đàn kiếm rải trên một vòng lớn nhìn ra là một đống que
   * bay tản mát, và người chơi không còn điều khiển được gì. Giữ vòng chặt
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
    // `spec.hitInterval`.
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
        entry.cooldown = this.spec.hitInterval
      } else {
        this.targets.push({ combatant: victim, cooldown: this.spec.hitInterval })
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

  /** Nhịp frame: chỉ xoay ma trận của đàn kiếm, không có luật chơi ở đây. */
  render(_frameDt: number): void {
    if (!this.active || !this.owner) return
    const owner = this.owner
    const radius = this.currentRadius()
    const fade = Math.min(1, this.age / 0.18)
    const spin = this.age * 2.6

    const perRing = this.count / RINGS
    for (let i = 0; i < this.count; i++) {
      // Ba vòng ĐỀU, hai vòng ngoài quay ngược vòng giữa.
      // Rải kiếm tự do thì nhìn ra là một đống que bay lộn xộn; chia thành vòng
      // đều và cho quay ngược nhau thì đọc ra ngay là một ĐỘI HÌNH — đây là bản
      // mệnh pháp bảo do người tu điều khiển, không phải mảnh vỡ.
      const ring = Math.floor(i / perRing)
      const seat = i % perRing
      const dir = ring === 1 ? -1 : 1
      const angle =
        (seat / perRing) * Math.PI * 2 + dir * spin * (1 + ring * 0.16) + ring * 0.29
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

      // Vệt lấy vị trí MŨI kiếm, không phải tâm thân kiếm: lưỡi với ra ngoài
      // vòng bay, và vệt xuất phát từ tâm thì nó nằm lệch vào trong so với chỗ
      // mắt đang thấy lưỡi kiếm quét qua.
      this.onSwordTrail?.(
        i,
        owner.pos.x + Math.cos(angle) * (r + BLADE_REACH * 0.5),
        y,
        owner.pos.z + Math.sin(angle) * (r + BLADE_REACH * 0.5),
      )
    }
    this.mesh.instanceMatrix.needsUpdate = true
  }

  stop(): void {
    const wasActive = this.active
    this.active = false
    this.owner = null
    this.targets.length = 0
    this.mesh.visible = false
    if (wasActive) this.onSwordsEnd?.()
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    this.group.removeFromParent()
  }
}
