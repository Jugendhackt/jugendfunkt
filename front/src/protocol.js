import CBOR from 'cbor-js';
// chunk size in seconds
// in ms
export const chunkTime = 100;

export const msgType = Object.freeze({time: 0, payload: 1});
export class Message {
  // type
  // received as timestamp (ms)
  // sent as timestamp (ms)
  // payload as TimedAudio / null
  constructor(type, sent, received, payload) {
    this.type = type;
    this.sent = sent;
    this.received = received;
    this.payload = payload;
  }
}

export const role = Object.freeze({client: 2, server: 3});
export class State {
  // latency in ms
  constructor(lastSent, lastReceived, role, pendingAudio) {
    this.lastSent = lastSent;
    this.lastReceived = lastReceived;
    this.role = role;
    this.pendingAudio = pendingAudio;
  }

  appendPendingAudio(audio) {
    this.pendingAudio.concat([audio]);
  }
}

export const initalState = new State(null, null, role.server, []);

export class TimedAudio {
  constructor(time, audio) {
    this.time = time;
    this.audio = audio;
  }
}

export function handleMessageClient(msg, state) {
  if(msg.type === msgType.payload) {
    state.pendingAudio.appendPendingAudio(msgType.payload);
  }
  return state;
}

export function sendMessage(channel, msg, state) {
  channel.send(encodeMsg(msg));
  return state;
}

export function encodeMsg(msg) {
  return CBOR.encode({
    'type': msg.type,
    'time' : msg.sent,
    'payload_time' : msg.payload.time,
    'payload' : msg.payload.audio
  });
}

export function decodeMsg(msg, received) {
  var parsed = CBOR.decode(msg);
  return new Message(parsed.type, parsed.time, received, new TimedAudio(parsed.payload_time, parsed.payload));
}
