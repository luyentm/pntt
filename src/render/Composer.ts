import { BloomEffect, EffectComposer, EffectPass, RenderPass } from 'postprocessing'
import { HalfFloatType, type PerspectiveCamera, type Scene, type WebGLRenderer } from 'three'
import { EdgeOutlineEffect } from './effects/EdgeOutlineEffect'

/**
 * Chuỗi hậu xử lý: RenderPass -> viền -> bloom.
 *
 * Bloom phải nằm ở EffectPass RIÊNG vì nó là CONVOLUTION effect — postprocessing
 * không cho gộp effect có tích chập với effect thường vào cùng một pass.
 *
 * Khử răng cưa dùng MSAA của render target (multisampling: 4) chứ không phải SMAA:
 * lowpoly toàn cạnh hình học sắc, MSAA xử lý đúng loại răng cưa đó và rẻ hơn
 * một pass SMAA đầy đủ.
 */
export class Composer {
  readonly composer: EffectComposer
  readonly outline: EdgeOutlineEffect
  readonly bloom: BloomEffect

  /** Tắt hẳn hậu xử lý — vẽ thẳng ra màn hình. Dùng để so sánh và để cứu fps. */
  enabled = true

  constructor(
    private readonly renderer: WebGLRenderer,
    private readonly scene: Scene,
    private readonly camera: PerspectiveCamera,
  ) {
    this.composer = new EffectComposer(renderer, {
      frameBufferType: HalfFloatType, // cần cho bloom, tránh banding
      multisampling: 4,
    })

    this.composer.addPass(new RenderPass(scene, camera))

    this.outline = new EdgeOutlineEffect(camera, {
      color: 0x1b2027,
      thickness: 1.6,
      depthSensitivity: 0.012,
      normalSensitivity: 1.9,
      opacity: 0.85,
      creaseFade: [16, 42],
      silhouetteFade: [45, 95],
      grazing: [0.2, 0.55],
    })
    this.composer.addPass(new EffectPass(camera, this.outline))

    this.bloom = new BloomEffect({
      // Nhẹ tay: linh châu/VFX cần có hào quang mềm, không phải một cục sáng cháy
      intensity: 0.42,
      // Ngưỡng cao: chỉ VFX/vật phát sáng mới rực lên, cảnh vật thường không bị mờ
      luminanceThreshold: 0.82,
      luminanceSmoothing: 0.18,
      mipmapBlur: true,
      radius: 0.62,
    })
    this.composer.addPass(new EffectPass(camera, this.bloom))
  }

  setSize(width: number, height: number): void {
    // updateStyle PHẢI là false.
    //
    // EffectComposer.setSize() gọi tiếp renderer.setSize(w, h, updateStyle), và
    // three mặc định updateStyle = true khi tham số là undefined -> nó ghi
    // canvas.style.width/height bằng px, đè mất CSS `width: 100%`. Canvas bị ghim
    // ở kích thước cứng, ResizeObserver thấy canvas đổi kích thước lại gọi
    // setSize... thành vòng lặp phản hồi và chốt ở một kích thước sai (canvas chỉ
    // chiếm một góc màn hình).
    this.composer.setSize(width, height, false)
  }

  render(dt: number): void {
    if (this.enabled) {
      this.composer.render(dt)
    } else {
      this.renderer.render(this.scene, this.camera)
    }
  }

  dispose(): void {
    this.composer.dispose()
  }
}
