import type { Scene as ThreeScene } from 'three'
import type { EventBus } from '@/core/EventBus'
import type { GameEvents } from '@/core/events'
import type { Input } from '@/core/Input'
import type { Rng } from '@/core/Rng'
import type { IsoCamera } from '@/render/IsoCamera'
import type { Lighting } from '@/render/Lighting'

/** Mọi thứ một màn cần để dựng và chạy. */
export interface SceneContext {
  readonly three: ThreeScene
  readonly camera: IsoCamera
  readonly lighting: Lighting
  readonly input: Input
  readonly rng: Rng
  readonly bus: EventBus<GameEvents>
}

/**
 * Hợp đồng của một màn chơi.
 *
 * Đây là điểm cắm cho cốt truyện về sau: mỗi chương Phàm Nhân (Thất Huyền Môn,
 * Hoàng Phong Cốc, Thiên Nam) sẽ là một GameScene, và `ChapterScript` sẽ chạy
 * bên trong `fixedUpdate` của nó. Bản demo ship đúng một màn nhưng qua chính
 * interface này, nên thêm chương sau không phải sửa lõi.
 */
export interface GameScene {
  readonly name: string
  load(ctx: SceneContext): void | Promise<void>
  /** Nhịp cố định 60Hz — toàn bộ gameplay ở đây. */
  fixedUpdate(dt: number): void
  /** Nhịp frame — chỉ những gì thuần hình ảnh (nội suy, hiệu ứng theo thời gian thực). */
  render(alpha: number, frameDt: number): void
  unload(): void
}
