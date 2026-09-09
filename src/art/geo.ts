import { BufferAttribute, Color, type BufferGeometry } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

/**
 * Tô màu vào vertex của geometry.
 *
 * Đây là mấu chốt để giữ draw call thấp: nhiều khối màu khác nhau gộp được vào
 * MỘT mesh dùng chung một material `vertexColors`, thay vì mỗi màu một mesh.
 * Không dùng texture nên vertex color chính là toàn bộ "art" của prop.
 */
export function paint(geometry: BufferGeometry, color: number): BufferGeometry {
  // mergeGeometries đòi mọi geometry cùng dạng index; polyhedron thì non-indexed
  // còn cylinder/cone thì indexed -> quy hết về non-indexed trước khi gộp.
  const geo = geometry.index ? geometry.toNonIndexed() : geometry
  const count = geo.getAttribute('position').count
  const c = new Color(color)
  const arr = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    arr[i * 3] = c.r
    arr[i * 3 + 1] = c.g
    arr[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new BufferAttribute(arr, 3))
  return geo
}

/** Gộp danh sách geometry (đã paint) thành một. Giải phóng luôn các geometry nguồn. */
export function mergeAll(parts: BufferGeometry[]): BufferGeometry {
  if (parts.length === 0) throw new Error('mergeAll: danh sách rỗng')
  if (parts.length === 1) return parts[0] as BufferGeometry
  const merged = mergeGeometries(parts, false)
  if (!merged) throw new Error('mergeAll: gộp thất bại — kiểm tra attribute có khớp nhau')
  for (const p of parts) p.dispose()
  return merged
}

/** Dịch geometry tại chỗ — tiện khi xếp khối trước lúc gộp. */
export function at(geometry: BufferGeometry, x: number, y: number, z: number): BufferGeometry {
  geometry.translate(x, y, z)
  return geometry
}

/** Xoay quanh trục Y tại chỗ (radian). */
export function spinY(geometry: BufferGeometry, radians: number): BufferGeometry {
  geometry.rotateY(radians)
  return geometry
}
