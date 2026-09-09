import { describe, expect, it } from 'vitest'
import { Box3, Vector3 } from 'three'
import { buildHanLap } from '../characters/HanLap'
import { buildChibi } from '../buildChibi'
import { CHIBI_JOINTS } from '../ChibiRig'
import { HAND_PROP_IDS, buildHandProp, hasHandProp } from '../props/handProps'
import { hasSkill, skillDef } from '@/game/data/skills'
import { HAN_LAP_LOOK } from '@/game/data/player'

function bounds(root: { updateMatrixWorld: (f?: boolean) => void }): Box3 {
  root.updateMatrixWorld(true)
  return new Box3().setFromObject(root as never)
}

describe('Hàn Lập — bản dựng riêng', () => {
  it('vẫn là MỘT SkinnedMesh, tức một draw call', () => {
    // Cả lý do rigid skinning tồn tại. Tách một bộ phận ra thành mesh riêng để
    // "cho dễ chỉnh" là đánh đổi một draw call lấy sự tiện tay, và với nhân vật
    // luôn có mặt trên màn hình thì đó là cái giá trả suốt cả lượt chơi.
    const hanLap = buildHanLap()
    let meshes = 0
    hanLap.root.traverse((o) => {
      if ((o as { isMesh?: boolean }).isMesh) meshes++
    })
    expect(meshes).toBe(1)
  })

  it('dùng đúng bộ xương chung, đủ mọi khớp', () => {
    // Nếu Hàn Lập có rig riêng thì mọi clip trong `anim/clips/` phải nhân bản,
    // và hai bản sẽ trôi khỏi nhau ngay lần chỉnh tư thế đầu tiên
    const hanLap = buildHanLap()
    for (const joint of CHIBI_JOINTS) {
      expect(hanLap.bones[joint], joint).toBeDefined()
    }
  })

  it('cao đúng tỉ lệ chibi, không cao hơn quái vì nhiều chi tiết hơn', () => {
    const hanLap = buildHanLap()
    const box = bounds(hanLap.root)
    const size = box.getSize(new Vector3())
    // Đuôi ngựa chạy ra SAU nên nó không được tính vào chiều cao
    expect(size.y).toBeGreaterThan(1.0)
    expect(size.y).toBeLessThan(1.25)
  })

  it('★ đuôi ngựa nằm SAU LƯNG, không xuyên qua ngực', () => {
    // Bao kiếm ở bản trước đã dính đúng lỗi này: đặt ở z = -0.105 trong khi khối
    // ngực là hình trụ bán kính 0.131, nên nó nằm gọn bên trong lồng ngực và
    // không hiện ra một pixel nào. Không có gì báo — geometry vẫn được gộp,
    // tam giác vẫn được vẽ, chỉ là bị chính thân người che kín.
    const box = bounds(buildHanLap().root)
    // Phần sau lưng phải vươn ra quá bán kính thân (0.134) một khoảng rõ rệt
    expect(box.min.z).toBeLessThan(-0.28)
  })

  it('tốn nhiều tam giác hơn hẳn quái thường — đó là chủ ý', () => {
    const hanLap = buildHanLap()
    const grunt = buildChibi({ name: 'test', detail: 'simple', ...HAN_LAP_LOOK })
    const triOf = (m: { geometry: { getAttribute: (n: string) => { count: number } } }) =>
      m.geometry.getAttribute('position').count / 3
    expect(triOf(hanLap.mesh)).toBeGreaterThan(triOf(grunt.mesh) * 2)
  })
})

describe('pháp bảo cầm tay', () => {
  it('mọi id đều là chiêu có thật', () => {
    for (const id of HAND_PROP_IDS) expect(hasSkill(id), id).toBe(true)
  })

  it('chỉ chiêu có VẬT THẬT mới cầm được gì đó', () => {
    // Hoả Cầu Thuật, Canh Kim Kiếm Khí, Thái Ất Thanh Sơn Quyết đều là pháp lực
    // thuần — nhét một vật vào tay chúng là nói sai về chính hạng của chiêu, thứ
    // mà thẻ giới thiệu vừa ghi rõ ngay bên dưới màn hình
    for (const id of HAND_PROP_IDS) {
      expect(skillDef(id).phapBao.hang, id).not.toBe('khong')
    }
    for (const id of ['hoaCau', 'canhKimKiemKhi', 'thaiAtThanhSon', 'kimQuangThuan']) {
      expect(hasHandProp(id), id).toBe(false)
    }
  })

  it('không vật nào dài quá NỬA THÂN NGƯỜI', () => {
    // Ngưỡng 0,55 là nửa chiều cao nhân vật (1,1). Quá mức đó thì vật cầm tay
    // đọc ra là một cây thương chứ không phải thứ nằm trong nắm tay, và với cây
    // quạt hay lá phù thì nó còn sai hẳn về loại.
    //
    // Đây là cái bẫy mà bảng này sinh ra để chặn: mô hình trưng bày của Tam Diễm
    // Phiến cao 1,7 unit, nên quên `scale` một dòng là Hàn Lập vác một cây quạt
    // to gấp rưỡi người. Test đã bắt được đúng một lần — phi kiếm ở tỉ lệ 0,5 ra
    // 0,55 unit, tức dài đúng bằng nửa người.
    for (const id of HAND_PROP_IDS) {
      const size = bounds(buildHandProp(id)).getSize(new Vector3())
      expect(Math.max(size.x, size.y, size.z), id).toBeLessThan(0.55)
    }
  })

  it('ném lỗi khi hỏi một chiêu không có pháp bảo cầm tay', () => {
    // Bên gọi đã phải hỏi `hasHandProp` trước, nên tới được đây mà không có mục
    // thì đó là lỗi lập trình chứ không phải một trạng thái hợp lệ
    expect(() => buildHandProp('hoaCau')).toThrow()
  })
})
