# fseh
A minimal Finite State Event Handler for JavaScript

[![travis build](https://img.shields.io/travis/0xfede/fseh.svg)](https://travis-ci.org/0xfede/fseh)
[![codecov coverage](https://img.shields.io/codecov/c/github/0xfede/fseh.svg)](https://codecov.io/gh/0xfede/fseh)
[![npm version](https://img.shields.io/npm/v/fseh.svg)](https://www.npmjs.com/package/fseh)

Have you ever had to handle an event differently depending on the state of your application? *fseh* lets you create
state-aware event handler that execute different code depending on the current state of your application.

It's basically an implementation of a Finite State Machine, optimized to be used where callbacks and event handlers are
expected.

Here's a quick Node.js/Expressjs example. Suppose you what your web application to automatically respond with a standard
error message when the application is not ready or down for maintenance: you could check for the current state in all
your routes:

```js
var express = require('express')
  , app = express()
  , ready = false;

app.get('/', function(req, res) {
  if (ready) {
    res.send("Thanks for GETting");
  } else {
    res.status(503).send("Sorry, I'm not ready yet...");
  }
});  
app.post('/', function(req, res) {
  if (ready) {
    res.send("Thanks for POSTing");
  } else {
    res.status(503).send("Sorry, I'm not ready yet...");
  }
});  
app.listen(8080);

// connect to a db and perform other init stuff...
// ... or just wait 5 seconds
setTimeout(function() {
  ready = true;
}, 5000);
```

A better approach would be to create a middleware to do the job:

```js
function checkIfReady(req, res, next) {
  if (ready) {
    next();
  } else {
    res.status(503).send("Sorry, I'm not ready yet...");
  }
}

app.get('/', checkIfReady, function(req, res) {
  res.send("Thanks for GETting");
});  
app.post('/', checkIfReady, function(req, res) {
  res.send("Thanks for POSTing");
});  
```

Things would get immediately more complicated if you'd like to handle different types of requests differently or if there's
a greater variety of states that just ready or not. fseh least you define a Finite State Machine (FSM) and event handlers
for each state.

```js
var Machine = require('fseh').Machine
  , express = require('express')
  , app = express()

var fsm = new Machine({
  "setup": {
    "request": function(req, res) {
      res.status(503).send("Sorry, I'm not ready yet...");
    },
    "setup-completed": function() {
      this.enter('ready');
    }
  },
  "ready": {
    "request": function(req, res, next) {
      next();
    }
  }
}, 'setup');

app.use(fsm.eventHandler('request'));

app.get('/', function(req, res) {
  res.send("Thanks for GETting");
});  
app.post('/', function(req, res) {
  res.send("Thanks for POSTing");
});  
app.listen(8080);

setTimeout(fsm.eventHandler('setup-completed'), 5000);
```

In the example above we've defined a state machine that supports two states, called `setup` and `ready`, and the handles
the `request` event differently depending on the state. In the example, the initial state is set up `setup` in the constructor
and the machine transits to the `ready` state after 5 seconds, when a timer expire triggering a `setup-completed` event.
We then create an event handler for the `request` event that it's simply used as a Expressjs middleware.

![Simple FSM](doc/fsm1.png "Simple Finite State Machine")

This is just a very simple scenario: fseh can be used to handle much more complex state machines, like, for instance,
a WebRTC negotiation, where several messages need to be exchanged between two or more parties and the receipt of a message
might need a radically different handling depending on the current negotiation state.