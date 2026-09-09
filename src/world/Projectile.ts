import {
  Group,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
  type Scene,
} from 'three'
import type { Rng } from '@/core/Rng'
import type { EffectKind } from '@/game/Effects'
import type { Element } from '@/game/Stats'
import { materials } from '@/render/Materials'
import { projectileGeometry, type ProjectileLook } from '@/vfx/projectileGeometry'
import { isHostile, type Combatant } from './Combatant'
import type { CollisionWorld } from './Collision'
import type { CombatWorld } from './CombatWorld'
import type { HeightField } from './Terrain'

export type ProjectileBehavior =
  /** Bay thẳng cho tới khi trúng hoặc hết hạn. */
  | 'thang'
  /** Đuổi theo mục tiêu gần nhất. */
  | 'truyKich'
  /** Bay ra rồi quay về chỗ chủ — Ngự Kiếm Thuật. */
  | 'hoiKiem'

export interface ProjectileSpec {
  readonly look: ProjectileLook
  readonly behavior: ProjectileBehavior
  readonly speed: number
  /** Bán kính va chạm của viên đạn. */
  readonly radius: number
  /** Kích thước hiển thị. */
  readonly scale: number
  readonly lifetime: number
  readonly mult: number
  readonly knockback: number
  readonly stagger: number
  /**
   * Số mục tiêu xuyên được. 1 = trúng một con là tan.
   * Phi kiếm quay về nên xuyên nhiều, hoả cầu nổ nên chỉ cần 1.
   */
  readonly pierce: number
  readonly element: Element
  /** Nổ lan khi trúng hoặc hết hạn. */
  readonly explodeRadius?: number
  readonly explodeMult?: number
  /** Trạng thái áp lên mục tiêu khi trúng. */
  readonly onHit?: { kind: EffectKind; duration: number; magnitude: number }
  /** Cự ly bay ra trước khi quay về (chỉ dùng cho hoiKiem). */
  readonly outRange?: number
}

interface Projectile {
  active: boolean
  spec: ProjectileSpec | null
  owner: Combatant | null
  x: number
  y: number
  z: number
  vx: number
  vz: number
  age: number
  spin: number
  returning: boolean
  travelled: number
  /** Id các combatant đã trúng — chống một viên trừ máu một mục tiêu nhiều lần. */
  hits: Set<number>
  hitsLeft: number
  /**
   * Đếm tới lần nhả vệt kế tiếp.
   *
   * Chặn nhịp Ở ĐÂY chứ không ở lớp VFX: lớp VFX nhận vệt qua một hook không có
   * danh tính của từng viên, nên nó không thể biết hai lời gọi liền nhau là của
   * một viên hay của hai viên khác nhau.
   */
  trailTimer: number
}

const GROUND_CLEARANCE = 0.55
/** Giãn cách giữa hai lần nhả vệt của một viên, giây. */
const TRAIL_INTERVAL = 0.035

/**
 * Phi hành khí: phi kiếm, hoả cầu, phù lục.
 *
 * Mỗi kiểu tạo hình là MỘT InstancedMesh, nên hàng chục viên bay cùng lúc chỉ
 * tốn ba draw call. Vị trí và góc xoay được ghi vào ma trận instance mỗi frame.
 */
export class ProjectileSystem {
  readonly group = new Group()

  private readonly pools = new Map<ProjectileLook, InstancedMesh>()
  private readonly items: Projectile[] = []
  private readonly matrix = new Matrix4()
  private readonly position = new Vector3()
  private readonly quaternion = new Quaternion()
  private readonly scaleVec = new Vector3()
  private readonly axis = new Vector3(0, 1, 0)
  private readonly hitBuffer: Combatant[] = []

