import { Group, type PerspectiveCamera, type Scene } from 'three'
import { Palette } from '@/art/Palette'
import type { EventBus } from '@/core/EventBus'
import type { GameEvents } from '@/core/events'
import type { Rng } from '@/core/Rng'
import { AreaBurstLayer } from './AreaBurst'
import { BreakthroughFx } from './BreakthroughFx'
import { GroundMarkLayer } from './GroundMarks'
import { LightningBolt } from './LightningBolt'
import { FootAuraLayer } from './FootAura'
import { NO_TRAIL, RibbonTrailLayer, type TrailOptions } from './RibbonTrails'
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
 * Cặp màu vệt ribbon theo ngũ hành — ĐẦU vệt và ĐUÔI vệt.
 *
 * Mỗi hệ đi từ một màu NÓNG SÁNG ở đầu sang màu ĐẶC TRƯNG của hệ ở đuôi. Chỉ
 * đổi một màu thì bảy chiêu trông như một chiêu bảy màu; đổi cả cặp thì mỗi
 * chiêu có một đường chuyển màu riêng, và đó là thứ đọc được cả khi vệt chỉ hiện
 * hai phần mười giây.
 *
 * Đầu vệt của hệ nào cũng sáng và ngả vàng/trắng có lý do: đầu vệt là chỗ vừa
 * xảy ra lực, và mắt đọc "sáng gắt" thành "mạnh". Để đầu vệt đúng màu hệ thì
 * hoả cầu ra một vệt đỏ đều tay, nhìn như một dải sơn.
 */
const ELEMENT_TRAIL: Record<string, { head: number; tail: number }> = {
  /** Kim quang: trắng ngà sang vàng đồng. */
  kim: { head: 0xfff3c0, tail: 0xd99b2c },
  /** Mộc: vàng chanh sang lục thẫm — tông của trúc. */
  moc: { head: 0xdcf46e, tail: 0x2f9e55 },
  /** Thuỷ: băng trắng sang lam sâu. */
  thuy: { head: 0xd8f6ff, tail: 0x2f7fd6 },
  /** Hoả: vàng lửa sang đỏ than. */
  hoa: { head: 0xffd45e, tail: 0xd8341a },
  /** Thổ: cát sang nâu đất. */
  tho: { head: 0xf4cc86, tail: 0x8a5524 },
  /** Không thuộc hệ nào: cặp chủ đạo. */
  vo: { head: Palette.vetVang, tail: Palette.vetLuc },
}

/** Sấm: trắng xanh sang lam điện — chỉ Thiên Lôi Phù dùng. */
const TRAIL_LOI = { head: 0xeaf7ff, tail: 0x6f9fff }
/** Ma đạo: huyết sang tím đen. */
const TRAIL_MA = { head: 0xd94a52, tail: Palette.aoMaDao }
/**
 * Phong lam: lam ngọc sáng sang lam sâu — cú lướt Phong Độn Thuật.
 *
 * Khoảng chuyển màu RỘNG là chỗ phân biệt nó với hai cặp lam đã có: thuỷ đi
 * trắng băng → lam vương (#D8F6FF→#2F7FD6) và sấm đi trắng xanh → lam nhạt
 * (#EAF7FF→#6F9FFF), cả hai đều bắt đầu gần như trắng nên nhìn nhanh thì hai
 * cặp đó chỉ khác nhau ở độ đậm của đuôi. Cặp này bắt đầu ở lam ngọc RÕ MÀU rồi
 * chìm xuống lam sâu, nên nó đọc ra là một dải xanh thật chứ không phải một vệt
 * trắng hơi ngả xanh.
 */
const TRAIL_PHONG = { head: 0x9ff3ff, tail: 0x2445c8 }
/**
 * Giá Y Thần Công: huyết sáng sang huyết thẫm.
 *
 * Đây là chỗ CỐ TÌNH phá quy tắc "đầu vệt ngả vàng/trắng". Đầu vàng đọc ra là
 * kim quang chính đạo, mà chiêu này đang đốt tinh huyết của chính người thi
 * triển — nó phải trông sai và nguy, không phải trông oai. Vẫn giữ đầu SÁNG để
 * còn ra được lực, chỉ đổi sắc.
 */
