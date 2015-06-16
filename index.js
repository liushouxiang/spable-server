var fs = require('fs');
var url = require('url');
var path = require('path');
var http = require('http');
var split = require('split');
var through2 = require('through2');

function SPAServer () {
	this.middleware = [];
	this.server = http.createServer();
}

SPAServer.prototype.use = function (handler) {
	this.middleware.push(handler);
};

SPAServer.prototype.listen = function (port) {
	var self = this;
	this.server.on('request', function (req, res) {
		var stack = self.middleware.slice(0);
		var next = function (err) {
			var handler = stack.shift();
			if (handler) {
				handler(err, req, res, next);
			}
		};
		next();
	});
	this.server.listen(port);
};

function handleStaticRequest () {
	var mime = {
		'css': 'text/css',
		'js': 'text/javascript',
		'jpg': 'image/jpeg',
		'jpeg': 'image/jpeg',
		'png': 'image/png',
		'gif': 'image/gif',
		'html': 'text/html',
		'htm': 'text/html'
	};
	return function (err, req, res, next) {
		if (err) {
			next(err);
			return;
		}
		var pathname = url.parse(req.url).pathname;
		var extname = path.extname(pathname).substr(1);
		pathname = path.join(config.webroot, pathname);
		if (mime[extname]) {
			fs.exists(pathname, function (exists) {
				if (exists) {
					res.writeHead(200, {
						'Content-Type': mime[extname]
					});
					fs.createReadStream(pathname).pipe(res);
				} else {
					res.writeHead(404);
					res.end();
				}
			});

		} else {
			next();
		}
	}
}

function handleJSONRequest () {
	var match = function (url, next) {
		var jsonPath = null;
		return through2(function (chunk, enc, cb) {
			if (String.fromCharCode(chunk[0]) !== '#') {
				var reg = /(.*)\s+(.*)/;
				var line = chunk.toString('utf8');
				var arr = reg.exec(line);
				if (arr && new RegExp(arr[1]).test(url)) {
					jsonPath = arr[2];
				}
			}
			cb();
		}, function (cb) {
			if (!jsonPath) {
				next();
			} else {
				this.push(jsonPath);
			}
			cb();
		});
	};

	return function (err, req, res, next) {
		if (err) {
			next(err);
			return;
		}
		if (!fs.existsSync(config.conf)) {
			var err = new Error('can not find config file, please check!');
			next(err);
			return;
		}
		fs.createReadStream(config.conf)
		.pipe(split())
		.pipe(match(req.url, next))
		.pipe(through2(function (chunk, enc, cb) {
			var jsonPath = chunk.toString('utf8');
			jsonPath = path.join(config.webroot, jsonPath);
			var exists = fs.existsSync(jsonPath);
			if (exists) {
				res.writeHead(200, {
					'Content-Type': 'application/json'
				});
				fs.createReadStream(jsonPath).pipe(res);
			} else {
				res.writeHead(404);
				res.end();
			}
			cb();
		}));
	};
}

function handleEntryRequest (err, req, res, next) {
	if (err) {
		next(err);
		return;
	}
	var extname = path.extname(config.entry).substr(1);
	var pathname = path.join(config.webroot, config.entry);
	if (extname === 'js') {
		try {
			var entry = require(pathname);
			entry(req, res);
		} catch (err) {
			next(err);
		}
		next();
	} else {
		res.writeHead(200, {
			'Content-Type': 'text/html'
		});
		fs.createReadStream(pathname).pipe(res);
		next();
	}
}

function handleException (err, req, res) {
	if (err) {
		console.dir(err);
		res.writeHead(500);
		res.end();
	}
}

var config;
module.exports = function (options) {
	config = options || {};
	if (!config.webroot) {
		throw new Error('webroot must be specified.');
		return;
	}
	if (!config.conf) {
		throw new Error('conf must be specified.');
		return;
	}
	config.entry = config.entry || './index.html';
	var server = new SPAServer();
	server.use(handleStaticRequest());
	server.use(handleJSONRequest());
	server.use(handleEntryRequest);
	server.use(handleException);
	server.listen(config.port || 8888);
};