if (typeof define !== 'function') {
    var define = require('amdefine')(module);
}
define([], function () {
    "use strict";
    return function (thisQue, primus, dispatch) {
        return function (rawMessage) {
            console.log('messageQue handler got message!');
            rawMessage.ack();
            var message = rawMessage.body;
            if (!message.to) {
                return console.log('the message does not have a "to" field.');
            } else if (message.to._spark || message.to._sparks) {
                dispatch.toSparks(message);
            } else if (message.to.user || message.to.users) {
                dispatch.toUsers(message, null, true);
            //} else if (message.to.room) {
            //    dispatch.toRoom(message, null, true);
            } else {
                for (var i = 0; i < dispatch.collections.length; i++) {
                    var config = dispatch.collections[i];
                    if (message.to[config.collection]) {
                        return config.handler(message, null, true);
                    }
                }
                console.log('Error: messageQue message recipient not recognized: ', message);
            }
        };
    };
});
