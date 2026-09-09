import { Group, type Object3D } from 'three'
import { buildBeast } from '@/art/buildBeast'
import { buildChibi } from '@/art/buildChibi'
import { HAN_LAP_LOOK } from '@/game/data/player'
import {
  buildChuongThienBinh,
  buildCodexPedestal,
  buildKiemTrucBo,
  buildTamDiemPhien,
  buildThienLoiTruc,
  buildThucKimTrung,
  buildTranKy,
} from '@/art/props/treasures'
import { IDLE } from '@/anim/clips/locomotion'
import { BEAST_IDLE } from '@/anim/clips/beast'
import type { Animator } from '@/anim/Clip'
import { CODEX, codexEntry, type CodexEntry, type CodexModel } from '@/game/data/codex'
import { unitDef } from '@/game/data/units'
import { CodexPanel } from '@/ui/CodexPanel'
import type { GameScene, SceneContext } from './Scene'

/** Mặt bệ. Mô hình đứng lên trên mốc này. */
const STAGE_Y = 0.62

/** Bao nhiêu radian mỗi giây. Một vòng khoảng 14 giây. */
const SPIN_RATE = 0.45

/**
 * Bán kính bệ và khoảng cách camera.
 *
 * Đo bằng mắt trên khung 800×578 — cỡ nhỏ nhất còn đáng nhắm tới. Ở khoảng
 * cách 6.4 thì cái bệ một mình đã chiếm nửa chiều cao khung và trông như một
 * cái bàn ăn; 8.6 thì cả bệ lẫn mô hình lọt vào khoảng trống giữa hai cột DOM
 * mà vẫn đủ lớn để đếm được mười hai thanh kiếm trúc.
 */
const PEDESTAL_RADIUS = 0.6
const CAMERA_DISTANCE = 6.2
/**
 * Bệ lệch sang trái, camera vẫn ngắm gốc toạ độ.
 *
 * Ở chế độ chi tiết, DOM chia làm ba: lưới bám mép trái, thẻ chi tiết bám mép
 * phải, và khoảng trống ở giữa hơi LỆCH TRÁI vì thẻ chi tiết rộng hơn lưới.
 * Đẩy bệ sang trái đúng bằng chênh lệch đó thì mô hình nằm giữa khoảng trống
 * chứ không nằm sau thẻ chữ.
 */
const STAGE_X = -0.75

/**
 * Đồ Giám — bảng tra nhân vật, yêu thú và pháp bảo.
 *
 * Một `GameScene` chứ không phải một lớp phủ DOM, và lý do là cái BỆ XOAY: mô
 * hình ở đây dựng bằng đúng những hàm geometry mà trận đấu dùng, nên con Hắc
 * Lang trong Đồ Giám là con Hắc Lang thật chứ không phải một tấm ảnh chụp sẽ
 * lệch đi sau lần đổi màu lông đầu tiên. Muốn vậy thì phải có một scene three,
 * và có scene rồi thì làm hẳn một màn sạch còn rẻ hơn là chen vào màn khác.
 *
 * Màn này KHÔNG có combat, không có người chơi, không có bộ va chạm. Nó có đúng
 * ba thứ: một cái bệ, một mô hình, và một bảng DOM.
 */
export class CodexScene implements GameScene {
  readonly name = 'doGiam'

  private ctx!: SceneContext
  private readonly objects: Object3D[] = []
  private readonly stage = new Group()
  /** Node xoay — mô hình gắn vào đây, bệ thì không. */
  private readonly turntable = new Group()
  private panel!: CodexPanel
  private current: Object3D | null = null
  /**
   * Animator của mô hình đang trưng, nếu nó có xương.
   *
   * Cần vì nhân vật và thú dựng ở TƯ THẾ NGHỈ của rig chứ không phải tư thế
   * đứng: rig nghỉ là hai tay dang ngang và chân duỗi thẳng, nhìn ra một hình
   * nộm chứ không phải một người. Chạy clip `IDLE` một nhịp là đủ để nó đứng
   * đúng dáng, và chạy tiếp thì nó còn thở.
   */
  private animator: Animator<string> | null = null
  private spin = 0

  load(ctx: SceneContext): void {
    this.ctx = ctx
    const { three, camera } = ctx

    this.stage.position.x = STAGE_X
    this.stage.add(this.turntable)
    const pedestal = buildCodexPedestal(PEDESTAL_RADIUS)
    pedestal.position.y = STAGE_Y
    this.stage.add(pedestal)
    // Ẩn khi chưa chọn mục: ở chế độ lưới thì thẻ trải hết bề ngang, nên cái bệ
    // chỉ là một khối cam nằm sau đám chữ — nó không nói gì mà lại tranh mắt
    this.stage.visible = false
    three.add(this.stage)
    this.objects.push(this.stage)

    const uiRoot = document.getElementById('ui-root')
    if (!uiRoot) throw new Error('CodexScene: thiếu #ui-root')
    this.panel = new CodexPanel(uiRoot)
    this.panel.onSelect = (id) => this.show(codexEntry(id))
    this.panel.onBack = () => this.clearModel()
    this.panel.onClose = () => ctx.bus.emit('game:pauseRequest', {})
    this.panel.show()

    // Camera nhìn ngang tầm bệ và ĐỨNG YÊN: đây là chỗ để ngắm một vật, nên
    // chuyển động duy nhất trên màn hình phải là vật đang xoay. Camera cũng
    // trôi theo thì hai chuyển động chồng lên nhau và mắt không bám được cái nào.
    camera.pitch = 0.3
    camera.yaw = Math.PI * 0.02
    camera.distance = CAMERA_DISTANCE
    camera.snapTo(0, STAGE_Y + 0.34, 0)

    three.updateMatrixWorld(true)
    ctx.bus.emit('scene:loaded', { name: this.name })
  }

