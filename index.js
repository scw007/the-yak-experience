const { ClientCredentialsAuthProvider } = require('@twurple/auth');
const { ApiClient } = require('@twurple/api');
const { DirectConnectionAdapter, EventSubListener } = require('@twurple/eventsub');
const { NgrokAdapter } = require('@twurple/eventsub-ngrok');
// const OBSWebSocket = require('obs-websocket-js');
const express = require('express');
const { stringReplace } = require('string-replace-middleware');
const WebSocket = require('ws');
const path = require('path');


const main = async () => {
    // setup config and secrets
    const userId = process.env.USER_ID
    const clientId = process.env.CLIENT_ID 
    const clientSecret = process.env.CLIENT_SECRET 
    const eventSubSecret = process.env.EVENTSUB_SECRET
    const port = process.env.PORT
    const hostname = process.env.HOSTNAME
    
    // setup http and ws server
    const wss = new WebSocket.Server({ 
        noServer: true,
        path: "/websockets",
    });
    const app = express();
    app.use(stringReplace({
        'HOSTNAME': hostname,
    }));
    app.use(express.static(path.join(__dirname, 'public')));
    const server = app.listen(port);
    server.on('upgrade', (request, socket, head) => {
        wss.handleUpgrade(request, socket, head, socket => {
            wss.emit('connection', socket, request);
        });
    });

    // setup twitch pubsub
    const logger = {
        minLevel: 'debug'
    }
    const authProvider = new ClientCredentialsAuthProvider(clientId, clientSecret);
    const apiClient = new ApiClient({ authProvider, logger });
    let adapter
    if (hostname !== "") {
        adapter = new NgrokAdapter();
    } else {
        adapter = new EnvPortAdapter({ hostName: "https://" + hostname });
    }
    const listener = new EventSubListener({ apiClient, adapter, secret: eventSubSecret, logger });

    await apiClient.eventSub.deleteAllSubscriptions()

    const redemptionAdd = await listener.subscribeToChannelRedemptionAddEvents(userId, e => {
        msg = `${e.userDisplayName} just redeemed ${e.rewardTitle}! ${e.input}`
        wss.clients.forEach(client => client.send(msg));
    });

    await listener.listen();
}

main()
