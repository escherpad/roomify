/**
 * Created by ge on 5/18/15.
 */
var _ = require('lodash'),
// server setup library files
    http = require('http'),
    express = require('express'),
    mongoose = require('mongoose'),
    AttachUserMock = require('../primus-middlewares/attachUserMock.js'),
    async = require('async'),
    Primus = require('Primus'),
    expect = require('expect.js'),
    should = require('should');
var prefix = require('superagent-prefix');

var Agents = require('../Models/Agents.js');
var Rooms = require('../Models/Rooms.js');
var Dispatch = require('../handlers/dispatch.js');
var MessageQueRouter = require('../handlers/messageQueRouter.js');
var SocketRouter = require('../handlers/socketRouter.js');
var transformers = require('../transformers/transformers.js');
var TransformConstructor = function (room) {
    room.before('join', transformers.join);
    room.before('leave', transformers.leave);
};
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
        {
            'user': 1,
            'que': 1,
            __options__: {unique: false}
        }
    ]
}, 'Agent');

var Schema = mongoose.Schema;
var UserAccessFragment = ModelBuilder.SchemaBuilder({
    username: String,
    __options__: {
        _id: false
    }
}, 'UserAccessFragment');

var NoteModel = ModelBuilder({
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

function Server(instanceId, thisQue, MockUserList, fn) {
    var serverQue = ['chat-q', (instanceId || 0)].join('-');
    var thisQue = String(instanceId || 0);
    var app = express();
    app.set('port', 8000 + instanceId);

    // connect to the database
    var db_url = process.env.EP_MONGODB_URI || process.env.EP_MONGODB_URI_TEST || 'mongodb://localhost:27017/roomifyTestDB';
    console.log('database: ' + db_url);
    mongoose.connect(db_url, function (err) {
        console.log('mongoose: Database is connected');
    });

    var db = mongoose.connection;
    db.on('error', console.error.bind(console, 'mongoose: connection error:'));
    db.once('open', function callback() {
        console.log('mongoose: Database connection is OPEN.');
    });

    var server = http.createServer(app);
    var primus = new Primus(server, socketConfig);
    var agents = new Agents(
        function (agent, callback) {
            var _agent = new AgentModel(agent);
            return _agent.save(callback);
        },
        function (query, callback) {
            AgentModel.findOne(query, callback);
        },
        function (query, callback) {
            AgentModel.find(query, callback);
        });
    var noteConfig = {
        collection: 'note',
        que: thisQue,
        keys: {
            key: '_id',
            que: '_que',
            users: 'users',
            pluck: 'username'
        },
        agents: agents,
        constructor: TransformConstructor,
        Model: NoteModel
    };

    var Notes = Rooms(noteConfig.que, noteConfig.keys, noteConfig.agents, noteConfig.constructor, noteConfig.Model);
    var notes = new Notes();

    var collections = [{
        collection: 'note',
        keys: noteConfig.keys,
        models: notes
    }];

    var dispatch = Dispatch(thisQue, primus, agents, collections);
    var socketRouter = SocketRouter(thisQue, primus, dispatch);
    var messageQueRouter = MessageQueRouter(thisQue, primus, dispatch);

    // here are the toQue mock
    //dispatch.toQue = function (message, que) {
    //    if (!que) que = message._routing.que;
    //    console.log('to que: ', que, '\\n', message);
    //};

    primus.before('attachUser', AttachUserMock(MockUserList));
    primus.on('connection', function (spark) {
        var req = spark.request;
        if (!req.user) {
            console.log('socket connection rejected. user not logged in.');
            spark.end({error: 'user not logged in.'}, {reconnect: false});
        } else {
            console.log('socket connection accepted. --------- Que: ', thisQue, ' user: ', req.user.username, ' sparkId: ', spark.id);
            agents.add(thisQue, req.user.username, spark.id, function (err, doc) {
                //console.log('agent.add err: ', err, '\n doc: ', doc);
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
            socketRouter(message);
        });
    });
    primus.on('disconnection', function (spark) {
        console.log('socket is disconnected for user: ', spark.request.user.username, ' sparkId: ', spark.id);
        agents.remove(thisQue, spark.request.user.username, spark.id, function (err, doc) {
            //console.log('agent.add err: ', err, '\n doc: ', doc);
        });
    });
    //console.log('server is listening on port ', app.get('port'));
    server.listen(app.get('port'), fn);
    var serverSetup = {};
    serverSetup.que = thisQue;
    serverSetup.agents = agents;
    serverSetup.dispatch = dispatch;
    serverSetup.socketRouter = socketRouter;
    serverSetup.messageQueRouter = messageQueRouter;
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
        text: 'It is a great day out there!'
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
        console.log('server0 dispatch toQue is called');
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
        console.log('server1 dispatch toQue is called');
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
if (typeof describe !== 'undefined') {
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
} else {
    // if the code is running without the mochaTest environment, run the following test to make sure the server/client connection is proper.
    var server = Server(0, '0', userMockData[1], function () {
        console.log('server is running...')
    });
    var Socket = Primus.createSocket(socketConfig);
    var client = new Socket('http://localhost:8000');

    client.on('open', function (spark) {
        console.log('client: connection is open.');
    });
    client.on('data', function (data) {
        console.log('data received: ', data);
        client.write({ping: 'ping'});
    });
}

