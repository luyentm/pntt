import { CHIBI_RIG, type ChibiJoint } from '@/art/ChibiRig'
import { compileClip, type Clip } from '../Clip'

/**
 * Các khớp mà đòn đánh ghi đè. Chân KHÔNG nằm trong danh sách, nên clip di
 * chuyển vẫn điều khiển chân trong lúc thân trên vung kiếm — đánh được trong
 * lúc đang chạy, và đó là thứ làm combat trôi chảy thay vì giật cục.
 */
export const UPPER_BODY: readonly ChibiJoint[] = [
  'torso',
  'head',
  'shoulderL',
  'elbowL',
  'shoulderR',
  'elbowR',
]

/**
 * Quy ước dấu cho tay (suy từ phép xoay quanh Z với chi buông theo -Y):
 *   rz > 0 -> đưa tay ra phía +X, tức phía BÊN TRÁI của nhân vật
 *   rz < 0 -> đưa tay ra phía -X, tức phía BÊN PHẢI
 * (shoulderL nằm ở +X nên đó là tay trái.)
 */

/** Đòn 1: chém ngang từ phải sang trái. */
export const ATTACK_1: Clip<ChibiJoint> = compileClip(CHIBI_RIG, {
  name: 'attack1',
  duration: 0.34,
  loop: false,
  frames: [
    {
      t: 0,
      pose: {
        // Lấy đà: xoay thân sang phải, tay phải giương lên chếch ra ngoài
        torso: { ry: -0.44 },
        head: { ry: -0.2 },
        shoulderR: { rx: 0.5, rz: -0.72 },
        elbowR: { rx: -1.15 },
        shoulderL: { rx: -0.25 },
        elbowL: { rx: -0.5 },
      },
    },
    {
      t: 0.11,
      pose: {
        // Điểm trúng: thân bật sang trái kéo theo tay quét qua
        torso: { ry: 0.46 },
        head: { ry: 0.22 },
        shoulderR: { rx: -0.85, rz: 0.55 },
        elbowR: { rx: -0.25 },
        shoulderL: { rx: 0.3 },
        elbowL: { rx: -0.35 },
      },
    },
    {
      t: 0.34,
      pose: {
        torso: { ry: 0.05 },
        head: { ry: 0 },
        shoulderR: { rx: -0.1, rz: 0 },
        elbowR: { rx: -0.45 },
        shoulderL: { rx: 0 },
        elbowL: { rx: -0.3 },
      },
    },
  ],
})

/** Đòn 2: quét ngược lại từ trái sang phải. */
export const ATTACK_2: Clip<ChibiJoint> = compileClip(CHIBI_RIG, {
  name: 'attack2',
  duration: 0.32,
  loop: false,
  frames: [
    {
      t: 0,
      pose: {
        torso: { ry: 0.42 },
        head: { ry: 0.18 },
        shoulderR: { rx: -0.7, rz: 0.6 },
        elbowR: { rx: -0.9 },
        shoulderL: { rx: 0.25 },
        elbowL: { rx: -0.4 },
      },
    },
    {
      t: 0.1,
      pose: {
        torso: { ry: -0.5 },
        head: { ry: -0.24 },
        shoulderR: { rx: -0.5, rz: -0.72 },
        elbowR: { rx: -0.2 },
        shoulderL: { rx: -0.3 },
        elbowL: { rx: -0.45 },
      },
    },
    {
      t: 0.32,
      pose: {
        torso: { ry: -0.05 },
        head: { ry: 0 },
        shoulderR: { rx: -0.1, rz: 0 },
        elbowR: { rx: -0.45 },
        shoulderL: { rx: 0 },
        elbowL: { rx: -0.3 },
      },
    },
  ],
})

