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

/**
 * Niệm chú / dẫn khí: hai tay chắp trước ngực rồi đẩy ra.
 * Là clip TOÀN THÂN vì thi triển pháp thuật phải thấy rõ là đang làm việc khác
 * hẳn với chém — nếu chỉ phủ thân trên thì chân vẫn chạy và mất hết sức nặng.
 */
export const CAST: Clip<ChibiJoint> = compileClip(CHIBI_RIG, {
  name: 'cast',
  duration: 0.52,
  loop: false,
  frames: [
    {
      t: 0,
      pose: {
        torso: { rx: -0.12 },
        head: { rx: -0.06 },
        // Chắp tay trước ngực
        shoulderL: { rx: -0.95, rz: -0.55 },
        elbowL: { rx: -1.15 },
        shoulderR: { rx: -0.95, rz: 0.55 },
        elbowR: { rx: -1.15 },
        kneeL: { rx: 0.18 },
        kneeR: { rx: 0.18 },
        hip: { py: -0.03 },
      },
    },
    {
      t: 0.2,
      pose: {
        // Đẩy hai tay ra trước, người hơi ngả về sau vì phản lực
        torso: { rx: -0.26 },
        head: { rx: -0.1 },
        shoulderL: { rx: -1.45, rz: -0.16 },
        elbowL: { rx: -0.14 },
        shoulderR: { rx: -1.45, rz: 0.16 },
        elbowR: { rx: -0.14 },
        kneeL: { rx: 0.24 },
        kneeR: { rx: 0.24 },
        hip: { py: -0.045, pz: -0.04 },
      },
    },
    {
      t: 0.52,
      pose: {
        torso: { rx: 0 },
        head: { rx: 0 },
        shoulderL: { rx: -0.1, rz: 0 },
        elbowL: { rx: -0.3 },
        shoulderR: { rx: -0.1, rz: 0 },
        elbowR: { rx: -0.3 },
        kneeL: { rx: 0 },
        kneeR: { rx: 0 },
        hip: { py: 0, pz: 0 },
      },
    },
  ],
})

/**
 * Toạ thiền: ngồi khoanh chân, tay đặt trên đầu gối, người hơi thở.
 *
 * Xoay `root` để hạ cả người xuống và gập chân ra trước — đó là cách duy nhất
 * để thành thế NGỒI thật, chứ chỉ gập đầu gối thì nhân vật vẫn đứng.
 */
export const MEDITATE: Clip<ChibiJoint> = compileClip(CHIBI_RIG, {
  name: 'meditate',
  duration: 4.6,
  frames: [
    {
      t: 0,
      pose: {
        root: { py: -0.2 },
        hip: { py: -0.04 },
        // Chân khoanh: đùi mở ngang ra trước, cẳng chân gập vào trong
        hipL: { rx: -1.5, rz: 0.62 },
        kneeL: { rx: 1.45 },
        hipR: { rx: -1.5, rz: -0.62 },
        kneeR: { rx: 1.45 },
        // Tay KHÉP vào thân rồi gập khuỷu để hai bàn tay chụm trước bụng.
        // Dáng xoè tay ra hai bên đọc ra là "đang đứng chờ" chứ không phải
        // nhập định — mà từ góc iso thì chỉ có bóng ngoài của dáng là đọc được,
        // nên khép tay lại quan trọng hơn mọi chi tiết khác của clip này.
        shoulderL: { rx: -0.28, rz: -0.1 },
        elbowL: { rx: -1.3 },
        shoulderR: { rx: -0.28, rz: 0.1 },
        elbowR: { rx: -1.3 },
        torso: { rx: 0.1 },
        head: { rx: 0.16 },
      },
    },
    {
      t: 2.3,
      pose: {
        root: { py: -0.185 },
        hip: { py: -0.028 },
        hipL: { rx: -1.5, rz: 0.62 },
        kneeL: { rx: 1.45 },
        hipR: { rx: -1.5, rz: -0.62 },
        kneeR: { rx: 1.45 },
        shoulderL: { rx: -0.33, rz: -0.08 },
        elbowL: { rx: -1.26 },
        shoulderR: { rx: -0.33, rz: 0.08 },
        elbowR: { rx: -1.26 },
        // Hơi thở: ngực nở, đầu ngẩng rất nhẹ
        torso: { rx: 0.02 },
        head: { rx: 0.1 },
      },
    },
    {
      t: 4.6,
      pose: {
        root: { py: -0.2 },
        hip: { py: -0.04 },
        hipL: { rx: -1.5, rz: 0.62 },
        kneeL: { rx: 1.45 },
        hipR: { rx: -1.5, rz: -0.62 },
        kneeR: { rx: 1.45 },
        shoulderL: { rx: -0.28, rz: -0.1 },
        elbowL: { rx: -1.3 },
        shoulderR: { rx: -0.28, rz: 0.1 },
        elbowR: { rx: -1.3 },
        torso: { rx: 0.1 },
        head: { rx: 0.16 },
      },
    },
  ],
})

