import { BlendFunction, Effect, EffectAttribute } from 'postprocessing'
import { Color, MathUtils, Uniform, Vector2, type PerspectiveCamera, type WebGLRenderer } from 'three'

/**
 * Viền cel-shading suy ra từ depth buffer.
 *
 * Vì sao tự viết thay vì dùng OutlineEffect có sẵn: OutlineEffect của postprocessing
 * chỉ tô viền cho các object được *chọn* (kiểu highlight khi hover), còn ta cần viền
 * cho MỌI vật thể — đó chính là thứ làm chibi lowpoly tách khỏi nền và trông "cute".
 *
 * Hai loại cạnh được phát hiện riêng:
 *  1. Silhouette — chênh lệch độ sâu giữa các pixel lân cận (người trên nền cỏ).
 *     Chuẩn hoá theo khoảng cách nên nét KHÔNG dày lên khi camera zoom ra.
 *  2. Crease — pháp tuyến hình học suy từ vị trí view-space; ở góc cạnh pháp tuyến
 *     đổi hướng gấp nên `fwidth` vọt lên (cánh tay áp vào thân, các mặt của khối đá).
 *
 * Chỉ 5 lần lấy mẫu depth, không cần render thêm normal buffer.
 */
const fragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uTanHalfFov;
uniform float uThickness;
uniform float uDepthSens;
uniform float uNormalSens;
uniform float uOpacity;
// x = bắt đầu tan, y = tan hết (khoảng cách view-space, world unit)
uniform vec2 uCreaseFade;
uniform vec2 uSilhouetteFade;
// x = facing bắt đầu tính, y = facing tính đủ. facing = |dot(pháp tuyến, tia nhìn)|
uniform vec2 uGrazing;

