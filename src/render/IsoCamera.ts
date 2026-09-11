import { MathUtils, PerspectiveCamera, Plane, Raycaster, Vector2, Vector3 } from 'three'

const GROUND = new Plane(new Vector3(0, 1, 0), 0)

/**
 * Camera isometric: quay quanh một điểm ngắm bằng toạ độ cầu (yaw/pitch/distance).
 *
 * Dùng PerspectiveCamera fov hẹp thay vì Orthographic: giữ được cảm giác iso nhưng
 * sương mù, đổ bóng và các hiệu ứng dựa trên độ sâu đều đọc đúng, và nhân vật chibi
 * có chút phối cảnh nhìn "game" hơn. Đây cũng là lựa chọn của Diablo 3/4, Torchlight.
 */
export class IsoCamera {
  readonly camera: PerspectiveCamera
  /** Điểm camera đang ngắm (đã được làm mượt). */
  readonly target = new Vector3()

  yaw = Math.PI * 0.22
  // ~38 độ: đủ dốc để nhìn bao quát khi đông quái, đủ thoải để thấy hông
  // nhân vật và chiều sâu của cảnh (nhìn thẳng đứng làm mất hết khối)
  pitch = 0.62
  // 17 unit: nhân vật chiếm ~10% chiều cao màn hình. Xa hơn (thử 30) thì chibi
  // chỉ còn ~35px và mất hết chi tiết áo/mặt — mà nhân vật chính là thứ đáng nhìn
  // nhất của một game chibi.
  distance = 17

  minDistance = 9
  maxDistance = 34
  // minPitch thấp để người chơi hạ camera ngắm được chân trời và vòm trời;
  // maxPitch cao để nhìn gần như thẳng đứng khi cần đọc thế trận đại chiến
  minPitch = 0.3
  maxPitch = 1.36

  /** Độ mượt khi bám nhân vật; càng nhỏ càng trễ. */
  followLerp = 9
  orbitSpeed = 0.0045
  zoomSpeed = 0.03

  private readonly desired = new Vector3()
  private readonly shakeOffset = new Vector3()
  private shakeMag = 0
  private shakeLeft = 0
  private shakeDur = 0

  private readonly raycaster = new Raycaster()
  private readonly ndc = new Vector2()

  constructor(aspect: number) {
    this.camera = new PerspectiveCamera(36, aspect, 0.5, 400)
    this.desired.copy(this.target)
    this.apply()
  }

  setAspect(width: number, height: number): void {
    this.camera.aspect = width / Math.max(1, height)
    this.camera.updateProjectionMatrix()
  }

  /** Đặt điểm ngắm mong muốn; `update()` sẽ lerp tới đó. */
  follow(x: number, y: number, z: number): void {
    this.desired.set(x, y, z)
  }

  /** Nhảy tức thì tới điểm ngắm — dùng khi vào màn / dịch chuyển. */
  snapTo(x: number, y: number, z: number): void {
    this.desired.set(x, y, z)
    this.target.copy(this.desired)
    this.apply()
  }

  /**
   * Kéo chuột xoay camera quanh điểm ngắm. dx, dy tính bằng pixel.
   *
   * Quy ước là lối camera quay quanh nhân vật của game nhập vai, thứ tay người
   * chơi đã quen: **camera đi theo tay, cảnh trượt ngược lại**. Kéo sang phải
   * thì camera vòng sang phải; kéo XUỐNG thì camera dâng lên nhìn từ trên, kéo
   * LÊN thì nó hạ xuống ngang tầm mắt.
   *
   * Hai dấu ngược nhau ở hai dòng dưới KHÔNG phải nhầm: `yaw` là góc quay
   * quanh trục đứng, còn `pitch` là ĐỘ CAO của camera — cùng một chiều kéo
   * trên màn hình ra hai dấu khác nhau trong toạ độ cầu. `pitch` từng mang dấu
   * trừ, và khi đó kéo xuống lại hạ camera: đứng một mình thì không ai để ý,
   * đứng cạnh trục ngang thì hai trục đá nhau và cú kéo chéo nào cũng sai.
   */
  orbit(dx: number, dy: number): void {
    this.yaw -= dx * this.orbitSpeed
    this.pitch = MathUtils.clamp(this.pitch + dy * this.orbitSpeed, this.minPitch, this.maxPitch)
  }

  /** delta là WheelEvent.deltaY dồn lại. */
  zoom(delta: number): void {
    this.distance = MathUtils.clamp(
      this.distance + delta * this.zoomSpeed,
      this.minDistance,
      this.maxDistance,
    )
  }

  /** Rung camera — dùng khi trúng đòn nặng, boss giáng chiêu, đột phá cảnh giới. */
  shake(magnitude: number, duration = 0.35): void {
    // Rung mới chỉ ghi đè nếu mạnh hơn rung đang chạy
    if (magnitude < this.shakeMag * (this.shakeLeft / Math.max(this.shakeDur, 1e-4))) return
    this.shakeMag = magnitude
    this.shakeDur = duration
    this.shakeLeft = duration
  }

  update(dt: number): void {
    // Lerp độc lập framerate
    const t = 1 - Math.exp(-this.followLerp * dt)
    this.target.lerp(this.desired, t)

    if (this.shakeLeft > 0) {
      this.shakeLeft = Math.max(0, this.shakeLeft - dt)
      const falloff = this.shakeLeft / Math.max(this.shakeDur, 1e-4)
      const amp = this.shakeMag * falloff * falloff
      // Nhiễu rẻ tiền bằng sin ở tần số lệch nhau -> không thấy chu kỳ
      const s = performance.now() * 0.001
      this.shakeOffset.set(
        Math.sin(s * 61.3) * amp,
        Math.sin(s * 79.7) * amp * 0.6,
        Math.sin(s * 53.1) * amp,
      )
    } else {
      this.shakeOffset.set(0, 0, 0)
      this.shakeMag = 0
    }

    this.apply()
  }

  private apply(): void {
    const horiz = Math.cos(this.pitch) * this.distance
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * horiz + this.shakeOffset.x,
      this.target.y + Math.sin(this.pitch) * this.distance + this.shakeOffset.y,
      this.target.z + Math.cos(this.yaw) * horiz + this.shakeOffset.z,
    )
    this.camera.lookAt(
      this.target.x + this.shakeOffset.x * 0.3,
      this.target.y + this.shakeOffset.y * 0.3,
      this.target.z + this.shakeOffset.z * 0.3,
    )
  }

  /**
   * Chiếu toạ độ chuột (NDC) xuống mặt phẳng ngang y = `planeY`.
   * Đây là hàm dùng để ngắm pháp thuật và click-to-move.
   */
  screenToGround(ndcX: number, ndcY: number, out: Vector3, planeY = 0): boolean {
    this.ndc.set(ndcX, ndcY)
    this.raycaster.setFromCamera(this.ndc, this.camera)
    GROUND.constant = -planeY
    return this.raycaster.ray.intersectPlane(GROUND, out) !== null
  }

  /** Hướng "trước mặt" theo góc camera, đã chiếu xuống mặt đất — để WASD đi theo hướng nhìn. */
  forwardOnGround(out: Vector3): Vector3 {
    return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize()
  }

  rightOnGround(out: Vector3): Vector3 {
    return out.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize()
  }
}
