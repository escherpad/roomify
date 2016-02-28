/**
 * Created by ge on 5/18/15.
 */
"use strict";
var chatExchange = 'ep.chat';

function join(message, done) {
    done(null, message);
}

function leave(message, done) {
    done(null, message);
}

// todo: need to remove from collection as well.
function ifEmptyClose(message) {
    done(null, message);
}

module.exports = {
    join: join,
    leave: leave
};
