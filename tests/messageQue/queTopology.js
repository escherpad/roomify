'use strict';
module.exports = function (rabbit, nodeType, chatQue, chatKey) {
    var connectionConfig = {
        user: process.env.MQ_USERNAME,
        pass: process.env.MQ_PASSWORD,
        server: [process.env.MQ_SERVER],
        port: 5672,
        vhost: '%2f'
    };
    //if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') console.log('print message que configuration in development mode: \\n', connectionConfig);
    var rabbitConfig = {
        // arguments used to establish a connection to a broker
        connection: connectionConfig,

        // define the exchanges
        exchanges: [
            {
                name: 'ep.email',
                type: 'topic',
                persistent: false
            },
            {
                name: 'ep.database',
                type: 'topic',
                persistent: false
            },
            {
                name: 'ep.chat',
                type: 'direct',
                //autoDelete: true,
                persistent: false
            },
            {
                name: 'ep.latex2pdf',
                type: 'topic',
                persistent: false
            }
        ],

        // setup the queues, only subscribing to the one this service
        // will consume messages from
        queues: [
            {
                name: 'email-q',
                autoDelete: false,
                limit: 1,
                subscribe: nodeType === 'escherpad.mailer'
            },
            {
                name: 'bindr-get-children-q',
                autoDelete: false,
                limit: 1,
                subscribe: nodeType === 'escherpad.database-grunt-worker'
            },
            {
                name: 'bindr-get-notes-q',
                autoDelete: false,
                limit: 1,
                subscribe: nodeType === 'escherpad.database-grunt-worker'
            },
            {
                name: 'note-access-update-q',
                autoDelete: false,
                limit: 1,
                subscribe: nodeType === 'escherpad.database-grunt-worker'
            },
            {
                name: 'bindr-access-update-q',
                autoDelete: false,
                limit: 1,
                subscribe: nodeType === 'escherpad.database-grunt-worker'
            },
            {
                name: 'latex2pdf-q',
                autoDelete: true,
                subscribe: nodeType === 'escherpad.latex2pdf-worker'
            },
            {
                name: chatQue,
                autoDelete: true,
                exclusive: true, // to allow only the current consumer to connect to.
                subscribe: nodeType === 'escherpad.app-server'
            }
        ],

        // binds exchanges and queues to one another
        bindings: [
            {
                exchange: 'ep.email',
                target: 'email-q',
                keys: ['email']
            },
            {
                exchange: 'ep.database',
                target: 'bindr-get-notes-q',
                keys: ['database.bindr.get.notes']
            },
            {
                exchange: 'ep.database',
                target: 'bindr-get-children-q',
                keys: ['database.bindr.get.children']
            },
            {
                exchange: 'ep.database',
                target: 'note-access-update-q',
                keys: ['database.note.update.access']
            },
            {
                exchange: 'ep.database',
                target: 'bindr-access-update-q',
                keys: ['database.bindr.update.access']
            },
            {
                exchange: 'ep.latex2pdf',
                target: 'latex2pdf-q',
                keys: ['latex2pdf']
            }
        ]
    };

    if (nodeType === 'escherpad.app-server') {
        rabbitConfig.bindings.push({
            exchange: 'ep.chat',
            target: chatQue,
            //keys: ['chat.' + chatKey]
            keys: [chatKey]
        });
    }
    return rabbit.configure(rabbitConfig);
};
