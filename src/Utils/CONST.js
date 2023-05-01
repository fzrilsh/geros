exports.DefaultOptions = {
    puppeteer: {
        headless: true,
        defaultViewport: null,
        args: [ '--no-sandbox', '--disable-setuid-sandbox' ]
    },
    authTimeoutMs: 0,
    qrMaxRetries: 0,
    takeoverOnConflict: false,
    takeoverTimeoutMs: 0,
    // userAgent: 'Instagram 76.0.0.15.395 Android (24/7.0; 640dpi; 1440x2560; samsung; SM-G930F; herolte; samsungexynos8890; en_US; 138226743)',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.67 Safari/537.36',
    ffmpegPath: 'ffmpeg',
    bypassCSP: false,
    username: null,
    password: null,
    instagram: 'https://www.instagram.com'
};  