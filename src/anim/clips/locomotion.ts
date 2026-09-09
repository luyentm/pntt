import { compileClip, type Clip } from '../Clip'

/**
 * Quy ước dấu (suy ra từ phép xoay quanh trục X với chi buông theo -Y,
 * và nhân vật hướng mặt về +Z):
 *   rx < 0  -> đưa chi ra TRƯỚC (+Z)
 *   rx > 0  -> đưa chi ra SAU (-Z)
 *   đầu gối gập (gót về sau) -> rx DƯƠNG
 *   khuỷu gập (bàn tay ra trước) -> rx ÂM
 */

/** Đứng yên: hơi thở, đầu nhấp nhẹ. Chu kỳ dài để không thấy lặp. */
export const IDLE: Clip = compileClip({
  name: 'idle',
  duration: 3.4,
  frames: [
    {
      t: 0,
      pose: {
        torso: { rx: 0 },
        head: { rx: 0 },
        hip: { py: 0 },
        shoulderL: { rz: 0 },
        shoulderR: { rz: 0 },
      },
    },
    {
      t: 1.7,
      pose: {
        // Ngực nở ra, vai xoè thêm chút, đầu hơi ngẩng -> đọc ra là hít vào
        torso: { rx: -0.04 },
        head: { rx: 0.025 },
        hip: { py: 0.013 },
        shoulderL: { rz: 0.05, rx: -0.03 },
        shoulderR: { rz: -0.05, rx: -0.03 },
      },
    },
    {
      t: 3.4,
      pose: {
        torso: { rx: 0 },
        head: { rx: 0 },
        hip: { py: 0 },
        shoulderL: { rz: 0 },
        shoulderR: { rz: 0 },
      },
    },
  ],
})

/** Đi bộ. 5 key cho một chu kỳ: tiếp đất L, vượt, tiếp đất R, vượt, quay lại. */
export const WALK: Clip = compileClip({
  name: 'walk',
  duration: 0.92,
  frames: [
    {
      t: 0,
      pose: {
        hipL: { rx: -0.42 },
        kneeL: { rx: 0.08 },
        hipR: { rx: 0.32 },
        kneeR: { rx: 0.45 },
        shoulderL: { rx: 0.3 },
        elbowL: { rx: -0.3 },
        shoulderR: { rx: -0.3 },
        elbowR: { rx: -0.3 },
        hip: { py: 0 },
        torso: { ry: -0.07 },
      },
    },
    {
      t: 0.23,
      pose: {
        hipL: { rx: -0.05 },
        kneeL: { rx: 0.05 },
        // Gập gối cao lúc chân vượt qua -> chân không bị "trượt" trên mặt đất
        hipR: { rx: -0.02 },
        kneeR: { rx: 0.75 },
        shoulderL: { rx: 0.06 },
        elbowL: { rx: -0.24 },
        shoulderR: { rx: -0.06 },
        elbowR: { rx: -0.24 },
        hip: { py: 0.026 },
        torso: { ry: 0 },
      },
    },
    {
      t: 0.46,
      pose: {
        hipL: { rx: 0.32 },
        kneeL: { rx: 0.45 },
        hipR: { rx: -0.42 },
        kneeR: { rx: 0.08 },
        shoulderL: { rx: -0.3 },
        elbowL: { rx: -0.3 },
        shoulderR: { rx: 0.3 },
        elbowR: { rx: -0.3 },
        hip: { py: 0 },
        torso: { ry: 0.07 },
      },
    },
    {
      t: 0.69,
      pose: {
        hipL: { rx: -0.02 },
        kneeL: { rx: 0.75 },
        hipR: { rx: -0.05 },
        kneeR: { rx: 0.05 },
        shoulderL: { rx: -0.06 },
        elbowL: { rx: -0.24 },
        shoulderR: { rx: 0.06 },
        elbowR: { rx: -0.24 },
        hip: { py: 0.026 },
        torso: { ry: 0 },
      },
    },
    {
      t: 0.92,
      pose: {
        hipL: { rx: -0.42 },
        kneeL: { rx: 0.08 },
        hipR: { rx: 0.32 },
        kneeR: { rx: 0.45 },
        shoulderL: { rx: 0.3 },
        elbowL: { rx: -0.3 },
        shoulderR: { rx: -0.3 },
        elbowR: { rx: -0.3 },
        hip: { py: 0 },
        torso: { ry: -0.07 },
      },
    },
  ],
})

/** Chạy: ngả người ra trước, biên độ lớn, khuỷu gập cao, nhấp nhô mạnh. */
export const RUN: Clip = compileClip({
  name: 'run',
  duration: 0.6,
  frames: [
    {
      t: 0,
      pose: {
        hipL: { rx: -0.72 },
        kneeL: { rx: 0.3 },
        hipR: { rx: 0.5 },
        kneeR: { rx: 0.95 },
        shoulderL: { rx: 0.6, rz: 0.05 },
        elbowL: { rx: -0.95 },
        shoulderR: { rx: -0.6, rz: -0.05 },
        elbowR: { rx: -0.95 },
        hip: { py: 0.01 },
        torso: { rx: -0.22, ry: -0.12 },
        head: { rx: 0.14 },
      },
    },
    {
      t: 0.15,
      pose: {
        // Pha bay: cả hai chân rời đất, thân bật lên cao nhất
        hipL: { rx: -0.1 },
        kneeL: { rx: 0.5 },
        hipR: { rx: -0.15 },
        kneeR: { rx: 1.3 },
        shoulderL: { rx: 0.12, rz: 0.05 },
        elbowL: { rx: -0.9 },
        shoulderR: { rx: -0.12, rz: -0.05 },
        elbowR: { rx: -0.9 },
        hip: { py: 0.055 },
        torso: { rx: -0.24, ry: 0 },
        head: { rx: 0.16 },
      },
    },
    {
      t: 0.3,
      pose: {
        hipL: { rx: 0.5 },
        kneeL: { rx: 0.95 },
        hipR: { rx: -0.72 },
        kneeR: { rx: 0.3 },
        shoulderL: { rx: -0.6, rz: 0.05 },
        elbowL: { rx: -0.95 },
        shoulderR: { rx: 0.6, rz: -0.05 },
        elbowR: { rx: -0.95 },
        hip: { py: 0.01 },
        torso: { rx: -0.22, ry: 0.12 },
        head: { rx: 0.14 },
      },
    },
    {
      t: 0.45,
      pose: {
        hipL: { rx: -0.15 },
        kneeL: { rx: 1.3 },
        hipR: { rx: -0.1 },
        kneeR: { rx: 0.5 },
        shoulderL: { rx: -0.12, rz: 0.05 },
        elbowL: { rx: -0.9 },
        shoulderR: { rx: 0.12, rz: -0.05 },
        elbowR: { rx: -0.9 },
        hip: { py: 0.055 },
        torso: { rx: -0.24, ry: 0 },
        head: { rx: 0.16 },
      },
    },
    {
      t: 0.6,
      pose: {
        hipL: { rx: -0.72 },
        kneeL: { rx: 0.3 },
        hipR: { rx: 0.5 },
        kneeR: { rx: 0.95 },
        shoulderL: { rx: 0.6, rz: 0.05 },
        elbowL: { rx: -0.95 },
        shoulderR: { rx: -0.6, rz: -0.05 },
        elbowR: { rx: -0.95 },
        hip: { py: 0.01 },
        torso: { rx: -0.22, ry: -0.12 },
        head: { rx: 0.14 },
      },
    },
  ],
})
