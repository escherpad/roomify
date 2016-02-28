"use strict";

var _ = require('lodash');
var async = require('async');

module.exports = function dispatch(thisQue, primus, messageQue, agents, collections) {
    var chatExchange = 'ep.chat';
    var dispatch;

    dispatch = {
        toSparks: function (message, sparkIds, username) {
            console.log('============================toSparks=============================');
            if (!sparkIds) sparkIds = message.to._sparks || [message.to._spark];
            var spark, missing = [];
            for (var i = 0; i < sparkIds.length; i++) {
                spark = primus.spark(sparkIds[i]);
                if (spark && typeof spark.write == 'function') {
                    //console.log('spark:' + sparkIds[i] + ' is found in que: ' + thisQue + ' -------------------------------');

                    spark.write(message);
                } else {
                    // sparkId is unique within each que, so this is okay.
                    //console.log('spark:' + sparkIds[i] + ' is missing in que: ' + thisQue + ' ===============================' + spark);
                    missing.push(sparkIds[i]);
                }
            }
            var sparkId;
            for (var i = 0; i < missing.length; i++) {
                sparkId = missing[i];
                agents.remove(thisQue, username, sparkId, function (err) {
                    //console.log('the agent is removed: ', sparkId);
                });
            }
            return this;
        },
        toQue: function (message, que) {
            console.log('============================toQue=============================');
            if (!que)  que = message.to._que; // mostly not used
            messageQue.publish(chatExchange, que, message);
            return this;
        },
        // when notIn is passed, only to other ques.
        toQues: function (message, ques, notIn) {
            if (!ques) ques = message.to._ques || [message.to._que]; // mostly not used
            if (typeof notIn !== 'undefined') {
                for (var i = 0; i < ques.length; i++) {
                    if (ques[i] !== thisQue && notIn.indexOf(ques[i]) === -1) {
                        notIn.push(ques[i]);
                        this.toQue(message, ques[i]);
                    }
                }
            } else {
                for (var i = 0; i < ques.length; i++) {
                    if (ques[i] !== thisQue) {
                        this.toQue(message, ques[i]);
                    }
                }
            }
            return this;
        },
        toUsers: function (message, usernames, local) {
            console.log('============================toUsers=============================');
            if (!usernames) usernames = message.to.users || [message.to.user];
            console.log('dispatch.toUsers: message: ', message);
            var that = this;
            usernames.map(function (username) {
                console.log('getting user sparks for user: ', username);
                agents.getUserSparks(username, thisQue, function (err, sparkIds) {
                    console.log('sparkIds for ' + username + ': in que: ' + thisQue + ' --------------', sparkIds);
                    that.toSparks(message, sparkIds, username);
                });
            });
            if (local) return this;
            var usedQues = [];
            usernames.map(function (username) {
                agents.getUserQues(username, function (err, userQues) {
                    console.log('======> userQues: ', userQues);
                    that.toQues(message, userQues, usedQues);
                });
            });
            return this;
        },
        collections: []
    };
    // not tested yet
    collections.forEach(function(config){
        var room = config.room;
        dispatch.collections.push({
            collection: config.collection,
            handler: function (message, id, local) {
                if (!id) id = message.to[config.collection];
                room.get(id, function (err, modelObj) {
                    if (!modelObj) {
                        room.createHandle(id, message);
                    } else if (modelObj[config.keys.que] === thisQue) {
                        modelObj.transform(message, function (err, message) {
                            message.to.users = modelObj.getUsers();
                            delete message.to._que;
                            dispatch.toUsers(message);
                        });
                    } else if (!local) {
                        dispatch.toQue(message, modelObj[config.keys.que]);
                    } else {
                        //console.log('message is not sent to remote room. \n room: ', id, '\n message: ', JSON.stringify(message));
                    }
                }, true);
                return this;
            }
        });
    });
    return dispatch;
};
