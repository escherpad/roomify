/**
 * Created by ge on 5/13/15.
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module);
}
define(['underscore', 'async', '../../api-server/models/SchemaModels'],
    function (_, async, SchemaModels) {
        "use strict";
        var AgentModel = SchemaModels.Agent;

        //usage examples:
        // 0. agents.add(sparkId, agentString, username, queKey)
        // 1. agents.getByQue(queKey): get all agents that has the same queKey
        // 2. agents.get(agentString): get the agent that has a specific agentString
        // 3. agents.getByUsername(username): get all the agents that belongs to this user
        //    all above returns object:
        //    { spark: sparkId, agent: agentString, user: username, que: queKey }
        //
        // 4. agents.

        var Agents = function () {
            this.agents = {};
            this.sparks = {};
            this.ques = {};
        };

        // creates a new agent in the collection
        Agents.prototype.add = function (queKey, username, sparkId, callback) {
            var agent = {
                user: username,
                que: queKey,
                spark: sparkId
            };
            var agentModel = new AgentModel(agent);
            agentModel.save(callback);
            if (this.agents[username]) {
                this.agents[username].push(agent);
            } else {
                this.agents[username] = [agent];
            }
            if (this.sparks[username]) {
                this.sparks[username].push(agent.spark);
            }
            if (this.ques[username]) {
                if (this.ques[username].indexOf(queKey) == -1) {
                    this.ques[username].push(queKey);
                }
            }
            return agent;
        };

        Agents.prototype.remove = function (que, username, sparkId, callback) {
            var query = {que: que, spark: sparkId};
            var agent, ind, that = this;
            if (username) {
                query.user = username;
            }
            if (username && this.agents[username]) {
                agent = _.findWhere(this.agents[username], query);
                ind = _.indexOf(this.agents[username], agent);
                if (ind > -1) this.agents[username].splice(ind, 1);
                if (this.sparks[username]) {
                    ind = this.sparks[username].indexOf(username);
                    if (ind > -1) this.sparks[username].splice(ind, 1);
                }
                if (this.ques[username]) {
                    if (_.where(this.agents[username], {que: que}).length == 0) {
                        ind = _.indexOf(this.ques[username], que);
                        if (ind > -1) this.ques[username].splice(ind, 1);
                    }
                }
            }
            AgentModel.findOne(query).exec(function (err, doc) {
                if (err) console.log('AgentModel.findOne error: ', err);
                if (err || !doc && typeof callback === 'function') callback(err, 'Agents.remove: doc is not found');
                if (doc) {
                    username = doc.name;
                    if (that.agents[username]) {
                        agent = _.findWhere(that.agents[username], query);
                        ind = _.indexOf(that.agents[username], agent);
                        if (ind > -1)that.agents[username].splice(ind, 1);
                        if (that.sparks[username]) {
                            ind = that.sparks[username].indexOf(username);
                            if (ind > -1)that.sparks[username].splice(ind, 1);
                        }
                        if (that.ques[username]) {
                            if (_.where(that.agents[username], {que: que}).length == 0) {
                                ind = _.indexOf(that.ques[username], que);
                                if (ind > -1)that.ques[username].splice(ind, 1);
                            }
                        }
                    }
                    doc.remove(callback);
                }
            })
        };

        Agents.prototype.get = function (username, callback, noCache) {
            var query = {user: username};
            var that = this;
            if (!noCache) {
                var agents = _.where(this.agents, query);
                if (!agents || agents.length === 0) {
                    return AgentModel.find(query, function (err, docs) {
                        console.log('inside AgentModel.find callback.', err, '\n docs: ', docs);
                        if (docs) {
                            that.agents[username] = docs;
                            delete that.sparks[username];
                            delete that.ques[username];
                        }
                        callback(err, docs);
                    });
                } else {
                    return callback(null, agents);
                }
            } else {
                console.log('Agents.get: not using cache');
                return AgentModel.find(query, function (err, docs) {
                    console.log('inside AgentModel.find callback.', err, '\n docs: ', docs);
                    if (docs) {
                        that.agents[username] = docs;
                        delete that.sparks[username];
                        delete that.ques[username];
                    }
                    callback(err, docs);
                });
            }
        };

        Agents.prototype.getUserQues = function (username, callback) {
            if (this.ques[username]) return callback(null, this.ques[username]);
            var that = this;
            this.get(username, function (err, docs) {
                that.ques[username] = _.uniq(_.pluck(that.agents[username], 'que'));
                callback(null, that.ques[username]);
            }, true);
            return this;
        };

        Agents.prototype.getUserSparks = function (username, que, callback) {
            if (this.sparks[username]) return callback(null, this.sparks[username]);
            var that = this;
            this.get(username, function (err, docs) {
                that.sparks[username] = _.pluck(_.where(that.agents[username], {que: que}), 'spark');
                callback(null, that.sparks[username]);
            }, true);
            return this;
        };

        return Agents;
    });