/** Đòn 3: chém xuống bằng cả người — đòn kết combo, mạnh và chậm nhất. */
export const ATTACK_3: Clip<ChibiJoint> = compileClip(CHIBI_RIG, {
  name: 'attack3',
  duration: 0.46,
  loop: false,
  frames: [
    {
      t: 0,
      pose: {
        // Ngửa ra sau lấy đà, kiếm giương quá đầu
        torso: { rx: -0.38 },
        head: { rx: -0.18 },
        shoulderR: { rx: 1.5, rz: -0.18 },
        elbowR: { rx: -1.5 },
        shoulderL: { rx: 1.2, rz: 0.18 },
        elbowL: { rx: -1.3 },
      },
    },
    {
      t: 0.14,
      pose: {
        // Gập người xuống theo nhát chém
        torso: { rx: 0.44 },
        head: { rx: 0.22 },
        shoulderR: { rx: -1.5, rz: -0.08 },
        elbowR: { rx: -0.1 },
        shoulderL: { rx: -1.3, rz: 0.08 },
        elbowL: { rx: -0.15 },
      },
    },
    {
      t: 0.46,
      pose: {
        torso: { rx: 0 },
        head: { rx: 0 },
        shoulderR: { rx: -0.1, rz: 0 },
        elbowR: { rx: -0.45 },
        shoulderL: { rx: -0.05, rz: 0 },
        elbowL: { rx: -0.35 },
      },
    },
  ],
})

export const ATTACK_COMBO: readonly Clip<ChibiJoint>[] = [ATTACK_1, ATTACK_2, ATTACK_3]

/** Trúng đòn: giật lùi. Là clip TOÀN THÂN vì trúng đòn thì phải mất nhịp chân. */
export const HURT: Clip<ChibiJoint> = compileClip(CHIBI_RIG, {
  name: 'hurt',
  duration: 0.3,
  loop: false,
  frames: [
    {
      t: 0,
      pose: {
        torso: { rx: 0.42 },
        head: { rx: -0.36 },
        hip: { pz: -0.07 },
        shoulderL: { rx: -0.42, rz: 0.32 },
        shoulderR: { rx: -0.42, rz: -0.32 },
        elbowL: { rx: -0.7 },
        elbowR: { rx: -0.7 },
        kneeL: { rx: 0.3 },
        kneeR: { rx: 0.25 },
      },
    },
    {
      t: 0.13,
      pose: {
        torso: { rx: 0.16 },
        head: { rx: -0.12 },
        hip: { pz: -0.02 },
        shoulderL: { rx: -0.18, rz: 0.14 },
        shoulderR: { rx: -0.18, rz: -0.14 },
        elbowL: { rx: -0.5 },
        elbowR: { rx: -0.5 },
        kneeL: { rx: 0.12 },
        kneeR: { rx: 0.1 },
      },
    },
    { t: 0.3, pose: {} },
  ],
})

/**
 * Chết: đổ người ra trước.
 * Xoay `root` để cả thân lật quanh bàn chân — đó là cách duy nhất để nhân vật
 * thật sự NẰM xuống chứ chỉ gập người mà vẫn đứng.
 */
export const DIE: Clip<ChibiJoint> = compileClip(CHIBI_RIG, {
  name: 'die',
  duration: 0.95,
  loop: false,
  frames: [
    { t: 0, pose: {} },
    {
      t: 0.24,
      pose: {
        root: { rx: 0.34 },
        hip: { py: -0.13 },
        torso: { rx: 0.3 },
        head: { rx: -0.26 },
        kneeL: { rx: 1 },
        kneeR: { rx: 0.88 },
        shoulderL: { rx: -0.35, rz: 0.2 },
        shoulderR: { rx: -0.35, rz: -0.2 },
      },
    },
    {
      t: 0.58,
      pose: {
        root: { rx: 1.24, py: -0.14 },
        hip: { py: -0.2 },
        torso: { rx: 0.48 },
        head: { rx: -0.42 },
        kneeL: { rx: 1.5 },
        kneeR: { rx: 1.38 },
        shoulderL: { rx: -0.62, rz: 0.34 },
        shoulderR: { rx: -0.62, rz: -0.34 },
        elbowL: { rx: -0.5 },
        elbowR: { rx: -0.5 },
      },
    },
    {
      t: 0.95,
      pose: {
        root: { rx: 1.42, py: -0.19 },
        hip: { py: -0.2 },
        torso: { rx: 0.42 },
        head: { rx: -0.34 },
        kneeL: { rx: 1.44 },
        kneeR: { rx: 1.32 },
        shoulderL: { rx: -0.55, rz: 0.4 },
        shoulderR: { rx: -0.55, rz: -0.4 },
        elbowL: { rx: -0.4 },
        elbowR: { rx: -0.4 },
      },
    },
  ],
})
