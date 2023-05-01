const puppeteer = require('puppeteer')
const Utils = require('./Utils/Utils')
const CONST = require('./Utils/CONST')
const EventEmitter = require('events')
const axios = require('axios')
const API = require('./Utils/API')

class Client {
    constructor(options = {}) {
        if (!options.username && !options.password) throw new Error("Must input username and password on parameters")
        this.options = Utils.mergeDefault(CONST.DefaultOptions, options)
        this.browser = null
        this.page = null
        this.clientEvent = new EventEmitter()

        this.#initialize()
        return this.clientEvent
    }

    async #initialize() {
        let [browser, page] = [null, null];

        const puppeteerOpts = this.options.puppeteer;
        if (puppeteerOpts && puppeteerOpts.browserWSEndpoint) {
            browser = await puppeteer.connect(puppeteerOpts);
            page = await browser.newPage();
        } else {
            const browserArgs = [...(puppeteerOpts.args || [])];
            if (!browserArgs.find(arg => arg.includes('--user-agent'))) {
                browserArgs.push(`--user-agent=${this.options.userAgent}`);
            }

            browser = await puppeteer.launch({ ...puppeteerOpts, args: browserArgs });
            page = (await browser.pages())[0];
        }

        await page.setUserAgent(this.options.userAgent);
        if (this.options.bypassCSP) await page.setBypassCSP(true);

        this.browser = browser
        this.page = page;

        // (await browser.defaultBrowserContext()).overridePermissions('https://www.instagram.com/', ["notifications"]);

        await page.goto("https://www.instagram.com/", {
            waitUntil: 'load',
            timeout: 0,
            referer: 'https://instagram.com/'
        });
        await page.waitForSelector('[type=submit]', { timeout: this.options.authTimeoutMs })

        await page.type('[type=text]', this.options.username);
        await page.click('[type=text]')
        await page.type('[type=password]', this.options.password);
        await page.click('[type=submit]');

        await page.waitForNavigation()
        await page.goto('https://www.instagram.com/direct/inbox/');

        let profile = await API(`/api/v1/users/web_profile_info/?username=${this.options.username}`)
        this.clientEvent.emit('ready', profile.data)

        const client = await page.target().createCDPSession()
        await client.send('Network.enable');
        await client.send('Page.enable');

        client.on('Network.webSocketFrameReceived', ({ response }) => {
            const buff = (new Buffer.from(response.payloadData, 'base64')).toString('ascii')
            var json = Utils.extractJSON(buff)

            if (json.length) { json = json[0] }
            else return null

            // console.log(json[0].data[0])

            if (json.length)
                json.forEach(msg => {
                    if ('event' in msg)
                        switch (msg.event) {
                            case 'patch':
                                var value = Utils.extractJSON(msg.data[0].value || '[]')
                                if (!value.length) return null

                                const data = {
                                    dmID: msg.data[0].path.endsWith('/') ?
                                        /threads\/(.+?)\//.exec(msg.data[0].path)[1] :
                                        /threads\/(.+?)\//.exec(msg.data[0].path + '/')[1],
                                    ...value[0]
                                }
                                if (value[0].item_type) {
                                    data.reply = (text) => this.#reply(data, text)
                                }

                                // if (!data.send_attribution) return null
                                return this.clientEvent.emit('newDM', data)
                        }
                });
            else if ("presence_event" in json) this.clientEvent.emit('presence', json.presence_event)
            else if ("payload" in json)
                if ("ringRequest" in json.payload.body) this.clientEvent.emit('call', json.payload.body)
        })
    }

    async #reply(data, text) {
        const { dmID } = data
        const page = await this.browser.newPage()
        await page.goto(`https://www.instagram.com/direct/t/${dmID}/`, {
            waitUntil: 'load',
            timeout: 0,
            referer: 'https://instagram.com/'
        });
        await page.waitForSelector('textarea[placeholder="Message..."]', { timeout: this.options.authTimeoutMs })

        await page.type('textarea', text);
        await (await page.$x("//div[contains(text(), 'Send')]"))[0].click()

        setTimeout(async () => {
            await page.close()
        }, 3000);
    }
}

module.exports = Client