import { BEAST_RIG, type BeastJoint } from '@/art/BeastRig'
import { compileClip, type Clip } from '../Clip'

/**
 * Quy ước dấu giống rig người: chi buông theo -Y, `rx` âm đưa chi ra TRƯỚC (+Z).
 * Thú cũng hướng mặt về +Z nên mã xoay hướng dùng chung được cho cả hai.
 */

/** Đứng yên: thở nhẹ, đuôi lắc, đầu ngó quanh. */
export const BEAST_IDLE: Clip<BeastJoint> = compileClip(BEAST_RIG, {
  name: 'beastIdle',
  duration: 3.1,
  frames: [
    { t: 0, pose: { spine: { py: 0 }, tail: { rz: 0 }, head: { ry: 0 } } },
    {
      t: 1.05,
      pose: { spine: { py: 0.012 }, tail: { rz: 0.24, rx: -0.1 }, head: { ry: 0.2, rx: 0.05 } },
    },
    { t: 2.1, pose: { spine: { py: 0.004 }, tail: { rz: -0.22, rx: 0.06 }, head: { ry: -0.16 } } },
    { t: 3.1, pose: { spine: { py: 0 }, tail: { rz: 0 }, head: { ry: 0 } } },
  ],
})

/**
 * Đi bộ — nước đi CHÉO (trot): chân trước-trái đi cùng chân sau-phải.
 * Đây là nước đi thật của loài chó/sói; nếu cho bốn chân cùng nhịp thì con thú
 * trông như đồ chơi lên dây.
 */
export const BEAST_WALK: Clip<BeastJoint> = compileClip(BEAST_RIG, {
  name: 'beastWalk',
  duration: 0.68,
  frames: [
    {
      t: 0,
      pose: {
        legFL: { rx: -0.42 },
        pawFL: { rx: 0.12 },
        legBR: { rx: -0.36 },
        pawBR: { rx: 0.2 },
        legFR: { rx: 0.34 },
        pawFR: { rx: 0.42 },
        legBL: { rx: 0.3 },
        pawBL: { rx: 0.5 },
        spine: { ry: -0.05, py: 0 },
        tail: { rz: 0.12 },
      },
    },
    {
      t: 0.17,
      pose: {
        legFL: { rx: -0.04 },
        pawFL: { rx: 0.08 },
        legBR: { rx: -0.02 },
        pawBR: { rx: 0.1 },
        legFR: { rx: -0.06 },
        pawFR: { rx: 0.62 },
        legBL: { rx: -0.04 },
        pawBL: { rx: 0.7 },
        spine: { ry: 0, py: 0.018 },
        tail: { rz: 0 },
      },
    },
    {
      t: 0.34,
      pose: {
        legFL: { rx: 0.34 },
        pawFL: { rx: 0.42 },
        legBR: { rx: 0.3 },
        pawBR: { rx: 0.5 },
        legFR: { rx: -0.42 },
        pawFR: { rx: 0.12 },
        legBL: { rx: -0.36 },
        pawBL: { rx: 0.2 },
        spine: { ry: 0.05, py: 0 },
        tail: { rz: -0.12 },
      },
    },
    {
      t: 0.51,
      pose: {
        legFL: { rx: -0.06 },
        pawFL: { rx: 0.62 },
        legBR: { rx: -0.04 },
        pawBR: { rx: 0.7 },
        legFR: { rx: -0.04 },
        pawFR: { rx: 0.08 },
        legBL: { rx: -0.02 },
        pawBL: { rx: 0.1 },
        spine: { ry: 0, py: 0.018 },
        tail: { rz: 0 },
      },
    },
    {
      t: 0.68,
      pose: {
        legFL: { rx: -0.42 },
        pawFL: { rx: 0.12 },
        legBR: { rx: -0.36 },
        pawBR: { rx: 0.2 },
        legFR: { rx: 0.34 },
        pawFR: { rx: 0.42 },
        legBL: { rx: 0.3 },
        pawBL: { rx: 0.5 },
        spine: { ry: -0.05, py: 0 },
        tail: { rz: 0.12 },
      },
    },
  ],
})

