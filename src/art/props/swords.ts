import { BoxGeometry, ConeGeometry, CylinderGeometry, type BufferGeometry } from 'three'
import { at, mergeAll, paint } from '@/art/geo'
import { Palette } from '@/art/Palette'

/**
 * Kiếm trúc của Thanh Trúc Phong Vân Kiếm — mũi về +Z, dài đúng 1 unit.
 *
 * Thân là ống trúc có đốt chứ không phải lưỡi kim loại: đây là bản mệnh pháp
 * khí luyện từ trúc, và ở kích thước 33 thanh bay vòng thì chỉ có MÀU và bóng
 * ngoài là đọc được — nên màu trúc quan trọng hơn mọi chi tiết khác.
 */
export function bambooSwordGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = []

  const blade = new BoxGeometry(0.07, 0.03, 0.62)
  parts.push(paint(at(blade, 0, 0, 0.05), Palette.tre))

  // Hai đốt trúc: khối hơi phình, bắt sáng khác thân nên đọc ra là "trúc"
  for (const z of [-0.1, 0.18]) {
    const node = new CylinderGeometry(0.05, 0.05, 0.035, 6)
    node.rotateX(Math.PI / 2)
    parts.push(paint(at(node, 0, 0, z), Palette.laTungNhat))
  }

  const tip = new ConeGeometry(0.042, 0.18, 4)
  tip.rotateX(Math.PI / 2)
  parts.push(paint(at(tip, 0, 0, 0.45), Palette.linh))

  const grip = new BoxGeometry(0.045, 0.045, 0.14)
  parts.push(paint(at(grip, 0, 0, -0.34), Palette.than))

  return mergeAll(parts)
}

/**
 * Phi kiếm để cưỡi (Ngự Kiếm Phi Hành) — mũi về +Z, dài 1 unit.
 *
 * To và bẹt hơn kiếm trúc: nó phải đọc ra là "đứng được lên trên" từ góc iso,
 * nên bề rộng quan trọng hơn độ mảnh. Có thêm vòng linh khí dưới bụng kiếm để
 * mắt bắt được nó đang bay, không phải đang nằm đất.
 */
export function flyingSwordGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = []

  const blade = new BoxGeometry(0.19, 0.05, 0.78)
  parts.push(paint(at(blade, 0, 0, 0.05), Palette.daNhat))

  // Sống kiếm: dải hẹp nhô lên giữa lưỡi, cho lưỡi kiếm một mặt cắt
  const ridge = new BoxGeometry(0.05, 0.035, 0.74)
  parts.push(paint(at(ridge, 0, 0.03, 0.05), Palette.kim))

  const tip = new ConeGeometry(0.1, 0.24, 4)
  tip.rotateX(Math.PI / 2)
  parts.push(paint(at(tip, 0, 0, 0.56), Palette.daNhat))

  const guard = new BoxGeometry(0.3, 0.06, 0.06)
  parts.push(paint(at(guard, 0, 0, -0.36), Palette.kim))

  const grip = new BoxGeometry(0.07, 0.07, 0.2)
  parts.push(paint(at(grip, 0, 0, -0.48), Palette.than))

  const aura = new CylinderGeometry(0.26, 0.16, 0.03, 7)
  parts.push(paint(at(aura, 0, -0.09, 0.02), Palette.linh))

  return mergeAll(parts)
}
