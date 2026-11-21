/**
 * Laya TV - Real-Time Remote Bridge (HTTP SSE + WebSockets)
 * Provides instant, zero-setup, cross-network communication between Samsung Smart TV
 * and mobile companion pages (Import, Mic, Party Jukebox) on standard HTTPS port 443.
 */
class RemoteBridgeService {
  constructor() {
    this.roomCode = null;
    this.isTV = false;
    this.clientType = 'phone';
    this.connected = false;
    this.callbacks = [];
    this.eventSource = null;
    this.ws = null;
    this.beaconTimer = null;
    this.fallbackPollTimer = null;
  }

  initTV(roomCode, onMessage) {
    this.isTV = true;
    this.roomCode = (roomCode || '').replace(/^LAYA-/i, '').trim();
    if (onMessage) this.callbacks.push(onMessage);
    this.connectStream();

    // TV broadcasts beacon every 3.5s so mobile companion connects instantly
    if (this.beaconTimer) clearInterval(this.beaconTimer);
    this.beaconTimer = setInterval(() => {
      this.send({ type: 'TV_ACK', room: this.roomCode, status: 'BEACON', time: Date.now() });
    }, 3500);
  }

  initMobile(roomCode, onMessage, clientType = 'phone') {
    this.isTV = false;
    this.clientType = clientType;
    this.roomCode = (roomCode || '').replace(/^LAYA-/i, '').trim();
    if (onMessage) this.callbacks.push(onMessage);
    this.connectStream();

    // Announce mobile presence immediately with client identity
    this.send({ type: 'PHONE_HELLO', client: this.clientType, room: this.roomCode, time: Date.now() });
  }

  connectStream() {
    const subTopic = this.isTV
      ? `layatv_room_${this.roomCode}_tv`
      : `layatv_room_${this.roomCode}_phone`;

    // 1. Primary Transport: HTML5 EventSource (Standard HTTPS 443, zero polling)
    if (typeof EventSource !== 'undefined') {
      try {
        if (this.eventSource) {
          try { this.eventSource.close(); } catch(e){}
        }
        const sseUrl = `https://ntfy.sh/${subTopic}/sse`;
        this.eventSource = new EventSource(sseUrl);

        this.eventSource.onopen = () => {
          this.connected = true;
          console.log('[RemoteBridge] SSE connected:', subTopic);
          if (!this.isTV) {
            this.send({ type: 'PHONE_HELLO', client: this.clientType, room: this.roomCode, time: Date.now() });
          }
        };

        this.eventSource.onmessage = (event) => {
          this.handleRawIncoming(event.data, subTopic);
        };

        this.eventSource.onerror = (err) => {
          console.warn('[RemoteBridge] SSE reconnecting...');
          this.connected = false;
        };
        return;
      } catch (err) {
        console.warn('[RemoteBridge] EventSource failed, attempting WebSocket...', err);
      }
    }

    // 2. Fallback Transport: WebSocket (Port 443)
    this.connectWebSocket(subTopic);
  }

  connectWebSocket(subTopic) {
    if (typeof WebSocket === 'undefined') return;
    try {
      if (this.ws) {
        try { this.ws.close(); } catch(e){}
      }
      this.ws = new WebSocket(`wss://ntfy.sh/${subTopic}/ws`);
      this.ws.onopen = () => {
        this.connected = true;
        console.log('[RemoteBridge] WebSocket connected:', subTopic);
        if (!this.isTV) {
          this.send({ type: 'PHONE_HELLO', client: this.clientType, room: this.roomCode, time: Date.now() });
        }
      };
      this.ws.onmessage = (event) => {
        this.handleRawIncoming(event.data, subTopic);
      };
      this.ws.onclose = () => {
        this.connected = false;
        setTimeout(() => this.connectStream(), 4000);
      };
    } catch (e) {
      console.warn('[RemoteBridge] WebSocket fallback error:', e);
    }
  }

  handleRawIncoming(rawStr, subTopic) {
    try {
      const entry = JSON.parse(rawStr);
      if (entry.event === 'message' && entry.message) {
        let payload = null;
        try {
          payload = JSON.parse(entry.message);
        } catch (e) {
          payload = entry.message;
        }
        if (payload) {
          this.callbacks.forEach(cb => {
            try { cb(payload, subTopic); } catch (err) { console.warn(err); }
          });
        }
      }
    } catch (err) {
      // Direct raw message without ntfy wrapper
      try {
        const payload = JSON.parse(rawStr);
        this.callbacks.forEach(cb => {
          try { cb(payload, subTopic); } catch (err) { console.warn(err); }
        });
      } catch (e) {}
    }
  }

  send(payload) {
    if (!this.roomCode) return false;
    const pubTopic = this.isTV
      ? `layatv_room_${this.roomCode}_phone`
      : `layatv_room_${this.roomCode}_tv`;

    const bodyStr = typeof payload === 'string' ? payload : JSON.stringify(payload);

    fetch(`https://ntfy.sh/${pubTopic}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyStr
    }).catch(err => {
      console.warn('[RemoteBridge] send error:', err);
    });

    return true;
  }
}

window.RemoteBridge = new RemoteBridgeService();