  constructor(
    scene: Scene,
    private readonly world: CombatWorld,
    private readonly rng: Rng,
    capacity = 48,
  ) {
    this.group.name = 'projectiles'
    scene.add(this.group)

    for (const look of ['kiem', 'hoaCau', 'phuLuc'] as ProjectileLook[]) {
      const geometry = projectileGeometry(look)
      // Hoả cầu và phù lục PHẢI dùng vật liệu glow (toneMapped: false) để bloom
      // bắt được — đi qua tone mapping thì chúng không bao giờ rực lên.
      // Phi kiếm là kim khí nên dùng vật liệu nhận sáng, cho ra ánh kim thật.
      const material =
        look === 'kiem'
          ? materials.flat(0xffffff, { vertexColors: true })
          : materials.glow(0xffffff, 1, { vertexColors: true })
      const mesh = new InstancedMesh(geometry, material, capacity)
      mesh.instanceMatrix.setUsage(35048) // DynamicDrawUsage
      mesh.frustumCulled = false
      mesh.castShadow = false
      mesh.count = capacity
      this.pools.set(look, mesh)
      this.group.add(mesh)
    }

    for (let i = 0; i < capacity; i++) {
      this.items.push({
        active: false,
        spec: null,
        owner: null,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vz: 0,
        age: 0,
        spin: 0,
        returning: false,
        travelled: 0,
        hits: new Set(),
        hitsLeft: 0,
        trailTimer: 0,
      })
    }
    this.hideAll()
  }

  private hideAll(): void {
    this.scaleVec.setScalar(0)
    this.position.set(0, -999, 0)
    this.quaternion.identity()
    this.matrix.compose(this.position, this.quaternion, this.scaleVec)
    for (const mesh of this.pools.values()) {
      for (let i = 0; i < this.items.length; i++) mesh.setMatrixAt(i, this.matrix)
      mesh.instanceMatrix.needsUpdate = true
    }
  }

  get activeCount(): number {
    let n = 0
    for (const it of this.items) if (it.active) n++
    return n
  }

  /** Bắn một viên theo hướng (dirX, dirZ) đã chuẩn hoá hay chưa cũng được. */
  fire(owner: Combatant, spec: ProjectileSpec, dirX: number, dirZ: number): void {
    const len = Math.hypot(dirX, dirZ)
    if (len < 1e-5) return

    const slot = this.take()
    slot.spec = spec
    slot.owner = owner
    slot.x = owner.pos.x
    slot.y = owner.y + GROUND_CLEARANCE
    slot.z = owner.pos.z
    slot.vx = (dirX / len) * spec.speed
    slot.vz = (dirZ / len) * spec.speed
    slot.age = 0
    slot.spin = this.rng.float(0, Math.PI * 2)
    slot.returning = false
    slot.travelled = 0
    slot.trailTimer = 0
    slot.hits.clear()
    slot.hitsLeft = Math.max(1, spec.pierce)
  }

  private take(): Projectile {
    for (const it of this.items) {
      if (!it.active) {
        it.active = true
        return it
      }
    }
    // Hồ cạn: giành lại viên già nhất
    let oldest = this.items[0] as Projectile
    for (const it of this.items) if (it.age > oldest.age) oldest = it
    return oldest
  }

  fixedUpdate(dt: number, collision: CollisionWorld, ground: HeightField): void {
    for (const p of this.items) {
      if (!p.active || !p.spec || !p.owner) continue
      const spec = p.spec

      p.age += dt
      p.spin += dt * 14

      p.trailTimer -= dt
      if (p.trailTimer <= 0) {
        p.trailTimer = TRAIL_INTERVAL
        this.onTrail?.(p.x, p.y, p.z, p.vx, p.vz, spec)
      }

      if (spec.behavior === 'truyKich') this.homeToward(p, dt)
      if (spec.behavior === 'hoiKiem') this.steerReturn(p, dt)

      const stepX = p.vx * dt
      const stepZ = p.vz * dt
      p.x += stepX
      p.z += stepZ
      p.travelled += Math.hypot(stepX, stepZ)
      p.y = ground.heightAt(p.x, p.z) + GROUND_CLEARANCE

      // Trúng vật cản tĩnh -> tan (trừ phi kiếm đang quay về, nó xuyên qua)
      if (!p.returning && collision.query(p.x, p.z, spec.radius, []) > 0) {
        this.detonate(p, true)
        continue
      }

      if (this.resolveHits(p)) continue

      // Phi kiếm quay về tới chỗ chủ thì thu về, không nổ
      if (p.returning && p.owner) {
        const d = Math.hypot(p.owner.pos.x - p.x, p.owner.pos.z - p.z)
        if (d < 0.7) {
          this.retire(p)
          continue
        }
      }

      if (p.age >= spec.lifetime) {
        this.detonate(p, spec.explodeRadius !== undefined)
      }
    }

    this.writeMatrices()
  }

