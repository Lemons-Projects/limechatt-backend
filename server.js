(async function() {
    const {WebSocketServer, WebSocket} = require('ws')
    const escape = require('escape-html')
    const {parse} = require('marked')
    const {load} = require('cheerio')
    const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

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
        ws.on('message', async (data) => {
            try {

                const parsedData = JSON.parse(data)
                const message = {
                    type: 'message', 
                    content: parsedData.content ? await (safelyParseMarkdown((parsedData.content).substring(0, 850))) : '', 
                    author: parsedData.author ? (parsedData.author).substring(0, 25) : '', 
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
                ws.send(JSON.stringify({type: 'error', response: 'Please send a valid JSON data.'}))
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
    async function safelyParseMarkdown(text) {
        const parsedMarkdown = parse(escape(text))
        const htmlParsed = load(parsedMarkdown, {}, false)

        const links = htmlParsed('a').toArray()
        const codeBlocks = htmlParsed('code').toArray()

        for(const element of links) {
            const parsedElement = htmlParsed(element)
            const href = parsedElement.attr('href')
            if(!href || !isValidUrl(href)) return
            const trusted = trustedSites.some(link => href.startsWith(link))
            if(!trusted) {
                parsedElement.addClass('untrusted-site')
            } else {
                parsedElement.addClass('trusted-site')
            }
            if(isValidUrl(href) && !href.startsWith('javascript:')) {
                parsedElement.after(`<br>${await createEmbedFromURL(trusted, href)}`)
            }
        }

        codeBlocks.forEach(element => {
            const parsedElement = htmlParsed(element)
            if (parsedElement.hasClass('language-spoiler')) {
                parsedElement.addClass('spoilered')
                parsedElement.attr('onclick', 'this.classList.toggle(\'show\')')
            }
        })

        return htmlParsed.html()
    }

    async function createEmbedFromURL(trusted, url) {
        const isTrusted = trusted? 'trusted' : 'untrusted'
        let title = ''
        let description = ''
        let imageURL = ''
        let large = false
        try {
            const siteContent = await fetchText(url)
            const $ = load(siteContent)
            title = $('meta[property="og:title"]').attr('content')
            description = $('meta[property="og:description"]').attr('content')
            imageURL = $('meta[property="og:image"]').attr('content')
            large = $('meta[name="twitter:card"]').attr('content') == 'summary_large_image'
        } catch {}
        if(title || description || imageURL) {
            const embed = `<div class="embed ${isTrusted}">
                        <h4 class="embed-title">${escape(title)}</h4><br>
                        <h5 class="embed-description">${escape(description)}</h5><br>
                        <img class="embed-image" src="${escape(imageURL)}">
                    </div>`
            const parsedEmbed = load(embed, {}, false)
            if(large) parsedEmbed('img').addClass('large-img')
            return parsedEmbed.html()
        } else {return ''}
    }

    function isValidUrl(url) {
        try {
            new URL(url)
            return true
        } catch (err) {
            return false
        }
    }

    async function fetchText(url) {
        return await (await fetch(url)).text()
    }
})()