/**
 * Created by ge on 5/18/15.
 */
var _ = require('lodash'),
    http = require('http'),
    express = require('express'),
    mongoose = require('mongoose'),
    AttachUserMock = require('../primus-middlewares/attachUserMock.js'),
    async = require('async'),
    Primus = require('Primus'),
    expect = require('expect.js'),
    should = require('should');
var Roomify = require('../Roomify');

var socketConfig = {
    pathname: '/api/v1/stream',
    transformer: 'engine.io'
};
var ModelBuilder = require('mongoose-model-builder');
var AgentModel = ModelBuilder({
    user: String,
    que: String,
    spark: String,
    __index__: [
        {   'user': 1, 'que': 1, __options__: { unique: false } }
    ]
}, 'Agent');

var UserAccessFragment = ModelBuilder.SchemaBuilder({
    username: String,
    __options__: {  _id: false  }
}, 'UserAccessFragment');

var NoteModel = ModelBuilder({
    _que: String,
    title: String,
    text: String,
    users: [UserAccessFragment],
    usersLocal: [UserAccessFragment]
}, 'Note');

var userMockData = {
    user1: {username: 'user1'},
    user2: {username: 'user2'},
    user3: {username: 'user3'}
};

var roomifyConfig = {
    thisQue: null,
    agents: {
        add: function (agent, callback) {
            var _agent = new AgentModel(agent);
            return _agent.save(callback);
        },
        findOne: function (query, callback) {
            AgentModel.findOne(query, callback);
        },
        find: function (query, callback) {
            AgentModel.find(query, callback);
        }
    },
    collections: [{
        collection: 'note',
        //que: null,
        keys: {
            key: '_id',
            que: '_que',
            users: 'users',
            pluck: 'username'
        },
        //TransformConstructor: TransformConstructor,
        Model: NoteModel
    }]
};

function Server(instanceId, thisQue, MockUserList, fn) {
    var serverQue = ['chat-q', (instanceId || 0)].join('-');
    var app = express();
    app.set('port', 8000 + instanceId);

    // connect to the database
    mongoose.connect('mongodb://localhost:27017/roomifyTestDB', function (err) {
        console.log('mongoose: Database is connected');
    });
    mongoose.connection
        .on('error', console.error.bind(console, 'mongoose: connection error:'))
        .once('open', function callback() {
            console.log('mongoose: Database connection is OPEN.');
        });

    var server = http.createServer(app);
    var primus = new Primus(server, socketConfig);

    var roomify = Roomify(_.extend({}, roomifyConfig, {thisQue: thisQue}), primus, null);

    primus.before('attachUser', AttachUserMock(MockUserList));
    primus.on('connection', function (spark) {
        var req = spark.request;
        if (!req.user) {
            console.log('socket connection rejected. user not logged in.');
            spark.end({error: 'user not logged in.'}, {reconnect: false});
        } else {
            console.log('==> socket connection accepted. Que: ', thisQue, ' user: ', req.user.username, ' sparkId: ', spark.id);
            roomify.agents.add(thisQue, req.user.username, spark.id, function (err, doc) {
                console.log('agent.add err: ', err, '\n doc: ', doc);
            });
        }
        //console.log('the spark id is: ', spark.id);
        spark.on('data', function (message) {
            // only attach the from property if the message is an object.
            // this inlcude array (object), hash, and function.
            if (['object', 'function'].indexOf(typeof message) !== -1) {
                if (typeof message.from === 'undefined') message.from = {};
                message.from.user = req.user.username;
                message.from.que = thisQue;
                message.from.spark = spark.id;
            }
            //console.log('server: client data received.');
            roomify.socketRouter(message);
        });
    });
    primus.on('disconnection', function (spark) {
        console.log('socket is disconnected for user: ', spark.request.user.username, ' sparkId: ', spark.id);
        roomify.agents.remove(thisQue, spark.request.user.username, spark.id, function (err, doc) {
            if (err) console.log('agent.remove err: ', err, '\n doc: ', doc);
        });
    });
    //console.log('server is listening on port ', app.get('port'));
    server.listen(app.get('port'), fn);
    var serverSetup = {};
    serverSetup.que = thisQue;
    serverSetup.agents = roomify.agents;
    serverSetup.dispatch = roomify.dispatch;
    serverSetup.socketRouter = roomify.socketRouter;
    serverSetup.messageQueRouter = roomify.messageQueRouter;
    serverSetup.primus = primus;
    serverSetup.server = server;
    return serverSetup;
}

var server0, server1;

var messages = {
    toUser1: {
        to: {user: 'user1'},
        text: 'Oh, what a day! What a lovely day!'
    },
    toUser2: {
        to: {user: 'user2'},
        text: 'Oh, what a day! What a lovely day!'
    }
};

var serverSetups = {
    server0: function (done) {
        console.log('server0 is up and running...');
        server0 = Server(0, '0', userMockData, done);
    },
    server1: function (done) {
        console.log('server1 is up and running...');
        server1 = Server(1, '1', userMockData, done);
    }
};

