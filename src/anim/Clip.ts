import type { Bone } from 'three'
import { CHANNELS, CHIBI_REST, JOINTS, JOINT_INDEX, type JointName } from '@/art/ChibiRig'

/** Độ lệch của một khớp so với thế nghỉ. Kênh nào bỏ trống nghĩa là 0. */
export interface JointPose {
  rx?: number
  ry?: number
  rz?: number
  px?: number
  py?: number
  pz?: number
}

export type PoseDef = Partial<Record<JointName, JointPose>>

export interface KeyframeDef {
  /** Mốc thời gian, giây. Phải tăng dần. */
  t: number
  pose: PoseDef
}

export interface ClipDef {
  name: string
  duration: number
  loop?: boolean
  frames: KeyframeDef[]
}

/**
 * Clip đã biên dịch: keyframe nằm trong một Float32Array phẳng.
 * Biên dịch một lần lúc nạp module để lúc chạy chỉ còn đọc số và lerp —
 * không tra object, không cấp phát, nên không sinh rác mỗi frame.
 */
export interface Clip {
  readonly name: string
  readonly duration: number
  readonly loop: boolean
  readonly times: Float32Array
  /** frameCount × JOINTS.length × CHANNELS */
  readonly data: Float32Array
}

export const POSE_SIZE = JOINTS.length * CHANNELS

export function createPoseBuffer(): Float32Array {
  return new Float32Array(POSE_SIZE)
}

export function compileClip(def: ClipDef): Clip {
  if (def.frames.length === 0) throw new Error(`Clip "${def.name}": không có keyframe`)
  const frameCount = def.frames.length
  const times = new Float32Array(frameCount)
  const data = new Float32Array(frameCount * POSE_SIZE)

  for (let f = 0; f < frameCount; f++) {
    const frame = def.frames[f] as KeyframeDef
    times[f] = frame.t
    if (f > 0 && frame.t < (times[f - 1] as number)) {
      throw new Error(`Clip "${def.name}": keyframe ${f} có thời gian giảm`)
    }
    const base = f * POSE_SIZE
    for (const [jointName, pose] of Object.entries(frame.pose)) {
      const j = JOINT_INDEX[jointName as JointName]
      if (j === undefined) throw new Error(`Clip "${def.name}": khớp lạ "${jointName}"`)
      const o = base + j * CHANNELS
      data[o] = pose.rx ?? 0
      data[o + 1] = pose.ry ?? 0
      data[o + 2] = pose.rz ?? 0
      data[o + 3] = pose.px ?? 0
      data[o + 4] = pose.py ?? 0
      data[o + 5] = pose.pz ?? 0
    }
  }

  return { name: def.name, duration: def.duration, loop: def.loop ?? true, times, data }
}

/** Lấy mẫu clip ở thời điểm `time` (giây) vào `out`. */
export function samplePose(clip: Clip, time: number, out: Float32Array): void {
  const { times, data, duration, loop } = clip
  const n = times.length

  let t = time
  if (loop && duration > 0) {
    t = t % duration
    if (t < 0) t += duration
  } else {
    t = Math.min(Math.max(t, times[0] as number), times[n - 1] as number)
  }

  if (n === 1) {
    out.set(data.subarray(0, POSE_SIZE))
    return
  }

  // Quét thẳng: clip chỉ có vài keyframe nên nhanh hơn cả tìm nhị phân
  let i = 0
  while (i < n - 2 && t > (times[i + 1] as number)) i++

  const t0 = times[i] as number
  const t1 = times[i + 1] as number
  const span = t1 - t0
  const k = span > 1e-6 ? (t - t0) / span : 0

  const o0 = i * POSE_SIZE
  const o1 = (i + 1) * POSE_SIZE
  for (let c = 0; c < POSE_SIZE; c++) {
    const a = data[o0 + c] as number
    const b = data[o1 + c] as number
    out[c] = a + (b - a) * k
  }
}

