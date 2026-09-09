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
    quai: '0',
    canhGioi: '—',
    dot: '—',
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
      .add({ cap: game.loop.fpsCap }, 'cap', { '60 fps': 60, '120 fps': 120, 'Không khoá': 0 })
      .name('Giới hạn fps')
      .onChange((v: number) => {
        game.loop.fpsCap = v
      })
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

    // Chấm màu để tinh chỉnh bằng MẮT, không đoán số — hệt cách đã làm với viền
    const grade = this.gui.addFolder('Chấm màu')
    grade.add(game.composer.contrast, 'contrast', -0.5, 0.6, 0.01).name('Tương phản')
    grade.add(game.composer.contrast, 'brightness', -0.3, 0.3, 0.01).name('Độ sáng')
    grade.add(game.composer.saturation, 'saturation', -0.5, 0.8, 0.01).name('Bão hoà')
    grade.add(game.composer.vignette, 'darkness', 0, 1, 0.02).name('Vignette: đậm')
    grade.add(game.composer.vignette, 'offset', 0, 1, 0.02).name('Vignette: rộng')
    grade
      .add({ e: game.renderer.gl.toneMappingExposure }, 'e', 0.6, 1.6, 0.01)
      .name('Phơi sáng')
      .onChange((v: number) => {
        game.renderer.gl.toneMappingExposure = v
      })
    grade.close()

    const lights = this.gui.addFolder('Ánh sáng')
    lights.add(game.lighting.sun, 'intensity', 0, 4, 0.05).name('Nắng')
    lights.add(game.lighting.hemi, 'intensity', 0, 2, 0.05).name('Môi trường')
    lights.add(game.lighting.rim, 'intensity', 0, 2, 0.05).name('Đèn viền')
    lights
      .add({ near: (game.three.fog as { near: number }).near }, 'near', 5, 120, 1)
      .name('Sương: từ')
      .onChange((v: number) => {
        ;(game.three.fog as { near: number }).near = v
      })
    lights
      .add({ far: (game.three.fog as { far: number }).far }, 'far', 40, 320, 2)
      .name('Sương: đến')
      .onChange((v: number) => {
        ;(game.three.fog as { far: number }).far = v
      })
    lights.close()

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

    const combat = game.currentScene?.debug
    if (combat) {
      const f = this.gui.addFolder('Chiến đấu')
      f.add(this.readout, 'quai').name('Quái còn sống').listen().disable()
      f.add({ go: () => combat.spawnEnemies('yeuThu', 6) }, 'go').name('+6 Yêu Thử')
      f.add({ go: () => combat.spawnEnemies('hacLang', 3) }, 'go').name('+3 Hắc Lang')
      f.add({ go: () => combat.killAllEnemies() }, 'go').name('Diệt sạch quái')
      f.add({ go: () => combat.healPlayer() }, 'go').name('Hồi đầy sinh lực')
      f.add({ god: false }, 'god')
        .name('Bất tử')
        .onChange((v: boolean) => combat.setGodMode(v))

      // Nhóm tu luyện: để đi hết Luyện Khí → Trúc Cơ → Kết Đan trong một phút
      // mà kiểm tra cân bằng, thay vì cày thật mỗi lần sửa một con số
      const tu = this.gui.addFolder('Tu luyện')
      tu.add(this.readout, 'canhGioi').name('Cảnh giới').listen().disable()
      tu.add({ go: () => combat.addTuVi(200) }, 'go').name('+200 Tu Vi')
      tu.add({ go: () => combat.addTuVi(5000) }, 'go').name('+5000 Tu Vi')
      tu.add({ go: () => combat.addTuVi(200000) }, 'go').name('+200k Tu Vi')
      tu.add({ go: () => combat.giveItem('trucCoDan', 1) }, 'go').name('Cho Trúc Cơ Đan')
      tu.add({ go: () => combat.giveItem('ngungDan', 1) }, 'go').name('Cho Ngưng Đan')
      tu.add(
        {
          go: () => {
            for (const [id, n] of [
              ['thanhNguyenThao', 30],
              ['huyetLinhChi', 20],
              ['tinhNguyetHoa', 12],
              ['camLinhCan', 8],
              ['yeuDan', 24],
              ['linhThachHa', 400],
            ] as const) {
              combat.giveItem(id, n)
            }
          },
        },
        'go',
      ).name('Cho đủ nguyên liệu')
      tu.add({ go: () => combat.jumpToMajor(2) }, 'go').name('Nhảy tới Trúc Cơ')
      tu.add({ go: () => combat.jumpToMajor(3) }, 'go').name('Nhảy tới Kết Đan')

      const tran = this.gui.addFolder('Thủ trận')
      tran.add(this.readout, 'dot').name('Đợt').listen().disable()
      tran.add({ go: () => combat.startWave() }, 'go').name('Khởi trận (Enter)')
      for (const w of [1, 2, 3, 4, 5, 6]) {
        tran.add({ go: () => combat.jumpToWave(w - 1) }, 'go').name(`Nhảy tới đợt ${w}`)
      }
    }

    const cam = this.gui.addFolder('Camera')
    cam.add(game.camera, 'distance', 5, 40, 0.5).name('Khoảng cách').listen()
    cam.add(game.camera, 'pitch', 0.4, 1.4, 0.01).name('Góc chúc').listen()
    cam.add(game.camera, 'followLerp', 1, 25, 0.5).name('Độ mượt bám')
    cam
      .add({ shake: () => game.bus.emit('camera:shake', { magnitude: 0.5, duration: 0.4 }) }, 'shake')
      .name('Thử rung camera')
    cam.close()

    window.addEventListener('keydown', this.onKey)

    // Bản phát hành thì ẩn sẵn, vẫn mở được bằng `.
    //
    // Bản build này được đưa lên GitHub Pages, tức là một URL công khai. Người
    // vào lần đầu mà thấy bảng debug chiếm một phần ba màn hình — kèm nút "Nhảy
    // tới Kết Đan" và "+200k Tu Vi" — thì vừa không nhìn ra game, vừa mất trắng
    // toàn bộ nội dung mà cả bản demo được xây quanh.
    if (import.meta.env.PROD) this.gui.hide()
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
    const combat = this.game.currentScene?.debug
    if (combat) {
      this.readout.quai = `${combat.aliveEnemyCount()} / ${combat.enemyCount()}`
      this.readout.canhGioi = combat.realmLabel()
      this.readout.dot = combat.waveLabel()
    }
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKey)
    this.gui.destroy()
  }
}
