import { Group, type PerspectiveCamera, type Scene } from 'three'
import { Palette } from '@/art/Palette'
import type { EventBus } from '@/core/EventBus'
import type { GameEvents } from '@/core/events'
import type { Rng } from '@/core/Rng'
import { FloatingTextLayer } from './FloatingText'
import { ImpactShardLayer } from './ImpactShards'
import { SlashArcLayer } from './SlashArc'

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

    this.group.add(this.slash.group)
    this.group.add(this.shards.group)
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

        this.floats.spawn(
          e.x,
          e.y,
          e.z,
          text,
          playerHit ? 'playerHurt' : e.crit ? 'crit' : 'damage',
        )

        if (e.crit) this.bus.emit('camera:shake', { magnitude: 0.09, duration: 0.16 })
        if (playerHit) this.bus.emit('camera:shake', { magnitude: 0.16, duration: 0.22 })
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

  update(dt: number, camera: PerspectiveCamera, width: number, height: number): void {
    this.slash.update(dt)
    this.shards.update(dt)
    this.floats.update(dt, camera, width, height)
  }

  dispose(): void {
    for (const off of this.unsubscribe) off()
    this.slash.dispose()
    this.shards.dispose()
    this.floats.dispose()
    this.group.removeFromParent()
  }
}
