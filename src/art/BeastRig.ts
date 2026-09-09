import { createRig, type JointRest, type RigDef } from '@/anim/Rig'

/**
 * Bộ xương thú bốn chân — dùng cho Hắc Lang, Yêu Thử, Độc Thù.
 *
 * Toạ độ chuẩn hoá cho một con thú dài ~1.0, cao vai ~0.42. Chiều dài chạy theo
 * trục Z (mũi ở +Z) để khớp quy ước "sinh vật hướng +Z" của cả game — nhờ vậy
 * mã xoay hướng và ngắm chiêu dùng chung được cho cả người và thú.
 *
 * Chỉ có khớp cổ chân trước, không có khớp khuỷu/gối riêng: ở kích thước chibi
 * thì đốt chân dưới gần như không đọc được, mà mỗi khớp thêm vào là thêm 6 kênh
 * cho MỌI clip.
 */
export const BEAST_JOINTS = [
  'root',
  'spine',
  'neck',
  'head',
  'tail',
  'legFL',
  'pawFL',
  'legFR',
  'pawFR',
  'legBL',
  'pawBL',
  'legBR',
  'pawBR',
] as const

export type BeastJoint = (typeof BEAST_JOINTS)[number]

const HIP_Y = 0.42
const SHOULDER_Z = 0.26
const HIP_Z = -0.26
const LEG_SPREAD = 0.13

const BEAST_REST: Record<BeastJoint, JointRest> = {
  root: { pos: [0, 0, 0], parent: null },
  spine: { pos: [0, HIP_Y, 0], parent: 'root' },
  // Cổ chếch lên và ra trước
  neck: { pos: [0, 0.06, SHOULDER_Z], rot: [-0.28, 0, 0], parent: 'spine' },
  head: { pos: [0, 0.11, 0.04], rot: [0.28, 0, 0], parent: 'neck' },
  tail: { pos: [0, 0.03, HIP_Z - 0.06], rot: [0.55, 0, 0], parent: 'spine' },

  legFL: { pos: [LEG_SPREAD, -0.03, SHOULDER_Z], parent: 'spine' },
  pawFL: { pos: [0, -0.2, 0], parent: 'legFL' },
  legFR: { pos: [-LEG_SPREAD, -0.03, SHOULDER_Z], parent: 'spine' },
  pawFR: { pos: [0, -0.2, 0], parent: 'legFR' },
  legBL: { pos: [LEG_SPREAD, -0.03, HIP_Z], parent: 'spine' },
  pawBL: { pos: [0, -0.2, 0], parent: 'legBL' },
  legBR: { pos: [-LEG_SPREAD, -0.03, HIP_Z], parent: 'spine' },
  pawBR: { pos: [0, -0.2, 0], parent: 'legBR' },
}

export const BEAST_RIG: RigDef<BeastJoint> = createRig('beast', BEAST_JOINTS, BEAST_REST)
