/**
 * Created by ge on 5/20/15.
 */
"use strict";
module.exports = function attachUserMock(authData) {
    return function (req, res, next) {
        req.user = authData[req.query.username];
        if (!req.user) throw Error('can not find mock user in authData');
        next();
    };
};
