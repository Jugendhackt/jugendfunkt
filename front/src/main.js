import * as p from './protocol';

console.log("Starting up")
let config = {"iceServers":[{url:'stun:stun.1.google.com:19302'},{url:'turn:numb.viagenie.ca',credential: 'muazkh', username: 'webrtc@live.com'}]};

let c = null;
let socket = new WebSocket("ws://10.23.41.224:3000")
let sendChannel = null;
let role = null;
let channels = []

// in ms
let preSend = 5000;
let start = null;
let data = null;

socket.onmessage = function(msg){

	let parsed = JSON.parse(msg.data)
	console.log(parsed)

	if(parsed["type"] == "new_client"){
		console.log("New client joined, gonna send msg")

		role = "server";

		c = setup_socket("server");

		//setup new channel
		let dataChannel = c.createDataChannel("sendChannel");
		dataChannel.onmessage = on_client_msg

		dataChannel.onopen = function(channel){
      dataChannel.binaryType = "arraybuffer";
			channels.push(dataChannel)
		};

		c.createOffer()
		.then(desc => {
			c.setLocalDescription(desc);
		})
		.then(() => c.localDescription)
		.then(offer => JSON.stringify(offer))
		.then(encoded => socket.send(encoded))

	}else if(parsed["type"] == "answer"){

		c.setRemoteDescription(parsed).then(() => console.log(c))
		console.log("Awneser received")

	}else if(parsed["type"] == "ice_canidate"){

		c.addIceCandidate(parsed["candidate"])

	}else if (parsed["type"] == "offer"){

		role = "client";

		c = setup_socket("client");
		c.setRemoteDescription(parsed).then(() => c.createAnswer()).then(awnser => c.setLocalDescription(awnser)).then(() => JSON.stringify(c.localDescription)).then(encoded => socket.send(encoded))
		console.log(c)

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

	chan.oniceconnectionstatechange = function(evt){
		console.log(chan.iceConnectionState)
		if(chan.iceConnectionState == "COMPLETED"){

			if(role == "server"){
				chan = null;
			}
		}
	}

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

function on_server_msg(evt){
	console.log("the server wrote", evt.data)
}

function broadcast(msg){
	channels.forEach(function(client, index){
		try{
			client.send(msg)
		}catch(err){
			console.log("err: " + err);
			console.log(channels[index].readyState);
			channels.splice(index, 1);
		}
	});
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
				var cutMark = sampleRate * (p.chunkTime / 1000) + 1;
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
		broadcast(p.encodeMsg(msg));
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
