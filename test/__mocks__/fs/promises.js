process.chdir('/');
const { fs } = require('memfs');
module.exports = fs.promises;
