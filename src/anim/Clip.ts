import type { Bone } from 'three'
import { CHANNELS, type RigDef } from './Rig'

/** Độ lệch của một khớp so với thế nghỉ. Kênh nào bỏ trống nghĩa là 0. */
export interface JointPose {
  rx?: number
  ry?: number
  rz?: number
  px?: number
  py?: number
  pz?: number
}

export type PoseDef<Name extends string> = Partial<Record<Name, JointPose>>

export interface KeyframeDef<Name extends string> {
  /** Mốc thời gian, giây. Phải tăng dần. */
  t: number
  pose: PoseDef<Name>
}

export interface ClipDef<Name extends string> {
  name: string
  duration: number
  loop?: boolean
  frames: KeyframeDef<Name>[]
}

/**
 * Clip đã biên dịch: keyframe nằm trong một Float32Array phẳng.
 * Biên dịch một lần lúc nạp module để lúc chạy chỉ còn đọc số và lerp —
 * không tra object, không cấp phát, nên không sinh rác mỗi frame.
 */
export interface Clip<Name extends string = string> {
  readonly name: string
  readonly duration: number
  readonly loop: boolean
  readonly times: Float32Array
  /** frameCount × rig.joints.length × CHANNELS */
  readonly data: Float32Array
  readonly rig: RigDef<Name>
}

export function createPoseBuffer(rig: RigDef): Float32Array {
  return new Float32Array(rig.poseSize)
}

export function compileClip<Name extends string>(
  rig: RigDef<Name>,
  def: ClipDef<Name>,
): Clip<Name> {
  if (def.frames.length === 0) throw new Error(`Clip "${def.name}": không có keyframe`)
  const frameCount = def.frames.length
  const times = new Float32Array(frameCount)
  const data = new Float32Array(frameCount * rig.poseSize)

  for (let f = 0; f < frameCount; f++) {
    const frame = def.frames[f] as KeyframeDef<Name>
    times[f] = frame.t
    if (f > 0 && frame.t < (times[f - 1] as number)) {
      throw new Error(`Clip "${def.name}": keyframe ${f} có thời gian giảm`)
    }
    const base = f * rig.poseSize
    for (const [jointName, pose] of Object.entries(frame.pose) as Array<[Name, JointPose]>) {
      const j = rig.index[jointName]
      if (j === undefined) {
        throw new Error(`Clip "${def.name}": khớp lạ "${jointName}" (rig "${rig.name}")`)
      }
      const o = base + j * CHANNELS
      data[o] = pose.rx ?? 0
      data[o + 1] = pose.ry ?? 0
      data[o + 2] = pose.rz ?? 0
      data[o + 3] = pose.px ?? 0
      data[o + 4] = pose.py ?? 0
      data[o + 5] = pose.pz ?? 0
    }
  }

  return { name: def.name, duration: def.duration, loop: def.loop ?? true, times, data, rig }
}

/** Lấy mẫu clip ở thời điểm `time` (giây) vào `out`. */
export function samplePose(clip: Clip, time: number, out: Float32Array): void {
  const { times, data, duration, loop, rig } = clip
  const n = times.length
  const size = rig.poseSize

  let t = time
  if (loop && duration > 0) {
    t = t % duration
    if (t < 0) t += duration
  } else {
    t = Math.min(Math.max(t, times[0] as number), times[n - 1] as number)
  }

  if (n === 1) {
    out.set(data.subarray(0, size))
    return
  }

  // Quét thẳng: clip chỉ có vài keyframe nên nhanh hơn cả tìm nhị phân
  let i = 0
  while (i < n - 2 && t > (times[i + 1] as number)) i++

  const t0 = times[i] as number
  const t1 = times[i + 1] as number
  const span = t1 - t0
  const k = span > 1e-6 ? (t - t0) / span : 0

  const o0 = i * size
  const o1 = (i + 1) * size
  for (let c = 0; c < size; c++) {
    const a = data[o0 + c] as number
    const b = data[o1 + c] as number
    out[c] = a + (b - a) * k
  }
}

/** out = a + (b - a) * k */
export function blendPose(a: Float32Array, b: Float32Array, k: number, out: Float32Array): void {
  const n = out.length
  for (let c = 0; c < n; c++) {
    const va = a[c] as number
    const vb = b[c] as number
    out[c] = va + (vb - va) * k
  }
}

/**
 * Ghi thế vào xương. Animation là ĐỘ LỆCH so với thế nghỉ, nên ở đây cộng vào
 * giá trị nghỉ — nhờ vậy sửa tỉ lệ sinh vật trong bảng rest không làm hỏng clip.
 */
export function applyPose<Name extends string>(
  rig: RigDef<Name>,
  bones: Record<Name, Bone>,
  pose: Float32Array,
): void {
  const rest = rig.restBuffer
  for (const joint of rig.joints) {
    const o = rig.index[joint] * CHANNELS
    const bone = bones[joint]
    bone.rotation.set(
      (rest[o] as number) + (pose[o] as number),
      (rest[o + 1] as number) + (pose[o + 1] as number),
      (rest[o + 2] as number) + (pose[o + 2] as number),
    )
    bone.position.set(
      (rest[o + 3] as number) + (pose[o + 3] as number),
      (rest[o + 4] as number) + (pose[o + 4] as number),
      (rest[o + 5] as number) + (pose[o + 5] as number),
    )
  }
}

