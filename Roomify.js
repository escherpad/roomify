/** Created by ge on 2/28/16. */
var forEach = require('lodash/forEach');

var Agents = require('./Models/Agents.js');
var Rooms = require('./Models/Rooms.js');
var Dispatch = require('./handlers/dispatch.js');
var MessageQueRouter = require('./handlers/messageQueRouter.js');
var SocketRouter = require('./handlers/socketRouter.js');
var transformers = require('./transformers/transformers.js');


var TransformConstructor = function (room) {
    room.before('join', transformers.join);
    room.before('leave', transformers.leave);
};


function Roomify(roomifyConfig, primus, messageQue) {
    if (typeof roomifyConfig.thisQue === "undefined") throw Error('need "thisQue" in roomify config');
    if (typeof roomifyConfig.agents === "undefined") throw Error('need "agents" in roomify config');
    if (typeof roomifyConfig.collections === "undefined") throw Error('need "collections" in roomify config');

    var agents = new Agents(roomifyConfig.agents.add, roomifyConfig.agents.findOne, roomifyConfig.agents.find);


    forEach(roomifyConfig.collections, function (_config) {
        _config.que = roomifyConfig.thisQue;
        _config.room = new Rooms(_config);
    });

    var dispatch = Dispatch(roomifyConfig.thisQue, primus, messageQue, agents, roomifyConfig.collections);
    var socketRouter = SocketRouter(roomifyConfig.thisQue, dispatch);
    var messageQueRouter = MessageQueRouter(roomifyConfig.thisQue, dispatch);

    return {
        dispatch: dispatch,
        agents: agents,
        socketRouter: socketRouter,
        messageQueRouter: messageQueRouter,
        removeAgent: function () {
        },
        // removes all agents associated with que
        destroy: function () {
            //agents.remove(config.thisQue)
        }
    }
}

module.exports = Roomify;