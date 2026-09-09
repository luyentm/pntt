import { describe, expect, it } from 'vitest'
import { CHIBI_RIG, type ChibiJoint } from '@/art/ChibiRig'
import { CHANNELS } from '../Rig'
import { blendPose, compileClip, createPoseBuffer, samplePose } from '../Clip'
import { IDLE, RUN, WALK } from '../clips/locomotion'

const POSE_SIZE = CHIBI_RIG.poseSize

/** Đọc một kênh của khớp trong buffer thế. */
function ch(buf: Float32Array, joint: ChibiJoint, channel: number): number {
  return buf[CHIBI_RIG.index[joint] * CHANNELS + channel] as number
}

describe('compileClip', () => {
  it('POSE_SIZE khớp với số khớp × số kênh', () => {
    expect(POSE_SIZE).toBe(CHIBI_RIG.joints.length * CHANNELS)
  })

  it('ghi kênh vào đúng ô của khớp', () => {
    const clip = compileClip(CHIBI_RIG, {
      name: 'test',
      duration: 1,
      frames: [{ t: 0, pose: { head: { rx: 0.5, py: -0.25 } } }],
    })
    const buf = createPoseBuffer(CHIBI_RIG)
    samplePose(clip, 0, buf)
    expect(ch(buf, 'head', 0)).toBeCloseTo(0.5)
    expect(ch(buf, 'head', 4)).toBeCloseTo(-0.25)
    // Kênh không khai báo phải là 0, không phải undefined
    expect(ch(buf, 'head', 1)).toBe(0)
    expect(ch(buf, 'hipL', 0)).toBe(0)
  })

  it('từ chối keyframe có thời gian giảm', () => {
    expect(() =>
      compileClip(CHIBI_RIG, {
        name: 'bad',
        duration: 1,
        frames: [{ t: 0.5, pose: {} }, { t: 0.2, pose: {} }],
      }),
    ).toThrow(/thời gian giảm/)
  })

  it('từ chối tên khớp lạ', () => {
    // TypeScript đã chặn được ở compile time; test này bảo vệ lớp KIỂM TRA RUNTIME,
    // cần cho trường hợp clip được nạp từ dữ liệu ngoài hoặc gán sai rig
    expect(() =>
      compileClip(CHIBI_RIG, {
        name: 'bad',
        duration: 1,
        frames: [{ t: 0, pose: { khongTonTai: { rx: 1 } } } as never],
      }),
    ).toThrow(/khớp lạ/)
  })

  it('phát hiện dùng clip của rig khác', () => {
    // Clip của thú áp lên rig người sẽ ghi vào khớp sai -> phải chặn ngay
    expect(() =>
      compileClip(CHIBI_RIG, {
        name: 'wrongRig',
        duration: 1,
        frames: [{ t: 0, pose: { legFL: { rx: 1 } } } as never],
      }),
    ).toThrow(/khớp lạ/)
  })

  it('từ chối clip rỗng', () => {
    expect(() => compileClip(CHIBI_RIG, { name: 'empty', duration: 1, frames: [] })).toThrow(/keyframe/)
  })
})

