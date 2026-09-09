import { createRig, type JointRest, type RigDef } from '@/anim/Rig'

/**
 * Bộ xương người chibi. Toạ độ tính theo world unit, nhân vật cao ~1.1.
 *
 * Thứ tự khớp CỐ ĐỊNH — animation lưu dữ liệu theo chỉ số của mảng này.
 * Thêm khớp thì phải thêm vào cuối, đừng chèn giữa.
 */
export const CHIBI_JOINTS = [
  'root',
  'hip',
  'torso',
  'head',
  'shoulderL',
  'elbowL',
  'shoulderR',
  'elbowR',
  'hipL',
  'kneeL',
  'hipR',
  'kneeR',
] as const

export type ChibiJoint = (typeof CHIBI_JOINTS)[number]

const CHIBI_REST: Record<ChibiJoint, JointRest> = {
  root: { pos: [0, 0, 0], parent: null },
  hip: { pos: [0, 0.3, 0], parent: 'root' },
  torso: { pos: [0, 0.04, 0], parent: 'hip' },
  head: { pos: [0, 0.3, 0], parent: 'torso' },
  // Tay buông xuống, hơi xoè ra một chút cho dáng tự nhiên
  shoulderL: { pos: [0.135, 0.26, 0], rot: [0, 0, 0.16], parent: 'torso' },
  elbowL: { pos: [0, -0.16, 0], parent: 'shoulderL' },
  shoulderR: { pos: [-0.135, 0.26, 0], rot: [0, 0, -0.16], parent: 'torso' },
  elbowR: { pos: [0, -0.16, 0], parent: 'shoulderR' },
  hipL: { pos: [0.072, 0, 0], parent: 'hip' },
  kneeL: { pos: [0, -0.16, 0], parent: 'hipL' },
  hipR: { pos: [-0.072, 0, 0], parent: 'hip' },
  kneeR: { pos: [0, -0.16, 0], parent: 'hipR' },
}

export const CHIBI_RIG: RigDef<ChibiJoint> = createRig('chibi', CHIBI_JOINTS, CHIBI_REST)
