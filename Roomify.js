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


function Roomify(config, primus) {
    if (typeof config.thisQue === "undefined") throw Error('need "thisQue" in roomify config');
    if (typeof config.agents === "undefined") throw Error('need "agents" in roomify config');
    if (typeof config.collections === "undefined") throw Error('need "collections" in roomify config');

    var agents = new Agents(config.agents.add, config.agents.findOne, config.agents.find);


    forEach(config.collections, function (config) {
        config.room = new Rooms(config);
    });

    var dispatch = Dispatch(config.thisQue, primus, agents, config.collections);
    var socketRouter = SocketRouter(config.thisQue, primus, dispatch);
    var messageQueRouter = MessageQueRouter(config.thisQue, primus, dispatch);

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