async.parallel(serverSetups, function (err, results) {
    console.log('server setup just finished.');
    server0.dispatch.toQue = function (message, que) {
        console.log('=================server0 dispatch toQue is called==================');
        console.log('dispatch.toQue mock: message: ', message);
        var queMessage = {};
        queMessage.ack = function () {
            console.log('message is acknowledged.');
        };
        queMessage.body = message;
        if (typeof que === 'undefined') que = message.to._que;
        console.log('the que is: ', que);
        if (que === '1') server1.messageQueRouter(queMessage);
    };
    server1.dispatch.toQue = function (message, que) {
        console.log('=================server1 dispatch toQue is called==================');
        console.log('dispatch.toQue mock: message: ', message);
        var queMessage = {};
        queMessage.ack = function () {
            console.log('message is acknowledged.');
        };
        queMessage.body = message;
        if (typeof que === 'undefined') que = message.to.que;
        console.log('the que is: ', que);
        if (que === '0') server0.messageQueRouter(queMessage);
    };
});
describe('message routing test server: ', function (done) {
    var setup, Socket, clientA, clientB, clientC, clientD;
    beforeEach(function (done) {
        Socket = Primus.createSocket(socketConfig);
        clientA = new Socket('http://localhost:8000?username=user1');
        clientB = new Socket('http://localhost:8000?username=user2');
        clientC = new Socket('http://localhost:8001?username=user1');
        clientD = new Socket('http://localhost:8001?username=user2');
        var open = 0;

        function toFour() {
            open += 1;
            if (open === 4) done();
        }

        clientA.on('open', toFour);
        clientB.on('open', toFour);
        clientC.on('open', toFour);
        clientD.on('open', toFour);
    });
    afterEach(function (done) {
        clientA.end();
        clientB.end();
        clientC.end();
        clientD.end();
        setTimeout(done, 500);
    });
    it('can connect to client.', function (done) {
        console.log('client socket connection is open');
        done();
    });
    it('test Agent.js database query ADD is working properly', function (done) {
        server0.agents.add('0', 'yang.ge', 'xsasfsdfad', function (err, doc) {
            done();
        });
    });
    it('test Agent.js database query REMOVE is working properly', function (done) {
        server0.agents.remove('0', 'yang.ge', 'xsasfsdfad', function (err, doc) {
            done();
        });
    });
    it('one client should be able to send message to all the other clients but himself.', function (done) {
        var result = [];

        function check() {
            if (_.isEqual(result, ['clientB', 'clientD'])) done();
        }

        clientA.write(messages.toUser2);
        clientA.on('data', function (message) {
            console.log('client A received message: ', message);
            if (message.to.user === 'user1') {
                result.push('clientA');
                check();
            }
        });
        clientB.on('data', function (message) {
            console.log('client B received message: ', message);
            if (message.to.user === 'user2') {
                result.push('clientB');
                check();
            }
        });
        clientC.on('data', function (message) {
            console.log('client C received message: ', message);
            if (message.to.user === 'user1') {
                result.push('clientC');
                check();
            }
        });

        clientD.on('data', function (message) {
            console.log('client D received message: ', message);
            if (message.to.user === 'user2') {
                result.push('clientD');
                check();
            }
        });
    });
    // todo: agents `cache` mode. Right now the cache model is turned off.
});
describe('room routing: ', function (done) {
    var setup, note, message, Socket, clientA, clientB, clientC, clientD, clientE, clientF;
    beforeEach(function (done) {
        Socket = Primus.createSocket(socketConfig);
        clientA = new Socket('http://localhost:8000?username=user1');
        clientB = new Socket('http://localhost:8000?username=user2');
        clientC = new Socket('http://localhost:8000?username=user3');
        clientD = new Socket('http://localhost:8001?username=user1');
        clientE = new Socket('http://localhost:8001?username=user2');
        clientF = new Socket('http://localhost:8001?username=user3');
        var open = 0;

        function toSeven() {
            open += 1;
            if (open === 7) done();
        }

        clientA.on('open', toSeven);
        clientB.on('open', toSeven);
        clientC.on('open', toSeven);
        clientD.on('open', toSeven);
        clientE.on('open', toSeven);
        clientF.on('open', toSeven);

        note = {
            title: 'new note',
            users: [
                {username: 'user1'},
                {username: 'user2'}
            ]
        };
        new NoteModel(note).save(function (err, doc) {
            note = doc;
            message = {
                to: {note: doc._id},
                message: 'note broadcasting is working'
            };
            toSeven();
        });
    });
    afterEach(function (done) {
        clientA.end();
        clientB.end();
        clientC.end();
        clientD.end();
        clientE.end();
        clientF.end();
        setTimeout(done, 800);
    });
    it('can connect to client.', function (done) {
        console.log('client socket connection is open');
        done();
    });
    it('should be able to broadcast messages to all connected clients', function (done) {
        var result = [];

        function check() {
            if (_.includes(result, 'clientA') &&
                _.includes(result, 'clientB') &&
                _.includes(result, 'clientD') &&
                _.includes(result, 'clientE')) {
                done();
            }
            console.log(result);
        }

        clientA.write(message);
        clientA.on('data', function (message) {
            console.log('client A received message: ', message);
            result.push('clientA');
            check();

        });
        clientB.on('data', function (message) {
            console.log('client B received message: ', message);
            result.push('clientB');
            check();
        });
        clientC.on('data', function (message) {
            console.log('client C received message: ', message);
            result.push('clientC');
            check();
        });
        clientD.on('data', function (message) {
            console.log('client D received message: ', message);
            result.push('clientD');
            check();
        });
        clientE.on('data', function (message) {
            console.log('client E received message: ', message);
            result.push('clientE');
            check();
        });
        clientF.on('data', function (message) {
            console.log('client F received message: ', message);
            result.push('clientF');
            check();
        });
    });
});
