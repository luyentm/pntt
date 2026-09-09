import { describe, expect, it } from 'vitest'
import { CHANNELS, JOINTS, JOINT_INDEX } from '@/art/ChibiRig'
import { POSE_SIZE, blendPose, compileClip, createPoseBuffer, samplePose } from '../Clip'
import { IDLE, RUN, WALK } from '../clips/locomotion'

/** Đọc một kênh của khớp trong buffer thế. */
function ch(buf: Float32Array, joint: keyof typeof JOINT_INDEX, channel: number): number {
  return buf[JOINT_INDEX[joint] * CHANNELS + channel] as number
}

describe('compileClip', () => {
  it('POSE_SIZE khớp với số khớp × số kênh', () => {
    expect(POSE_SIZE).toBe(JOINTS.length * CHANNELS)
  })

  it('ghi kênh vào đúng ô của khớp', () => {
    const clip = compileClip({
      name: 'test',
      duration: 1,
      frames: [{ t: 0, pose: { head: { rx: 0.5, py: -0.25 } } }],
    })
    const buf = createPoseBuffer()
    samplePose(clip, 0, buf)
    expect(ch(buf, 'head', 0)).toBeCloseTo(0.5)
    expect(ch(buf, 'head', 4)).toBeCloseTo(-0.25)
    // Kênh không khai báo phải là 0, không phải undefined
    expect(ch(buf, 'head', 1)).toBe(0)
    expect(ch(buf, 'hipL', 0)).toBe(0)
  })

  it('từ chối keyframe có thời gian giảm', () => {
    expect(() =>
      compileClip({
        name: 'bad',
        duration: 1,
        frames: [{ t: 0.5, pose: {} }, { t: 0.2, pose: {} }],
      }),
    ).toThrow(/thời gian giảm/)
  })

  it('từ chối tên khớp lạ', () => {
    expect(() =>
      compileClip({
        name: 'bad',
        duration: 1,
        // @ts-expect-error — cố tình truyền khớp không tồn tại
        frames: [{ t: 0, pose: { khongTonTai: { rx: 1 } } }],
      }),
    ).toThrow(/khớp lạ/)
  })

  it('từ chối clip rỗng', () => {
    expect(() => compileClip({ name: 'empty', duration: 1, frames: [] })).toThrow(/keyframe/)
  })
})

describe('samplePose', () => {
  const clip = compileClip({
    name: 'ramp',
    duration: 2,
    frames: [
      { t: 0, pose: { head: { rx: 0 } } },
      { t: 1, pose: { head: { rx: 1 } } },
      { t: 2, pose: { head: { rx: 0 } } },
    ],
  })

  it('nội suy tuyến tính giữa hai keyframe', () => {
    const buf = createPoseBuffer()
    samplePose(clip, 0.25, buf)
    expect(ch(buf, 'head', 0)).toBeCloseTo(0.25, 5)
    samplePose(clip, 1.5, buf)
    expect(ch(buf, 'head', 0)).toBeCloseTo(0.5, 5)
  })

  it('lặp vòng theo duration', () => {
    const buf = createPoseBuffer()
    const a = createPoseBuffer()
    samplePose(clip, 0.4, a)
    // Đúng một chu kỳ sau phải ra cùng giá trị
    samplePose(clip, 2.4, buf)
    expect(ch(buf, 'head', 0)).toBeCloseTo(ch(a, 'head', 0), 5)
    // Thời gian âm cũng phải lặp đúng, không được kẹp về 0
    samplePose(clip, -1.6, buf)
    expect(ch(buf, 'head', 0)).toBeCloseTo(ch(a, 'head', 0), 5)
  })

  it('clip không lặp thì kẹp ở hai đầu', () => {
    const once = compileClip({
      name: 'once',
      duration: 1,
      loop: false,
      frames: [
        { t: 0, pose: { head: { rx: 0 } } },
        { t: 1, pose: { head: { rx: 1 } } },
      ],
    })
    const buf = createPoseBuffer()
    samplePose(once, 5, buf)
    expect(ch(buf, 'head', 0)).toBeCloseTo(1, 5)
    samplePose(once, -5, buf)
    expect(ch(buf, 'head', 0)).toBeCloseTo(0, 5)
  })

  it('clip một keyframe thì luôn trả về thế đó', () => {
    const still = compileClip({
      name: 'still',
      duration: 1,
      frames: [{ t: 0, pose: { torso: { ry: 0.3 } } }],
    })
    const buf = createPoseBuffer()
    samplePose(still, 7.7, buf)
    expect(ch(buf, 'torso', 1)).toBeCloseTo(0.3, 5)
  })
})

describe('blendPose', () => {
  it('k = 0 và k = 1 trả về đúng hai đầu', () => {
    const a = createPoseBuffer()
    const b = createPoseBuffer()
    const out = createPoseBuffer()
    a[0] = 1
    b[0] = 3
    blendPose(a, b, 0, out)
    expect(out[0]).toBeCloseTo(1)
    blendPose(a, b, 1, out)
    expect(out[0]).toBeCloseTo(3)
    blendPose(a, b, 0.5, out)
    expect(out[0]).toBeCloseTo(2)
  })
})

describe('clip di chuyển', () => {
  it('walk và run khép kín vòng lặp (frame đầu = frame cuối)', () => {
    // Nếu hai đầu không khớp thì mỗi vòng sẽ có một cú giật thấy rõ
    for (const clip of [WALK, RUN, IDLE]) {
      const first = createPoseBuffer()
      const last = createPoseBuffer()
      samplePose(clip, 0, first)
      // Lấy mẫu sát cuối thay vì đúng duration, vì đúng duration đã wrap về 0
      samplePose(clip, clip.duration - 1e-5, last)
      for (let i = 0; i < POSE_SIZE; i++) {
        expect(Math.abs((first[i] as number) - (last[i] as number))).toBeLessThan(1e-3)
      }
    }
  })

  it('chân trái và chân phải lệch pha nửa chu kỳ khi đi', () => {
    const now = createPoseBuffer()
    const half = createPoseBuffer()
    samplePose(WALK, 0, now)
    samplePose(WALK, WALK.duration / 2, half)
    // Nửa chu kỳ sau, chân phải phải ở đúng chỗ chân trái đang đứng
    expect(ch(half, 'hipR', 0)).toBeCloseTo(ch(now, 'hipL', 0), 2)
    expect(ch(half, 'hipL', 0)).toBeCloseTo(ch(now, 'hipR', 0), 2)
  })

  it('tay đánh ngược pha với chân', () => {
    const buf = createPoseBuffer()
    samplePose(WALK, 0, buf)
    // Chân trái ra trước (rx âm) thì vai trái phải ra sau (rx dương)
    expect(ch(buf, 'hipL', 0)).toBeLessThan(0)
    expect(ch(buf, 'shoulderL', 0)).toBeGreaterThan(0)
  })

  it('chạy thì ngả người ra trước và biên độ lớn hơn đi', () => {
    const walk = createPoseBuffer()
    const run = createPoseBuffer()
    samplePose(WALK, 0, walk)
    samplePose(RUN, 0, run)
    // torso rx âm = ngả ra trước
    expect(ch(run, 'torso', 0)).toBeLessThan(-0.1)
    expect(Math.abs(ch(run, 'hipL', 0))).toBeGreaterThan(Math.abs(ch(walk, 'hipL', 0)))
  })
})
