console.log("Starting up")
let config = {"iceServers":[{url:'stun:stun.1.google.com:19302'},{url:'turn:numb.viagenie.ca',credential: 'muazkh', username: 'webrtc@live.com'}]};

let c = null;
let socket = new WebSocket("ws://10.23.41.224:3000")
let sendChannel = null;
let role = null;
let channels = []

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

		dataChannel.onopen =  function(channel){


			channels.push(dataChannel)
			console.log(channels)

			broadcast("New User connected")
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

	//sendchannel ist zum Server
	console.log("the server wrote", evt.data)
}

function broadcast(msg){
	channels.forEach(function(client, index){
		try{
			client.send(msg)
		}catch(err){
			console.log("user disconnected")
			channels = channels.splice(index, 1);
		}
		
	})
}