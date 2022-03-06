const { ClientCredentialsAuthProvider } = require('@twurple/auth');
const { ApiClient } = require('@twurple/api');
const { DirectConnectionAdapter, EventSubListener } = require('@twurple/eventsub');
const { NgrokAdapter } = require('@twurple/eventsub-ngrok');
// const OBSWebSocket = require('obs-websocket-js');
const express = require('express');
const WebSocket = require('ws');
const path = require('path');

const Config = require('./config.json')
const Secret = require('./secret.json')

const main = async () => {
    // setup config and secrets
    const userId = Config.user_id;
    const clientId = Secret.client_id;
    const clientSecret = Secret.client_secret;
    const eventSubSecret = Secret.eventsub_secret;
    // const obsSecret = Secret.obs_secret;

    // setup obs
    // const obs = new OBSWebSocket();
    // obs.connect({ address: 'localhost:4444', password: obsSecret });
    
    // setup browser source
    const app = express();
    app.use(express.static(path.join(__dirname, 'public')));
    const server = app.listen(3000);

    // setup ws server
    const wss = new WebSocket.Server({ port: 1234 });
    wss.on('connection', function connection(ws) {
        ws.on('message', function message(data) {
            console.log(data)
            wss.clients.forEach(function each(client) {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(data)
                }
            });
        });
    });

    // setup twitch api
    /*
    const logger = {
        minLevel: 'debug'
    }
    const authProvider = new ClientCredentialsAuthProvider(clientId, clientSecret);
    const apiClient = new ApiClient({ authProvider, logger });
    const adapter = new NgrokAdapter();
    const listener = new EventSubListener({ apiClient, adapter, secret: eventSubSecret, logger });

    await apiClient.eventSub.deleteAllSubscriptions()

    const onlineSubscription = await listener.subscribeToStreamOnlineEvents(userId, async e => {
        console.log(`${e.broadcasterDisplayName} just went live!`);
        // try {
        //     await obs.send('SetCurrentScene', {
        //         'scene-name': 'Scene 2'
        //     })
        // } catch (err) {
        //     console.log(err)
        // }
    });
    const offlineSubscription = await listener.subscribeToStreamOfflineEvents(userId, e => {
        console.log(`${e.broadcasterDisplayName} just went offline`);
    });

    let subscriptions = await apiClient.eventSub.getSubscriptions(userId)
    console.log(subscriptions)

    await listener.listen();
    */
}

main()
