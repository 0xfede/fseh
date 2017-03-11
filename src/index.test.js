var chai = require('chai')
  , spies = require('chai-spies')
  , should = chai.should()
  , Machine = require('../dist/index').Machine

chai.use(spies);

describe('fseh', function() {

  describe('constructor', function() {

    it('should create an empty Machine with no initial state', function() {
      let m = new Machine();
      should.not.exist(m.state);
    });

    it('should create a Machine with no initial state', function() {
      let m = new Machine({ start: {} });
      should.not.exist(m.state);
    });

    it('should create a Machine that transits to the initial state', function() {
      let m = new Machine({ start: {} }, 'start');
      return m.ready.then(function() {
        should.exist(m.state);
        m.state.should.be.a('string');
        m.state.should.equal('start');
      });
    });

    it('should create a Machine that transits to the initial state and calls the entry function', function() {
      let spy = chai.spy(function() {
        should.exist(this.state);
        this.state.should.be.a('string');
        this.state.should.equal('start');
      });
      let m = new Machine({
        start: {
          entry: spy
        }
      }, 'start');
      return m.ready.then(function() {
        spy.should.have.been.called();
      });
    });

    it('should fail when processing an event before any state transition', function() {
      let m = new Machine({
        start: {
          event: () => {}
        }
      });
      m.process('event').then(function() {
        should.fail();
      }, function(err) {
        err.message.should.equal('unhandled');
      });
    });

  });

  describe('enter', function() {

    it('should transit to a known state', function() {
      let m = new Machine({
        start: {}
      });
      should.not.exist(m.state);
      return m.enter('start').then(function() {
        should.exist(m.state);
        m.state.should.be.a('string');
        m.state.should.equal('start');
      });
    });

    it('should not transit to an unknown state', function() {
      let m = new Machine({
        start: {}
      });
      should.not.exist(m.state);
      return m.enter('blabla').then(function() {
        should.fail();
      }, function(e) {
        e.message.should.equal('unknown_state');
      });
    });

    it('should not transit to an undefined state', function() {
      let m = new Machine({
        start: {}
      });
      should.not.exist(m.state);
      return m.enter().then(function() {
        should.fail();
      }, function(e) {
        e.message.should.equal('invalid_state');
      });
    });

    it('should do nothing when transiting to the current state', function() {
      let m = new Machine({
        start: {}
      }, 'start');
      return m.enter('start').then(function(res) {
        res.should.equal(true);
        should.exist(m.state);
        m.state.should.be.a('string');
        m.state.should.equal('start');
      });
    });

    it('should perform a valid transition', function() {
      let m = new Machine({
        start: {},
        end: {}
      }, 'start');
      return m.ready.then(function() {
        should.exist(m.state);
        m.state.should.be.a('string');
        m.state.should.equal('start');
        return m.enter('end').then(function() {
          m.state.should.be.a('string');
          m.state.should.equal('end');
        });
      });
    });

    it('should perform a valid transition calling exit and entry functions', function() {
      let start_entry = chai.spy();
      let start_exit = chai.spy();
      let end_entry = chai.spy();

      let m = new Machine({
        start: {
          entry: start_entry,
          exit: start_exit,
        },
        end: {
          entry: end_entry
        }
      }, 'start');
      return m.ready.then(function() {
        should.exist(m.state);
        start_entry.should.have.been.called();
        start_exit.should.not.have.been.called();
        end_entry.should.not.have.been.called();
        m.state.should.be.a('string');
        m.state.should.equal('start');

        return m.enter('end', 'aaa').then(function() {
          start_entry.should.have.been.called.once();
          start_exit.should.have.been.called();
          end_entry.should.have.been.called.with('aaa');
          m.state.should.be.a('string');
          m.state.should.equal('end');
        });
      });
    });

  });

  describe('process', function() {

    it('should process a known event in a state that handles it', function() {
      let spy = chai.spy();
      let m = new Machine({
        state1: {
          event1: spy
        },
        state2: {
        }
      }, 'state1');

      let h = m.eventHandler('event1');
      h.should.be.a('function');
      return h().then(function() {
        spy.should.have.been.called.once();
      });
    });

    it('should call the default handler if defined for an unknown event', function() {
      let spy1 = chai.spy();
      let spy2 = chai.spy();
      let m = new Machine({
        state1: {
          event1: spy1
        },
        state2: {
          '*': spy2
        }
      }, 'state1');

      var h = m.eventHandler('event1');
      h.should.be.a('function');
      return h().then(function() {
        spy1.should.have.been.called.once();
        m.enter('state2');
        return h().then(function() {
          spy1.should.have.been.called.once();
          spy2.should.have.been.called.once();
        });
      });
    });

    it('should return an error if an event is not handled and no default is defined', function() {
      let spy = chai.spy();
      let m = new Machine({
        state1: {
          event1: spy
        },
        state2: {
        }
      }, 'state1');

      let h = m.eventHandler('event1');
      h.should.be.a('function');
      return h().then(function() {
        spy.should.have.been.called.once();
        return m.enter('state2').then(function() {
          m.state.should.equal('state2');
          return h().then(function() {
            should.fail();
          }, function(err) {
            err.message.should.equal('unhandled');
            spy.should.have.been.called.once();
          });
        });
      });
    });

    it('should ignore an null event', function() {
      let m = new Machine({
        state1: {
        }
      }, 'state1');

      return m.process().then(function() {
        should.fail();
      }, function(err) {
        err.message.should.equal('bad_event');
      });
    });

  });

  describe('defer', function() {

    it('should defer an event and process in the next state if it handles it (1)', function() {
      let spy = chai.spy();
      let m = new Machine({
        state1: {
          event1: 'defer'
        },
        state2: {
          event1: spy
        }
      }, 'state1');

      let h = m.eventHandler('event1');
      h.should.be.a('function');
      return h().then(() => {
        spy.should.not.have.been.called();
        return m.enter('state2').then(() => {
          spy.should.have.been.called.once();
        });
      });
    });

    it('should defer an event and process in the next state if it handles it (2)', function() {
      let spy = chai.spy();
      let m = new Machine({
        state1: {
          event1: 'defer'
        },
        state2: {
          event1: 'defer'
        },
        state3: {
          event1: spy
        }
      }, 'state1');

      let h = m.eventHandler('event1');
      h.should.be.a('function');
      return h().then(() => {
        spy.should.not.have.been.called();
        m.deferredEvents.length.should.equal(1);
        return m.enter('state2').then(() => {
          spy.should.not.have.been.called();
          m.deferredEvents.length.should.equal(1);
          return m.enter('state3').then(() => {
            spy.should.have.been.called.once();
            m.deferredEvents.length.should.equal(0);
          });
        });
      });
    });

    it('should defer an event and process in the next state if it handles it (3)', function() {
      let spy = chai.spy();
      let m = new Machine({
        state1: {
          event1: 'defer'
        },
        state2: {
          event1: 'defer'
        },
        state3: {
          event1: spy
        }
      }, 'state1');

      let h = m.eventHandler('event1');
      h.should.be.a('function');
      return h().then(() => {
        spy.should.not.have.been.called();
        m.deferredEvents.length.should.equal(1);
        return m.enter('state2').then(() => {
          return h().then(() => {
            spy.should.not.have.been.called();
            m.deferredEvents.length.should.equal(2);
            return m.enter('state3').then(() => {
              spy.should.have.been.called.twice();
              m.deferredEvents.length.should.equal(0);
            });
          });
        });
      });
    });

    it('should precessed all deferred events even if some fail and return a resolve promise', function() {
      let spy = chai.spy();
      let m = new Machine({
        state1: {
          event1: 'defer',
          event2: 'defer'
        },
        state2: {
          event1: () => { throw new Error('a') },
          event2: spy,
        }
      }, 'state1');

      return m.process('event2')
        .then(() => m.process('event1'))
        .then(() => m.process('event2'))
        .then(() => m.process('event1'))
        .then(() => m.process('event2'))
        .then(() => m.process('event1'))
        .then(() => {
          m.deferredEvents.length.should.equal(6);
          return m.enter('state2').then(() => {
            spy.should.have.been.called(3);
          });
        });
    });

  });

  describe('noop', function() {

    it('should do nothing', function () {
      let m = new Machine({
        state1: {
          event1: 'noop'
        }
      }, 'state1');

      let h = m.eventHandler('event1');
      return h();
    });

  });

  describe('eventHandler', function() {

    it('should create a default event handler', function() {
      let m = new Machine({
        start: {
        }
      }, 'start');

      let spy = chai.spy();
      let h = m.eventHandler({
        '*': spy
      });
      h.should.be.a('function');
      return h().then(function() {
        spy.should.have.been.called();
      });
    });

    it('should create an event handler whose state handlers are called according to the fsm state', function() {
      let m = new Machine({
        start: {
        },
        work: {
        },
        end: {
        }
      }, 'start');
      let start_spy = chai.spy();
      let work_spy = chai.spy();
      let end_spy = chai.spy();
      let h = m.eventHandler({
        start: start_spy,
        work: work_spy,
        end: end_spy
      });
      h.should.be.a('function');
      return h().then(function() {
        start_spy.should.have.been.called.once();
        work_spy.should.not.have.been.called();
        end_spy.should.not.have.been.called();
        m.enter('work');
        return h().then(function() {
          start_spy.should.have.been.called.once();
          work_spy.should.have.been.called.once();
          end_spy.should.not.have.been.called();
          m.enter('end');
          return h().then(function() {
            start_spy.should.have.been.called.once();
            work_spy.should.have.been.called.once();
            end_spy.should.have.been.called.once();
          });
        });
      });
    });

    it('should preserve the original arguments when calling a state handler', function() {
      let m = new Machine({
        start: {
          transitions: [ 'end' ]
        },
        end: {
        }
      }, 'start');

      let spy = chai.spy();
      let h = m.eventHandler({
        '*': spy
      });
      h.should.be.a('function');
      return h('aaa', 1).then(function() {
        spy.should.have.been.called.with('aaa', 1);
      });
    });

    it('should fail when handling an event for a state not covered', function() {
      let m = new Machine({
        start: {
        },
        end: {
        }
      }, 'start');

      let spy = chai.spy();
      let h = m.eventHandler({
        end: spy
      });
      return h().then(function() {
        should.fail();
      }, function(err) {
        err.message.should.equal('unhandled');
      }); // current state is start and it's not covered by the handler
    });

    it('should return the return value of the original event handler', function() {
      let m = new Machine({
        start: {
          ev: function() {
            return 4;
          },
          '*': function() {
            return 3;
          }
        }
      }, 'start');

      let h = m.eventHandler({
        start: function() {
          return 5;
        }
      });
      return h().then(function(r) {
        r.should.equal(5);
        return m.eventHandler('ev')(1, 2, 3).then(function(r) {
          r.should.equal(4);
          return m.eventHandler('ev__')().then(function(r) {
            r.should.equal(3);
          });
        });
      });
    });

  });

  describe('callbackEventHandler', function() {

    it('should call the callback with the result of the promise returned by the event handler', function(done) {
      let m = new Machine({
        start: {
          ev: function(i) {
            return i * 2;
          }
        }
      }, 'start');

      let h = m.callbackEventHandler('ev');

      h(5, function(err, res) {
        should.not.exist(err);
        res.should.equal(10);
        done();
      });
    });

    it('should call the callback with the error of the promise returned by the event handler', function(done) {
      let m = new Machine({
        start: {
          ev: function(i) {
            return i * 2;
          }
        }
      }, 'start');

      let h = m.callbackEventHandler('aaa');

      h(5, function(err, res) {
        err.message.should.equal('unhandled');
        done();
      });
    });

    it('should not fail if no callback is passed', function() {
      let m = new Machine({
        start: {
          ev: function(i) {
            return i * 2;
          }
        }
      }, 'start');

      should.not.Throw(function() {
        let h = m.callbackEventHandler('ev');
        h(5);
      })
    });

  });

});