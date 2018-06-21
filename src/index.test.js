const chai = require('chai')
  ,chaiAsPromised = require("chai-as-promised")
  , sinon = require("sinon")
  , sinonChai = require("sinon-chai")
  , should = chai.should()
  , Machine = require('../dist/index').Machine

chai.use(sinonChai);
chai.use(chaiAsPromised);

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

    it('should create a Machine that transits to the initial state', async function() {
      let m = new Machine({ start: {} }, 'start');
      await m.ready;
      should.exist(m.state);
      m.state.should.be.a('string');
      m.state.should.equal('start');
    });

    it('should create a Machine that transits to the initial state and calls the entry function', async function() {
      let spy = sinon.spy(function() {
        should.exist(this.state);
        this.state.should.be.a('string');
        this.state.should.equal('start');
      });
      let m = new Machine({
        start: {
          entry: spy
        }
      }, 'start');
      await m.ready;
      spy.should.have.been.called;
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

    it('should transit to a known state', async function() {
      let m = new Machine({
        start: {}
      });
      should.not.exist(m.state);
      await m.enter('start');
      should.exist(m.state);
      m.state.should.be.a('string');
      m.state.should.equal('start');
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

    it('should gracefully handle errors when entering state', function() {
      let m = new Machine({
        start: {
          entry() {
            throw new Error('y');
          }
        }
      });
      should.not.exist(m.state);
      return m.enter('start').then(function() {
        should.fail();
      }, function(e) {
        e.message.should.equal('y');
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

    it('should do nothing when transiting to the current state', async function() {
      let m = new Machine({
        start: {}
      }, 'start');
      await m.ready;
      let res = await m.enter('start');
      res.should.equal(true);
      should.exist(m.state);
      m.state.should.be.a('string');
      m.state.should.equal('start');
    });

    it('should perform a valid transition', async function() {
      let m = new Machine({
        start: {},
        end: {}
      }, 'start');
      await m.ready;
      should.exist(m.state);
      m.state.should.be.a('string');
      m.state.should.equal('start');
      await m.enter('end');
      m.state.should.be.a('string');
      m.state.should.equal('end');
    });

    it('should perform a valid transition calling exit and entry functions', async function() {
      let start_entry = sinon.spy();
      let start_exit = sinon.spy();
      let end_entry = sinon.spy();

      let m = new Machine({
        start: {
          entry: start_entry,
          exit: start_exit,
        },
        end: {
          entry: end_entry
        }
      }, 'start');
      await m.ready;
      should.exist(m.state);
      start_entry.should.have.been.called;
      start_exit.should.not.have.been.called;
      end_entry.should.not.have.been.called;
      m.state.should.be.a('string');
      m.state.should.equal('start');

      await m.enter('end', 'aaa');
      start_entry.should.have.been.calledOnce;
      start_exit.should.have.been.called;
      end_entry.should.have.been.calledWith('aaa');
      m.state.should.be.a('string');
      m.state.should.equal('end');
    });

    it('should enter a state that enters automatically another state', async function() {
      let end_entry = sinon.spy();

      let m = new Machine({
        start: {
          entry: function() {
            return this.enter('next');
          }
        },
        next: {
          entry: function() {
            this.enter('end')
          }
        },
        end: {
          entry: end_entry
        }
      });
      await m.enter('start');
      end_entry.should.have.been.calledOnce;
    });
  });

  describe('process', function() {

    it('should process a known event in a state that handles it', async function() {
      let spy = sinon.spy();
      let m = new Machine({
        state1: {
          event1: spy
        },
        state2: {
        }
      }, 'state1');

      let h = m.eventHandler('event1');
      await h();
      spy.should.have.been.calledOnce;
    });

    it('should call the default handler if defined for an unknown event', async function() {
      let spy1 = sinon.spy();
      let spy2 = sinon.spy();
      let m = new Machine({
        state1: {
          event1: spy1
        },
        state2: {
          '*': spy2
        }
      }, 'state1');

      var h = m.eventHandler('event1');
      await h();
      spy1.should.have.been.calledOnce;
      await m.enter('state2');
      await h();
      spy1.should.have.been.calledOnce;
      spy2.should.have.been.calledOnce;
    });

    it('should return an error if an event is not handled and no default is defined', function() {
      let spy = sinon.spy();
      let m = new Machine({
        state1: {
          event1: spy
        },
        state2: {
        }
      }, 'state1');

      let h = m.eventHandler('event1');
      return h().then(function() {
        spy.should.have.been.calledOnce;
        return m.enter('state2').then(function() {
          m.state.should.equal('state2');
          return h().then(function() {
            should.fail();
          }, function(err) {
            err.message.should.equal('unhandled');
            spy.should.have.been.calledOnce;
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

    it('should defer an event and process it in the next state if handled (1)', async function() {
      let spy = sinon.spy();
      let m = new Machine({
        state1: {
          event1: 'defer'
        },
        state2: {
          event1: spy
        }
      }, 'state1');

      let h = m.eventHandler('event1');
      let deferred = h();
      spy.should.not.have.been.called;
      await m.enter('state2');
      await deferred;
      spy.should.have.been.calledOnce;
    });

    it('should defer an event and process it in the next state if handled (2)', async function() {
      let spy = sinon.spy();
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
      let deferred = h();
      spy.should.not.have.been.called;
      await m.enter('state2');
      spy.should.not.have.been.called;
      m.deferredEvents.length.should.equal(1);
      await m.enter('state3');
      await deferred;
      spy.should.have.been.calledOnce;
      m.deferredEvents.length.should.equal(0);
    });

    it('should defer an event and process it in the next state if handled (3)', async function() {
      let spy = sinon.spy();
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
      let deferred1 = h();
      spy.should.not.have.been.called;
      await m.enter('state2');
      let deferred2 = h();
      spy.should.not.have.been.called;
      await m.enter('state3');
      await deferred1;
      await deferred2;
      spy.should.have.been.calledTwice;
      m.deferredEvents.length.should.equal(0);
    });

    it('should process all deferred events even if some fail and return a resolve promise', async function() {
      let spy = sinon.spy();
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

      await m.ready;
      m.process('event2');
      m.process('event1').catch(() => {});
      m.process('event2');
      m.process('event1').catch(() => {});
      m.process('event2');
      m.process('event1').catch(() => {});
      await m.enter('state2');
      spy.should.have.been.calledThrice;
    });

    it('should return a failed promise if a deferred event is ignored in a subsequent state', async function() {
      let m = new Machine({
        state1: {
          event1: 'defer',
        },
        state2: {
        }
      }, 'state1');

      await m.ready;
      let deferred = m.process('event1');
      await m.enter('state2');
      deferred.should.eventually.be.rejected;
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

    it('should create a default event handler', async function() {
      let m = new Machine({
        start: {
        }
      }, 'start');

      let spy = sinon.spy();
      let h = m.eventHandler({
        '*': spy
      });
      await h();
      spy.should.have.been.called;
    });

    it('should create an event handler whose state handlers are called according to the fsm state', async function() {
      let m = new Machine({
        start: {
        },
        work: {
        },
        end: {
        }
      }, 'start');
      let start_spy = sinon.spy();
      let work_spy = sinon.spy();
      let end_spy = sinon.spy();
      let h = m.eventHandler({
        start: start_spy,
        work: work_spy,
        end: end_spy
      });
      await h();
      start_spy.should.have.been.calledOnce;
      work_spy.should.not.have.been.called;
      end_spy.should.not.have.been.called;
      await m.enter('work');
      await h();
      start_spy.should.have.been.calledOnce;
      work_spy.should.have.been.calledOnce;
      end_spy.should.not.have.been.called;
      await m.enter('end');
      await h();
      start_spy.should.have.been.calledOnce;
      work_spy.should.have.been.calledOnce;
      end_spy.should.have.been.calledOnce;
    });

    it('should preserve the original arguments when calling a state handler', async function() {
      let m = new Machine({
        start: {
          transitions: [ 'end' ]
        },
        end: {
        }
      }, 'start');

      let spy = sinon.spy();
      let h = m.eventHandler({
        '*': spy
      });
      await h('aaa', 1);
      spy.should.have.been.calledWith('aaa', 1);
    });

    it('should fail when handling an event for a state not covered', function() {
      let m = new Machine({
        start: {
        },
        end: {
        }
      }, 'start');

      let spy = sinon.spy();
      let h = m.eventHandler({
        end: spy
      });
      return h().then(function() {
        should.fail();
      }, function(err) {
        err.message.should.equal('unhandled');
      }); // current state is start and it's not covered by the handler
    });

    it('should return the return value of the original event handler', async function() {
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
      let r = await h();
      r.should.equal(5);
      r = await m.eventHandler('ev')(1, 2, 3);
      r.should.equal(4);
      r = await m.eventHandler('ev__')();
      r.should.equal(3);
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