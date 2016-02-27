/**
 * Created by ge on 5/18/15.
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module);
}
define(['underscore', 'async'],
    function (_, async) {
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

        return {
            join: join,
            leave: leave
        };
    }
);
