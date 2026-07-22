import WebSocket, { WebSocketServer } from 'ws';
import http from 'http';

let wss: WebSocketServer;

export const initWebSocket = (server: http.Server) => {
    wss = new WebSocketServer({ server });
    
    wss.on('connection', (ws: WebSocket) => {
        console.log("New WebSocket connection.");
        ws.on('close', () => console.log("WebSocket disconnected."));
    });
};

export const broadcastMessage = (message: any) => {
    if (!wss) return;
    wss.clients.forEach((client: WebSocket) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
};
