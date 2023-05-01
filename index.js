const Client = require('./src/Client')

async function run() {
    const client = new Client({
        username: username,
        password: password
    })

    client.on('ready', console.log)
    client.on('newDM', function(data){
        console.log(data)
        data.reply('whats up')
    })
}

const username = 'instagram_account'
const password = 'instagram_account_password'

run()