const TRAIL_GIA_Y = { head: 0xff9a8a, tail: 0x7a0f1e }
/** Đại Diễn Quyết: trắng tía sang tía sâu — thần thức, không thuộc ngũ hành nào. */
const TRAIL_DAI_DIEN = { head: 0xf0e4ff, tail: 0x8a4be0 }
/** Thực Kim Trùng: vàng trùng sang lục ô liu — sắc của thứ đang gặm, không phải của lửa. */
const TRAIL_TRUNG = { head: 0xe9ff9e, tail: 0x6e8f12 }

/**
 * Cặp màu vệt gắn theo TỪNG CHIÊU, tra trước khi tra theo ngũ hành.
 *
 * Cần vì ngũ hành của chiêu không phải lúc nào cũng là màu của chiêu. Thiên Lôi
 * Phù và cú giộng của Mặc Đại Phu đều là hệ `kim`, lấy theo hệ thì tia sét ra
 * vàng đồng và đòn của lão trông như một chiêu kim quang chính đạo. Phong Độn
 * Thuật là `vo` nên nó rơi vào cặp chủ đạo — tức cú lướt trông y hệt vệt chạy bộ,
 * đúng thứ mà một chiêu nên tránh nhất.
 *
 * Gom vào một bảng thay vì rải `if (id === …)` ở từng chỗ nghe sự kiện: trước
 * đây `skill:area` có ngoại lệ cho sấm mà `skill:cast` thì không, nên đoạn TỤ KHÍ
 * của Thiên Lôi Phù bốc lên màu vàng đồng rồi tia sét đánh xuống màu lam điện —
 * đoạn dẫn khí nói sai về chiêu đang tới.
 */
export const SKILL_TRAIL: Record<string, { head: number; tail: number }> = {
  thienLoiPhu: TRAIL_LOI,
  bossSlam: TRAIL_MA,
  phongDon: TRAIL_PHONG,
  giaYThanCong: TRAIL_GIA_Y,
  daiDienQuyet: TRAIL_DAI_DIEN,
  thucKimTrung: TRAIL_TRUNG,
}

function elementTrail(element: string): { head: number; tail: number } {
  return ELEMENT_TRAIL[element] ?? ELEMENT_TRAIL.vo!
}

/**
 * Cặp màu vệt của một chiêu: theo id trước, ngũ hành sau.
 *
 * Công khai cùng `SKILL_TRAIL` để test khoá được hai chỗ dễ trôi: id trong bảng
 * phải là chiêu thật, và chiêu có cặp riêng thì không được rơi về cặp ngũ hành.
 */
export function skillTrail(id: string, element: string): { head: number; tail: number } {
  return SKILL_TRAIL[id] ?? elementTrail(element)
}

/**
 * Cặp màu chủ đạo của mọi vệt đuôi: VÀNG KIM ở đầu, LAM LỤC linh khí ở đuôi.
 *
 * Đi theo cặp chứ không một màu là chỗ quan trọng. Một vệt một màu đọc ra là
 * "một dải nhựa phát sáng"; vệt chuyển từ vàng nóng sang lam lục nguội đọc ra
 * là linh khí đang tan — mắt hiểu chuyển màu thành thời gian, nên chính cái
 * gradient nói cho người xem biết đầu nào là đầu mới.
 *
 * Vàng phải là đầu, không phải đuôi: nó sáng hơn nên hút mắt, mà thứ cần hút
 * mắt là chỗ vật thể ĐANG Ở, không phải chỗ nó vừa rời khỏi.
 */
const TRAIL_HEAD = Palette.vetVang
const TRAIL_TAIL = Palette.vetLuc

