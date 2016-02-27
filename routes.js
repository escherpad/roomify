/**
 * @fileOverview Server routing configurations
 * @author Ge Yang
 * @type {_|exports}
 * @private
 */
define(['underscore', 'path', 'passport', '../api-server/rolesHelper', '../api-server/user/authCtrl'],
    function (_, path, passport, rolesHelper, AuthCtrl) {
        "use strict";
        var accessLevels = rolesHelper.accessLevels;
        var userRoles = rolesHelper.userRoles;

        function ensureAuthorized(req, res, next) {
            var role, route, accessLevel;
            if (!req.user) {
                role = userRoles.public;
            } else {
                role = req.user.role;
            }
            route = _.findWhere(routes,
                {
                    path: req.route.path,
                    httpMethod: req.method.toUpperCase()
                });
            if (route) {
                accessLevel = route.accessLevel || accessLevels.all;
            } else {
                accessLevel = accessLevels.all;
            }
            if (!(accessLevel.bitMask & role.bitMask)) return res.send(401);
            return next();
        }

        var routes = [
            {
                path: '/api/v1/register',
                httpMethod: 'POST',
                middleware: [AuthCtrl.register],
                accessLevel: accessLevels.all
            },
            {
                path: '/api/v1/login',
                httpMethod: 'POST',
                middleware: [AuthCtrl.login],
                accessLevel: accessLevels.all
            },
            {
                path: '/api/v1/logout',
                httpMethod: 'POST',
                middleware: [AuthCtrl.logout],
                accessLevel: accessLevels.all
            },
            // All other get requests should be handled by AngularJS's client-side routing system
            {
                path: '/*',
                httpMethod: 'GET',
                middleware: [
                    function (req, res) {
                        var role = userRoles.public, username = '', id = '', email = '';
                        if (req.user) {
                            role = req.user.role;
                            username = req.user.username;
                            id = req.user.id;
                            email = req.user.email;
                        }
                        /* this catch all is sort of hacky, which is why it took me so long to figure out how to set the cookie */
                        res.cookie('user', JSON.stringify({
                            'username': username,
                            'role': role,
                            'id': id,
                            'email': email
                        }));
                        res.render('index');
                    }
                ]
            }
        ];

        function httpMethodRecitifier(route) {
            route.httpMethod = route.httpMethod.toUpperCase();
        }

        _.each(routes, httpMethodRecitifier);
        return function (app) {
            _.each(routes, function (route) {
                if (route.developmentOnly && (process.env.NODE_ENV && process.env.NODE_ENV !== 'development')) {
                    return console.log('route is for test only, will not appear in production.\n ' +
                        'only development environment is allowed.');
                }
                route.middleware.unshift(ensureAuthorized);
                var args = _.flatten([route.path, route.middleware]);
                // console.log(route.path + route.httpMethod);
                switch (route.httpMethod.toUpperCase()) {
                    case 'GET':
                        app.get.apply(app, args);
                        break;
                    case 'POST':
                        app.post.apply(app, args);
                        break;
                    case 'PATCH':
                        app.patch.apply(app, args);
                        break;
                    case 'PUT':
                        app.put.apply(app, args);
                        break;
                    case 'DELETE':
                        app.delete.apply(app, args);
                        break;
                    default:
                        throw new Error('Invalid HTTP method specified for route ' + route.path);
                        break;
                }
            });
        };
    }
);

