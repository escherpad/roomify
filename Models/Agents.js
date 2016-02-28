/** Created by ge on 5/13/15. */
"use strict";
var _ = require('lodash');

//usage examples:
// 0. agents.add(sparkId, agentString, username, queKey)
// 1. agents.getByQue(queKey): get all agents that has the same queKey
// 2. agents.get(agentString): get the agent that has a specific agentString
// 3. agents.getByUsername(username): get all the agents that belongs to this user
//    all above returns object:
//    { spark: sparkId, agent: agentString, user: username, que: queKey }
//
// 4. agents.

var Agents = function (addAgentRecord, findOneAgentRecord, findAgentRecord) {
    if (!addAgentRecord) throw Error('findAgentRecord is missing');
    this.addAgentRecord = addAgentRecord;
    if (!findOneAgentRecord) throw Error('findOneAgentRecord is missing');
    this.findOneAgentRecord = findOneAgentRecord;
    if (!findAgentRecord) throw Error('findAgentRecord is missing');
    this.findAgentRecord = findAgentRecord;
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
    this.addAgentRecord(agent, callback);

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
        agent = _.find(this.agents[username], query);
        ind = _.indexOf(this.agents[username], agent);
        if (ind > -1) this.agents[username].splice(ind, 1);
        if (this.sparks[username]) {
            ind = this.sparks[username].indexOf(username);
            if (ind > -1) this.sparks[username].splice(ind, 1);
        }
        if (this.ques[username]) {
            if (_.filter(this.agents[username], {que: que}).length == 0) {
                ind = _.indexOf(this.ques[username], que);
                if (ind > -1) this.ques[username].splice(ind, 1);
            }
        }
    }
    this.findOneAgentRecord(query, function (err, doc) {
        if (err) console.log('findAgentModel error: ', err);
        if (err || !doc && typeof callback === 'function') callback(err, 'Agents.remove: doc is not found');
        if (doc) {
            username = doc.name;
            if (that.agents[username]) {
                agent = _.find(that.agents[username], query);
                ind = _.indexOf(that.agents[username], agent);
                if (ind > -1)that.agents[username].splice(ind, 1);
                if (that.sparks[username]) {
                    ind = that.sparks[username].indexOf(username);
                    if (ind > -1)that.sparks[username].splice(ind, 1);
                }
                if (that.ques[username]) {
                    if (_.filter(that.agents[username], {que: que}).length == 0) {
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
        var agents = _.filter(this.agents, query);
        if (!agents || agents.length === 0) {
            return this.findAgentRecord(query, function (err, docs) {
                if (err) console.log('inside AgentModel.find callback.', err, '\n docs: ', docs);
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
        return this.findAgentRecord(query, function (err, docs) {
            if (err) console.log('inside AgentModel.find callback.', err, '\n docs: ', docs);
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
        that.ques[username] = _.uniq(_.map(that.agents[username], 'que'));
        callback(null, that.ques[username]);
    }, true);
    return this;
};

Agents.prototype.getUserSparks = function (username, que, callback) {
    if (this.sparks[username]) return callback(null, this.sparks[username]);
    var that = this;
    this.get(username, function (err, docs) {
        that.sparks[username] = _.map(_.filter(that.agents[username], {que: que}), 'spark');
        callback(null, that.sparks[username]);
    }, true);
    return this;
};

module.exports = Agents;
