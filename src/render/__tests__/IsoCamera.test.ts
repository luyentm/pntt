import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { IsoCamera } from '../IsoCamera'

/**
 * Điểm `p` nằm ở đâu trên màn hình, theo hệ NDC (-1…1, y dương là phía TRÊN).
 *
 * Đo bằng phép chiếu thật chứ không đọc `yaw`/`pitch`: câu hỏi cần trả lời là
 * "kéo tay xuống thì cảnh đi đâu", mà nó nằm ở chỗ vật hiện lên màn hình —
 * không nằm ở dấu của một biến trong toạ độ cầu.
 */
function onScreen(cam: IsoCamera, p: Vector3): Vector3 {
  cam.camera.updateMatrixWorld(true)
  cam.camera.updateProjectionMatrix()
  return p.clone().project(cam.camera)
}

const DRAG = 40

/** Đỉnh đầu nhân vật chibi — mốc để đo cảnh trượt lên hay xuống. */
function head(): Vector3 {
  return new Vector3(0, 1.1, 0)
}

describe('IsoCamera.orbit', () => {
  /**
   * Trục dọc là chỗ đã sai một lần: `pitch` từng dùng dấu trừ, nên kéo xuống
   * lại HẠ camera xuống ngang tầm mắt — ngược hẳn mọi game có camera quay quanh
   * nhân vật, và đứng cạnh trục ngang thì đọc ra là hai trục đá nhau.
   */
  it('kéo XUỐNG thì camera dâng lên nhìn từ trên, cảnh trượt xuống', () => {
    const cam = new IsoCamera(16 / 9)
    cam.snapTo(0, 0, 0)
    const before = onScreen(cam, head())
    const height = cam.camera.position.y

    cam.orbit(0, DRAG)
    cam.update(1)
    expect(cam.camera.position.y).toBeGreaterThan(height)
    expect(onScreen(cam, head()).y).toBeLessThan(before.y)
  })

  it('kéo LÊN là chiều ngược hẳn — camera hạ xuống ngang tầm mắt', () => {
    const cam = new IsoCamera(16 / 9)
    cam.snapTo(0, 0, 0)
    const before = onScreen(cam, head())
    const height = cam.camera.position.y

    cam.orbit(0, -DRAG)
    cam.update(1)
    expect(cam.camera.position.y).toBeLessThan(height)
    expect(onScreen(cam, head()).y).toBeGreaterThan(before.y)
  })

  /**
   * Trục ngang giữ nguyên lối cũ: camera đi vòng THEO tay, nên cảnh trượt
   * ngược lại. Đây là lối camera của game nhập vai, và nó không đổi — test ở
   * đây để nếu có ai sửa dấu của `yaw` thì phải sửa có ý thức.
   */
  it('kéo sang PHẢI thì camera đi vòng sang phải, cảnh trượt sang trái', () => {
    const cam = new IsoCamera(16 / 9)
    cam.snapTo(0, 0, 0)
    // Mốc đặt sẵn ở nửa phải màn hình theo góc camera hiện tại
    const mark = cam.rightOnGround(new Vector3()).multiplyScalar(3)
    const before = onScreen(cam, mark)
    expect(before.x).toBeGreaterThan(0)

    cam.orbit(DRAG, 0)
    cam.update(1)
    expect(onScreen(cam, mark).x).toBeLessThan(before.x)
  })

  it('pitch bị kẹp hai đầu, kéo mạnh cỡ nào cũng không lật qua đỉnh', () => {
    // Lật qua đỉnh thì `lookAt` mất trục up và cả khung hình quay ngược
    const cam = new IsoCamera(16 / 9)
    cam.orbit(0, 100000)
    expect(cam.pitch).toBeLessThanOrEqual(cam.maxPitch)
    cam.orbit(0, -100000)
    expect(cam.pitch).toBeGreaterThanOrEqual(cam.minPitch)
  })

  it('xoay không làm camera trôi xa hay lại gần điểm ngắm', () => {
    const cam = new IsoCamera(16 / 9)
    cam.snapTo(0, 0, 0)
    cam.orbit(DRAG * 3, DRAG * 2)
    cam.update(1)
    expect(cam.camera.position.length()).toBeCloseTo(cam.distance, 5)
  })
})