/**
 * Phát clip lên một bộ xương, có crossfade khi đổi clip và một LỚP PHỦ tuỳ chọn
 * chỉ ảnh hưởng một số khớp.
 *
 * Lớp phủ tồn tại để đánh trong lúc đang chạy: thân trên vung kiếm theo clip
 * đánh, còn chân vẫn giữ chu kỳ chạy. Không có nó thì mọi đòn đánh đều phải
 * dừng hẳn di chuyển, và combat mất hết cảm giác trôi chảy.
 *
 * Ba buffer được cấp phát sẵn và dùng lại mãi -> không sinh rác mỗi frame.
 */
export class Animator<Name extends string> {
  timeScale = 1

  private current: Clip<Name> | null = null
  private previous: Clip<Name> | null = null
  private currentTime = 0
  private previousTime = 0
  private fadeLeft = 0
  private fadeDuration = 0

  private overlay: Clip<Name> | null = null
  private overlayTime = 0
  private overlayMask: number[] = []
  private overlayWeight = 1

  private readonly bufCurrent: Float32Array
  private readonly bufPrevious: Float32Array
  private readonly bufOverlay: Float32Array
  private readonly bufOut: Float32Array

  constructor(
    private readonly rig: RigDef<Name>,
    private readonly bones: Record<Name, Bone>,
  ) {
    this.bufCurrent = createPoseBuffer(rig)
    this.bufPrevious = createPoseBuffer(rig)
    this.bufOverlay = createPoseBuffer(rig)
    this.bufOut = createPoseBuffer(rig)
  }

  get clipName(): string | null {
    return this.current?.name ?? null
  }

  get overlayName(): string | null {
    return this.overlay?.name ?? null
  }

  /** Đổi clip nền. Gọi lại với clip đang phát là no-op nên gọi mỗi frame vẫn an toàn. */
  play(clip: Clip<Name>, fade = 0.14): void {
    if (this.current === clip) return
    if (this.current && fade > 0) {
      this.previous = this.current
      this.previousTime = this.currentTime
      this.fadeDuration = fade
      this.fadeLeft = fade
    } else {
      this.previous = null
      this.fadeLeft = 0
    }
    this.current = clip
    this.currentTime = 0
  }

  /**
   * Phát một clip chỉ trên `joints` (và mọi khớp con của chúng không tự động —
   * phải liệt kê rõ khớp nào bị ghi đè).
   */
  playOverlay(clip: Clip<Name>, joints: readonly Name[], weight = 1): void {
    this.overlay = clip
    this.overlayTime = 0
    this.overlayWeight = weight
    this.overlayMask = joints.map((j) => this.rig.index[j])
  }

  clearOverlay(): void {
    this.overlay = null
    this.overlayMask = []
  }

  /** Lớp phủ đã chạy hết chưa (clip không lặp). */
  get overlayFinished(): boolean {
    return this.overlay === null || (!this.overlay.loop && this.overlayTime >= this.overlay.duration)
  }

  setTime(time: number): void {
    this.currentTime = time
  }

  update(dt: number): void {
    if (!this.current) return
    const step = dt * this.timeScale
    this.currentTime += step

    samplePose(this.current, this.currentTime, this.bufCurrent)

    let base = this.bufCurrent
    if (this.previous && this.fadeLeft > 0) {
      this.previousTime += step
      this.fadeLeft = Math.max(0, this.fadeLeft - dt)
      samplePose(this.previous, this.previousTime, this.bufPrevious)
      // fadeLeft giảm dần -> k tiến về 1 -> nghiêng hẳn về clip mới
      const k = 1 - this.fadeLeft / Math.max(this.fadeDuration, 1e-4)
      blendPose(this.bufPrevious, this.bufCurrent, k, this.bufOut)
      if (this.fadeLeft === 0) this.previous = null
      base = this.bufOut
    }

    if (this.overlay) {
      // Lớp phủ dùng dt THẬT, không nhân timeScale: tốc độ đòn đánh không được
      // đổi theo tốc độ chạy, nếu không thì chạy nhanh sẽ đánh nhanh theo
      this.overlayTime += dt
      samplePose(this.overlay, this.overlayTime, this.bufOverlay)
      if (base !== this.bufOut) this.bufOut.set(base)
      for (const j of this.overlayMask) {
        const o = j * CHANNELS
        for (let c = 0; c < CHANNELS; c++) {
          const a = this.bufOut[o + c] as number
          const b = this.bufOverlay[o + c] as number
          this.bufOut[o + c] = a + (b - a) * this.overlayWeight
        }
      }
      base = this.bufOut
    }

    applyPose(this.rig, this.bones, base)
  }
}
