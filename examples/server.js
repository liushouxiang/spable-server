var path = require('path');
var spaServer = require('../index.js');

spaServer({
	serverConfDir: path.join(__dirname, 'conf/server.conf'),
	entry: path.join(__dirname, 'entry.js')
});