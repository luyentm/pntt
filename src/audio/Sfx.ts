import type { EventBus } from '@/core/EventBus'
import type { GameEvents } from '@/core/events'
import { Synth } from './Synth'

/**
 * Khoảng cách tối thiểu giữa hai tiếng CÙNG LOẠI, giây.
 *
 * Cần thiết vì một phát Thiên Lôi Phù trúng 12 con sẽ phát 12 sự kiện
 * `combat:hit` trong đúng một frame. Không chặn thì 12 tiếng gõ cộng biên độ
 * lên nhau thành một tiếng "bục" méo tiếng, to hơn mọi thứ khác trong game.
 */
const THROTTLE: Record<string, number> = {
  hit: 0.045,
  crit: 0.08,
  swing: 0.06,
  death: 0.09,
  pickup: 0.05,
  area: 0.08,
}

/**
 * Toàn bộ âm thanh của game.
 *
 * NGHE sự kiện chứ không được hệ chiến đấu gọi trực tiếp — hệt như `Vfx`. Nhờ
 * vậy thêm hay bỏ một tiếng không phải sửa luật chơi, và combat vẫn chạy được
 * không cần âm thanh (đúng thứ các test đang làm).
 */
export class Sfx {
  private readonly synth: Synth
  private readonly unsubscribe: Array<() => void> = []
  private readonly lastAt = new Map<string, number>()
  private clock = 0