/** out = a + (b - a) * k */
export function blendPose(
  a: Float32Array,
  b: Float32Array,
  k: number,
  out: Float32Array,
): void {
  for (let c = 0; c < POSE_SIZE; c++) {
    const va = a[c] as number
    const vb = b[c] as number
    out[c] = va + (vb - va) * k
  }
}

/** Thế nghỉ dạng phẳng, dùng làm gốc để cộng độ lệch của animation. */
const REST = (() => {
  const buf = new Float32Array(POSE_SIZE)
  for (const name of JOINTS) {
    const rest = CHIBI_REST[name]
    const o = JOINT_INDEX[name] * CHANNELS
    buf[o] = rest.rot?.[0] ?? 0
    buf[o + 1] = rest.rot?.[1] ?? 0
    buf[o + 2] = rest.rot?.[2] ?? 0
    buf[o + 3] = rest.pos[0]
    buf[o + 4] = rest.pos[1]
    buf[o + 5] = rest.pos[2]
  }
  return buf
})()

/**
 * Ghi thế vào xương. Animation là ĐỘ LỆCH so với thế nghỉ, nên ở đây cộng vào
 * giá trị nghỉ — nhờ vậy sửa tỉ lệ nhân vật trong CHIBI_REST không làm hỏng clip.
 */
export function applyPose(bones: Record<JointName, Bone>, pose: Float32Array): void {
  for (const name of JOINTS) {
    const j = JOINT_INDEX[name]
    const o = j * CHANNELS
    const bone = bones[name]
    bone.rotation.set(
      (REST[o] as number) + (pose[o] as number),
      (REST[o + 1] as number) + (pose[o + 1] as number),
      (REST[o + 2] as number) + (pose[o + 2] as number),
    )
    bone.position.set(
      (REST[o + 3] as number) + (pose[o + 3] as number),
      (REST[o + 4] as number) + (pose[o + 4] as number),
      (REST[o + 5] as number) + (pose[o + 5] as number),
    )
  }
}

/**
 * Phát clip lên một bộ xương, có crossfade khi đổi clip.
 * Ba buffer được cấp phát sẵn và dùng lại mãi -> không sinh rác mỗi frame.
 */
export class Animator {
  timeScale = 1

  private current: Clip | null = null
  private previous: Clip | null = null
  private currentTime = 0
  private previousTime = 0
  private fadeLeft = 0
  private fadeDuration = 0

  private readonly bufCurrent = createPoseBuffer()
  private readonly bufPrevious = createPoseBuffer()
  private readonly bufOut = createPoseBuffer()

  constructor(private readonly bones: Record<JointName, Bone>) {}

  get clipName(): string | null {
    return this.current?.name ?? null
  }

  /** Đổi clip. Gọi lại với clip đang phát là no-op nên gọi mỗi frame vẫn an toàn. */
  play(clip: Clip, fade = 0.14): void {
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

  /** Nhảy tới một thời điểm trong clip hiện tại — dùng để khớp nhịp bước chân. */
  setTime(time: number): void {
    this.currentTime = time
  }

  update(dt: number): void {
    if (!this.current) return
    const step = dt * this.timeScale
    this.currentTime += step

    samplePose(this.current, this.currentTime, this.bufCurrent)

    if (this.previous && this.fadeLeft > 0) {
      this.previousTime += step
      this.fadeLeft = Math.max(0, this.fadeLeft - dt)
      samplePose(this.previous, this.previousTime, this.bufPrevious)
      // fadeLeft giảm dần -> k tiến về 1 -> nghiêng hẳn về clip mới
      const k = 1 - this.fadeLeft / Math.max(this.fadeDuration, 1e-4)
      blendPose(this.bufPrevious, this.bufCurrent, k, this.bufOut)
      if (this.fadeLeft === 0) this.previous = null
      applyPose(this.bones, this.bufOut)
    } else {
      applyPose(this.bones, this.bufCurrent)
    }
  }
}