/**
 * Chạy — nước PHI (gallop/bound): hai chân trước cùng vươn, hai chân sau cùng đạp,
 * thân gập và giãn theo. Khác hẳn trot, nên chuyển từ đi sang chạy đọc ra ngay.
 */
export const BEAST_RUN: Clip<BeastJoint> = compileClip(BEAST_RIG, {
  name: 'beastRun',
  duration: 0.42,
  frames: [
    {
      t: 0,
      pose: {
        // Vươn dài: chân trước ra trước, chân sau đạp về sau, thân giãn
        legFL: { rx: -0.82 },
        legFR: { rx: -0.74 },
        pawFL: { rx: 0.1 },
        pawFR: { rx: 0.14 },
        legBL: { rx: 0.72 },
        legBR: { rx: 0.66 },
        pawBL: { rx: 0.28 },
        pawBR: { rx: 0.32 },
        spine: { rx: -0.16, py: 0.03 },
        neck: { rx: -0.1 },
        tail: { rx: -0.3 },
      },
    },
    {
      t: 0.12,
      pose: {
        legFL: { rx: 0.28 },
        legFR: { rx: 0.34 },
        pawFL: { rx: 0.5 },
        pawFR: { rx: 0.46 },
        legBL: { rx: 0.1 },
        legBR: { rx: 0.06 },
        pawBL: { rx: 0.6 },
        pawBR: { rx: 0.64 },
        spine: { rx: 0.08, py: 0.05 },
        neck: { rx: 0.04 },
        tail: { rx: -0.18 },
      },
    },
    {
      t: 0.24,
      pose: {
        // Gập người: chân sau thu về dưới bụng chuẩn bị đạp
        legFL: { rx: 0.62 },
        legFR: { rx: 0.58 },
        pawFL: { rx: 0.3 },
        pawFR: { rx: 0.34 },
        legBL: { rx: -0.76 },
        legBR: { rx: -0.7 },
        pawBL: { rx: 0.9 },
        pawBR: { rx: 0.94 },
        spine: { rx: 0.24, py: 0.008 },
        neck: { rx: 0.1 },
        tail: { rx: -0.42 },
      },
    },
    {
      t: 0.33,
      pose: {
        legFL: { rx: -0.2 },
        legFR: { rx: -0.14 },
        pawFL: { rx: 0.2 },
        pawFR: { rx: 0.24 },
        legBL: { rx: -0.1 },
        legBR: { rx: -0.06 },
        pawBL: { rx: 0.5 },
        pawBR: { rx: 0.54 },
        spine: { rx: -0.04, py: 0.055 },
        neck: { rx: -0.04 },
        tail: { rx: -0.3 },
      },
    },
    {
      t: 0.42,
      pose: {
        legFL: { rx: -0.82 },
        legFR: { rx: -0.74 },
        pawFL: { rx: 0.1 },
        pawFR: { rx: 0.14 },
        legBL: { rx: 0.72 },
        legBR: { rx: 0.66 },
        pawBL: { rx: 0.28 },
        pawBR: { rx: 0.32 },
        spine: { rx: -0.16, py: 0.03 },
        neck: { rx: -0.1 },
        tail: { rx: -0.3 },
      },
    },
  ],
})

