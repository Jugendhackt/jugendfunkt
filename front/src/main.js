console.log("hi");

let config = {"iceServers":[{url:'stun:stun.1.google.com:19302'},{url:'turn:numb.viagenie.ca',credential: 'muazkh', username: 'webrtc@live.com'}]};

let c = new RTCPeerConnection(config);
let socket = new WebSocket("ws://10.23.41.224:3000")

function createOffer(){
	return c.createOffer()
	.then(desc => {
		c.setLocalDescription(desc);
	})
	.then(() => c.localDescription)
}

c.onicecandidate = function (evt) {
    if (evt.candidate)
      socket.send(JSON.stringify({
      	'type': "ice_canidate",
        'candidate': evt.candidate
      }));
  };

c.oniceconnectionstatechange = function(evt){
	console.log(c.iceConnectionState)
	if(c.iceConnectionState == "COMPLETED"){
		sendChannel.send("HALLO")
	}
}


socket.onmessage = function(msg){
	let parsed = JSON.parse(msg.data)
	if (parsed["type"] == "offer"){
		console.log("Accept offer, reply awnser")
		c.setRemoteDescription(parsed).then(() => c.createAnswer()).then(awnser => c.setLocalDescription(awnser)).then(() => JSON.stringify(c.localDescription)).then(encoded => socket.send(encoded))
		console.log(c)
	}else if(parsed["type"] == "answer"){
		c.setRemoteDescription(parsed).then(() => console.log(c))
		console.log("Singaling completet, gonna start ICE?")


	}else if(parsed["type"] == "new_client"){

	let sendChannel = c.createDataChannel("sendChannel");
	sendChannel.onmessage = function(msg){
		console.log(msg.data)
		sendChannel.send("PING")
	}

	sendChannel.onopen =  function(channel){
		console.log(channel)
		sendChannel.send("PING")
	};
		createOffer().then(offer => JSON.stringify(offer)).then(encoded => socket.send(encoded))

	}else if(parsed["type"] == "ice_canidate"){
		c.addIceCandidate(parsed["candidate"])
	}else{
		console.log(parsed)
	}
}



c.ondatachannel = function(evt){
	console.log(evt)
	let channel = evt.channel;


 	channel.onmessage = function(msg){
		console.log(msg.data)
		channel.send("PONG")
	}


}