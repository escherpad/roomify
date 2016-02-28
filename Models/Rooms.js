/**
 * Created by ge on 5/13/15.
 */
"use strict";
var _ = require('lodash');
var async = require('async');

// example
//var room = new Room('chat room 6');
//room.transform(message).broadcast();
//room.exclude('yang.ge').transform(message).broadcast();

module.exports = function Rooms (thisQue, keys, agents, TransformConstructor, RoomModel) {

    function Constructor(room) {
        room._transformers = {};
        room._transformerOrder = [];

        if (!room[keys.que]) room[keys.que] = thisQue;
        room.save();

        room.getUsers = function () {
            if (keys.map) {
                return _.map(this[keys.users], keys.map);
            } else {
                return this[keys.users];
            }
        };

        room.close = function (callback) {
            // does not remove from collection
            this.remove(callback);
            return this;
        };

        room.before = function (key, transformer) {
            this._transformers[key] = transformer;
            if (this._transformerOrder.indexOf(key) == -1) {
                this._transformerOrder.push(transformer);
            }
        };

        // room chat api
        room.transform = function (message, callback) {
            if (!this._transformerOrder || this._transformerOrder.length === 0) {
                callback(null, message);
                return this;
            }
            var transformer, that = this;
            this.asyncJobs = [];
            for (var i = 0; i < this._transformerOrder.length; i++) {
                transformer = this._transformers[this._transformerOrder[i]];
                if (i == 0) {
                    this.asyncJobs.push(function (next) {
                        next(null, message);
                    });
                }
                if (typeof transformer === 'function') {
                    this.asyncJobs.push(function (newMessage, done) {
                        transformer.call(that, newMessage, done);
                    });
                }
            }
            async.waterfall(this.asyncJobs, function (err, message) {
                delete that.asyncJobs;
                callback(err, message);
            });
            return this;
        };
        //room.broadcast = function (message) {
        //    if (!message) {
        //        message = this._message;
        //        dispatch.toUsers(message, this.getUsers());
        //        delete this._message;
        //    } else {
        //        dispatch.toUsers(message, this.getUsers());
        //    }
        //};
        return room;
    }

    // Collection Constructor
    var Rooms = function () {
        this.rooms = {};
    };
    // only locally created rooms involve the TransformConstructure
    Rooms.prototype.createHandle = function (roomId, payload) {
        console.log('room is not found. The default routing createHandle does not support ' +
            'creation of rooms or any of the CRUD operations.');
    };
    Rooms.prototype.get = function (key, callback, noCache) {
        var query = {};
        query[keys.key] = key;
        var that = this;
        if (!noCache) {
            var room = _.find(this.rooms, query);
            if (!room) {
                return RoomModel.findOne(query, function (err, doc) {
                    if (err || !doc) return callback(err, doc);
                    Constructor(doc);
                    TransformConstructor.call(that, doc);
                    that.rooms[key] = doc;
                    return callback(err, doc);
                });
            } else {
                return callback(null, room);
            }
        } else {
            //console.log('Rooms.get: not using cache');
            return RoomModel.findOne(query, function (err, doc) {
                if (err || !doc) return callback(err, doc);
                Constructor(doc);
                TransformConstructor.call(that, doc);
                that.rooms[key] = doc;
                callback(err, doc);
            })
        }
    };
    // method for loading all of the rooms for the current server Que.
    // this is useful when server restarts.
    Rooms.prototype.getByQue = function (que, callback, noCache) {
        var query = {};
        query[field.que] = que;
        var that = this;
        //console.log('Rooms.getByQue: does not use cache');
        return RoomModel.find(query, function (err, docs) {
            if (!err && docs) {
                docs.map(function (doc) {
                    if (!doc.name) return;
                    Constructor(doc);
                    TransformConstructor.call(that, doc);
                    that.rooms[doc[field.key]] = doc;
                });
            }
            callback(err, docs);
        })
    };
    Rooms.prototype.close = function (key, callback, messageClients) {
        var that = this;
        this.get(key, function (err, room) {
            if (!err && room) {
                if (messageClients) room.broadcast({
                    from: {room: key},
                    text: 'room is closed'
                });
                room.close(callback);
                delete that.rooms[key];
            } else {
                //console.log('room with name: ', key, " is not found.");
                callback('room not found');
            }
        }, true); // this prohibits the use of Rooms.get cache.
        return this;
    };

    return Rooms;
}
