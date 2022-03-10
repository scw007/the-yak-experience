const { ClientCredentialsAuthProvider } = require('@twurple/auth');
const { ApiClient } = require('@twurple/api');
const { DirectConnectionAdapter, EventSubListener } = require('@twurple/eventsub');
const { NgrokAdapter } = require('@twurple/eventsub-ngrok');
const NodeCache = require("node-cache");
// const OBSWebSocket = require('obs-websocket-js');
const express = require('express');
const { stringReplace } = require('string-replace-middleware');
const WebSocket = require('ws');
const path = require('path');



const main = async () => {
    // setup cache
    const myCache = new NodeCache();

    // setup config and secrets
    const userId = process.env.USER_ID
    const clientId = process.env.CLIENT_ID 
    const clientSecret = process.env.CLIENT_SECRET 
    const eventSubSecret = process.env.EVENTSUB_SECRET
    const port = process.env.PORT
    const hostname = process.env.HOSTNAME
    const protocol = process.env.PROTOCOL || "wss"
    const ttl = process.env.TTL || 3600
    
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

    const eventHandler = (type, e) => {
        console.log(type, e.id)
        // handle duplicate events
        if (myCache.has(type+e.id)) {
            return
        }
        myCache.set(type+e.id, type+e.id, ttl)

        let payload = {
            type: type,
            title: e.title,
            choices: []
        }
        if (!!e.choices) {
            for (let i = 0; i < e.choices.length; i++) {
                let obj = {
                    title: e.choices[i].title,
                }
                switch (type) {
                    case 'poll_end':
                        obj.votes = e.choices[i].totalVotes;
                        break;
                } 
                payload.choices.push(obj) 
            }
        } else if (!!e.outcomes) {
            for (let i = 0; i < e.outcomes.length; i++) {
                let obj = {
                    title: e.outcomes[i].title,
                }
                switch (type) {
                    case 'prediction_lock':
                        obj.votes = e.outcomes[i].channelPoints;
                        break;
                    case 'prediction_end':
                        obj.votes = e.outcomes[i].channelPoints;
                        break;
                }
                payload.choices.push(obj) 
            }
        }
        payload = JSON.stringify(payload)
        console.log(payload)
        wss.clients.forEach(client => client.send(payload));
    }

    const pollBegin = await listener.subscribeToChannelPollBeginEvents(userId, e => {
        eventHandler('poll_begin', e)
    });

    const pollEnd = await listener.subscribeToChannelPollEndEvents(userId, e => {
        eventHandler('poll_end', e)
    });

    const predictionBegin = await listener.subscribeToChannelPredictionBeginEvents(userId, e => {
        eventHandler('prediction_begin', e)
    });

    const predictionLock = await listener.subscribeToChannelPredictionLockEvents(userId, e => {
        eventHandler('prediction_lock', e)
    });

    const predictionEnd = await listener.subscribeToChannelPredictionEndEvents(userId, e => {
        eventHandler('prediction_end', e)
    });

    await listener.listen();
}

main()
