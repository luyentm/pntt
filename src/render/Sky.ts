import {
  BackSide,
  Color,
  Fog,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  type Scene,
} from 'three'
import { Palette } from '@/art/Palette'

const vertexShader = /* glsl */ `
varying vec3 vWorldDir;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldDir = normalize(world.xyz - cameraPosition);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`

// Gradient 3 chặng (đỉnh trời -> chân trời -> dưới chân trời) + một quầng sáng
// về phía mặt trời. Rẻ hơn skybox và khớp tông lowpoly hơn ảnh trời thật.
const fragmentShader = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uBottom;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunPower;
varying vec3 vWorldDir;

void main() {
  vec3 dir = normalize(vWorldDir);
  float h = dir.y;

  // Dồn gradient về sát chân trời cho ra cảm giác không khí dày
  float upper = smoothstep(0.0, 0.55, h);
  float lower = smoothstep(0.0, -0.28, h);

  vec3 col = mix(uHorizon, uTop, pow(upper, 0.75));
  col = mix(col, uBottom, lower);

  float sun = max(dot(dir, normalize(uSunDir)), 0.0);
  col += uSunColor * pow(sun, uSunPower) * 0.7;

  gl_FragColor = vec4(col, 1.0);
}
`

export interface Sky {
  mesh: Mesh
  /**
   * Sương mù của bộ mặc định.
   *
   * Công khai vì `scene.fog` KHÔNG phải chỗ đáng tin để đọc lại: bộ stylized
   * thay nó bằng một `FogExp2` (mật độ, không có near/far), nên ai đọc
   * `scene.fog` rồi ép kiểu về `Fog` sẽ nhận `undefined` lúc bộ đó đang bật.
   */
  fog: Fog
  setSunDir: (dir: Vector3) => void
  setColors: (top: number, horizon: number, bottom: number) => void
  dispose: () => void
}

/**
 * Vòm trời gradient + sương mù. Sương mù rất quan trọng với lowpoly: nó làm nhoà rìa
 * bản đồ nên không cần dựng cảnh xa, và tạo cảm giác núi non trùng điệp của sơn môn.
 */
export function createSky(scene: Scene, sunDir: Vector3): Sky {
  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    side: BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: new Color(Palette.troiTren) },
      uHorizon: { value: new Color(Palette.troiChanTroi) },
      uBottom: { value: new Color(Palette.troiDuoi) },
      uSunDir: { value: sunDir.clone() },
      uSunColor: { value: new Color(Palette.nangSom) },
      // 26 chứ không 48: quầng nắng rộng hơn nên trời có không khí, thay vì một
      // đốm sáng bé xíu trên nền gradient phẳng
      uSunPower: { value: 26 },
    },
  })

  const mesh = new Mesh(new SphereGeometry(300, 24, 16), material)
  // Vòm trời luôn được vẽ trước và không bị cull theo frustum
  mesh.frustumCulled = false
  mesh.renderOrder = -1000
  mesh.name = 'sky'
  scene.add(mesh)

  // Sương bắt đầu ở 44 chứ không 30, và màu ĐẬM hơn chân trời.
  //
  // Bắt đầu ở 30 thì cả tiền cảnh đã bị xám hoá — sân đấu rộng khoảng 30 unit nên
  // gần như toàn bộ những gì người chơi đang nhìn đều nằm trong sương, và đó là
  // nguyên nhân lớn nhất của cảm giác "nhạt nhoà". Đẩy ra 44 thì vùng chiến đấu
  // trong veo, còn rừng và núi xa vẫn tan vào sương.
  //
  // Và màu sương phải ĐẬM hơn màu trời ở chân trời. Sương sáng bằng trời thì địa
  // hình xa lẫn hẳn vào nền thành một dải sữa; sương đậm hơn thì rừng xa hiện lên
  // thành từng lớp bóng — đúng cái chất "núi non trùng điệp" của sơn môn.
  const fog = new Fog(Palette.suongSau, 44, 165)
  scene.fog = fog

  return {
    mesh,
    fog,
    setSunDir(dir) {
      ;(material.uniforms.uSunDir!.value as Vector3).copy(dir)
    },
    setColors(top, horizon, bottom) {
      ;(material.uniforms.uTop!.value as Color).set(top)
      ;(material.uniforms.uHorizon!.value as Color).set(horizon)
      ;(material.uniforms.uBottom!.value as Color).set(bottom)
      // Sương lấy màu chân trời rồi LÀM ĐẬM: bằng đúng màu trời thì địa hình xa
      // lẫn hẳn vào nền thành một dải sữa.
      //
      // Ghi vào `fog` của mình, không vào `scene.fog`: khi bộ stylized đang bật
      // thì `scene.fog` là sương của NÓ, và ghi màu chân trời vào đó sẽ đè mất
      // màu sương đã tinh chỉnh riêng cho bộ đó.
      fog.color.set(horizon).multiplyScalar(0.78)
    },
    dispose() {
      scene.remove(mesh)
      mesh.geometry.dispose()
      material.dispose()
    },
  }
}
