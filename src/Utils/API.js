const axios = require('axios')

/**
 * @param {string} path 
 * @returns {object} object
 */
module.exports = async(path) => (await axios.request({
    method: 'get',
    maxBodyLength: Infinity,
    url: 'https://www.instagram.com' + path,
    headers: {
        'User-Agent': 'Instagram 85.0.0.21.100 Android (23/6.0.1; 538dpi; 1440x2560; LGE; LG-E425f; vee3e; en_US',
    }
})).data