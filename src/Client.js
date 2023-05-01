const puppeteer = require('puppeteer')
const Utils = require('./Utils/Utils')
const CONST = require('./Utils/CONST')
const EventEmitter = require('events')

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

        const profile = await browser.newPage()
        await profile.goto("https://www.instagram.com/" + this.options.username, {
            waitUntil: 'load',
            timeout: 0,
            referer: 'https://instagram.com/'
        });
        profile.on('response', async (response) => {
            if (await response.url().startsWith('https://www.instagram.com/api/v1/users/web_profile_info/?username=')) {
                this.clientEvent.emit('ready', (await response.json()).data.user)
                profile.close()
            }

        })

        const client = await page.target().createCDPSession()
        await client.send('Network.enable');
        await client.send('Page.enable');

        // this.clientEvent.emit('ready', 'ready')
        // `{"client_context":"7058579641524101933","device_id":"FAC22A0E-B936-4417-A6D5-44589674571C","action":"send_item","item_type":"text","mutation_token":"7058579641492239905","text":"bang","thread_id":"340282366841710301244276158232444183473"}`
        // `{"client_context":"7058579898653981318","device_id":"FAC22A0E-B936-4417-A6D5-44589674571C","action":"send_item","item_type":"text","mutation_token":"7058579898626304721","text":"bang","thread_id":"340282366841710301244276158232444183473"}`
        // [{"event":"patch","data":[{"op":"add","path":"/direct_v2/threads/340282366841710301244276158232444183473/items/31044085271868279333056426983555072","value":"{\"item_id\":\"31044085271868279333056426983555072\",\"user_id\":58511342766,\"timestamp\":1682903234729242,\"item_type\":\"text\",\"client_context\":\"7058607763398958242\",\"show_forward_attribution\":false,\"forward_score\":null,\"is_shh_mode\":false,\"otid\":\"7058607763398958242\",\"is_btv_send\":false,\"send_attribution\":\"direct_thread\",\"text\":\"woy bang\"}"}],"message_type":1,"seq_id":25560,"tq_seq_id":null,"mutation_token":"7058607763398958242","realtime":true}]
        // {"presence_event":{"user_id":"58511342766","is_active":false,"last_activity_at_ms":"1682903255000","in_threads":null}}
        client.on('Network.webSocketFrameReceived', ({ response }) => {
            const buff = (new Buffer.from(response.payloadData, 'base64')).toString('ascii')
            var json = Utils.extractJSON(buff)

            if (json.length) { json = json[0] }
            else return null

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
                                if(value[0].item_type){
                                    data.reply = (text) => this.#reply(data, text)
                                }

                                if(!data.send_attribution) return null
                                this.clientEvent.emit('newDM', data)
                                break
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

        setTimeout(async() => {
            await page.close()
        }, 3000);
    }
}

module.exports = Client