/** Pub/sub có type. Dùng để tách hệ thống gameplay khỏi UI: hệ thống emit, UI nghe. */
type Handler<P> = (payload: P) => void

export class EventBus<M extends Record<string, unknown>> {
  private readonly handlers = new Map<string, Set<Handler<never>>>()

  /** Đăng ký nghe; trả về hàm huỷ đăng ký. */
  on<K extends keyof M & string>(type: K, handler: Handler<M[K]>): () => void {
    let set = this.handlers.get(type)
    if (!set) {
      set = new Set()
      this.handlers.set(type, set)
    }
    set.add(handler as Handler<never>)
    return () => {
      set?.delete(handler as Handler<never>)
    }
  }

  once<K extends keyof M & string>(type: K, handler: Handler<M[K]>): () => void {
    const off = this.on(type, (payload) => {
      off()
      handler(payload)
    })
    return off
  }

  emit<K extends keyof M & string>(type: K, payload: M[K]): void {
    const set = this.handlers.get(type)
    if (!set || set.size === 0) return
    // Sao chép để handler có thể tự huỷ đăng ký ngay trong lúc đang emit
    for (const handler of [...set]) (handler as Handler<M[K]>)(payload)
  }

  clear(): void {
    this.handlers.clear()
  }
}
