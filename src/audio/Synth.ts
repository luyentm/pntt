/**
 * Bộ tổng hợp âm tối giản trên WebAudio.
 *
 * Không có một file audio nào trong cả project. Lý do không chỉ là dung lượng:
 * âm thanh sinh bằng code thì đổi được theo tham số ngay lúc chạy (cao độ theo
 * cảnh giới, độ đục theo khoảng cách), và một bản build vẫn chạy offline hoàn
 * toàn — cùng một nguyên tắc đã áp cho model và animation.
 */

export interface ToneSpec {
  /** Tần số đầu, Hz. */
  freq: number
  /** Tần số cuối; bỏ trống thì giữ nguyên cao độ. */
  freqEnd?: number
  /** Độ dài, giây. */
  dur: number
  type?: OscillatorType
  gain?: number
  /** Thời gian lên, giây. Rất ngắn cho tiếng gõ, dài hơn cho tiếng ngân. */
  attack?: number
  /** Trễ trước khi phát, giây. */
  delay?: number
  /** Có thì đưa qua lọc thông thấp ở tần số này. */
  lowpass?: number
}

export interface NoiseSpec {
  dur: number
  gain?: number
  /** Tần số lọc; thấp = tiếng đục (đòn nặng), cao = tiếng sắc (kim khí). */
  bandpass?: number
  /** Độ hẹp của dải. Cao = "có cao độ" hơn. */
  q?: number
  freqEnd?: number
  delay?: number
}

/**
 * Số giọng chạy cùng lúc tối đa.
 *
 * 40 chứ không 20. Thử 20 trước thì hụt: riêng tiếng đột phá đã tốn 9 giọng
 * (hợp âm rải 4 nốt + khánh 4 bồi âm + một hơi nhiễu), nên đang đánh nhau mà
 * đột phá là tiếng quan trọng nhất của cả bản demo bị cắt mất. Vẫn phải có
 * trần, vì mỗi giọng là 2–4 node và không có trần thì một trận đông người sẽ
 * dựng node vô hạn.
 *
 * Ước lượng xấu nhất với bộ chặn nhịp hiện tại: bạo kích 12 lần/giây × 5 giọng
 * × 0,42 giây ngân ≈ 25 giọng cùng lúc — vẫn dưới 40.
 */
const MAX_VOICES = 40
/** Độ dài đệm nhiễu dùng lại, giây. */
const NOISE_SECONDS = 0.5

export class Synth {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noise: AudioBuffer | null = null
  private voices = 0
  private volume: number

  constructor(volume = 0.6) {
    this.volume = volume
  }

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running'
  }

  /**
   * Dựng AudioContext. PHẢI gọi từ trong một cử chỉ của người dùng.
   *
   * Trình duyệt chặn phát âm trước khi người dùng chạm vào trang, và một
   * AudioContext dựng quá sớm sẽ nằm ở trạng thái 'suspended' mãi — âm thanh
   * "không có lỗi gì" mà cũng chẳng bao giờ nghe được.
   */
  unlock(): void {
    if (!this.ctx) {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      this.ctx = new Ctor()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.volume
      this.master.connect(this.ctx.destination)
      this.noise = this.makeNoise(this.ctx)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v))
    if (this.master) this.master.gain.value = this.volume
  }

  private makeNoise(ctx: AudioContext): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * NOISE_SECONDS)
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    // Nhiễu trắng sinh bằng một bộ sinh số tuyến tính tự viết, KHÔNG dùng
    // Math.random(): cả project cấm nó để giữ tính xác định, và ở đây nó cũng
    // không cần — nhiễu chỉ cần "không có chu kỳ nghe ra được"
    let seed = 0x2f6e2b1
    for (let i = 0; i < length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0
      data[i] = (seed / 0xffffffff) * 2 - 1
    }
    return buffer
  }

  /** Còn chỗ cho một giọng nữa không. */
  private take(): boolean {
    if (this.voices >= MAX_VOICES) return false
    this.voices++
    return true
  }

  private release(): void {
    this.voices = Math.max(0, this.voices - 1)
  }

  tone(spec: ToneSpec): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master || ctx.state !== 'running' || !this.take()) return

    const t0 = ctx.currentTime + (spec.delay ?? 0)
    const dur = Math.max(0.01, spec.dur)
    const osc = ctx.createOscillator()
    osc.type = spec.type ?? 'sine'
    osc.frequency.setValueAtTime(spec.freq, t0)
    if (spec.freqEnd !== undefined && spec.freqEnd !== spec.freq) {
      // exponentialRamp không nhận 0 và không nhận giá trị trái dấu
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, spec.freqEnd), t0 + dur)
    }

    const gain = ctx.createGain()
    const peak = spec.gain ?? 0.2
    const attack = Math.min(spec.attack ?? 0.005, dur * 0.5)
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.linearRampToValueAtTime(peak, t0 + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)

    let tail: AudioNode = gain
    if (spec.lowpass !== undefined) {
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = spec.lowpass
      gain.connect(filter)
      tail = filter
    }

    osc.connect(gain)
    tail.connect(master)
    osc.start(t0)
    osc.stop(t0 + dur + 0.02)
    osc.onended = () => {
      osc.disconnect()
      gain.disconnect()
      if (tail !== gain) tail.disconnect()
      this.release()
    }
  }

  noiseBurst(spec: NoiseSpec): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master || !this.noise || ctx.state !== 'running' || !this.take()) return

    const t0 = ctx.currentTime + (spec.delay ?? 0)
    const dur = Math.max(0.01, spec.dur)
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.loop = true

    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.Q.value = spec.q ?? 1.2
    const f0 = spec.bandpass ?? 900
    filter.frequency.setValueAtTime(f0, t0)
    if (spec.freqEnd !== undefined) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(20, spec.freqEnd), t0 + dur)
    }

    const gain = ctx.createGain()
    const peak = spec.gain ?? 0.18
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.linearRampToValueAtTime(peak, t0 + Math.min(0.004, dur * 0.3))
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)

    src.connect(filter)
    filter.connect(gain)
    gain.connect(master)
    src.start(t0)
    src.stop(t0 + dur + 0.02)
    src.onended = () => {
      src.disconnect()
      filter.disconnect()
      gain.disconnect()
      this.release()
    }
  }

  /**
   * Tiếng chuông/khánh: nhiều bồi âm lệch nhau, mỗi cái tắt với tốc độ khác.
   *
   * Đây là cách rẻ nhất để ra tiếng kim khí thật sự: một sine đơn nghe ra là
   * tiếng máy đo, còn chồng bồi âm phi điều hoà rồi cho tắt lệch nhau thì tai
   * đọc ra là "một vật bằng đồng vừa bị gõ".
   */
  bell(freq: number, dur: number, gain = 0.16): void {
    const partials: ReadonlyArray<[number, number, number]> = [
      [1, 1, 1],
      [2.76, 0.55, 0.62],
      [5.4, 0.3, 0.38],
      [8.93, 0.16, 0.25],
    ]
    for (const [ratio, level, decay] of partials) {
      this.tone({
        freq: freq * ratio,
        dur: dur * decay,
        type: 'sine',
        gain: gain * level,
        attack: 0.002,
      })
    }
  }

  dispose(): void {
    void this.ctx?.close()
    this.ctx = null
    this.master = null
    this.noise = null
    this.voices = 0
  }
}
