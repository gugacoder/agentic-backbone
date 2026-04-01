import { useEffect, useRef, useState } from "react"
import { io, type Socket } from "socket.io-client"

export type TypedSocket = Socket

interface UseWebSocketOptions {
  url: string
  autoConnect?: boolean
}

export function useWebSocket({ url, autoConnect = true }: UseWebSocketOptions) {
  const socketRef = useRef<Socket | null>(null)
  const [socket, setSocket] = useState<Socket | null>(null)

  useEffect(() => {
    if (!autoConnect) return

    const s = io(url, {
      transports: ["websocket", "polling"],
      autoConnect: true,
    })

    socketRef.current = s
    setSocket(s)

    return () => {
      s.disconnect()
      socketRef.current = null
      setSocket(null)
    }
  }, [url, autoConnect])

  return { socket }
}