/** Vệt của ma đạo: giữ tông huyết để người chơi vẫn phân biệt được đòn của địch. */
const TRAIL_HEAD_MA = 0xd94a52
const TRAIL_TAIL_MA = Palette.aoMaDao


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
  readonly marks: GroundMarkLayer
  readonly lightning: LightningBolt
  readonly trails: RibbonTrailLayer
  readonly footAura: FootAuraLayer

  private readonly unsubscribe: Array<() => void> = []
  /** Handle của các vệt đang bám theo chủ thể, tra theo khoá của cảnh. */
  private readonly follows = new Map<string, number>()
  /** Đảo chiều quét của vệt chém sau mỗi nhát, để combo không lặp một động tác. */
  private slashFlip = false
  /** Đếm tới lần nhả hào quang dưới chân kế tiếp. */
  private auraTimer = 0
  /** Đổi bên mỗi lần nhả hào quang, để nó đọc ra là từng BƯỚC chân. */
  private auraSide = 1

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
    this.marks = new GroundMarkLayer()
    this.lightning = new LightningBolt()
    this.trails = new RibbonTrailLayer()
    this.footAura = new FootAuraLayer()

    this.group.add(this.slash.group)
    this.group.add(this.shards.group)
    this.group.add(this.burst.group)
    this.group.add(this.shield.group)
    this.group.add(this.breakthrough.group)
    this.group.add(this.marks.group)
    this.group.add(this.lightning.group)
    this.group.add(this.trails.group)
    this.group.add(this.footAura.group)
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

        // Nan hoa: cái làm cú đánh có SỨC. Mảnh vỡ nói "có gì vừa vỡ", nan hoa
        // nói "vừa có một lực rất mạnh đi qua đây". Ngắn và bắn thẳng ra, nên
        // mắt đọc ra hướng lực chứ chỉ là một đám sáng.
        if (!e.dot) {
          const tone = playerHit ? TRAIL_MA : e.crit ? ELEMENT_TRAIL.kim! : ELEMENT_TRAIL.vo!
          this.spokes(e.x, e.y, e.z, e.crit ? 8 : 5, {
            ...tone,
            inner: 0.06,
            outer: e.crit ? 1.5 : 0.9,
            rise: e.crit ? 0.7 : 0.4,
            width: e.crit ? 0.075 : 0.05,
            opacity: e.crit ? 0.9 : 0.75,
            fade: e.crit ? 0.22 : 0.16,
            points: 4,
          })
        }

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
      bus.on('skill:cast', (e) => {
        // Tụ khí: nan hoa chạy VÀO người trong lúc đang niệm — `inward` nên đầu
        // vệt nằm ở tâm, tức chỗ sáng nhất là chỗ linh khí đang tụ lại. Đây là
        // thứ làm chiêu có cảm giác được dựng lên thay vì bật ra từ không khí,
        // và nó cũng là lời báo trước cho đối thủ, nên vừa đẹp vừa công bằng.
        if (e.castTime < 0.12) return
        const tone = skillTrail(e.id, e.element)
        this.spokes(e.x, e.y + 0.35, e.z, 7, {
          ...tone,
          inner: 0.2,
          outer: 2.1,
          rise: 0.5,
          width: 0.075,
          opacity: 0.6,
          // Tan đúng bằng thời gian dẫn khí: vệt còn ở đó cho tới lúc chiêu phát
          fade: Math.min(0.9, e.castTime),
        })
      }),
    )

    this.unsubscribe.push(
      bus.on('skill:area', (e) => {
        const color = ELEMENT_COLOR[e.element] ?? Palette.linh
        const isLightning = e.skillId === 'thienLoiPhu'
        const isSlam = e.skillId === 'bossSlam'
        // Màu theo bảng `SKILL_TRAIL` (xem lý do ở đó). Hai cờ trên vẫn cần cho
        // những thứ KHÁC màu: nhịp tan, độ bốc của nan hoa, tia sét, rung camera.
        const tone = skillTrail(e.skillId, e.element)

        // Thiên Lôi Phù KHÔNG dùng cột của AreaBurst nữa: giờ đã có tia sét
        // thật, và cái cột chỉ che mất nó. Còn lại chỉ là vòng loang trên đất.
        this.burst.spawn(e.x, e.y, e.z, e.radius, {
          color,
          life: isLightning ? 0.42 : 0.6,
          pillar: false,
        })
        this.shards.burst(e.x, e.y + 0.3, e.z, this.rng, {
          count: isLightning ? 16 : 12,
          color,
          speed: isLightning ? 6.5 : 4,
          size: 0.06,
        })

        // Tia sét thật cho Thiên Lôi Phù, thay cho một cột sáng suông
        if (isLightning) {
          this.lightning.strike(e.x, e.y, e.z, this.rng, { height: 18, width: 0.26 })
        }

        // Nan hoa chạy tới ĐÚNG mép pháp vực. Nó vẽ ra chính tầm của chiêu, nên
        // người chơi học được bán kính mà không cần một vòng chỉ dẫn nào — đây
        // là việc mà vòng hạt bắn ngang trước kia làm, và nan hoa làm rõ hơn vì
        // nó là những đường liền chỉ thẳng ra mép.
        this.spokes(e.x, e.y + 0.18, e.z, Math.round(6 + e.radius * 1.6), {
          ...tone,
          inner: 0.25,
          outer: e.radius,
          rise: isLightning ? 1.5 : 0.55,
          width: 0.07,
          opacity: 0.6,
          fade: isLightning ? 0.3 : 0.42,
        })
        // Và ba vòng xoắn bốc lên ở tâm: pháp vực không chỉ loang ngang, nó còn
        // có một cột khí ở giữa. Không có nó thì chiêu diện rộng nào cũng dẹt.
        for (let i = 0; i < 3; i++) {
          this.trails.strokeSpiral(
            e.x,
            e.y,
            e.z,
            e.radius * 0.3,
            1.5 + e.radius * 0.25,
            1.3,
            (i / 3) * Math.PI * 2,
            { ...tone, width: 0.06, opacity: 0.55, fade: 0.5 },
          )
        }

        // Vết còn lại: bằng chứng rằng chỗ đó vừa bị đánh
        this.marks.spawn(e.x, e.y, e.z, e.radius * 0.95, {
          color: e.element === 'thuy' ? Palette.bang : color,
          life: e.element === 'thuy' ? 3.4 : 2.4,
          opacity: isSlam ? 0.42 : 0.3,
        })

        if (isLightning || isSlam) {
          this.bus.emit('camera:shake', { magnitude: 0.28, duration: 0.3 })
        }
      }),
    )

    this.unsubscribe.push(
      bus.on('skill:buff', (e) => {
        // Màu theo CHIÊU, không phải kim quang cho mọi thứ. Trước đây chỉ có một
        // chiêu hỗ trợ nên tô cứng màu kim là đủ; giờ có ba, mà Giá Y Thần Công
        // dựng lên bằng cột kim quang thì nó đọc ra là một chiêu chính đạo —
        // đúng thứ mà chiêu đốt tinh huyết không được phép trông giống.
        const tone = skillTrail(e.id, 'vo')
        this.burst.spawn(e.x, e.y, e.z, 1.4, { color: tone.tail, life: 0.45 })
        // Bốn dải cuộn lên quanh người: trạng thái hỗ trợ là thứ được DỰNG LÊN,
        // và đường xoắn đi lên là cách nói điều đó mà không cần một chữ nào
        for (let i = 0; i < 4; i++) {
          this.trails.strokeSpiral(e.x, e.y, e.z, 0.62, 1.9, 1.1, (i / 4) * Math.PI * 2, {
            ...tone,
            width: 0.06,
            opacity: 0.7,
            fade: 0.55,
          })
        }
        // Chữ bay lên phải đọc được cho CẢ HAI loại độ mạnh. `khien` mang một
        // LƯỢNG (hấp thụ 1870 sát thương) nên hiện số là đúng; Giá Y và Đại Diễn
        // mang một TỈ LỆ, và "⛨ 0.6" thì không nói gì với người chơi cả — số đó
        // phải đọc ra là +60%.
        const label =
          e.kind === 'khien' ? `⛨ ${e.magnitude}` : `+${Math.round(e.magnitude * 100)}%`
        this.floats.spawn(e.x, e.y + 1.4, e.z, label, 'info')
      }),
    )

    this.unsubscribe.push(
      bus.on('skill:dash', (e) => {
        // Vệt gió: dùng chính vệt chém nhưng dẹt và mờ.
        //
        // Lấy lam giữa của `Palette.thuy` chứ không lấy đầu hay đuôi của
        // `TRAIL_PHONG`: đây là một tấm quạt dẹt một màu, mà đầu cặp thì gần như
        // trắng (tan vào nền trời) và đuôi cặp thì thẫm (tan vào bóng cỏ). Chỉ
        // dải ribbon mới có chuyển màu để dùng được cả hai đầu đó.
        this.slash.spawn(e.x, e.y + 0.45, e.z, e.facing, e.distance * 0.55, {
          color: Palette.thuy,
          life: 0.3,
        })
        // Và một vệt dải chạy hết cú lướt. Vệt chém chỉ nói "có gì quét qua đây";
        // dải nối điểm đầu với điểm cuối mới nói ĐI TỪ ĐÂU TỚI ĐÂU — thứ duy nhất
        // cho người chơi thấy mình vừa dịch đi bao xa.
        const dx = Math.sin(e.facing) * e.distance
        const dz = Math.cos(e.facing) * e.distance
        // Cặp lam riêng, KHÔNG phải cặp chủ đạo: cú lướt và cú chạy bộ đi cùng
        // một đường thẳng ngang mặt đất, nên nếu cùng màu thì Phong Độn Thuật
        // đọc ra là "chạy nhanh một nhịp" chứ không phải một chiêu.
        this.trails.strokeLine(e.x, e.y + 0.55, e.z, e.x + dx, e.y + 0.55, e.z + dz, {
          ...TRAIL_PHONG,
          width: 0.3,
          opacity: 0.8,
          fade: 0.34,
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
        // Linh khí xoáy lên theo người: nhẹ, nhưng đủ để lên tầng có cảm giác.
        // Ba dải, không phải mười: lên tầng nhỏ phải nhỏ hơn đột phá đại cảnh
        // giới, và số dải là cách chia bậc rõ hơn cả màu hay bề rộng.
        for (let i = 0; i < 3; i++) {
          this.trails.strokeSpiral(e.x, e.y, e.z, 0.58, 1.7, 1.2, (i / 3) * Math.PI * 2, {
            ...ELEMENT_TRAIL.vo!,
            width: 0.055,
            opacity: 0.7,
            fade: 0.6,
          })
        }
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

        if (e.success) {
          // Ba lớp: nan hoa kim quang bắn thẳng lên, nan hoa loang ra mặt đất,
          // và tám dải xoắn cuộn lên ở lại lâu nhất. Đây là khoảnh khắc đáng
          // nhớ nhất của bản demo nên nó được nhiều lớp nhất — và cách chia bậc
          // là SỐ DẢI, không phải bề rộng: 8 dải so với 3 dải của lên tầng nhỏ.
          this.spokes(e.x, e.y + 0.2, e.z, 10, {
            ...ELEMENT_TRAIL.kim!,
            inner: 0.1,
            outer: 1.1,
            rise: 5.5,
            width: 0.1,
            opacity: 0.95,
            fade: 0.7,
          })
          this.spokes(e.x, e.y + 0.05, e.z, 12, {
            ...ELEMENT_TRAIL.vo!,
            inner: 0.4,
            outer: 4.6,
            rise: 0.35,
            width: 0.1,
            opacity: 0.8,
            fade: 0.85,
          })
          for (let i = 0; i < 8; i++) {
            this.trails.strokeSpiral(e.x, e.y, e.z, 1.15, 4.4, 1.8, (i / 8) * Math.PI * 2, {
              head: Palette.kim,
              tail: Palette.vetLuc,
              width: 0.09,
              opacity: 0.9,
              fade: 1.5,
            })
          }
          this.marks.spawn(e.x, e.y, e.z, 5.5, { color: Palette.kim, life: 3.2, opacity: 0.3 })
        }
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
        // Nan hoa huyết khí tản ra SÁT ĐẤT: cái xác để lại dấu, không tan vào
        // không khí. `rise` thấp là chỗ khác biệt với vụ nổ — nó xẹp xuống chứ
        // không bốc lên, và đó là cách nói "tắt" chứ không phải "phát ra".
        this.spokes(e.x, e.y + 0.12, e.z, 6, {
          ...TRAIL_MA,
          inner: 0.1,
          outer: 1.2,
          rise: 0.15,
          width: 0.075,
          opacity: 0.7,
          fade: 0.4,
        })
      }),
    )
  }

  /** Gọi khi người chơi hoặc quái vung đòn, để vẽ vệt chém. */
  spawnSlash(
    x: number,
    y: number,
    z: number,
    facing: number,
    radius: number,
    side: 'player' | 'ally' | 'enemy' = 'player',
  ): void {
    const friendly = side === 'player'
    const color = friendly ? Palette.linh : Palette.maHuyet
    this.slash.spawn(x, y + 0.5, z, facing, radius, { color })

    // Dải bám theo đường lưỡi kiếm, ĐÈ LÊN cung chém chứ không thay nó: cung nói
    // "cả vùng này bị quét", dải nói "lưỡi đi theo đường này và đây là chỗ nó
    // vừa tới". Bỏ cung đi thì đòn đánh mất phần diện tích và hoá ra mảnh khảnh.
    this.slashFlip = !this.slashFlip
    this.trails.strokeArc(x, y + 0.52, z, facing, radius * 0.95, 1.0, this.slashFlip, {
      head: friendly ? TRAIL_HEAD : TRAIL_HEAD_MA,
      tail: friendly ? TRAIL_TAIL : TRAIL_TAIL_MA,
      width: 0.26,
      opacity: friendly ? 0.95 : 0.8,
      fade: 0.26,
    })
    // Hai nan hoa bắn thẳng theo hướng vung, ở đúng đầu lưỡi. Cung nói "cả vùng
    // này bị quét", dải nói "lưỡi đi theo đường này" — còn hai nan hoa này nói
    // ĐÒN ĐI VỀ PHÍA NÀO, thứ mà một đường cung đối xứng không nói rõ.
    const tipX = x + Math.sin(facing) * radius * 0.85
    const tipZ = z + Math.cos(facing) * radius * 0.85
    for (let i = 0; i < 2; i++) {
      const a = facing + this.rng.float(-0.3, 0.3)
      const len = radius * this.rng.float(0.3, 0.5)
      this.trails.strokeLine(
        tipX,
        y + 0.42,
        tipZ,
        tipX + Math.sin(a) * len,
        y + 0.5,
        tipZ + Math.cos(a) * len,
        {
          head: friendly ? TRAIL_HEAD : TRAIL_MA.head,
          tail: friendly ? TRAIL_TAIL : TRAIL_MA.tail,
          width: 0.08,
          opacity: 0.8,
          fade: 0.16,
          points: 4,
        },
      )
    }
  }

  /**
   * Chùm nan hoa ribbon toả ra từ một điểm — thứ THAY THẾ cho tia lửa hạt.
   *
   * ## Đầu vệt LUÔN ở tâm
   *
   * Dải thóp dần từ đầu về đuôi, nên đầu vệt là đầu DÀY và CHÓI. Bản đầu tôi đặt
   * đầu vệt ở mút ngoài — kết quả là mỗi nan hoa dày và sáng nhất ở vành, thóp
   * lại về tâm, và cả chùm đọc ra là những tia đang CHIẾU VÀO tâm. Ngược hẳn
   * nghĩa của một vụ nổ.
   *
   * Đặt đầu ở tâm thì được đúng hình sao nổ: đặc và chói ở chỗ vừa xảy ra lực,
   * mảnh và nhạt dần ra ngoài. Và nó đúng cho cả tụ khí — chỗ linh khí đang tụ
   * cũng là chỗ phải sáng nhất — nên không cần hai chiều, chỉ cần một.
   *
   * ## Góc rải đều rồi nhiễu nhẹ
   *
   * Không rải hoàn toàn tự do: theo phân bố đúng thì sẽ có mấy nan chồng khít
   * nhau và cả chùm lệch hẳn về một phía. Với 5 nan thì chuyện đó xảy ra thường
   * xuyên, và nó đọc ra là hiệu ứng bị lỗi chứ không phải là ngẫu nhiên.
   */
  private spokes(
    x: number,
    y: number,
    z: number,
    count: number,
    o: TrailOptions & {
      head: number
      tail: number
      /** Bán kính gốc nan hoa. */
      inner?: number
      /** Bán kính đầu nan hoa. */
      outer?: number
      /** Mút ngoài nan hoa nhấc lên bấy nhiêu. */
      rise?: number
    },
  ): void {
    const inner = o.inner ?? 0.1
    const outer = o.outer ?? 1
    const rise = o.rise ?? 0.3
    const base = this.rng.float(0, Math.PI * 2)
    const style: TrailOptions = {
      head: o.head,
      tail: o.tail,
      width: o.width,
      opacity: o.opacity,
      fade: o.fade,
      points: o.points,
    }
    for (let i = 0; i < count; i++) {
      const a = base + (i / count) * Math.PI * 2 + this.rng.float(-0.22, 0.22)
      const len = outer * this.rng.float(0.62, 1)
      const up = rise * this.rng.float(0.35, 1)
      // strokeLine coi điểm THỨ HAI là đầu vệt, nên tâm phải đứng thứ hai
      this.trails.strokeLine(
        x + Math.cos(a) * len,
        y + up,
        z + Math.sin(a) * len,
        x + Math.cos(a) * inner,
        y,
        z + Math.sin(a) * inner,
        style,
      )
    }
  }

  /**
   * Hào quang linh khí toả ra dưới chân khi di chuyển. Cảnh gọi mỗi frame.
   *
   * Ngưỡng tốc độ 2.2 chứ không 0: đi bộ chậm mà cũng toả hào quang thì nó mất
   * hết ý nghĩa — phải là dấu hiệu của "đang lao đi", không phải của "đang tồn tại".
   *
   * Vòng được nhả LỆCH SANG HAI BÊN xen kẽ, không phải đúng giữa hai chân. Nhả
   * đúng giữa thì một chuỗi vòng đồng tâm chồng lên nhau đọc ra là một hiệu ứng
   * đứng yên đang nhấp nháy; lệch bên thì mắt đọc ra từng BƯỚC CHÂN.
   */
  footAuraStep(dt: number, x: number, y: number, z: number, facing: number, speed: number, flying: boolean): void {
    if (speed < 2.2) {
      this.auraTimer = 0
      return
    }
    this.auraTimer -= dt
    if (this.auraTimer > 0) return
    // Bay thì nhả thưa hơn và vòng to hơn: không có bước chân nào cả, nó là
    // luồng khí dưới phi kiếm nên nhịp phải chậm và mượt hơn nhịp chạy
    this.auraTimer = flying ? 0.16 : 0.11
    this.auraSide = -this.auraSide

    // Lệch ngang so với hướng đang nhìn
    const sx = Math.cos(facing) * 0.16 * this.auraSide
    const sz = -Math.sin(facing) * 0.16 * this.auraSide
    this.footAura.spawn(x + sx, y, z + sz, {
      color: this.auraSide > 0 ? Palette.vetLuc : Palette.vetVang,
      from: flying ? 0.35 : 0.2,
      to: flying ? 1.6 : 0.9,
      life: flying ? 0.55 : 0.4,
      peak: flying ? 0.6 : 0.5,
    })
  }

  /**
   * Vệt dải bám theo một chủ thể đang chuyển động.
   *
   * Cảnh gọi MỖI FRAME với `active` = "chủ thể này còn đang để lại vệt". Lớp này
   * tự lo phần vòng đời: `active` chuyển sang true thì nó xin một vệt mới,
   * chuyển sang false thì nó thả cho vệt tan.
   *
   * Vì sao lấy khoá bằng chuỗi chứ không bắt bên gọi giữ handle: bên gọi là các
   * hệ gameplay (người chơi, hệ phi hành khí), và chúng KHÔNG NÊN giữ trạng thái
   * của lớp đồ hoạ. Bật/tắt hiệu ứng phải là việc sửa một chỗ trong `Vfx`, không
   * phải đi dọn các trường handle rải rác trong luật chơi.
   *
   * `options` chỉ có tác dụng ở khung hình vệt được tạo ra; đổi màu giữa đường
   * thì phải thả rồi bám lại.
   */
  follow(
    key: string,
    active: boolean,
    x: number,
    y: number,
    z: number,
    options?: TrailOptions,
  ): void {
    const existing = this.follows.get(key) ?? NO_TRAIL
    if (!active) {
      if (existing !== NO_TRAIL) {
        this.trails.release(existing)
        this.follows.delete(key)
      }
      return
    }
    let handle = existing
    // isLive cũng false khi vệt bị hồ thu hồi để nhường cho vệt khác, nên nhánh
    // này lo luôn cả trường hợp đó — không cần bên gọi biết chuyện thu hồi
    if (!this.trails.isLive(handle)) {
      handle = this.trails.attach(options)
      this.follows.set(key, handle)
    }
    this.trails.feed(handle, x, y, z)
  }

  /**
   * Cấu hình vệt dải cho phi hành khí theo ngũ hành.
   *
   * Đầu vệt lấy MÀU CỦA HỆ, không phải vàng kim như các vệt khác: hoả cầu và
   * băng phong phù phải nhìn ra ngay là hai chiêu khác nhau, và màu của vệt là
   * thứ đọc được ở khoảng cách xa hơn cả hình viên đạn. Đuôi vẫn về lam lục nên
   * cả bộ hiệu ứng vẫn cùng một tông.
   */
  projectileTrail(element: string): TrailOptions {
    return {
      ...elementTrail(element),
      width: 0.14,
      opacity: 0.85,
      fade: 0.3,
      // Bước ngắn: viên đạn bay nhanh nên nếu để bước mặc định thì 18 điểm xương
      // sống trải ra gần 3 unit và dải dài quá thành ra một cái ống
      step: 0.11,
    }
  }

  /** Vụ nổ của phi hành khí — ProjectileSystem gọi qua hook onExplode. */
  spawnExplosion(x: number, y: number, z: number, radius: number, element: string): void {
    const color = ELEMENT_COLOR[element] ?? Palette.hoa
    const tone = elementTrail(element)
    this.burst.spawn(x, y - 0.4, z, radius, { color, life: 0.55 })
    this.shards.burst(x, y, z, this.rng, { count: 18, color, speed: 6, size: 0.07 })

    // Ba lớp cho một vụ nổ: nan hoa bắn ngang ra, nan hoa bốc lên, vết cháy ở
    // lại. Một lớp duy nhất thì vụ nổ nào cũng giống nhau, dù đổi màu.
    this.spokes(x, y, z, Math.round(7 + radius * 2), {
      ...tone,
      inner: 0.12,
      outer: radius * 1.35,
      rise: 0.4,
      width: 0.085,
      opacity: 0.8,
      fade: 0.3,
    })
    this.spokes(x, y + 0.1, z, 5, {
      ...tone,
      inner: 0.3,
      outer: radius * 0.5,
      rise: radius * 1.5,
      width: 0.075,
      opacity: 0.75,
      fade: 0.45,
    })
    this.marks.spawn(x, y - 0.5, z, radius * 0.8, { color, life: 2.2, opacity: 0.28 })

    // Hệ Hoả được thêm hai dải xoắn cuộn lên — chỗ duy nhất trong bộ hiệu ứng
    // mô tả "khí nóng bốc lên sau vụ nổ". Băng vỡ và kim khí thì không: chúng
    // tan tại chỗ, và cho chúng cuộn lên là nói sai về chất của chúng.
    if (element === 'hoa') {
      for (let i = 0; i < 2; i++) {
        this.trails.strokeSpiral(x, y, z, radius * 0.34, radius * 1.6, 1, i * Math.PI, {
          ...tone,
          width: 0.09,
          opacity: 0.6,
          fade: 0.7,
        })
      }
    }
  }

  update(dt: number, camera: PerspectiveCamera, width: number, height: number): void {
    this.breakthrough.update(dt)
    this.footAura.update(dt)
    this.marks.update(dt)
    this.lightning.update(dt)
    this.slash.update(dt)
    this.trails.update(dt, camera)
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
    this.footAura.dispose()
    this.marks.dispose()
    this.lightning.dispose()
    this.trails.dispose()
    this.floats.dispose()
    this.group.removeFromParent()
  }
}
