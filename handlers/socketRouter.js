if (typeof define !== 'function') {
    var define = require('amdefine')(module);
}
define([], function () {
    "use strict";
    return function (thisQue, primus, dispatch) {
        var chatExchange = 'ep.chat';
        return function (message) {
            //console.log('socketRouter: message: ', message);
            if (!message.to) {
                // do something
            } else if (message.to._que) {
                dispatch.toQue(message);
            } else if (message.to._ques) {
                dispatch.toQues(message);
            } else if (message.to._spark || message.to._sparks) {
                dispatch.toSparks(message);
            } else if (message.to.user || message.to.users) {
                dispatch.toUsers(message);
            //} else if (message.to.room) {
            //    dispatch.toRoom(message);
            } else {
                for (var i = 0; i < dispatch.collections.length; i++) {
                    var config = dispatch.collections[i];
                    if (message.to[config.collection]) {
                        return config.handler(message);
                    }
                }
                console.log('Error: socket message recipient not recognized: ', message);
            }
        };
    };
});
