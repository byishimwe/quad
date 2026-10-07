import { useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import { connectSocket, disconnectSocket } from "@/lib/socket";
import { useSocketStore } from "@/stores/socketStore";

export function SocketManager() {
  const { isSignedIn, userId, sessionId, getToken } = useAuth();
  const setSocket = useSocketStore((state) => state.setSocket);

  useEffect(() => {
    let mounted = true;

    const setupSocket = () => {
      if (isSignedIn && userId && sessionId) {
        if (mounted) {
          const socket = connectSocket(() => getToken());
          setSocket(socket);
        }
      } else {
        disconnectSocket();
        setSocket(null);
      }
    };

    setupSocket();

    return () => {
      mounted = false;
      // Disconnect on unmount to prevent leaks or stale state
      disconnectSocket();
      setSocket(null);
    };
  }, [isSignedIn, userId, sessionId, getToken, setSocket]);

  return null;
}
