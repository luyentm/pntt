import { Group, type PerspectiveCamera, type Scene } from 'three'
import { Palette } from '@/art/Palette'
import type { EventBus } from '@/core/EventBus'
import type { GameEvents } from '@/core/events'
import type { Rng } from '@/core/Rng'
import { AreaBurstLayer } from './AreaBurst'
import { BreakthroughFx } from './BreakthroughFx'
import { GroundMarkLayer } from './GroundMarks'
import { LightningBolt } from './LightningBolt'
import { ParticleLayer, type EmitOptions } from './Particles'
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

/** Màu thứ hai của mỗi hệ — mỗi hạt lấy một sắc giữa hai màu. */
const ELEMENT_COLOR_2: Record<string, number> = {
  kim: Palette.vang,
  moc: Palette.doc,
  thuy: Palette.loi,
  hoa: Palette.luaDan,
  tho: Palette.datDam,
  vo: Palette.linhDam,
}

/**
 * Dáng hạt theo ngũ hành.
 *
 * Mỗi hệ một CHẤT khác nhau, không chỉ khác màu:
 *  - Hoả: đốm than bay LÊN, trọng lực âm nhẹ, lực cản cao — như tro nóng.
 *  - Thuỷ: mảnh băng RƠI xuống, trọng lực mạnh, không cản — như đá vụn.
 *  - Kim: tia lửa bắn thẳng và nhanh, tắt sớm — như kim khí chạm nhau.
 *  - Mộc: đốm lơ lửng, cản rất cao — như lá và phấn hoa.
 * Chỉ đổi màu thì bảy chiêu trông như một chiêu bảy màu.
 */
const ELEMENT_PARTICLE: Record<string, Partial<EmitOptions>> = {
  hoa: { shape: 'mote', gravity: 2.4, drag: 3.4, life: [0.5, 1.0], lift: 1.6, fade: 'pop' },
  thuy: { shape: 'shard', gravity: -22, drag: 0, life: [0.4, 0.8], spin: 16 },
  kim: { shape: 'spark', gravity: -6, drag: 1.2, life: [0.2, 0.4], speed: [7, 13] },
  moc: { shape: 'mote', gravity: -1.2, drag: 4.5, life: [0.7, 1.3], lift: 0.8 },
  tho: { shape: 'shard', gravity: -20, drag: 0.5, life: [0.4, 0.7] },
  vo: { shape: 'mote', gravity: -2, drag: 3, life: [0.5, 0.9], lift: 1 },
}

