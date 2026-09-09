import {
  Bone,
  Float32BufferAttribute,
  Matrix4,
  Skeleton,
  SkinnedMesh,
  Uint16BufferAttribute,
  type BufferGeometry,
  type Material,
} from 'three'
import { mergeAll, paint } from './geo'

/**
 * Danh sách khớp. Thứ tự CỐ ĐỊNH — animation lưu dữ liệu theo chỉ số của mảng này.
 * Thêm khớp thì phải thêm vào cuối, đừng chèn giữa.
 */
export const JOINTS = [
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

export type JointName = (typeof JOINTS)[number]

export const JOINT_INDEX: Record<JointName, number> = Object.fromEntries(
  JOINTS.map((name, i) => [name, i]),
) as Record<JointName, number>

/** Số kênh mỗi khớp: rx ry rz px py pz. */
export const CHANNELS = 6

export interface JointRest {
  /** Vị trí cục bộ so với khớp cha. */
  pos: [number, number, number]
  /** Xoay cục bộ lúc nghỉ (radian). Animation là ĐỘ LỆCH so với giá trị này. */
  rot?: [number, number, number]
  parent: JointName | null
}

/** Bộ xương chibi. Toạ độ tính theo world unit, nhân vật cao ~1.1. */
export const CHIBI_REST: Record<JointName, JointRest> = {
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

export interface ChibiSkeleton {
  bones: Record<JointName, Bone>
  order: Bone[]
  rootBone: Bone
}

export function createChibiBones(): ChibiSkeleton {
  const bones = {} as Record<JointName, Bone>
  for (const name of JOINTS) {
    const rest = CHIBI_REST[name]
    const bone = new Bone()
    bone.name = name
    bone.position.set(...rest.pos)
    if (rest.rot) bone.rotation.set(...rest.rot)
    bones[name] = bone
  }
  for (const name of JOINTS) {
    const parent = CHIBI_REST[name].parent
    if (parent) bones[parent].add(bones[name])
  }
  const rootBone = bones.root
  // Ma trận world lúc nghỉ là cơ sở để Skeleton tính bind inverse
  rootBone.updateMatrixWorld(true)
  return { bones, order: JOINTS.map((n) => bones[n]), rootBone }
}

/**
 * Dựng nhân vật thành MỘT SkinnedMesh duy nhất.
 *
 * Mỗi khối được gắn CỨNG vào đúng một xương (skinWeight = 1) — gọi là rigid
 * skinning. Không cần tính trọng số mềm, mà vẫn được cái lợi quyết định: cả nhân
 * vật chỉ tốn MỘT draw call, thay vì một draw call cho mỗi bộ phận nếu dùng cây
 * Group. Với yêu cầu "đại chiến" hàng chục quái cùng lúc thì đây là khác biệt
 * giữa 80 và 800 draw call.
 *
 * Cách animate không đổi: vẫn là xoay khớp bằng số, không có file 3D nào.
 */
export class ChibiBuilder {
  private readonly parts: BufferGeometry[] = []
  private readonly skeleton: ChibiSkeleton
  private readonly tmp = new Matrix4()

  constructor(skeleton?: ChibiSkeleton) {
    this.skeleton = skeleton ?? createChibiBones()
  }

  get bones(): Record<JointName, Bone> {
    return this.skeleton.bones
  }

  /**
   * Gắn một khối vào khớp. `geometry` được tạo trong hệ toạ độ CỤC BỘ của khớp
   * (gốc là tâm khớp), builder sẽ tự đưa về không gian world lúc nghỉ.
   * Builder sở hữu geometry từ lúc này — không dùng lại nó ở ngoài.
   */
  add(joint: JointName, geometry: BufferGeometry, color: number): this {
    const bone = this.skeleton.bones[joint]
    this.tmp.copy(bone.matrixWorld)
    geometry.applyMatrix4(this.tmp)

    // paint() có thể trả về geometry MỚI (khi phải chuyển sang non-indexed),
    // nên phải dùng giá trị trả về chứ không dùng lại biến cũ
    const painted = paint(geometry, color)

    const count = painted.getAttribute('position').count
    const index = JOINT_INDEX[joint]
    const skinIndex = new Uint16Array(count * 4)
    const skinWeight = new Float32Array(count * 4)
    for (let i = 0; i < count; i++) {
      skinIndex[i * 4] = index
      skinWeight[i * 4] = 1
    }
    painted.setAttribute('skinIndex', new Uint16BufferAttribute(skinIndex, 4))
    painted.setAttribute('skinWeight', new Float32BufferAttribute(skinWeight, 4))

    this.parts.push(painted)
    return this
  }

  finish(material: Material, name: string): { mesh: SkinnedMesh; skeleton: ChibiSkeleton } {
    const geometry = mergeAll(this.parts)
    this.parts.length = 0

    const mesh = new SkinnedMesh(geometry, material)
    mesh.name = name
    mesh.castShadow = true
    mesh.receiveShadow = false // chibi tự đổ bóng lên mình trông bẩn, không đáng
    // Xương phải là con của mesh để ma trận world của chúng nằm cùng hệ với mesh
    mesh.add(this.skeleton.rootBone)
    // Skeleton tự tính bind inverse từ matrixWorld hiện tại của xương (thế nghỉ)
    mesh.bind(new Skeleton(this.skeleton.order))

    return { mesh, skeleton: this.skeleton }
  }
}
