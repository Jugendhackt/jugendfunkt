const express = require('express');
const app = express();


const WebSocketServer = require('ws').Server;
const WebSocket = require('ws');
const wss = new WebSocketServer({host: '127.0.0.1', port: 3000});


wss.on('connection', function(conn){


	conn.on('message', function(msg){
		wss.clients.forEach(function(c){
			if(c.readyState === WebSocket.OPEN){
				c.send(msg);
			}	
		});
	});
});


