/**
 * Created by ge on 5/20/15.
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module);
}
define(['underscore', '../../api-server/user/UserModel.js'],
    function (_, UserModel) {
        "use strict";
        return function (req, res, next) {
            if (!req.session.passport || !req.session.passport.user) {
                req.user = undefined;
            } else {
                UserModel.deserializeUser(req.session.passport.user, function (err, user) {
                    if (err || !user) {
                        next(err || 'user not found');
                    } else {
                        req.user = user.toObject();
                        next();
                    }
                });
            }
        };
    });

