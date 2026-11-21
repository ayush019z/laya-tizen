/**
 * Laya TV - Real-Time Remote Bridge
 * Uses Secure WebSockets (HiveMQ / EMQX MQTT Broker) + WebRTC PeerJS
 * Provides instant (<50ms) bidirectional messaging between TV and mobile companion pages (Import, Mic, Party Jukebox).
 */
class RemoteBridgeService {
  constructor() {
    this.client = null;
    this.roomCode = null;
    this.isTV = false;
    this.connected = false;
    this.callbacks = [];
    this.peer = null;
    this.peerCall = null;
  }

  initTV(roomCode, onMessage) {
    this.isTV = true;
    this.roomCode = (roomCode || '').replace(/^LAYA-/i, '').trim();
    if (onMessage) this.callbacks.push(onMessage);
    this.connectMQTT();
    this.initPeerJS();
  }

  initMobile(roomCode, onMessage) {
    this.isTV = false;
    this.roomCode = (roomCode || '').replace(/^LAYA-/i, '').trim();
    if (onMessage) this.callbacks.push(onMessage);
    this.connectMQTT();
  }

  connectMQTT() {
    if (!window.Paho || !window.Paho.MQTT) {
      console.warn('[RemoteBridge] Paho MQTT not available in window');
      return;
    }

    const clientId = (this.isTV ? 'layatv_' : 'layamob_') + Math.random().toString(16).substr(2, 8);
    const host = 'broker.hivemq.com';
    const port = 8884;

    try {
      this.client = new Paho.MQTT.Client(host, port, '/mqtt', clientId);

      this.client.onConnectionLost = (responseObject) => {
        console.warn('[RemoteBridge] MQTT Connection Lost:', responseObject ? responseObject.errorMessage : 'Unknown');
        this.connected = false;
        setTimeout(() => this.connectMQTT(), 3500);
      };

      this.client.onMessageArrived = (message) => {
        try {
          const payload = JSON.parse(message.payloadString);
          this.callbacks.forEach(cb => {
            try { cb(payload, message.destinationName); } catch (e) { console.warn(e); }
          });
        } catch (e) {
          console.warn('[RemoteBridge] Error parsing incoming MQTT message:', e);
        }
      };

      const options = {
        useSSL: true,
        timeout: 6,
        keepAliveInterval: 30,
        cleanSession: true,
        onSuccess: () => {
          this.connected = true;
          console.log('[RemoteBridge] Connected to MQTT broker:', host);
          const subTopic = this.isTV
            ? `layatv/room/${this.roomCode}/from_phone`
            : `layatv/room/${this.roomCode}/from_tv`;
          this.client.subscribe(subTopic);
          console.log('[RemoteBridge] Subscribed to:', subTopic);

          if (!this.isTV) {
            // Mobile pings TV immediately on connect
            this.send({ type: 'PHONE_HELLO', room: this.roomCode, time: Date.now() });
          }
        },
        onFailure: (err) => {
          console.warn('[RemoteBridge] HiveMQ connect failed, retrying on EMQX...', err);
          setTimeout(() => this.connectFallbackMQTT(), 2500);
        }
      };

      this.client.connect(options);
    } catch (err) {
      console.warn('[RemoteBridge] MQTT init error:', err);
    }
  }

  connectFallbackMQTT() {
    if (!window.Paho || !window.Paho.MQTT) return;
    try {
      const clientId = (this.isTV ? 'layatv_' : 'layamob_') + Math.random().toString(16).substr(2, 8);
      this.client = new Paho.MQTT.Client('broker.emqx.io', 8084, '/mqtt', clientId);
      this.client.onConnectionLost = () => setTimeout(() => this.connectMQTT(), 5000);
      this.client.onMessageArrived = (message) => {
        try {
          const payload = JSON.parse(message.payloadString);
          this.callbacks.forEach(cb => cb(payload, message.destinationName));
        } catch (e) {}
      };
      this.client.connect({
        useSSL: true,
        timeout: 6,
        cleanSession: true,
        onSuccess: () => {
          this.connected = true;
          const subTopic = this.isTV
            ? `layatv/room/${this.roomCode}/from_phone`
            : `layatv/room/${this.roomCode}/from_tv`;
          this.client.subscribe(subTopic);
        },
        onFailure: () => setTimeout(() => this.connectMQTT(), 5000)
      });
    } catch (e) {}
  }

  send(payload) {
    if (!this.client || !this.connected) {
      console.warn('[RemoteBridge] Cannot send, MQTT not connected');
      return false;
    }
    try {
      const pubTopic = this.isTV
        ? `layatv/room/${this.roomCode}/from_tv`
        : `layatv/room/${this.roomCode}/from_phone`;
      const msg = new Paho.MQTT.Message(JSON.stringify(payload));
      msg.destinationName = pubTopic;
      msg.qos = 0;
      this.client.send(msg);
      return true;
    } catch (err) {
      console.warn('[RemoteBridge] send error:', err);
      return false;
    }
  }

  initPeerJS() {
    if (!window.Peer) return;
    try {
      this.peer = new Peer('layatv-' + this.roomCode, { debug: 1 });
      this.peer.on('call', (call) => {
        this.peerCall = call;
        call.answer(); // Answer with no audio returned
        call.on('stream', (remoteAudioStream) => {
          if (window.AudioDSP) {
            window.AudioDSP.attachMicrophoneStream(remoteAudioStream);
          } else {
            const a = new Audio();
            a.srcObject = remoteAudioStream;
            a.play().catch(() => {});
          }
        });
      });
      this.peer.on('error', (err) => {
        console.warn('[RemoteBridge] PeerJS error:', err);
      });
    } catch (e) {
      console.warn('[RemoteBridge] PeerJS init failed:', e);
    }
  }
}

window.RemoteBridge = new RemoteBridgeService();