/** Vồ: rướn lên rồi lao đầu về trước ngoạm. */
export const BEAST_ATTACK: Clip<BeastJoint> = compileClip(BEAST_RIG, {
  name: 'beastAttack',
  duration: 0.52,
  loop: false,
  frames: [
    {
      t: 0,
      pose: {
        // Thu người lấy đà, đầu ngửa lên
        spine: { rx: 0.26, py: -0.05 },
        neck: { rx: 0.34 },
        head: { rx: -0.24 },
        legFL: { rx: 0.4 },
        legFR: { rx: 0.4 },
        legBL: { rx: -0.5 },
        legBR: { rx: -0.5 },
        pawBL: { rx: 0.8 },
        pawBR: { rx: 0.8 },
        tail: { rx: -0.4 },
      },
    },
    {
      t: 0.16,
      pose: {
        // Bật lên và lao đầu về trước
        spine: { rx: -0.34, py: 0.1, pz: 0.06 },
        neck: { rx: -0.44 },
        head: { rx: 0.36 },
        legFL: { rx: -0.9 },
        legFR: { rx: -0.86 },
        legBL: { rx: 0.6 },
        legBR: { rx: 0.6 },
        pawBL: { rx: 0.1 },
        pawBR: { rx: 0.1 },
        tail: { rx: 0.2 },
      },
    },
    {
      t: 0.52,
      pose: {
        spine: { rx: 0, py: 0, pz: 0 },
        neck: { rx: 0 },
        head: { rx: 0 },
        legFL: { rx: 0 },
        legFR: { rx: 0 },
        legBL: { rx: 0 },
        legBR: { rx: 0 },
        pawBL: { rx: 0 },
        pawBR: { rx: 0 },
        tail: { rx: 0 },
      },
    },
  ],
})

/** Trúng đòn: rúm người lại. */
export const BEAST_HURT: Clip<BeastJoint> = compileClip(BEAST_RIG, {
  name: 'beastHurt',
  duration: 0.28,
  loop: false,
  frames: [
    {
      t: 0,
      pose: {
        spine: { rx: 0.3, py: -0.06, pz: -0.05 },
        neck: { rx: 0.4 },
        head: { rx: -0.2 },
        tail: { rx: -0.6 },
        legFL: { rx: 0.3 },
        legFR: { rx: 0.3 },
        pawFL: { rx: 0.5 },
        pawFR: { rx: 0.5 },
      },
    },
    {
      t: 0.12,
      pose: {
        spine: { rx: 0.12, py: -0.02, pz: -0.02 },
        neck: { rx: 0.16 },
        head: { rx: -0.08 },
        tail: { rx: -0.3 },
        legFL: { rx: 0.12 },
        legFR: { rx: 0.12 },
        pawFL: { rx: 0.2 },
        pawFR: { rx: 0.2 },
      },
    },
    { t: 0.28, pose: {} },
  ],
})

/** Chết: khuỵu xuống rồi đổ nghiêng. */
export const BEAST_DIE: Clip<BeastJoint> = compileClip(BEAST_RIG, {
  name: 'beastDie',
  duration: 0.8,
  loop: false,
  frames: [
    { t: 0, pose: {} },
    {
      t: 0.22,
      pose: {
        spine: { py: -0.16, rx: 0.2 },
        neck: { rx: 0.3 },
        head: { rx: -0.2 },
        legFL: { rx: 0.7 },
        legFR: { rx: 0.7 },
        legBL: { rx: -0.6 },
        legBR: { rx: -0.6 },
        pawFL: { rx: 1.1 },
        pawFR: { rx: 1.1 },
        pawBL: { rx: 1.1 },
        pawBR: { rx: 1.1 },
      },
    },
    {
      t: 0.8,
      pose: {
        // Xoay root để cả con thú lật hẳn sang bên, chứ không chỉ khuỵu chân
        root: { rz: 1.4, py: -0.12 },
        spine: { py: -0.2, rx: 0.1 },
        neck: { rx: 0.2 },
        head: { rx: -0.3, ry: 0.3 },
        legFL: { rx: 0.5 },
        legFR: { rx: 0.9 },
        legBL: { rx: -0.4 },
        legBR: { rx: -0.8 },
        pawFL: { rx: 0.8 },
        pawFR: { rx: 1.2 },
        pawBL: { rx: 0.8 },
        pawBR: { rx: 1.2 },
        tail: { rx: -0.3, rz: 0.4 },
      },
    },
  ],
})