describe('samplePose', () => {
  const clip = compileClip(CHIBI_RIG, {
    name: 'ramp',
    duration: 2,
    frames: [
      { t: 0, pose: { head: { rx: 0 } } },
      { t: 1, pose: { head: { rx: 1 } } },
      { t: 2, pose: { head: { rx: 0 } } },
    ],
  })

  it('nội suy tuyến tính giữa hai keyframe', () => {
    const buf = createPoseBuffer(CHIBI_RIG)
    samplePose(clip, 0.25, buf)
    expect(ch(buf, 'head', 0)).toBeCloseTo(0.25, 5)
    samplePose(clip, 1.5, buf)
    expect(ch(buf, 'head', 0)).toBeCloseTo(0.5, 5)
  })

  it('lặp vòng theo duration', () => {
    const buf = createPoseBuffer(CHIBI_RIG)
    const a = createPoseBuffer(CHIBI_RIG)
    samplePose(clip, 0.4, a)
    // Đúng một chu kỳ sau phải ra cùng giá trị
    samplePose(clip, 2.4, buf)
    expect(ch(buf, 'head', 0)).toBeCloseTo(ch(a, 'head', 0), 5)
    // Thời gian âm cũng phải lặp đúng, không được kẹp về 0
    samplePose(clip, -1.6, buf)
    expect(ch(buf, 'head', 0)).toBeCloseTo(ch(a, 'head', 0), 5)
  })

  it('clip không lặp thì kẹp ở hai đầu', () => {
    const once = compileClip(CHIBI_RIG, {
      name: 'once',
      duration: 1,
      loop: false,
      frames: [
        { t: 0, pose: { head: { rx: 0 } } },
        { t: 1, pose: { head: { rx: 1 } } },
      ],
    })
    const buf = createPoseBuffer(CHIBI_RIG)
    samplePose(once, 5, buf)
    expect(ch(buf, 'head', 0)).toBeCloseTo(1, 5)
    samplePose(once, -5, buf)
    expect(ch(buf, 'head', 0)).toBeCloseTo(0, 5)
  })

  it('clip một keyframe thì luôn trả về thế đó', () => {
    const still = compileClip(CHIBI_RIG, {
      name: 'still',
      duration: 1,
      frames: [{ t: 0, pose: { torso: { ry: 0.3 } } }],
    })
    const buf = createPoseBuffer(CHIBI_RIG)
    samplePose(still, 7.7, buf)
    expect(ch(buf, 'torso', 1)).toBeCloseTo(0.3, 5)
  })
})

describe('blendPose', () => {
  it('k = 0 và k = 1 trả về đúng hai đầu', () => {
    const a = createPoseBuffer(CHIBI_RIG)
    const b = createPoseBuffer(CHIBI_RIG)
    const out = createPoseBuffer(CHIBI_RIG)
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
      const first = createPoseBuffer(CHIBI_RIG)
      const last = createPoseBuffer(CHIBI_RIG)
      samplePose(clip, 0, first)
      // Lấy mẫu sát cuối thay vì đúng duration, vì đúng duration đã wrap về 0
      samplePose(clip, clip.duration - 1e-5, last)
      for (let i = 0; i < POSE_SIZE; i++) {
        expect(Math.abs((first[i] as number) - (last[i] as number))).toBeLessThan(1e-3)
      }
    }
  })

  it('chân trái và chân phải lệch pha nửa chu kỳ khi đi', () => {
    const now = createPoseBuffer(CHIBI_RIG)
    const half = createPoseBuffer(CHIBI_RIG)
    samplePose(WALK, 0, now)
    samplePose(WALK, WALK.duration / 2, half)
    // Nửa chu kỳ sau, chân phải phải ở đúng chỗ chân trái đang đứng
    expect(ch(half, 'hipR', 0)).toBeCloseTo(ch(now, 'hipL', 0), 2)
    expect(ch(half, 'hipL', 0)).toBeCloseTo(ch(now, 'hipR', 0), 2)
  })

  it('tay đánh ngược pha với chân', () => {
    const buf = createPoseBuffer(CHIBI_RIG)
    samplePose(WALK, 0, buf)
    // Chân trái ra trước (rx âm) thì vai trái phải ra sau (rx dương)
    expect(ch(buf, 'hipL', 0)).toBeLessThan(0)
    expect(ch(buf, 'shoulderL', 0)).toBeGreaterThan(0)
  })

  it('chạy thì ngả người ra trước và biên độ lớn hơn đi', () => {
    const walk = createPoseBuffer(CHIBI_RIG)
    const run = createPoseBuffer(CHIBI_RIG)
    samplePose(WALK, 0, walk)
    samplePose(RUN, 0, run)
    // torso rx âm = ngả ra trước
    expect(ch(run, 'torso', 0)).toBeLessThan(-0.1)
    expect(Math.abs(ch(run, 'hipL', 0))).toBeGreaterThan(Math.abs(ch(walk, 'hipL', 0)))
  })
})
