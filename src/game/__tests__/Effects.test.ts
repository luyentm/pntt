import { describe, expect, it } from 'vitest'
import { EffectSet } from '../Effects'

describe('EffectSet', () => {
  it('thêm và tìm được trạng thái', () => {
    const fx = new EffectSet()
    fx.apply('chamLai', 3, 0.4)
    expect(fx.has('chamLai')).toBe(true)
    expect(fx.find('chamLai')?.magnitude).toBe(0.4)
  })

  it('chồng thì GIỮ MẠNH HƠN và thời gian DÀI HƠN, không cộng dồn', () => {
    // Cộng dồn sẽ khiến một chiêu làm chậm bắn liên tục đóng băng mục tiêu
    // vĩnh viễn — lỗi cân bằng dễ xảy ra mà khó nhận ra khi chơi
    const fx = new EffectSet()
    fx.apply('chamLai', 3, 0.4)
    fx.apply('chamLai', 1, 0.6)
    expect(fx.size).toBe(1)
    const e = fx.find('chamLai')!
    expect(e.magnitude).toBe(0.6)
    expect(e.remaining).toBe(3)

    fx.apply('chamLai', 8, 0.2)
    expect(fx.find('chamLai')!.magnitude).toBe(0.6)
    expect(fx.find('chamLai')!.remaining).toBe(8)
  })

  it('hết thời gian thì tự gỡ', () => {
    const fx = new EffectSet()
    fx.apply('chamLai', 0.5, 0.5)
    for (let i = 0; i < 40; i++) fx.tick(1 / 60)
    expect(fx.has('chamLai')).toBe(false)
    expect(fx.size).toBe(0)
  })

  it('làm chậm giảm tốc, có sàn để không bao giờ bằng 0', () => {
    const fx = new EffectSet()
    expect(fx.speedMultiplier()).toBe(1)
    fx.apply('chamLai', 5, 0.5)
    expect(fx.speedMultiplier()).toBeCloseTo(0.5)
    // Làm chậm 200% vẫn phải để mục tiêu nhúc nhích được — bất động hoàn toàn
    // là việc của 'dongBang', và phải là một quyết định rõ ràng
    fx.apply('chamLai', 5, 2)
    expect(fx.speedMultiplier()).toBe(0.15)
  })

  it('đóng băng thì tốc bằng 0 và mất điều khiển', () => {
    const fx = new EffectSet()
    fx.apply('dongBang', 2, 0)
    expect(fx.speedMultiplier()).toBe(0)
    expect(fx.isImmobilized()).toBe(true)
  })

  it('sát thương theo thời gian gây theo NHỊP GIÂY, không rải mỗi frame', () => {
    // 60 con số "0.4" mỗi giây thì không ai đọc nổi
    const fx = new EffectSet()
    fx.apply('thieuDot', 3.5, 10)

    let total = 0
    let ticksWithDamage = 0
    for (let i = 0; i < 60; i++) {
      const d = fx.tick(1 / 60)
      total += d
      if (d > 0) ticksWithDamage++
    }
    expect(total).toBe(10)
    expect(ticksWithDamage).toBe(1)
  })

  it('tổng sát thương theo thời gian đúng bằng magnitude × số giây', () => {
    const fx = new EffectSet()
    fx.apply('trungDoc', 3, 7)
    let total = 0
    for (let i = 0; i < 200; i++) total += fx.tick(1 / 60)
    expect(total).toBe(21)
  })

  it('khiên hấp thụ hết thì sát thương xuyên qua bằng 0', () => {
    const fx = new EffectSet()
    fx.apply('khien', 5, 100)
    expect(fx.absorb(30)).toBe(0)
    expect(fx.find('khien')!.magnitude).toBe(70)
  })

  it('khiên vỡ thì phần vượt vẫn xuyên qua, và khiên tan NGAY', () => {
    const fx = new EffectSet()
    fx.apply('khien', 5, 40)
    expect(fx.absorb(70)).toBe(30)
    // Tan ngay chứ không đợi hết thời gian: khiên 0 điểm mà vẫn còn hiệu ứng
    // hiển thị sẽ làm người chơi tưởng mình còn được che
    expect(fx.has('khien')).toBe(false)
  })

  it('khiên hấp thụ đúng bằng lượng còn lại thì cũng tan', () => {
    const fx = new EffectSet()
    fx.apply('khien', 5, 40)
    expect(fx.absorb(40)).toBe(0)
    expect(fx.has('khien')).toBe(false)
  })

  it('không có khiên thì sát thương đi thẳng', () => {
    const fx = new EffectSet()
    expect(fx.absorb(25)).toBe(25)
  })

  it('clear() gỡ hết', () => {
    const fx = new EffectSet()
    fx.apply('khien', 5, 10)
    fx.apply('chamLai', 5, 0.3)
    fx.clear()
    expect(fx.size).toBe(0)
    expect(fx.speedMultiplier()).toBe(1)
  })
})
