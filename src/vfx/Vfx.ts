import { Group, type PerspectiveCamera, type Scene } from 'three'
import { Palette } from '@/art/Palette'
import type { EventBus } from '@/core/EventBus'
import type { GameEvents } from '@/core/events'
import type { Rng } from '@/core/Rng'
import { AreaBurstLayer } from './AreaBurst'
import { BreakthroughFx } from './BreakthroughFx'
import { FloatingTextLayer } from './FloatingText'
import { ImpactShardLayer } from './ImpactShards'
import { ShieldBubble } from './ShieldBubble'
import { SlashArcLayer } from './SlashArc'

/** Màu theo ngũ hành — dùng cho pháp vực và vụ nổ. */
const ELEMENT_COLOR: Record<string, number> = {
  kim: Palette.kim,
  moc: Palette.moc,
  thuy: Palette.bang,
  hoa: Palette.hoa,
  tho: Palette.tho,
  vo: Palette.linh,
}

/**
 * Bộ mặt của toàn bộ hiệu ứng.
 *
 * Nó NGHE sự kiện chứ không được hệ chiến đấu gọi trực tiếp. Nhờ vậy CombatWorld
 * không cần biết VFX tồn tại — thêm hay bỏ một hiệu ứng không phải sửa luật chơi,
 * và ngược lại có thể chạy combat không cần đồ hoạ (hữu ích cho test).
 */
export class Vfx {
  readonly group = new Group()
  readonly slash: SlashArcLayer
  readonly shards: ImpactShardLayer
  readonly floats: FloatingTextLayer
  readonly burst: AreaBurstLayer
  readonly shield: ShieldBubble
  readonly breakthrough: BreakthroughFx

  private readonly unsubscribe: Array<() => void> = []