/**
 * Ngự Kiếm Phi Hành: đứng trên phi kiếm.
 *
 * Chân KHÔNG khoanh mà hơi khuỵu và mở nhẹ, thân nghiêng về trước, hai tay đưa
 * ra sau lấy thăng bằng — dáng của người đang CƯỠI, không phải đang bay lơ lửng.
 * Đó là khác biệt duy nhất để người chơi nhìn ra "mình đang đứng trên thanh kiếm"
 * chứ không phải "mình đang bị bốc lên".
 */
export const FLY: Clip<ChibiJoint> = compileClip(CHIBI_RIG, {
  name: 'fly',
  duration: 2.4,
  frames: [
    {
      t: 0,
      pose: {
        // Nghiêng cả người về trước theo hướng bay
        root: { rx: -0.16 },
        torso: { rx: -0.1 },
        head: { rx: 0.14 },
        // Tay ngả ra sau, hơi xoè: cánh gió
        shoulderL: { rx: 0.72, rz: 0.3 },
        elbowL: { rx: 0.2 },
        shoulderR: { rx: 0.72, rz: -0.3 },
        elbowR: { rx: 0.2 },
        // Chân trước sau như tấn, đầu gối khuỵu
        hipL: { rx: -0.42, rz: 0.16 },
        kneeL: { rx: 0.58 },
        hipR: { rx: 0.24, rz: -0.14 },
        kneeR: { rx: 0.34 },
      },
    },
    {
      t: 1.2,
      pose: {
        // Nhấp nhô nhẹ: phi kiếm không bay phẳng như tàu
        root: { rx: -0.13, py: 0.045 },
        torso: { rx: -0.07 },
        head: { rx: 0.11 },
        shoulderL: { rx: 0.66, rz: 0.36 },
        elbowL: { rx: 0.16 },
        shoulderR: { rx: 0.66, rz: -0.36 },
        elbowR: { rx: 0.16 },
        hipL: { rx: -0.38, rz: 0.16 },
        kneeL: { rx: 0.52 },
        hipR: { rx: 0.2, rz: -0.14 },
        kneeR: { rx: 0.3 },
      },
    },
    {
      t: 2.4,
      pose: {
        root: { rx: -0.16 },
        torso: { rx: -0.1 },
        head: { rx: 0.14 },
        shoulderL: { rx: 0.72, rz: 0.3 },
        elbowL: { rx: 0.2 },
        shoulderR: { rx: 0.72, rz: -0.3 },
        elbowR: { rx: 0.2 },
        hipL: { rx: -0.42, rz: 0.16 },
        kneeL: { rx: 0.58 },
        hipR: { rx: 0.24, rz: -0.14 },
        kneeR: { rx: 0.34 },
      },
    },
  ],
})
