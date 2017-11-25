const express = require('express');
const app = express();


const WebSocketServer = require('ws').Server;
const WebSocket = require('ws');
const wss = new WebSocketServer({host: '0.0.0.0', port: 3000});


wss.on('connection', function(conn){
	broadcast(conn, JSON.stringify({"type": "new_client"}))

	conn.on('message', function(msg){
		broadcast(conn, msg)
	});
});

function broadcast(sender, msg){
	wss.clients.forEach(function(c){
			if(c.readyState === WebSocket.OPEN && sender != c){
				c.send(msg);
			}	
	});
}
