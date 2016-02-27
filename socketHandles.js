/**
 * @fileOverview Server Socket Definitions
 * @author Ge Yang
 * @type {_|exports}
 * @private
 */
define(['underscore', '../chatServer/handlers/chatHandlers'],
    function (_, chatHandlers) {
        "use strict";

        // two types of routing is supported:
        // 1. by room,
        // 2. by clientId
        var handlers = [
        /** NOT covered in api test. */
            // All other get requests should be handled by AngularJS's client-side routing system
            {
                path: 'spark',
                handler: chatHandlers.toSpark
            },
            //{
            //    path: 'clients/:clientId',
            //    action: 'join',
            //    handler: chatHandlers.toClient
            //}
        ];

        var Handlers = {
            onConnected: function(spark) {
            }
        };
        _.each(handlers, function (handler) {
            Handlers[[handler.action, handler.path].join(':')] = handler;
        });
        return Handlers;
    });

