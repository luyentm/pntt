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
  // Hai khớp bàn tay thêm SAU CÙNG, đúng luật của rig: clip lưu dữ liệu theo
  // chỉ số mảng này, nên chèn vào giữa là lệch toàn bộ animation đã có mà
  // không có gì báo. Thêm ở cuối thì mọi clip cũ vẫn đọc đúng khớp của chúng,
  // và hai khớp mới chỉ nhận thế nghỉ (tức là đứng yên) cho tới khi có clip
  // nào nói khác.
  //
  // Có để GẮN PHÁP BẢO. Trước đây bàn tay chỉ là một khối cầu hàn cứng vào
  // khuỷu, nên không có node nào để treo cây quạt hay lá phù vào — Hàn Lập thi
  // triển Tam Diễm Phiến mà cây quạt không nằm trong tay ai cả.
  'handL',
  'handR',
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
  // Đúng chỗ khối cầu bàn tay vẫn nằm từ trước, để dáng người không đổi một ly
  handL: { pos: [0, -0.163, 0], parent: 'elbowL' },
  handR: { pos: [0, -0.163, 0], parent: 'elbowR' },
}

export const CHIBI_RIG: RigDef<ChibiJoint> = createRig('chibi', CHIBI_JOINTS, CHIBI_REST)