  /** Dựng mô hình của một mục lên bệ. */
  private show(entry: CodexEntry): void {
    this.clearModel()
    const built = this.build(entry.model)
    if (!built) return
    const scale = entry.displayScale ?? 1
    built.node.scale.multiplyScalar(scale)
    built.node.position.y = STAGE_Y
    this.turntable.add(built.node)
    this.current = built.node
    this.animator = built.animator
    this.animator?.play(built.idleClip ?? IDLE)
    this.spin = 0
    this.stage.visible = true
    this.panel.showDetail(entry)
  }

  private clearModel(): void {
    if (this.current) {
      this.turntable.remove(this.current)
      this.current = null
    }
    this.animator = null
    this.turntable.rotation.y = 0
    this.stage.visible = false
  }

  /**
   * Dựng mô hình từ mô tả.
   *
   * `unit` đi qua đúng `UNITS` mà trận đấu dùng, nên Đồ Giám không giữ bản sao
   * nào của tạo hình. Tỉ lệ thì KHÔNG lấy `def.scale`: tỉ lệ trong trận là tỉ lệ
   * so với nhân vật cao 1,1 unit, còn ở đây vật đứng một mình nên con yêu thử
   * cao 0,57 unit sẽ chỉ là một chấm trên cái bệ rộng 2,3.
   */
  private build(
    model: CodexModel,
  ): { node: Object3D; animator: Animator<string> | null; idleClip?: never } | null {
    switch (model.kind) {
      case 'hanLap': {
        const chibi = buildChibi({ name: 'CodexHanLap', height: 1, detail: 'full', ...HAN_LAP_LOOK })
        chibi.root.scale.setScalar(1.15)
        return { node: chibi.root, animator: chibi.animator as unknown as Animator<string> }
      }
      case 'unit': {
        const def = unitDef(model.id)
        if (def.look.rig === 'beast') {
          const beast = buildBeast({
            name: `Codex_${def.id}`,
            shape: def.look.shape,
            // KHÔNG lấy `def.scale`: đó là tỉ lệ so với nhân vật cao 1,1 unit
            // trong trận, nên con yêu thử ra 0,52 và trên cái bệ rộng 2,3 nó
            // chỉ còn là một chấm. Ở đây mọi mô hình dựng ở tỉ lệ 1 rồi để
            // `displayScale` của từng mục chỉnh cho vừa khung.
            height: 1,
            fur: def.look.fur,
            furDark: def.look.furDark,
            belly: def.look.belly,
            eye: def.look.eye,
            nose: def.look.nose,
          })
          beast.animator.play(BEAST_IDLE)
          return { node: beast.root, animator: beast.animator as unknown as Animator<string> }
        }
        const chibi = buildChibi({
          name: `Codex_${def.id}`,
          height: 1,
          detail: 'full',
          robe: def.look.robe,
          robeDark: def.look.robeDark,
          trim: def.look.trim,
          sash: def.look.sash,
          skin: def.look.skin,
          hair: def.look.hair,
          boot: def.look.boot,
          eye: def.look.eye,
        })
        chibi.root.scale.setScalar(1.15)
        return { node: chibi.root, animator: chibi.animator as unknown as Animator<string> }
      }
      case 'prop': {
        const make = CODEX_PROPS[model.id]
        if (!make) return null
        return { node: make(), animator: null }
      }
    }
  }

  fixedUpdate(_dt: number): void {
    // Không có gameplay ở đây. Đồ Giám là một bảng tra, không phải một màn chơi
    // — toàn bộ chuyển động của nó thuần hình ảnh nên nằm hết trong `render`.
    if (this.ctx.input.wasPressed('Escape')) {
      // Esc lùi TỪNG BƯỚC: đang xem chi tiết thì về lưới, ở lưới mới ra menu.
      // Ra thẳng menu từ trang chi tiết là mất chỗ đang đọc, mà Đồ Giám là thứ
      // người ta lật qua lật lại chứ không xem một lượt rồi thôi.
      if (!this.panel.back()) this.ctx.bus.emit('game:pauseRequest', {})
    }
  }

  render(_alpha: number, frameDt: number): void {
    if (!this.current) return
    this.spin += frameDt * SPIN_RATE
    this.turntable.rotation.y = this.spin
    this.animator?.update(frameDt)
  }

  unload(): void {
    this.clearModel()
    for (const obj of this.objects) obj.removeFromParent()
    this.objects.length = 0
    this.panel.dispose()
  }
}

/** Bảng dựng prop. Ở ngoài lớp để `build` không thành một chuỗi if dài. */
const CODEX_PROPS: Record<string, () => Group> = {
  kiemTruc: buildKiemTrucBo,
  tamDiemPhien: buildTamDiemPhien,
  tranKy: buildTranKy,
  thienLoiTruc: buildThienLoiTruc,
  chuongThienBinh: buildChuongThienBinh,
  thucKimTrung: buildThucKimTrung,
}

/**
 * Mọi mục Đồ Giám đều dựng được mô hình.
 *
 * Kiểm lúc nạp module: một `prop` id gõ sai chỉ hiện ra khi có người bấm đúng
 * mục đó, và lúc ấy nó là một cái bệ trống chứ không phải một lỗi.
 */
for (const entry of CODEX) {
  if (entry.model.kind === 'prop' && !CODEX_PROPS[entry.model.id]) {
    throw new Error(`Đồ Giám "${entry.id}" trỏ vào prop không dựng được: "${entry.model.id}"`)
  }
}