  constructor(
    scene: Scene,
    uiRoot: HTMLElement,
    private readonly bus: EventBus<GameEvents>,
    private readonly rng: Rng,
  ) {
    this.group.name = 'vfx'
    this.slash = new SlashArcLayer()
    this.shards = new ImpactShardLayer()
    this.floats = new FloatingTextLayer(uiRoot)
    this.burst = new AreaBurstLayer()
    this.shield = new ShieldBubble()
    this.breakthrough = new BreakthroughFx()

    this.group.add(this.slash.group)
    this.group.add(this.shards.group)
    this.group.add(this.burst.group)
    this.group.add(this.shield.group)
    this.group.add(this.breakthrough.group)
    scene.add(this.group)

    this.unsubscribe.push(
      bus.on('combat:hit', (e) => {
        const playerHit = e.targetSide === 'player'

        // Mảnh vỡ: màu theo bên trúng đòn, để người chơi phân biệt được ngay
        // "mình vừa đánh trúng" với "mình vừa bị đánh"
        this.shards.burst(e.x, e.y, e.z, this.rng, {
          count: e.crit ? 15 : 8,
          color: playerHit ? Palette.maHuyet : e.crit ? Palette.kim : Palette.vang,
          speed: e.crit ? 5.6 : 4.1,
          size: e.crit ? 0.07 : 0.052,
        })

        let text = String(e.amount)
        // Hiển thị lý do sát thương lệch, để luật chênh cảnh giới và ngũ hành
        // không phải là con số vô hình mà người chơi phải tự đoán
        if (e.realmFactor < 0.5) text += ' ✕'
        else if (e.elementFactor > 1.1) text += ' ↑'
        else if (e.elementFactor < 0.9) text += ' ↓'

        // Khiên chặn hết thì hiện dạng khác hẳn: người chơi phải thấy được khiên
        // đang làm việc, nếu không thì Kim Quang Thuẫn trông như vô dụng
        const fullyAbsorbed = e.absorbed >= e.amount && e.absorbed > 0
        const kind = fullyAbsorbed
          ? 'info'
          : playerHit
            ? 'playerHurt'
            : e.crit
              ? 'crit'
              : 'damage'

        this.floats.spawn(e.x, e.y, e.z, fullyAbsorbed ? `⛨ ${e.amount}` : text, kind)

        // Sát thương theo thời gian không rung camera và không bắn mảnh vỡ mạnh:
        // nó tích tắc mỗi giây nên rung theo sẽ thành co giật liên tục
        if (e.dot) return
        if (e.crit) this.bus.emit('camera:shake', { magnitude: 0.09, duration: 0.16 })
        if (playerHit && e.absorbed < e.amount) {
          this.bus.emit('camera:shake', { magnitude: 0.16, duration: 0.22 })
        }
      }),
    )

    this.unsubscribe.push(
      bus.on('skill:area', (e) => {
        const color = ELEMENT_COLOR[e.element] ?? Palette.linh
        const isLightning = e.skillId === 'thienLoiPhu'
        this.burst.spawn(e.x, e.y, e.z, e.radius, {
          color,
          life: isLightning ? 0.42 : 0.6,
          pillar: isLightning,
          pillarHeight: e.radius * 4.5,
        })
        this.shards.burst(e.x, e.y + 0.3, e.z, this.rng, {
          count: isLightning ? 16 : 12,
          color,
          speed: isLightning ? 6.5 : 4,
          size: 0.06,
        })
        if (isLightning) {
          this.bus.emit('camera:shake', { magnitude: 0.28, duration: 0.3 })
        }
      }),
    )

    this.unsubscribe.push(
      bus.on('skill:buff', (e) => {
        this.burst.spawn(e.x, e.y, e.z, 1.4, { color: Palette.kim, life: 0.45 })
        this.floats.spawn(e.x, e.y + 1.4, e.z, `⛨ ${e.magnitude}`, 'info')
      }),
    )

    this.unsubscribe.push(
      bus.on('skill:dash', (e) => {
        // Vệt gió: dùng chính vệt chém nhưng dẹt và mờ, màu linh khí
        this.slash.spawn(e.x, e.y + 0.45, e.z, e.facing, e.distance * 0.55, {
          color: Palette.linh,
          life: 0.3,
        })
      }),
    )

    this.unsubscribe.push(
      bus.on('flight:trail', (e) => {
        // Vệt gió sau phi kiếm: dùng lại vệt chém nhưng dẹt, ngắn và mờ.
        // Không viết lớp hiệu ứng mới cho nó — cùng một dải ribbon thóp hai đầu,
        // chỉ khác tham số, nên thêm một lớp nữa chỉ để đổi ba con số là phí.
        this.slash.spawn(e.x, e.y - 0.12, e.z, e.facing + Math.PI, 1.15, {
          color: Palette.linh,
          life: 0.34,
        })
      }),
    )

    this.unsubscribe.push(
      bus.on('cultivation:tierUp', (e) => {
        // Lên tầng nhỏ: hiệu ứng NHỎ có chủ ý. Nếu mỗi tầng cũng nổ cột sáng thì
        // 13 tầng Luyện Khí sẽ làm khoảnh khắc đột phá đại cảnh giới mất thiêng.
        this.burst.spawn(e.x, e.y, e.z, 1.8, { color: Palette.linh, life: 0.7 })
        this.shards.burst(e.x, e.y + 0.4, e.z, this.rng, {
          count: 12,
          color: Palette.linh,
          speed: 3.4,
          size: 0.055,
        })
        this.floats.spawn(e.x, e.y + 1.6, e.z, e.realmName, 'heal')
      }),
    )

    this.unsubscribe.push(
      bus.on('cultivation:breakthrough', (e) => {
        this.breakthrough.play(e.x, e.y, e.z, e.success)
        this.shards.burst(e.x, e.y + 0.5, e.z, this.rng, {
          count: e.success ? 34 : 14,
          color: e.success ? Palette.kim : Palette.maHuyet,
          speed: e.success ? 8.5 : 3.2,
          size: 0.08,
        })
        this.floats.spawn(
          e.x,
          e.y + 1.9,
          e.z,
          e.success ? `☯ ${e.realmName}` : 'Đột phá thất bại',
          e.success ? 'crit' : 'playerHurt',
        )
        this.bus.emit('camera:shake', {
          magnitude: e.success ? 0.5 : 0.22,
          duration: e.success ? 0.9 : 0.35,
        })
      }),
    )

    this.unsubscribe.push(
      bus.on('combat:death', (e) => {
        this.shards.burst(e.x, e.y + 0.35, e.z, this.rng, {
          count: 20,
          color: Palette.maHuyet,
          speed: 5.4,
          size: 0.06,
        })
      }),
    )
  }

  /** Gọi khi người chơi hoặc quái vung đòn, để vẽ vệt chém. */
  spawnSlash(x: number, y: number, z: number, facing: number, radius: number, color?: number): void {
    this.slash.spawn(x, y + 0.5, z, facing, radius, { color: color ?? Palette.linh })
  }

  /** Vụ nổ của phi hành khí — ProjectileSystem gọi qua hook onExplode. */
  spawnExplosion(x: number, y: number, z: number, radius: number, element: string): void {
    const color = ELEMENT_COLOR[element] ?? Palette.hoa
    this.burst.spawn(x, y - 0.4, z, radius, { color, life: 0.55 })
    this.shards.burst(x, y, z, this.rng, { count: 18, color, speed: 6, size: 0.07 })
    this.bus.emit('camera:shake', { magnitude: 0.14, duration: 0.2 })
  }

  update(dt: number, camera: PerspectiveCamera, width: number, height: number): void {
    this.breakthrough.update(dt)
    this.slash.update(dt)
    this.shards.update(dt)
    this.burst.update(dt)
    this.floats.update(dt, camera, width, height)
  }

  dispose(): void {
    for (const off of this.unsubscribe) off()
    this.slash.dispose()
    this.shards.dispose()
    this.burst.dispose()
    this.shield.dispose()
    this.breakthrough.dispose()
    this.floats.dispose()
    this.group.removeFromParent()
  }
}
