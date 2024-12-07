const {WebSocketServer, WebSocket} = require('ws')
const escape = require('escape-html')
const {parse} = require('marked')
const {load} = require('cheerio')

const trustedSites = [
    'https://limechatt.github.io',
    'https://limechatt-slice.glitch.me',
    'https://developer.mozzila.org',
    'https://reactjs.org',
    'https://vuejs.org',
    'https://github.org',
    'https://npmjs.com',
    'https://youtube.com',
    'https://filegarden.com'
]

const wss = new WebSocketServer({port: 1050})

let messages = []
let message_limit = 750

wss.on('connection', ws => {
    ws.on('message', data => {
        try {

            const parsedData = JSON.parse(data)
            const message = {
                type: 'message', 
                content: parsedData.content ? safelyParseMarkdown((parsedData.content).substring(0, 850)) : '', 
                author: parsedData.author ? parsedData.author : '', 
                date: parsedData.date ? new Date(parsedData.date) : new Date('11/13/1987')
            }

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

/**
 * Parses the markdown as html
 * @param {string} text 
 */
function safelyParseMarkdown(text) {
    const parsedMarkdown = parse(escape(text))
    const htmlParsed = load(parsedMarkdown, {}, false)
    
    const links = htmlParsed('a').toArray()
    const codeBlocks = htmlParsed('code').toArray()

    links.forEach((element) => {
        const parsedElement = htmlParsed(element)
        const href = parsedElement.attr('href')
        if(href && !(trustedSites.some(link => href.startsWith(link)))) {
            parsedElement.addClass('untrusted-site')
        }
    })

    codeBlocks.forEach(element => {
        const parsedElement = htmlParsed(element)

        if(parsedElement.hasClass('language-spoiler')) {
            parsedElement.addClass('spoilered')
            parsedElement.attr('onclick', 'this.classList.toggle(\'show\')')
        }
    })

    return htmlParsed.html()
}