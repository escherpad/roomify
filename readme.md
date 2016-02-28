## Roomify, A (Horizontally) Scalable Chat Room For Your Node Server

### The Challenges 

I need to build chat rooms on existing node.js servers
database is in mongodb
I'm using Primus for the transport layer
I don't want to use redis for the messaging
keyword filtering github issues
the data schema is defined in mongoose json syntax

I can't have two chat/socket infrastructure.

### What Do You Need


### How To Test
- `./test/testSocketServer.js` is a test server instance that works as a template for writing tests. 
  to run this server, type:
  ```bash
  node ./tests/testSocketServer.js
  ```
  and the client and the server should ping each other infinitely and print out the ping/pon in the console.
  
- `./tests/routing.spec.js` is the specification file for the module.
  to run, type
  ```bash
  grunt watch-dev
  ```
  in the console.
  
### Grunt Tasks

watch
: watches all sources and run test at the end

watch-dev
: run test first, and then watch all sources

test
: run test