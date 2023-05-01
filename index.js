const Client = require('./src/Client')

async function run() {
    const client = new Client({
        username: username,
        password: password
    })

    client.on('ready', console.log)
    client.on('newDM', function(data){
        console.log(data)
        // data.reply('woyyy')
    })
}

const username = 'veralsh_'
const password = 'Fazril180307_'

run()