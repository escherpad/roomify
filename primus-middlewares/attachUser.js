/** Created by ge on 5/20/15. */
"use strict";
module.exports = function AttachUser(UserModel) {
    return function attachUser(req, res, next) {
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
};
