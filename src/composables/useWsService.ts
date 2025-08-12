import { onUnmounted } from 'vue';

const WS_URL = 'ws://localhost:8787';
let ws: WebSocket | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let isManuallyClosed = false;

async function handleMessage(event: MessageEvent) {
  try {
    const data = JSON.parse(event.data);
    console.log(data);
    const { useAppStore } = await import('../stores/appStore');
    useAppStore().handleWsEvent(data);
  } catch (e) {
    console.error(e);
  }
}

function connect() {
  ws = new WebSocket(WS_URL);
  ws.onopen = () => {
    ws?.send(JSON.stringify({ type: "subscribe", channel: "all" }));
  };
  ws.onmessage = handleMessage;
  ws.onclose = () => {
    if (!isManuallyClosed) {
      reconnectTimeout = setTimeout(connect, 2000);
    }
  };
  ws.onerror = () => {
    ws?.close();
  };
}

export function useWsService() {
  if (!ws || ws.readyState > 1) connect();
  onUnmounted(() => {
    isManuallyClosed = true;
    ws?.close();
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
  });
  return {
    send: (msg: any) => ws?.readyState === 1 && ws.send(JSON.stringify(msg)),
    close: () => {
      isManuallyClosed = true;
      ws?.close();
    },
    get readyState() {
      return ws?.readyState;
    },
  };
} 