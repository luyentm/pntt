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
  col += uSunColor * pow(sun, uSunPower) * 0.55;

  gl_FragColor = vec4(col, 1.0);
}
`

export interface Sky {
  mesh: Mesh
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
      uSunPower: { value: 48 },
    },
  })

  const mesh = new Mesh(new SphereGeometry(300, 24, 16), material)
  // Vòm trời luôn được vẽ trước và không bị cull theo frustum
  mesh.frustumCulled = false
  mesh.renderOrder = -1000
  mesh.name = 'sky'
  scene.add(mesh)

  // Dải sương mù bám sát tầm nhìn thực tế của camera (~20-90 unit). Đặt xa quá
  // thì cảnh phẳng lì không có chiều sâu, mà còn để lộ rìa bản đồ.
  scene.fog = new Fog(Palette.suongMu, 30, 100)

  return {
    mesh,
    setSunDir(dir) {
      ;(material.uniforms.uSunDir!.value as Vector3).copy(dir)
    },
    setColors(top, horizon, bottom) {
      ;(material.uniforms.uTop!.value as Color).set(top)
      ;(material.uniforms.uHorizon!.value as Color).set(horizon)
      ;(material.uniforms.uBottom!.value as Color).set(bottom)
      if (scene.fog) (scene.fog as Fog).color.set(horizon)
    },
    dispose() {
      scene.remove(mesh)
      mesh.geometry.dispose()
      material.dispose()
    },
  }
}