function elementParticle(element: string): Partial<EmitOptions> {
  return ELEMENT_PARTICLE[element] ?? ELEMENT_PARTICLE.vo!
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
  readonly particles: ParticleLayer
  readonly marks: GroundMarkLayer
  readonly lightning: LightningBolt

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
    this.particles = new ParticleLayer()
    this.marks = new GroundMarkLayer()
    this.lightning = new LightningBolt()

    this.group.add(this.slash.group)
    this.group.add(this.shards.group)
    this.group.add(this.burst.group)
    this.group.add(this.shield.group)
    this.group.add(this.breakthrough.group)
    this.group.add(this.particles.group)
    this.group.add(this.marks.group)
    this.group.add(this.lightning.group)
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

        // Tia lửa: cái làm cú đánh có SỨC. Mảnh vỡ nói "có gì vừa vỡ", tia lửa
        // nói "vừa có một lực rất mạnh đi qua đây".
        if (!e.dot) {
          this.particles.emit(e.x, e.y, e.z, this.rng, {
            count: e.crit ? 22 : 9,
            shape: 'spark',
            color: playerHit ? Palette.maHuyet : Palette.vang,
            color2: playerHit ? Palette.hoa : Palette.kim,
            pattern: 'sphere',
            speed: e.crit ? [9, 17] : [5, 10],
            size: [0.022, 0.05],
            life: [0.14, 0.32],
            gravity: -8,
            drag: 2.2,
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
        // Tụ khí: hạt bay VÀO người trong lúc đang niệm. Đây là thứ làm chiêu có
        // cảm giác được dựng lên thay vì bật ra từ không khí — và nó cũng là lời
        // báo trước cho đối thủ, nên nó vừa đẹp vừa công bằng.
        if (e.castTime < 0.12) return
        const color = ELEMENT_COLOR[e.element] ?? Palette.linh
        this.particles.emit(e.x, e.y + 0.4, e.z, this.rng, {
          count: 16,
          shape: 'mote',
          color,
          color2: ELEMENT_COLOR_2[e.element] ?? Palette.linhDam,
          pattern: 'implode',
          radius: 2.2,
          // Đủ nhanh để về tới người đúng lúc chiêu phát: quãng đường ~2.2 unit
          speed: [2.2 / Math.max(0.12, e.castTime), 3.4 / Math.max(0.12, e.castTime)],
          size: [0.03, 0.06],
          life: [e.castTime, e.castTime * 1.15],
          gravity: 0,
          drag: 0,
          fade: 'pop',
        })
      }),
    )

    this.unsubscribe.push(
      bus.on('skill:area', (e) => {
        const color = ELEMENT_COLOR[e.element] ?? Palette.linh
        const color2 = ELEMENT_COLOR_2[e.element] ?? Palette.linhDam
        const isLightning = e.skillId === 'thienLoiPhu'
        const isSlam = e.skillId === 'bossSlam'

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

        // Hạt theo CHẤT của ngũ hành, không chỉ theo màu
        const profile = elementParticle(e.element)
        this.particles.emit(e.x, e.y + 0.25, e.z, this.rng, {
          count: Math.round(18 + e.radius * 5),
          color,
          color2,
          pattern: 'dome',
          speed: [3, 4 + e.radius * 1.6],
          size: [0.035, 0.075],
          ...profile,
        })
        // Vòng hạt bắn ngang theo mép pháp vực — nó vẽ ra ĐÚNG tầm của chiêu,
        // nên người chơi học được bán kính mà không cần một vòng chỉ dẫn nào
        this.particles.emit(e.x, e.y + 0.12, e.z, this.rng, {
          count: Math.round(10 + e.radius * 4),
          color: color2,
          color2: color,
          pattern: 'ring',
          radius: e.radius * 0.85,
          speed: [1.4, 3.2],
          size: [0.03, 0.06],
          life: [0.3, 0.6],
          gravity: -9,
          drag: 1.6,
        })

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
        // Linh khí xoáy lên theo người: nhẹ, nhưng đủ để lên tầng có cảm giác
        this.particles.emit(e.x, e.y, e.z, this.rng, {
          count: 14,
          shape: 'mote',
          color: Palette.linh,
          color2: Palette.linhDam,
          pattern: 'ring',
          radius: 0.6,
          speed: [0.4, 1.2],
          size: [0.03, 0.06],
          life: [0.7, 1.2],
          gravity: 0.6,
          drag: 1.2,
          lift: 2.4,
        })
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
          // Ba lớp: tia kim quang bắn thẳng lên, vòng hạt loang ra mặt đất, và
          // đốm linh khí lơ lửng ở lại lâu nhất. Đây là khoảnh khắc đáng nhớ
          // nhất của bản demo nên nó được nhiều lớp nhất.
          this.particles.emit(e.x, e.y, e.z, this.rng, {
            count: 40,
            shape: 'spark',
            color: Palette.kim,
            color2: Palette.vang,
            pattern: 'cone',
            dirX: 0,
            dirZ: 0,
            arc: 0.25,
            speed: [14, 26],
            size: [0.03, 0.07],
            life: [0.5, 1],
            gravity: -6,
            drag: 0.8,
            lift: 8,
          })
          this.particles.emit(e.x, e.y + 0.1, e.z, this.rng, {
            count: 26,
            shape: 'shard',
            color: Palette.kim,
            color2: Palette.linh,
            pattern: 'ring',
            radius: 1.2,
            speed: [5, 11],
            size: [0.05, 0.1],
            life: [0.5, 0.95],
            gravity: -12,
          })
          this.particles.emit(e.x, e.y + 0.6, e.z, this.rng, {
            count: 30,
            shape: 'mote',
            color: Palette.linh,
            color2: Palette.kim,
            pattern: 'sphere',
            speed: [1, 3.4],
            size: [0.035, 0.07],
            life: [1.4, 2.4],
            gravity: 0.4,
            drag: 1.6,
            lift: 1.2,
            fade: 'pop',
          })
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
        // Bụi nặng bốc lên rồi rơi lại: cái xác để lại dấu, không tan vào không khí
        this.particles.emit(e.x, e.y + 0.2, e.z, this.rng, {
          count: 16,
          shape: 'mote',
          color: Palette.maHuyet,
          color2: Palette.aoMaDaoDam,
          pattern: 'dome',
          speed: [1.6, 3.6],
          size: [0.05, 0.1],
          life: [0.6, 1.1],
          gravity: -5,
          drag: 2.6,
          lift: 0.9,
        })
      }),
    )
  }

  /** Gọi khi người chơi hoặc quái vung đòn, để vẽ vệt chém. */
  spawnSlash(x: number, y: number, z: number, facing: number, radius: number, color?: number): void {
    this.slash.spawn(x, y + 0.5, z, facing, radius, { color: color ?? Palette.linh })
    // Bụi bốc theo lưỡi: chỉ vài hạt, và cố ý chụm hẹp theo hướng vung — nó nói
    // cho mắt biết đòn đi về phía nào, thứ mà một dải ribbon mờ không nói rõ
    this.particles.emit(x + Math.sin(facing) * radius * 0.6, y + 0.25, z + Math.cos(facing) * radius * 0.6, this.rng, {
      count: 5,
      shape: 'spark',
      color: color ?? Palette.linh,
      color2: Palette.vang,
      pattern: 'cone',
      dirX: Math.sin(facing),
      dirZ: Math.cos(facing),
      arc: 0.7,
      speed: [3, 6.5],
      size: [0.02, 0.04],
      life: [0.12, 0.24],
      gravity: -6,
      drag: 3,
    })
  }

  /** Vệt sau phi hành khí. ProjectileSystem gọi qua hook onTrail. */
  spawnTrail(x: number, y: number, z: number, vx: number, vz: number, element: string): void {
    const color = ELEMENT_COLOR[element] ?? Palette.linh
    const profile = elementParticle(element)
    // Bắn NGƯỢC hướng bay: vệt phải ở lại phía sau, không đi cùng viên đạn
    const len = Math.hypot(vx, vz) || 1
    this.particles.emit(x, y, z, this.rng, {
      count: 2,
      color,
      color2: ELEMENT_COLOR_2[element] ?? Palette.linhDam,
      pattern: 'cone',
      dirX: -vx / len,
      dirZ: -vz / len,
      arc: 0.5,
      speed: [0.6, 2],
      size: [0.025, 0.055],
      life: [0.2, 0.45],
      ...profile,
      // Vệt không được bay xa khỏi đường đạn, nên cản cao và trọng lực nhẹ
      gravity: (profile.gravity ?? -8) * 0.3,
      drag: 4,
    })
  }

  /** Vụ nổ của phi hành khí — ProjectileSystem gọi qua hook onExplode. */
  spawnExplosion(x: number, y: number, z: number, radius: number, element: string): void {
    const color = ELEMENT_COLOR[element] ?? Palette.hoa
    const color2 = ELEMENT_COLOR_2[element] ?? Palette.luaDan
    this.burst.spawn(x, y - 0.4, z, radius, { color, life: 0.55 })
    this.shards.burst(x, y, z, this.rng, { count: 18, color, speed: 6, size: 0.07 })

    // Ba lớp cho một vụ nổ: tia lửa bắn thẳng ra, đốm bay lên, vết cháy ở lại.
    // Một lớp duy nhất thì vụ nổ nào cũng giống nhau, dù đổi màu.
    this.particles.emit(x, y, z, this.rng, {
      count: 20,
      shape: 'spark',
      color,
      color2,
      pattern: 'sphere',
      speed: [7, 15],
      size: [0.025, 0.055],
      life: [0.18, 0.4],
      gravity: -10,
      drag: 2.4,
    })
    this.particles.emit(x, y, z, this.rng, {
      count: 14,
      ...elementParticle(element),
      color,
      color2,
      pattern: 'dome',
      speed: [2, 5],
      size: [0.04, 0.085],
    })
    this.marks.spawn(x, y - 0.5, z, radius * 0.8, { color, life: 2.2, opacity: 0.28 })

    this.bus.emit('camera:shake', { magnitude: 0.14, duration: 0.2 })
  }

  update(dt: number, camera: PerspectiveCamera, width: number, height: number): void {
    this.breakthrough.update(dt)
    this.particles.update(dt)
    this.marks.update(dt)
    this.lightning.update(dt)
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
    this.particles.dispose()
    this.marks.dispose()
    this.lightning.dispose()
    this.floats.dispose()
    this.group.removeFromParent()
  }
}