  private homeToward(p: Projectile, dt: number): void {
    if (!p.owner || !p.spec) return
    const target = this.nearestTargetFor(p, 22)
    if (!target) return
    const dx = target.pos.x - p.x
    const dz = target.pos.z - p.z
    const d = Math.hypot(dx, dz)
    if (d < 1e-4) return
    // Lái dần chứ không bám tức thì: bám tức thì thì không bao giờ né được
    const turn = 1 - Math.exp(-5 * dt)
    p.vx += ((dx / d) * p.spec.speed - p.vx) * turn
    p.vz += ((dz / d) * p.spec.speed - p.vz) * turn
  }

  private steerReturn(p: Projectile, dt: number): void {
    if (!p.owner || !p.spec) return
    const outRange = p.spec.outRange ?? 9
    if (!p.returning && p.travelled >= outRange) p.returning = true
    if (!p.returning) return

    const dx = p.owner.pos.x - p.x
    const dz = p.owner.pos.z - p.z
    const d = Math.hypot(dx, dz)
    if (d < 1e-4) return
    const turn = 1 - Math.exp(-9 * dt)
    p.vx += ((dx / d) * p.spec.speed - p.vx) * turn
    p.vz += ((dz / d) * p.spec.speed - p.vz) * turn
  }

  private nearestTargetFor(p: Projectile, radius: number): Combatant | null {
    if (!p.owner) return null
    // Tìm từ vị trí VIÊN ĐẠN, không phải vị trí người bắn
    return this.world.nearestHostileAt(p.x, p.z, p.owner.side, radius, p.owner)
  }

  /** Trả về true nếu viên đã bị thu hồi. */
  private resolveHits(p: Projectile): boolean {
    if (!p.spec || !p.owner) return false
    const spec = p.spec
    const owner = p.owner
    const count = this.world.queryCircle(
      p.x,
      p.z,
      spec.radius,
      this.hitBuffer,
      // isHostile chứ không phải `side !==`: xem ghi chú trong SkillCaster —
      // phép so sánh thô sẽ cho phi hành khí bắn trúng cả đồng môn
      (c) => c !== p.owner && c.alive && isHostile(owner.side, c.side) && !p.hits.has(c.id),
    )
    if (count === 0) return false

    for (let i = 0; i < count && p.hitsLeft > 0; i++) {
      const victim = this.hitBuffer[i] as Combatant
      p.hits.add(victim.id)
      p.hitsLeft--
      this.applyHit(p, victim)
    }

    if (p.hitsLeft <= 0) {
      this.detonate(p, spec.explodeRadius !== undefined)
      return true
    }
    return false
  }

  private applyHit(p: Projectile, victim: Combatant): void {
    if (!p.spec || !p.owner) return
    const spec = p.spec
    // Ngũ hành của CHIÊU, không phải của người thi triển: Hàn Lập thuộc Mộc vẫn
    // bắn được Hoả Cầu Thuật, và nó phải khắc theo hệ Hoả
    const savedElement = p.owner.stats.element
    p.owner.stats.element = spec.element
    const result = this.world.strike(p.owner, victim, spec.mult, {
      knockback: spec.knockback,
      stagger: spec.stagger,
    })
    p.owner.stats.element = savedElement

    if (result && spec.onHit) {
      victim.effects.apply(spec.onHit.kind, spec.onHit.duration, spec.onHit.magnitude, p.owner.id)
    }
  }

