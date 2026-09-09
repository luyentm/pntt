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
import { mergeAll, paint } from '@/art/geo'

/** Số kênh mỗi khớp: rx ry rz px py pz. */
export const CHANNELS = 6

export interface JointRest {
  /** Vị trí cục bộ so với khớp cha. */
  pos: [number, number, number]
  /** Xoay cục bộ lúc nghỉ (radian). Animation là ĐỘ LỆCH so với giá trị này. */
  rot?: [number, number, number]
  parent: string | null
}

/**
 * Định nghĩa một bộ xương.
 *
 * Tồn tại để hệ animation không bị khoá vào một hình thể duy nhất: người chibi và
 * thú bốn chân dùng CÙNG mã nguồn cho clip, lấy mẫu, blend và skinning — chỉ khác
 * danh sách khớp. Nếu không tách ra thì mỗi loại hình thể mới lại phải nhân bản
 * toàn bộ Clip/Animator.
 */
export interface RigDef<Name extends string = string> {
  readonly name: string
  /** Thứ tự CỐ ĐỊNH — animation lưu dữ liệu theo chỉ số của mảng này. */
  readonly joints: readonly Name[]
  readonly index: Readonly<Record<Name, number>>
  readonly rest: Readonly<Record<Name, JointRest>>
  readonly poseSize: number
  /** Thế nghỉ dạng phẳng, tính sẵn một lần để applyPose chỉ việc cộng vào. */
  readonly restBuffer: Float32Array
}

export function createRig<Name extends string>(
  name: string,
  joints: readonly Name[],
  rest: Record<Name, JointRest>,
): RigDef<Name> {
  const index = {} as Record<Name, number>
  joints.forEach((joint, i) => {
    index[joint] = i
  })

  // Kiểm tra ngay lúc nạp module: khớp cha phải tồn tại và phải đứng TRƯỚC con,
  // vì createBones() dựng cây theo đúng thứ tự này
  joints.forEach((joint, i) => {
    const parent = rest[joint].parent
    if (parent === null) return
    const pi = index[parent as Name]
    if (pi === undefined) throw new Error(`Rig "${name}": khớp "${joint}" có cha lạ "${parent}"`)
    if (pi >= i) throw new Error(`Rig "${name}": cha "${parent}" phải đứng trước con "${joint}"`)
  })

  const poseSize = joints.length * CHANNELS
  const restBuffer = new Float32Array(poseSize)
  for (const joint of joints) {
    const r = rest[joint]
    const o = index[joint] * CHANNELS
    restBuffer[o] = r.rot?.[0] ?? 0
    restBuffer[o + 1] = r.rot?.[1] ?? 0
    restBuffer[o + 2] = r.rot?.[2] ?? 0
    restBuffer[o + 3] = r.pos[0]
    restBuffer[o + 4] = r.pos[1]
    restBuffer[o + 5] = r.pos[2]
  }

  return { name, joints, index, rest, poseSize, restBuffer }
}

export interface RigBones<Name extends string> {
  bones: Record<Name, Bone>
  order: Bone[]
  rootBone: Bone
}

export function createBones<Name extends string>(rig: RigDef<Name>): RigBones<Name> {
  const bones = {} as Record<Name, Bone>
  for (const joint of rig.joints) {
    const r = rig.rest[joint]
    const bone = new Bone()
    bone.name = joint
    bone.position.set(...r.pos)
    if (r.rot) bone.rotation.set(...r.rot)
    bones[joint] = bone
  }
  for (const joint of rig.joints) {
    const parent = rig.rest[joint].parent
    if (parent) bones[parent as Name].add(bones[joint])
  }
  const rootBone = bones[rig.joints[0] as Name]
  // Ma trận world lúc nghỉ là cơ sở để Skeleton tính bind inverse
  rootBone.updateMatrixWorld(true)
  return { bones, order: rig.joints.map((j) => bones[j]), rootBone }
}

/**
 * Dựng một sinh vật thành MỘT SkinnedMesh duy nhất.
 *
 * Mỗi khối được gắn CỨNG vào đúng một xương (skinWeight = 1) — gọi là rigid
 * skinning. Không cần tính trọng số mềm, mà vẫn được cái lợi quyết định: cả sinh
 * vật chỉ tốn MỘT draw call, thay vì một draw call cho mỗi bộ phận nếu dùng cây
 * Group. Với yêu cầu "đại chiến" hàng chục quái cùng lúc thì đây là khác biệt
 * giữa 80 và 800 draw call.
 */
export class RigBuilder<Name extends string> {
  private readonly parts: BufferGeometry[] = []
  private readonly skeleton: RigBones<Name>
  private readonly tmp = new Matrix4()

  constructor(private readonly rig: RigDef<Name>) {
    this.skeleton = createBones(rig)
  }

  get bones(): Record<Name, Bone> {
    return this.skeleton.bones
  }

  /**
   * Gắn một khối vào khớp. `geometry` được tạo trong hệ toạ độ CỤC BỘ của khớp
   * (gốc là tâm khớp), builder sẽ tự đưa về không gian world lúc nghỉ.
   * Builder sở hữu geometry từ lúc này — không dùng lại nó ở ngoài.
   */
  add(joint: Name, geometry: BufferGeometry, color: number): this {
    const bone = this.skeleton.bones[joint]
    this.tmp.copy(bone.matrixWorld)
    geometry.applyMatrix4(this.tmp)

    // paint() có thể trả về geometry MỚI (khi phải chuyển sang non-indexed),
    // nên phải dùng giá trị trả về chứ không dùng lại biến cũ
    const painted = paint(geometry, color)

    const count = painted.getAttribute('position').count
    const index = this.rig.index[joint]
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

  finish(material: Material, name: string): { mesh: SkinnedMesh; skeleton: RigBones<Name> } {
    const geometry = mergeAll(this.parts)
    this.parts.length = 0

    const mesh = new SkinnedMesh(geometry, material)
    mesh.name = name
    mesh.castShadow = true
    mesh.receiveShadow = false // sinh vật tự đổ bóng lên mình trông bẩn, không đáng
    // Xương phải là con của mesh để ma trận world của chúng nằm cùng hệ với mesh
    mesh.add(this.skeleton.rootBone)
    // Skeleton tự tính bind inverse từ matrixWorld hiện tại của xương (thế nghỉ)
    mesh.bind(new Skeleton(this.skeleton.order))

    return { mesh, skeleton: this.skeleton }
  }
}
