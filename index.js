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
    const protocol = process.env.PROTOCOL || "wss"
    
    // setup http and ws server
    const wss = new WebSocket.Server({ 
        noServer: true,
        path: "/websockets",
    });
    wss.on("connection", (ws) => {
        let id = setInterval(function() {
            ws.send(JSON.stringify({
                type: 'ping',
                message: new Date()
            }), function() {  })
        }, 1000)

        ws.on("close", function() {
            clearInterval(id)
        })
    });
    const app = express();
    app.use(stringReplace({
        'HOSTNAME': hostname,
        'PROTOCOL': protocol
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

    // const redemptionAdd = await listener.subscribeToChannelRedemptionAddEvents(userId, e => {
    //     const msg = `${e.userDisplayName} just redeemed ${e.rewardTitle}! ${e.input}`
    //     const payload = {
    //         type: 'message',
    //         message: msg
    //     }
        
    //     wss.clients.forEach(client => client.send(JSON.stringify(payload)));
    // });
    const pollBegin = await listener.subscribeToChannelPollBeginEvents(userId, e => {
        let payload = {
            type: 'poll_begin',
            title: e.title,
            choices: []
        }
        for (let i = 0; i < e.choices.length; i++) {
            payload.choices.push({
                title: e.choices[i].title,
                votes: 0
            })
        }
        payload = JSON.stringify(payload)
        console.log(payload)
        wss.clients.forEach(client => client.send(payload));
    });
    // const pollInProgress = await listener.subscribeToChannelPollProgressEvents(userId, e => {
    //     let payload = {
    //         type: 'poll_in_progress',
    //         title: e.title,
    //         choices: []
    //     }
    //     for (let i = 0; i < e.choices.length; i++) {
    //         payload.choices.push({
    //             title: e.choices[i].title,
    //             votes: e.choices[i].totalVotes
    //         })
    //     }
    //     payload = JSON.stringify(payload)
    //     console.log(payload)
    //     wss.clients.forEach(client => client.send(payload));
    // });
    const pollEnd = await listener.subscribeToChannelPollEndEvents(userId, e => {
        let payload = {
            type: 'poll_end',
            title: e.title,
            choices: []
        }
        for (let i = 0; i < e.choices.length; i++) {
            payload.choices.push({
                title: e.choices[i].title,
                votes: e.choices[i].totalVotes
            })
        }
        payload = JSON.stringify(payload)
        console.log(payload)
        wss.clients.forEach(client => client.send(payload));
    });

    await listener.listen();
}

main()
