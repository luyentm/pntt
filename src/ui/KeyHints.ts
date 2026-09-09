/**
 * Bảng gợi ý phím ở góc phải.
 *
 * Có mặt vì bản demo không có màn hướng dẫn: mọi cơ chế của M5/M6 (toạ thiền,
 * uống Tiểu Bình, đột phá, luyện đan) đều nằm sau một phím mà không có gì trên
 * màn hình chỉ ra. Một danh sách tĩnh giải quyết xong, không tốn gì.
 */
const HINTS: ReadonlyArray<[string, string]> = [
  ['WASD', 'di chuyển'],
  ['Chuột / J', 'đánh'],
  ['1…7', 'pháp thuật'],
  ['Space', 'ngự kiếm (Trúc Cơ)'],
  ['F', 'toạ thiền'],
  ['G', 'uống Tiểu Bình'],
  ['C', 'tu luyện'],
  ['I', 'túi đồ'],
  ['K', 'luyện đan'],
  ['B', 'đột phá'],
]

export class KeyHints {
  private readonly root: HTMLDivElement

  constructor(container: HTMLElement) {
    this.root = document.createElement('div')
    this.root.className = 'keyhints'
    this.root.innerHTML = HINTS.map(([key, label]) => `<div><b>${key}</b> ${label}</div>`).join('')
    container.appendChild(this.root)
  }

  dispose(): void {
    this.root.remove()
  }
}
