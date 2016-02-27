/**
 * Created by ge on 5/20/15.
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module);
}
define([], function () {
    "use strict";
    return function (authData) {
        return function (req, res, next) {
            req.user = authData[req.query.username + 'Stub'];
            next();
        };
    };
});