  /** Kết thúc một viên; `explode` thì gây sát thương lan trước khi tan. */
  private detonate(p: Projectile, explode: boolean): void {
    const spec = p.spec
    if (explode && spec?.explodeRadius && p.owner) {
      const owner = p.owner
      const radius = spec.explodeRadius
      const count = this.world.queryCircle(
        p.x,
        p.z,
        radius,
        this.hitBuffer,
        (c) => c.alive && isHostile(owner.side, c.side),
      )
      const savedElement = p.owner.stats.element
      p.owner.stats.element = spec.element
      for (let i = 0; i < count; i++) {
        const victim = this.hitBuffer[i] as Combatant
        // Miễn thương vừa bật lúc trúng trực tiếp sẽ chặn luôn sát thương nổ,
        // nên đặt invuln = 0 để đòn nổ vẫn vào — nhưng chỉ một lần vì viên tan ngay
        victim.invuln = 0
        this.world.strike(p.owner, victim, spec.explodeMult ?? spec.mult, {
          knockback: spec.knockback * 0.7,
          stagger: spec.stagger,
        })
        if (spec.onHit) {
          victim.effects.apply(spec.onHit.kind, spec.onHit.duration, spec.onHit.magnitude, p.owner.id)
        }
      }
      p.owner.stats.element = savedElement
      this.onExplode?.(p.x, p.y, p.z, radius, spec)
    }
    this.retire(p)
  }

  /** Hook để VFX vẽ vụ nổ. Scene gán vào. */
  onExplode?: (x: number, y: number, z: number, radius: number, spec: ProjectileSpec) => void

  /** Nhả vệt sau viên đạn. Đã được chặn nhịp, gọi được thẳng vào lớp hạt. */
  onTrail?: (
    x: number,
    y: number,
    z: number,
    vx: number,
    vz: number,
    spec: ProjectileSpec,
  ) => void

  private retire(p: Projectile): void {
    p.active = false
    p.spec = null
    p.owner = null
    p.hits.clear()
  }

  private writeMatrices(): void {
    const counts = new Map<ProjectileLook, number>()

    // Ẩn hết trước rồi ghi lại các viên đang hoạt động: đơn giản và không bao
    // giờ để lại "viên ma" ở vị trí cũ
    this.scaleVec.setScalar(0)
    this.position.set(0, -999, 0)
    this.quaternion.identity()
    this.matrix.compose(this.position, this.quaternion, this.scaleVec)
    for (const [look, mesh] of this.pools) {
      counts.set(look, 0)
      for (let i = 0; i < this.items.length; i++) mesh.setMatrixAt(i, this.matrix)
    }

    for (const p of this.items) {
      if (!p.active || !p.spec) continue
      const mesh = this.pools.get(p.spec.look)
      if (!mesh) continue
      const slot = counts.get(p.spec.look) ?? 0
      counts.set(p.spec.look, slot + 1)

      this.position.set(p.x, p.y, p.z)
      if (p.spec.look === 'kiem') {
        // Phi kiếm chỉ về hướng bay và tự xoay quanh trục thân
        this.quaternion.setFromAxisAngle(this.axis, Math.atan2(p.vx, p.vz))
      } else {
        this.quaternion.setFromAxisAngle(this.axis, p.spin)
      }
      this.scaleVec.setScalar(p.spec.scale)
      this.matrix.compose(this.position, this.quaternion, this.scaleVec)
      mesh.setMatrixAt(slot, this.matrix)
    }

    for (const mesh of this.pools.values()) mesh.instanceMatrix.needsUpdate = true
  }

  clear(): void {
    for (const p of this.items) this.retire(p)
    this.hideAll()
  }

  dispose(): void {
    for (const mesh of this.pools.values()) {
      mesh.geometry.dispose()
    }
    this.group.removeFromParent()
  }
}