// Dựng lại vị trí view-space từ depth. Dùng getViewZ() do postprocessing cấp
// (đã lo hộ perspective/ortho và reversed depth buffer) nên không phải tự
// đoán quy ước NDC của three.
vec3 viewPosAt(const in vec2 uv, const in float d) {
  vec2 ndc = uv * 2.0 - 1.0;
  vec3 ray = vec3(ndc.x * uTanHalfFov * aspect, ndc.y * uTanHalfFov, -1.0);
  return ray * (-getViewZ(d));
}

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  // Trời không có viền
  if (depth > 0.9999) {
    outputColor = vec4(0.0);
    return;
  }

  vec2 o = texelSize * uThickness;
  vec2 ox = vec2(o.x, 0.0);
  vec2 oy = vec2(0.0, o.y);

  vec3 pC = viewPosAt(uv, depth);
  vec3 pL = viewPosAt(uv - ox, readDepth(uv - ox));
  vec3 pR = viewPosAt(uv + ox, readDepth(uv + ox));
  vec3 pD = viewPosAt(uv - oy, readDepth(uv - oy));
  vec3 pU = viewPosAt(uv + oy, readDepth(uv + oy));

  float zC = -pC.z;

  // Silhouette bằng ĐẠO HÀM CẤP HAI của độ sâu, không phải cấp một.
  // Mặt đất nghiêng nhìn xiên có độ sâu tăng đều -> hiệu cấp một rất lớn và sinh
  // ra hàng loạt nét giả dọc theo các mặt của địa hình. Hiệu cấp hai triệt tiêu
  // đúng cái dốc đều đó (mặt phẳng cho ~0) và chỉ vọt lên ở chỗ độ sâu thật sự
  // nhảy bậc — tức là biên của vật thể.
  float ddx = abs((-pL.z) + (-pR.z) - 2.0 * zC);
  float ddy = abs((-pD.z) + (-pU.z) - 2.0 * zC);
  float dz = max(ddx, ddy);
  float silhouette = smoothstep(0.3, 1.0, dz / max(zC * uDepthSens, 1e-4));

  vec3 n = normalize(cross(pR - pL, pU - pD));

  // Dập theo góc nhìn, áp cho CẢ HAI term.
  //
  // Khi mặt gần song song với tia nhìn (mặt đất nhìn xiên), độ sâu đổi rất nhanh
  // theo pixel; đạo hàm cấp hai ở ranh giới hai facet địa hình cũng vọt theo, nên
  // silhouette báo động giả y như crease — chính là các đường chéo chạy khắp mặt
  // đất. Còn nhân vật/prop thì luôn có mặt hướng về camera (facing lớn) nên nét
  // viền của chúng vẫn giữ nguyên.
  float facing = abs(dot(n, normalize(-pC)));
  float grazingFade = smoothstep(uGrazing.x, uGrazing.y, facing);

  float crease = smoothstep(0.25, 1.0, length(fwidth(n)) * uNormalSens) * grazingFade;
  silhouette *= grazingFade;

  // Nét viền tan theo khoảng cách — và nếp gấp tan SỚM hơn silhouette.
  //
  // Lý do là bản chất của lowpoly: địa hình gồm hàng nghìn mặt phẳng ghép nhau,
  // mỗi ranh giới mặt là một nếp gấp hình học THẬT. Ở gần, vẽ chúng ra lại đẹp —
  // thấy rõ các mảng địa hình. Nhưng ở xa mỗi mặt chỉ còn vài pixel nên fwidth()
  // vọt lên và cả mặt đất biến thành một tấm lưới wireframe. Còn silhouette thì
  // phải giữ được ở xa vì nó là thứ định hình bóng cây/núi trên nền sương.
  float creaseFade = 1.0 - smoothstep(uCreaseFade.x, uCreaseFade.y, zC);
  float silFade = 1.0 - smoothstep(uSilhouetteFade.x, uSilhouetteFade.y, zC);

  float edge = clamp(max(silhouette * silFade, crease * creaseFade), 0.0, 1.0) * uOpacity;
  outputColor = vec4(uColor, edge);
}
`

export interface EdgeOutlineOptions {
  /** Màu nét viền. */
  color?: number
  /** Độ dày nét, tính theo CSS pixel (đã độc lập với DPR). 1.2–2.2 là dải đẹp. */
  thickness?: number
  /** Càng NHỎ càng bắt nhiều cạnh silhouette. */
  depthSensitivity?: number
  /** Càng LỚN càng bắt nhiều nếp gấp. */
  normalSensitivity?: number
  opacity?: number
  /** [bắt đầu tan, tan hết] cho nếp gấp, tính theo world unit. */
  creaseFade?: [number, number]
  /** [bắt đầu tan, tan hết] cho silhouette. */
  silhouetteFade?: [number, number]
  /** [facing bắt đầu, facing đủ] — dập nét ở mặt nhìn xiên. */
  grazing?: [number, number]
}

export class EdgeOutlineEffect extends Effect {
  private readonly cam: PerspectiveCamera
  /**
   * Độ dày mong muốn tính theo CSS pixel. Uniform `uThickness` lại tính theo texel
   * của render target, nên mỗi frame phải quy đổi: cùng một giá trị ở đây phải cho
   * nét dày bằng nhau trên màn Retina DPR 3 và màn thường DPR 1, và không đổi khi
   * người chơi hạ tỉ lệ phân giải để cứu fps.
   */
  private cssThickness: number
  private readonly bufferSize = new Vector2()

  constructor(camera: PerspectiveCamera, options: EdgeOutlineOptions = {}) {
    super('EdgeOutlineEffect', fragmentShader, {
      attributes: EffectAttribute.DEPTH,
      // ALPHA = mix(dst, src, src.a) -> viền vẽ đè lên cảnh theo alpha ta xuất ra
      blendFunction: BlendFunction.ALPHA,
      uniforms: new Map<string, Uniform>([
        ['uColor', new Uniform(new Color(options.color ?? 0x1a1f26))],
        ['uTanHalfFov', new Uniform(1)],
        ['uThickness', new Uniform(1)],
        ['uDepthSens', new Uniform(options.depthSensitivity ?? 0.012)],
        ['uNormalSens', new Uniform(options.normalSensitivity ?? 2.4)],
        ['uOpacity', new Uniform(options.opacity ?? 0.9)],
        ['uCreaseFade', new Uniform(new Vector2(...(options.creaseFade ?? [16, 42])))],
        ['uSilhouetteFade', new Uniform(new Vector2(...(options.silhouetteFade ?? [45, 95])))],
        ['uGrazing', new Uniform(new Vector2(...(options.grazing ?? [0.2, 0.55])))],
      ]),
    })
    this.cam = camera
    this.cssThickness = options.thickness ?? 1.6
    this.refreshFov()
  }

  private uniform(name: string): Uniform {
    const u = this.uniforms.get(name)
    if (!u) throw new Error(`EdgeOutlineEffect: thiếu uniform ${name}`)
    return u
  }

  private refreshFov(): void {
    this.uniform('uTanHalfFov').value = Math.tan(MathUtils.degToRad(this.cam.fov) * 0.5)
  }

  get color(): Color {
    return this.uniform('uColor').value as Color
  }

  /** Độ dày nét theo CSS pixel. */
  get thickness(): number {
    return this.cssThickness
  }

  set thickness(v: number) {
    this.cssThickness = v
  }

  get depthSensitivity(): number {
    return this.uniform('uDepthSens').value as number
  }

  set depthSensitivity(v: number) {
    this.uniform('uDepthSens').value = v
  }

  get normalSensitivity(): number {
    return this.uniform('uNormalSens').value as number
  }

  set normalSensitivity(v: number) {
    this.uniform('uNormalSens').value = v
  }

  get outlineOpacity(): number {
    return this.uniform('uOpacity').value as number
  }

  set outlineOpacity(v: number) {
    this.uniform('uOpacity').value = v
  }

  get creaseFadeStart(): number {
    return (this.uniform('uCreaseFade').value as Vector2).x
  }

  set creaseFadeStart(v: number) {
    ;(this.uniform('uCreaseFade').value as Vector2).x = v
  }

  get creaseFadeEnd(): number {
    return (this.uniform('uCreaseFade').value as Vector2).y
  }

  set creaseFadeEnd(v: number) {
    ;(this.uniform('uCreaseFade').value as Vector2).y = v
  }

  get grazingLow(): number {
    return (this.uniform('uGrazing').value as Vector2).x
  }

  set grazingLow(v: number) {
    ;(this.uniform('uGrazing').value as Vector2).x = v
  }

  get grazingHigh(): number {
    return (this.uniform('uGrazing').value as Vector2).y
  }

  set grazingHigh(v: number) {
    ;(this.uniform('uGrazing').value as Vector2).y = v
  }

  get silhouetteFadeEnd(): number {
    return (this.uniform('uSilhouetteFade').value as Vector2).y
  }

  set silhouetteFadeEnd(v: number) {
    ;(this.uniform('uSilhouetteFade').value as Vector2).y = v
  }

  /** Camera có thể đổi fov (zoom chiêu thức, cutscene) nên cập nhật mỗi frame. */
  override update(renderer: WebGLRenderer): void {
    this.refreshFov()
    // Quy đổi CSS pixel -> texel: lấy trực tiếp kích thước drawing buffer nên
    // gộp được cả DPR và tỉ lệ phân giải vào một hệ số, không cần truyền thêm gì
    renderer.getDrawingBufferSize(this.bufferSize)
    // Đo theo canvas chứ không theo window: canvas mới là thứ nét viền hiện lên
    const cssWidth = Math.max(1, renderer.domElement.clientWidth || window.innerWidth)
    this.uniform('uThickness').value = this.cssThickness * (this.bufferSize.x / cssWidth)
  }
}
