const {WebSocketServer, WebSocket} = require('ws')

const wss = new WebSocketServer({port: 1050})

let messages = []
let message_limit = 750

wss.on('connection', ws => {
    ws.on('message', data => {
        try {

            let parsedData = JSON.parse(data)
            let message = {type: 'message', content: parsedData.content ? parsedData.content : '', author: parsedData.author ? parsedData.author : '', 'date': parsedData.date ? parsedData.date : 'null'}

            switch(parsedData.type) {
                case 'sendMessage':
                    messages.push(message)

                    if(messages.length > message_limit) {
                        messages.shift()
                    }

                    sendDataToAllClients(JSON.stringify(message), wss)
                    break
                
                case 'getMessages':
                    ws.send(JSON.stringify({response: messages}))
                    break
            }
        } catch (error) {
            ws.send(`Please send a valid JSON data.\nError: ${error}`)
        }
    })
})

/**
 * @param {string} data - The data to send to all clients connected to the socket.
 * @param {WebSocketServer} server - The websocket server.
 */
function sendDataToAllClients(data, server) {
    server.clients.forEach(client => {
        if(client.readyState === WebSocket.OPEN) {
            client.send(data)
        }
    })
}
