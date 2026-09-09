import { Scene } from 'three'
import { EventBus } from './EventBus'
import type { GameEvents } from './events'
import { Input, MouseBtn } from './Input'
import { Loop } from './Loop'
import { Rng } from './Rng'
import { Composer } from '@/render/Composer'
import { IsoCamera } from '@/render/IsoCamera'
import { Lighting } from '@/render/Lighting'
import { Renderer } from '@/render/Renderer'
import { createSky, type Sky } from '@/render/Sky'
import type { GameScene, SceneContext } from '@/world/Scene'

/** Seed mặc định: 4 byte ASCII của "PNTT". */
const DEFAULT_SEED = 0x504e5454

/**
 * Trục chính của game: giữ renderer/scene/camera/loop và điều phối màn chơi.
 * Không chứa luật chơi — luật nằm trong `src/game/`, còn nội dung nằm trong GameScene.
 */
export class Game {
  readonly three = new Scene()
  readonly renderer: Renderer
  readonly camera: IsoCamera
  readonly lighting: Lighting
  readonly sky: Sky
  readonly composer: Composer
  readonly input: Input
  readonly bus = new EventBus<GameEvents>()
  readonly rng: Rng
  readonly loop: Loop

  private scene: GameScene | null = null
  private paused = false

  /**
   * Thay thế đường vẽ mặc định.
   *
   * Có để cắm được một chuỗi hậu kỳ KHÁC (ví dụ bộ stylized dùng
   * `EffectComposer` của three addons) mà không phải sửa `Game`. Đặt `null` để
   * trả về `Composer` mặc định.
   */
  renderOverride: ((frameDt: number) => void) | null = null

  /**
   * Bộ môi trường stylized, nếu có. `main` gán vào.
   *
   * `Game` chỉ cần biết ba việc: nhịp nó mỗi khung, đổi cỡ khi khung hình đổi,
   * và nó có đang bật hay không. Kiểu để lỏng để `Game` không phải import lớp
   * đó — nếu import thì lõi phụ thuộc vào một tính năng tuỳ chọn.
   */
  stylized: {
    readonly active: boolean
    update(dt: number, x: number, y: number, z: number): void
    setSize(width: number, height: number): void
  } | null = null

  constructor(canvas: HTMLCanvasElement, seed = DEFAULT_SEED) {
    this.rng = new Rng(seed)
    this.renderer = new Renderer(canvas)
    this.camera = new IsoCamera(this.renderer.width / this.renderer.height)
    this.lighting = new Lighting(this.three)
    this.sky = createSky(this.three, this.lighting.sunDir)
    this.composer = new Composer(this.renderer.gl, this.three, this.camera.camera)
    this.input = new Input(canvas)
    this.loop = new Loop({ fixed: this.fixed, render: this.render })

    this.renderer.onResize((w, h) => {
      this.camera.setAspect(w, h)
      this.composer.setSize(w, h)
      this.stylized?.setSize(w, h)
    })
    this.composer.setSize(this.renderer.width, this.renderer.height)

    // Gameplay chỉ cần emit 'camera:shake', không cần biết camera tồn tại
    this.bus.on('camera:shake', ({ magnitude, duration }) => {
      this.camera.shake(magnitude, duration ?? 0.35)
    })
  }

  get isPaused(): boolean {
    return this.paused
  }

  set isPaused(value: boolean) {
    this.paused = value
    if (value) this.input.releaseAll()
  }

  get currentScene(): GameScene | null {
    return this.scene
  }

  private sceneContext(): SceneContext {
    return {
      three: this.three,
      camera: this.camera,
      lighting: this.lighting,
      input: this.input,
      // Mỗi màn có nhánh RNG riêng: rải decor của màn này không làm lệch
      // dòng số của drop vật phẩm hay roll đột phá
      rng: this.rng.fork(),
      bus: this.bus,
    }
  }

  async setScene(next: GameScene): Promise<void> {
    this.scene?.unload()
    this.scene = next
    await next.load(this.sceneContext())
  }

  start(): void {
    this.loop.start()
  }

  stop(): void {
    this.loop.stop()
  }

  private readonly fixed = (dt: number): void => {
    if (!this.paused) this.scene?.fixedUpdate(dt)
    this.input.endStep()
  }

  private readonly render = (alpha: number, frameDt: number): void => {
    this.renderer.beginFrame()

    // Điều khiển camera nằm ở nhịp frame vì nó thuần hình ảnh, và vì delta
    // kéo/cuộn chuột chỉ được xoá một lần mỗi frame (xem Input.endFrame)
    if (this.input.mouseIsDown(MouseBtn.Right)) {
      this.camera.orbit(this.input.dragX, this.input.dragY)
    }
    if (this.input.wheel !== 0) this.camera.zoom(this.input.wheel)

    this.camera.update(frameDt)
    this.lighting.update(this.camera.target.x, this.camera.target.y, this.camera.target.z)
    this.stylized?.update(
      frameDt,
      this.camera.target.x,
      this.camera.target.y,
      this.camera.target.z,
    )

    this.scene?.render(alpha, frameDt)
    if (this.renderOverride) this.renderOverride(frameDt)
    else this.composer.render(frameDt)
    this.input.endFrame()
  }

  dispose(): void {
    this.stop()
    this.scene?.unload()
    this.input.dispose()
    this.composer.dispose()
    this.sky.dispose()
    this.renderer.dispose()
    this.bus.clear()
  }
}
