import { useState, useEffect, useRef } from "react"
import { io, type Socket } from "socket.io-client"

export interface TypedSocket {
  emit(event: string, ...args: unknown[]): void
  on(event: string, handler: (...args: unknown[]) => void): void
  off(event: string, handler: (...args: unknown[]) => void): void
  connected: boolean
}

interface UseWebSocketOptions {
  url: string
}

interface UseWebSocketReturn {
  socket: TypedSocket | null
}

export function useWebSocket({ url }: UseWebSocketOptions): UseWebSocketReturn {
  const [socket, setSocket] = useState<TypedSocket | null>(null)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (!url) return

    const s = io(url, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
    })

    socketRef.current = s
    setSocket(s as unknown as TypedSocket)

    return () => {
      s.disconnect()
      socketRef.current = null
      setSocket(null)
    }
  }, [url])

  return { socket }
}
