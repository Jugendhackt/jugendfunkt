import * as p from './protocol';
import CBOR from 'cbor-js';

console.log("Starting up")
let config = {"iceServers":[{url:'stun:stun.1.google.com:19302'},{url:'turn:numb.viagenie.ca',credential: 'muazkh', username: 'webrtc@live.com'}]};

let socket = new WebSocket("ws://10.23.40.240:3000")
let sendChannel = null;
let role = null;
let channels = {}


let setup = {}

let lastChunks = [];

// in ms
let preSend = 5000;
let start = null;
let data = null;

socket.onmessage = function(msg){

	console.log(msg)
	let header = JSON.parse(msg.data)
	let parsed = JSON.parse(header["payload"])
	let id = header["id"]
	console.log(id, parsed)

	if(parsed["type"] == "new_client"){
		console.log("New client joined, gonna send msg")

		role = "server";

		setup[id] = setup_socket("server");

		//setup new channel
		let dataChannel = setup[id].createDataChannel("sendChannel");


		dataChannel.onmessage = on_client_msg
		dataChannel.parent_id = id

		dataChannel.onopen =  function(channel){
			dataChannel.binaryType = "arraybuffer";

			channels[id] = dataChannel

			delete setup[id]
			console.log(channels)
		};

		setup[id].createOffer()
		.then(desc => {
			setup[id].setLocalDescription(desc);
		})
		.then(() => setup[id].localDescription)
		.then(offer => JSON.stringify(offer))
		.then(encoded => socket.send(encoded))

	}else if(parsed["type"] == "answer"){

		setup[id].setRemoteDescription(parsed)
		console.log("Awneser received")

	}else if(parsed["type"] == "ice_canidate"){

		setup[id].addIceCandidate(parsed["candidate"])

	}else if (parsed["type"] == "offer"){

		role = "client";

		setup[id] = setup_socket("client");
		setup[id].setRemoteDescription(parsed).then(() => setup[id].createAnswer()).then(awnser => setup[id].setLocalDescription(awnser)).then(() => JSON.stringify(setup[id].localDescription)).then(encoded => socket.send(encoded))

		console.log(setup[id])

	}else{
		console.log(parsed)
	}
}

function setup_socket(){
	//setup new socket
	let chan = new RTCPeerConnection(config);

	//setup event handlers
	chan.onicecandidate = function (evt) {
		if (evt.candidate)
			socket.send(JSON.stringify({
				'type': "ice_canidate",
				'candidate': evt.candidate
			}));
		};


	if(role == "client"){
		chan.ondatachannel = function(evt){
			socket.close()

			console.log(evt)
			sendChannel = evt.channel;

		sendChannel.onmessage = on_server_msg
		}
	}

	return chan
}

function on_client_msg(evt){
	console.log("Some Client wrote", evt.data)
}


function concatBuffers(bufList) {
	var totalLength = 0
	for(var i = 0; i < bufList.length; i++) {
		totalLength += bufList[i].msg.byteLength
		console.log(typeof bufList[i].msg);
	}
	console.log(totalLength);

	var buffer = new ArrayBuffer(totalLength);

	for(var i = 0; i < bufList.length; i++) {
		var len = 0
		for(var j = 0; j <= i; j++) {
			len += bufList[j].msg.byteLength
		}
		for(var k = 0; k < bufList[i].msg.byteLength; k++) {
			buffer[len + k] = bufList[i].msg[k];
			console.log(len + k);
		}
	}
	return buffer;
}

function on_server_msg(evt){
	var result = handleChunk(evt.data);
	if(result !== null) {
		console.log(p.decodeMsg(concatBuffers(result)));
		lastChunks = [];
	}
}

function broadcast(msg){
	Object.keys(channels).forEach(function(client){
		try{
			channels[client].send(msg)
		}catch(err){
			delete channels[client]
	};
	})
}

var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
var channelCount = null;
var samples = null;
var sampleRate = null;
var length = null;
const chunkBit = (preSend / p.chunkTime) * 2;
var generatedChunks = 0;

function initializeBroadcast() {
	document.getElementById("control-container").innerHTML = `<input type="file" id="file-picker">`;
	document.getElementById("file-picker").addEventListener('change', function() {
		var files = document.getElementById("file-picker").files;
		if(files.length > 0) {
			var reader = new FileReader();
			reader.addEventListener('loadend', function() {
				audioCtx.decodeAudioData(this.result, function(buf) {
					length = buf.duration * 1000;
					channelCount = buf.numberOfChannels;
					sampleRate = buf.sampleRate;
					samples = new Array(channelCount);
					for(var i = 0; i < channelCount; i++) {
						samples[i] = buf.getChannelData(i);
					}
					startBroadcasting();
				}, function(e){ console.log("Error with decoding audio data" + e.err); });
			});
			reader.readAsArrayBuffer(files[0])
		}
	});
}

function processChunks(n) {
	for(var i = n; i > 0; i--) {
		if(samples[0].length > 0) {
			var chunkSamples = new Array(channelCount);
			for(var j = 0; j < channelCount; j++) {
				var cutMark = sampleRate * (p.chunkTime / 1000);
				chunkSamples[j] = Array.from(samples[j].slice(0, cutMark));
				samples[j] = samples[j].slice(cutMark);
			}
			var taudio = new p.TimedAudio(start + generatedChunks * p.chunkTime, chunkSamples)
			generatedChunks = generatedChunks + 1;
			data = data.concat([taudio]);
		}
	}
}

function startBroadcasting() {
	start = Date.now() + preSend;
	data = new Array();
	processChunks(chunkBit);
	window.setTimeout(sendData);
}

function sendData() {
	while(data.length > 0 && data[0].time <= Date.now() + preSend) {
		var msg = new p.Message(p.msgType.payload, Date.now(), null, data[0]);
		broadcastChunked(p.encodeMsg(msg), 0);
		data.splice(0, 1);
	}
	window.setTimeout(sendData, p.chunkTime);
	processChunks(chunkBit);
}

var roleWaitInterval = window.setInterval(function () {
	if(role !== null) {
		window.clearInterval(roleWaitInterval);
		document.getElementById("role").innerHTML = `syncast ${role}`;

		if(role === "server") {
			window.setTimeout(initializeBroadcast);
		}
	}
}, 300);

function broadcastChunked(msg, i) {
	function encodeChunk(msg, i, last) {
		return CBOR.encode({
			index: i,
			last: last,
			msg: msg
		});
	}
	// length > 10KiB => splitting needed
	const maxLength = 1000;
	if(msg.byteLength > maxLength) {
		var now = msg.slice(0, maxLength);
		broadcast(encodeChunk(now, i, false));
		broadcastChunked(msg.slice(maxLength), i + 1);
	} else {
		broadcast(encodeChunk(msg, i, true));
	}
}

function handleChunk(payload) {
	var chunk = CBOR.decode(payload);
	lastChunks[chunk.index] = chunk.msg;
	if(chunk.last) {
		return lastChunks;
	} else {
		return null;
	}
}
