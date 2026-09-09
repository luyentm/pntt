import GUI from 'lil-gui'
import type { Game } from '@/core/Game'
import { materials } from '@/render/Materials'

/**
 * Bảng debug. Tồn tại để tôi tinh chỉnh hình ảnh bằng cách nhìn thay vì đoán số,
 * và để đọc fps / draw call khi bắt đầu spawn nhiều quái.
 * Ẩn/hiện bằng phím `.
 */
export class DebugPanel {
  private readonly gui: GUI
  private readonly readout = {
    fps: '0',
    drawCalls: '0',
    tamGiac: '0',
    material: '0',
  }

  constructor(private readonly game: Game) {
    this.gui = new GUI({ title: 'Debug — Phàm Nhân Tu Tiên', width: 300 })

    const perf = this.gui.addFolder('Hiệu năng')
    perf.add(this.readout, 'fps').name('FPS').listen().disable()
    perf.add(this.readout, 'drawCalls').name('Draw call').listen().disable()
    perf.add(this.readout, 'tamGiac').name('Tam giác').listen().disable()
    perf.add(this.readout, 'material').name('Material cache').listen().disable()

    const gfx = this.gui.addFolder('Hình ảnh')
    gfx
      .add({ scale: game.renderer.resolutionScale }, 'scale', 0.5, 1, 0.05)
      .name('Tỉ lệ phân giải')
      .onChange((v: number) => {
        game.renderer.resolutionScale = v
      })
    gfx
      .add({ post: game.composer.enabled }, 'post')
      .name('Hậu xử lý')
      .onChange((v: boolean) => {
        game.composer.enabled = v
      })
    gfx
      .add({ shadows: game.lighting.shadowsEnabled }, 'shadows')
      .name('Đổ bóng')
      .onChange((v: boolean) => {
        game.lighting.shadowsEnabled = v
      })

    const outline = this.gui.addFolder('Nét viền')
    const o = game.composer.outline
    outline.add(o, 'thickness', 0.5, 3, 0.05).name('Độ dày')
    outline.add(o, 'depthSensitivity', 0.01, 0.3, 0.005).name('Nhạy silhouette')
    outline.add(o, 'normalSensitivity', 0.2, 8, 0.1).name('Nhạy nếp gấp')
    outline.add(o, 'outlineOpacity', 0, 1, 0.02).name('Độ đậm')
    outline.add(o, 'creaseFadeStart', 2, 60, 1).name('Nếp gấp: tan từ')
    outline.add(o, 'creaseFadeEnd', 5, 120, 1).name('Nếp gấp: tan hết')
    outline.add(o, 'silhouetteFadeEnd', 20, 200, 2).name('Silhouette: tan hết')
    outline.add(o, 'grazingLow', 0, 0.6, 0.01).name('Dập xiên: từ')
    outline.add(o, 'grazingHigh', 0.05, 1, 0.01).name('Dập xiên: đến')
    outline.addColor({ color: `#${o.color.getHexString()}` }, 'color').name('Màu').onChange((v: string) => {
      o.color.set(v)
    })
    outline.close()

    const bloom = this.gui.addFolder('Bloom')
    bloom.add(game.composer.bloom, 'intensity', 0, 3, 0.05).name('Cường độ')
    bloom
      .add(game.composer.bloom.luminanceMaterial, 'threshold', 0, 1, 0.01)
      .name('Ngưỡng sáng')
    bloom.close()

    const cam = this.gui.addFolder('Camera')
    cam.add(game.camera, 'distance', 5, 40, 0.5).name('Khoảng cách').listen()
    cam.add(game.camera, 'pitch', 0.4, 1.4, 0.01).name('Góc chúc').listen()
    cam.add(game.camera, 'followLerp', 1, 25, 0.5).name('Độ mượt bám')
    cam
      .add({ shake: () => game.bus.emit('camera:shake', { magnitude: 0.5, duration: 0.4 }) }, 'shake')
      .name('Thử rung camera')
    cam.close()

    window.addEventListener('keydown', this.onKey)
  }

  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.code === 'Backquote') {
      e.preventDefault()
      if (this.gui._hidden) this.gui.show()
      else this.gui.hide()
    }
  }

  /** Gọi mỗi frame để cập nhật số đọc. */
  update(): void {
    this.readout.fps = this.game.loop.fps.toFixed(0)
    this.readout.drawCalls = String(this.game.renderer.drawCalls)
    this.readout.tamGiac = this.game.renderer.triangles.toLocaleString('vi-VN')
    this.readout.material = String(materials.size)
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKey)
    this.gui.destroy()
  }
}
