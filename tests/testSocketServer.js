/** Created by ge on 5/18/15. */

var http = require('http'),
    express = require('express'),
    Primus = require('Primus');

var socketConfig = {
    pathname: '/api/v1/stream',
    transformer: 'engine.io'
};
function Server(instanceId, fn) {
    var app = express();
    app.set('port', instanceId + 8000);
    var server = http.createServer(app); // app is not necessary.
    var upgrades = []
        , requests = [];

    server.on('request', function incoming(req, res) {
        requests.push(res);
    });

    server.on('upgrade', function upgrade(req, socket) {
        upgrades.push(socket);
    });
    var primus = new Primus(server, socketConfig);
    primus.on('connection', function (spark){
        console.log('server: client is connected.');
        spark.write('first message sent from server to client after connection.');

        spark.on('data', function(data){
            console.log('client data received: ', data);
            spark.write(data);
        })
    });
    console.log('app start listening... on port: ', app.get('port'));
    server.listen(app.get('port'), fn);

    this.primus = primus;
    this.server = server;
    return this;
}

var server = Server(0, function(){console.log('setup callback: server is setup!');});
var Socket = Primus.createSocket(socketConfig);
var client = new Socket('http://localhost:8000');

client.on('open', function(spark){
    console.log('client: connection is open.');
});
client.on('data', function(data){
    console.log('data received: ', data);
    client.write({ping: 'ping'});
});