  constructor(bus: EventBus<GameEvents>, volume: number) {
    this.synth = new Synth(volume)

    this.unsubscribe.push(
      bus.on('combat:swing', (e) => {
        if (!this.allow('swing')) return
        // Tiếng vung: hơi gió quét, sắc hơn khi là người chơi
        const player = e.side === 'player'
        this.synth.noiseBurst({
          dur: 0.13,
          gain: player ? 0.1 : 0.07,
          bandpass: player ? 2600 : 1500,
          freqEnd: player ? 900 : 600,
          q: 0.9,
        })
      }),
    )

    this.unsubscribe.push(
      bus.on('combat:hit', (e) => {
        // Khiên chặn hết thì tiếng khác hẳn — người chơi phải NGHE ra được là
        // khiên đang làm việc, không chỉ thấy con số đổi màu
        if (e.absorbed >= e.amount && e.absorbed > 0) {
          if (!this.allow('hit')) return
          this.synth.tone({ freq: 520, freqEnd: 760, dur: 0.16, type: 'triangle', gain: 0.1 })
          return
        }

        if (e.dot) {
          if (!this.allow('hit')) return
          this.synth.noiseBurst({ dur: 0.09, gain: 0.05, bandpass: 700, q: 2.2 })
          return
        }

        if (e.crit) {
          if (!this.allow('crit')) return
          this.synth.noiseBurst({ dur: 0.1, gain: 0.16, bandpass: 3200, freqEnd: 800, q: 1.1 })
          this.synth.bell(880, 0.42, 0.1)
          return
        }

        if (!this.allow('hit')) return
        const playerHit = e.targetSide === 'player'
        this.synth.noiseBurst({
          dur: 0.075,
          gain: playerHit ? 0.15 : 0.11,
          // Bị đánh thì tiếng ĐỤC và thấp: nó phải khác hẳn tiếng mình đánh
          // trúng, vì đó là thông tin quan trọng nhất trong một trận đông người
          bandpass: playerHit ? 260 : 1400,
          freqEnd: playerHit ? 120 : 500,
          q: 1.4,
        })
        if (playerHit) this.synth.tone({ freq: 150, freqEnd: 80, dur: 0.14, type: 'sine', gain: 0.12 })
      }),
    )

    this.unsubscribe.push(
      bus.on('combat:death', (e) => {
        if (!this.allow('death')) return
        this.synth.noiseBurst({ dur: 0.26, gain: 0.12, bandpass: 520, freqEnd: 90, q: 0.8 })
        if (e.side === 'player') {
          this.synth.tone({ freq: 220, freqEnd: 60, dur: 0.9, type: 'sawtooth', gain: 0.14, lowpass: 700 })
        }
      }),
    )

    this.unsubscribe.push(
      bus.on('skill:cast', () => {
        this.synth.tone({ freq: 300, freqEnd: 760, dur: 0.2, type: 'triangle', gain: 0.1, attack: 0.03 })
      }),
    )

    this.unsubscribe.push(
      bus.on('skill:area', (e) => {
        if (!this.allow('area')) return
        const thunder = e.skillId === 'thienLoiPhu'
        const slam = e.skillId === 'bossSlam'
        this.synth.noiseBurst({
          dur: thunder ? 0.4 : 0.3,
          gain: 0.16,
          bandpass: thunder ? 3000 : 700,
          freqEnd: thunder ? 200 : 110,
          q: 0.7,
        })
        this.synth.tone({
          freq: slam ? 90 : 160,
          freqEnd: slam ? 45 : 70,
          dur: slam ? 0.6 : 0.34,
          type: 'sine',
          gain: 0.18,
        })
      }),
    )

    this.unsubscribe.push(
      bus.on('skill:buff', () => {
        // Kim Quang Thuẫn: tiếng khánh đồng, ngân dài
        this.synth.bell(660, 0.85, 0.13)
      }),
    )

    this.unsubscribe.push(
      bus.on('skill:dash', () => {
        this.synth.noiseBurst({ dur: 0.2, gain: 0.11, bandpass: 1800, freqEnd: 380, q: 0.6 })
      }),
    )

    this.unsubscribe.push(
      bus.on('skill:failed', () => {
        // Tiếng "không được": hai nốt đi XUỐNG. Đi lên nghe ra là thành công.
        this.synth.tone({ freq: 380, dur: 0.07, type: 'square', gain: 0.06 })
        this.synth.tone({ freq: 260, dur: 0.1, type: 'square', gain: 0.06, delay: 0.06 })
      }),
    )

    this.unsubscribe.push(
      bus.on('item:pickup', () => {
        if (!this.allow('pickup')) return
        this.synth.tone({ freq: 1180, dur: 0.09, type: 'sine', gain: 0.09 })
        this.synth.tone({ freq: 1760, dur: 0.12, type: 'sine', gain: 0.06, delay: 0.05 })
      }),
    )

    this.unsubscribe.push(
      bus.on('cultivation:tierUp', () => {
        // Lên tầng nhỏ: một tiếng khánh nhỏ. Cố ý KHIÊM TỐN — 13 tầng Luyện Khí
        // mà tầng nào cũng nổ chuông thì khoảnh khắc đột phá mất thiêng.
        this.synth.bell(1046, 0.5, 0.1)
      }),
    )

    this.unsubscribe.push(
      bus.on('cultivation:breakthrough', (e) => {
        if (e.success) {
          // Hợp âm rải đi LÊN + chuông lớn: đây là khoảnh khắc đáng nhớ nhất
          const root = 261.6
          for (const [i, ratio] of [1, 1.25, 1.5, 2].entries()) {
            this.synth.tone({
              freq: root * ratio,
              dur: 1.1 - i * 0.12,
              type: 'sine',
              gain: 0.11,
              attack: 0.02,
              delay: i * 0.075,
            })
          }
          this.synth.bell(523, 1.6, 0.15)
          this.synth.noiseBurst({ dur: 0.7, gain: 0.1, bandpass: 2400, freqEnd: 300, q: 0.5, delay: 0.28 })
        } else {
          this.synth.tone({ freq: 300, freqEnd: 70, dur: 0.9, type: 'sawtooth', gain: 0.13, lowpass: 600 })
          this.synth.noiseBurst({ dur: 0.5, gain: 0.1, bandpass: 300, freqEnd: 80, q: 1 })
        }
      }),
    )

    this.unsubscribe.push(
      bus.on('flight:toggle', ({ active }) => {
        this.synth.tone({
          freq: active ? 420 : 620,
          freqEnd: active ? 900 : 300,
          dur: 0.3,
          type: 'triangle',
          gain: 0.1,
          attack: 0.02,
        })
      }),
    )

    // Tiếng gió của phi hành: rất nhẹ và bị chặn nhịp, nếu không thì 7 vệt mỗi
    // giây thành một tiếng rít liên tục
    this.unsubscribe.push(
      bus.on('flight:trail', () => {
        if (!this.allow('flight', 0.22)) return
        this.synth.noiseBurst({ dur: 0.24, gain: 0.045, bandpass: 1100, freqEnd: 500, q: 0.7 })
      }),
    )
  }

  /** Mở khoá âm thanh. Phải gọi từ trong một cử chỉ của người dùng. */
  unlock(): void {
    this.synth.unlock()
  }

  get ready(): boolean {
    return this.synth.ready
  }

  setVolume(v: number): void {
    this.synth.setVolume(v)
  }

  /** Nhịp frame — chỉ để đếm thời gian cho bộ chặn nhịp. */
  update(frameDt: number): void {
    this.clock += frameDt
  }

  /** Tiếng khởi đợt / chuyển phase — màn gọi trực tiếp, không qua sự kiện. */
  gong(low = false): void {
    this.synth.bell(low ? 98 : 147, low ? 2.2 : 1.6, low ? 0.2 : 0.16)
    this.synth.noiseBurst({ dur: 0.6, gain: 0.09, bandpass: low ? 260 : 500, freqEnd: 90, q: 0.6 })
  }

  private allow(kind: string, custom?: number): boolean {
    const gap = custom ?? THROTTLE[kind] ?? 0
    if (gap <= 0) return true
    const last = this.lastAt.get(kind)
    if (last !== undefined && this.clock - last < gap) return false
    this.lastAt.set(kind, this.clock)
    return true
  }

  dispose(): void {
    for (const off of this.unsubscribe) off()
    this.unsubscribe.length = 0
    this.synth.dispose()
  }
}
