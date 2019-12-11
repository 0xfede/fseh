import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as spies from 'chai-spies';
import { Machine } from '../../dist/machine';

const should = chai.should();
chai.use(spies);
chai.use(chaiAsPromised);

describe('Machine', function() {
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
      if (m.state) {
        m.state.should.be.a('string');
        m.state.should.equal('start');
      }
    });

    it('should create a Machine that transits to the initial state and calls the entry function', async function() {
      let spy = chai.spy(function() {
        should.exist(this.state);
        this.state.should.be.a('string');
        this.state.should.equal('start');
      });
      let m = new Machine(
        {
          start: {
            entry: spy
          }
        },
        'start'
      );
      await m.ready;
      spy.should.have.been.called;
    });

    it('should fail when processing an event before any state transition', async function() {
      let m = new Machine({
        start: {
          event: () => {}
        }
      });
      try {
        await m.process('event');
        throw new Error('failed');
      } catch (err) {
        err.name.should.equal('UnhandledEventError');
      }
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
      if (m.state) {
        m.state.should.be.a('string');
        m.state.should.equal('start');
      }
    });

    it('should not transit to an unknown state', function() {
      let m = new Machine({
        start: {}
      });
      should.not.exist(m.state);
      return m.enter('blabla').then(
        function() {
          throw new Error('failed');
        },
        function(e) {
          e.name.should.equal('UnknownStateError');
        }
      );
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
      return m.enter('start').then(
        function() {
          throw new Error('failed');
        },
        function(e) {
          e.message.should.equal('y');
        }
      );
    });

    it('should not transit to an undefined state', function() {
      let m = new Machine({
        start: {}
      });
      should.not.exist(m.state);
      return m.enter(undefined as any).then(
        function() {
          throw new Error('failed');
        },
        function(e) {
          e.name.should.equal('InvalidStateError');
        }
      );
    });

    it('should do nothing when transiting to the current state', async function() {
      let m = new Machine(
        {
          start: {}
        },
        'start'
      );
      await m.ready;
      let res = await m.enter('start');
      res.should.equal(true);
      should.exist(m.state);
      if (m.state) {
        m.state.should.be.a('string');
        m.state.should.equal('start');
      }
    });

    it('should perform a valid transition', async function() {
      let m = new Machine(
        {
          start: {},
          end: {}
        },
        'start'
      );
      await m.ready;
      should.exist(m.state);
      if (m.state) {
        m.state.should.be.a('string');
        m.state.should.equal('start');
      }
      await m.enter('end');
      should.exist(m.state);
      if (m.state) {
        m.state.should.be.a('string');
        m.state.should.equal('end');
      }
    });

    it('should perform a valid transition calling exit and entry functions', async function() {
      let start_entry = chai.spy();
      let start_exit = chai.spy();
      let end_entry = chai.spy();

      let m = new Machine(
        {
          start: {
            entry: start_entry,
            exit: start_exit
          },
          end: {
            entry: end_entry
          }
        },
        'start'
      );
      await m.ready;
      should.exist(m.state);
      start_entry.should.have.been.called;
      start_exit.should.not.have.been.called;
      end_entry.should.not.have.been.called;
      if (m.state) {
        m.state.should.be.a('string');
        m.state.should.equal('start');
      }

      await m.enter('end', 'aaa');
      start_entry.should.have.been.called.once;
      start_exit.should.have.been.called;
      end_entry.should.have.been.called.with('aaa');
      if (m.state) {
        m.state.should.be.a('string');
        m.state.should.equal('end');
      }
    });

    it('should enter a state that enters automatically another state', async function() {
      let end_entry = chai.spy();

      let m = new Machine({
        start: {
          entry: function() {
            return this.enter('next');
          }
        },
        next: {
          entry: function() {
            this.enter('end');
          }
        },
        end: {
          entry: end_entry
        }
      });
      await m.enter('start');
      end_entry.should.have.been.called.once;
    });

    it('should emit events when entering a state', async function() {
      const m = new Machine({
        start: {}
      });

      let named_pre_entry = chai.spy();
      let pre_entry = chai.spy();
      let named_entry = chai.spy();
      let entry = chai.spy();
      let named = chai.spy();

      m.on('start:pre-entry', named_pre_entry);
      m.on('pre-entry', pre_entry);
      m.on('start:entry', named_entry);
      m.on('entry', entry);
      m.on('start', named);

      should.not.exist(m.state);
      await m.enter('start', 'aaa');
      should.exist(m.state);
      if (m.state) {
        m.state.should.be.a('string');
        m.state.should.equal('start');
      }
      named_pre_entry.should.have.been.called.once;
      pre_entry.should.have.been.called.once;
      pre_entry.should.have.been.called.with('start', 'aaa');
      named_entry.should.have.been.called.once;
      entry.should.have.been.called.once;
      entry.should.have.been.called.with('start', 'aaa');
      named.should.have.been.called.once;
    });

    it('should emit events when exiting a state', async function() {
      const m = new Machine(
        {
          start: {},
          end: {}
        },
        'start'
      );

      let named_exit = chai.spy();
      let exit = chai.spy();

      m.on('start:exit', named_exit);
      m.on('exit', exit);

      await m.ready;
      await m.enter('end', 'aaa');
      named_exit.should.have.been.called.once;
      exit.should.have.been.called.once;
      exit.should.have.been.called.with('start');
    });
  });

  describe('process', function() {
    it('should process a known event in a state that handles it', async function() {
      let spy = chai.spy();
      let m = new Machine(
        {
          state1: {
            event1: spy
          },
          state2: {}
        },
        'state1'
      );

      let h = m.eventHandler('event1');
      await h();
      spy.should.have.been.called.once;
    });

    it('should call the default handler if defined for an unknown event', async function() {
      let spy1 = chai.spy();
      let spy2 = chai.spy();
      let m = new Machine(
        {
          state1: {
            event1: spy1
          },
          state2: {
            '*': spy2
          }
        },
        'state1'
      );

      var h = m.eventHandler('event1');
      await h();
      spy1.should.have.been.called.once;
      await m.enter('state2');
      await h();
      spy1.should.have.been.called.once;
      spy2.should.have.been.called.once;
    });

    it('should return an error if an event is not handled and no default is defined', function() {
      let spy = chai.spy();
      let m = new Machine(
        {
          state1: {
            event1: spy
          },
          state2: {}
        },
        'state1'
      );

      let h = m.eventHandler('event1');
      return h().then(function() {
        spy.should.have.been.called.once;
        return m.enter('state2').then(function() {
          if (m.state) {
            m.state.should.equal('state2');
          }
          return h().then(
            function() {
              throw new Error('failed');
            },
            function(err) {
              err.name.should.equal('UnhandledEventError');
              spy.should.have.been.called.once;
            }
          );
        });
      });
    });

    it('should ignore an null event', function() {
      let m = new Machine(
        {
          state1: {}
        },
        'state1'
      );

      return m.process(undefined as any).then(
        function() {
          throw new Error('failed');
        },
        function(err) {
          err.name.should.equal('InvalidEventError');
        }
      );
    });
  });

  describe('defer', function() {
    it('should defer an event and process it in the next state if handled (1)', async function() {
      let spy = chai.spy();
      let m = new Machine(
        {
          state1: {
            event1: 'defer'
          },
          state2: {
            event1: spy
          }
        },
        'state1'
      );

      let h = m.eventHandler('event1');
      let deferred = h();
      spy.should.not.have.been.called;
      await m.enter('state2');
      await deferred;
      spy.should.have.been.called.once;
    });

    it('should defer an event and process it in the next state if handled (2)', async function() {
      let spy = chai.spy();
      let m = new Machine(
        {
          state1: {
            event1: 'defer'
          },
          state2: {
            event1: 'defer'
          },
          state3: {
            event1: spy
          }
        },
        'state1'
      );

      let h = m.eventHandler('event1');
      let deferred = h();
      spy.should.not.have.been.called;
      await m.enter('state2');
      spy.should.not.have.been.called;
      (m as any).deferredEvents.length.should.equal(1);
      await m.enter('state3');
      await deferred;
      spy.should.have.been.called.once;
      (m as any).deferredEvents.length.should.equal(0);
    });

    it('should defer an event and process it in the next state if handled (3)', async function() {
      let spy = chai.spy();
      let m = new Machine(
        {
          state1: {
            event1: 'defer'
          },
          state2: {
            event1: 'defer'
          },
          state3: {
            event1: spy
          }
        },
        'state1'
      );

      let h = m.eventHandler('event1');
      let deferred1 = h();
      spy.should.not.have.been.called;
      await m.enter('state2');
      let deferred2 = h();
      spy.should.not.have.been.called;
      await m.enter('state3');
      await deferred1;
      await deferred2;
      spy.should.have.been.called.twice;
      (m as any).deferredEvents.length.should.equal(0);
    });

    it('should process all deferred events even if some fail and return a resolve promise', async function() {
      debugger;
      let spy = chai.spy();
      let m = new Machine(
        {
          state1: {
            event1: 'defer',
            event2: 'defer',
            event3: 'defer',
            event4: 'defer'
          },
          state2: {
            event1: 'defer',
            event2: 'defer',
            event3: 'defer',
            event4: 'defer'
          },
          state3: {
            event1: () => {
              throw new Error('a');
            },
            event2: spy,
            event3: 'noop'
          }
        },
        'state1'
      );

      await m.ready;
      m.process('event4').catch(() => {});
      m.process('event3');
      m.process('event2');
      m.process('event1').catch(() => {});
      m.process('event4').catch(() => {});
      m.process('event3');
      m.process('event2');
      m.process('event1').catch(() => {});
      m.process('event4').catch(() => {});
      m.process('event3');
      m.process('event2');
      m.process('event1').catch(() => {});
      return new Promise(resolve => {
        setTimeout(async () => {
          await m.enter('state2');
          await m.enter('state3');
          spy.should.have.been.called.exactly(3);
          resolve();
        }, 10);
      });
    });

    it('should return a failed promise if a deferred event is ignored in a subsequent state', async function() {
      let m = new Machine(
        {
          state1: {
            event1: 'defer'
          },
          state2: {}
        },
        'state1'
      );

      await m.ready;
      let deferred = m.process('event1');
      await m.enter('state2');
      deferred.should.eventually.be.rejected;
    });
  });

  describe('noop', function() {
    it('should do nothing', function() {
      let m = new Machine(
        {
          state1: {
            event1: 'noop'
          }
        },
        'state1'
      );

      let h = m.eventHandler('event1');
      return h();
    });
  });

  describe('eventHandler', function() {
    it('should create a default event handler', async function() {
      let m = new Machine(
        {
          start: {}
        },
        'start'
      );

      let spy = chai.spy();
      let h = m.eventHandler({
        '*': spy
      });
      await h();
      spy.should.have.been.called;
    });

    it('should create an event handler whose state handlers are called according to the fsm state', async function() {
      let m = new Machine(
        {
          start: {},
          work: {},
          end: {},
          unexp: {}
        },
        'start'
      );
      let start_spy = chai.spy();
      let work_spy = chai.spy();
      let end_spy = chai.spy();
      let h = m.eventHandler({
        start: start_spy,
        work: work_spy,
        end: end_spy
      });
      await h();
      start_spy.should.have.been.called.once;
      work_spy.should.not.have.been.called;
      end_spy.should.not.have.been.called;
      await m.enter('work');
      await h();
      start_spy.should.have.been.called.once;
      work_spy.should.have.been.called.once;
      end_spy.should.not.have.been.called;
      await m.enter('end');
      await h();
      start_spy.should.have.been.called.once;
      work_spy.should.have.been.called.once;
      end_spy.should.have.been.called.once;
      await m.enter('unexp');
      debugger;
      await h().then(
        () => {
          throw new Error('should have failed');
        },
        _err => {
          return true;
        }
      );
      delete m.state;
      await h().then(
        () => {
          throw new Error('should have failed');
        },
        _err => {
          return true;
        }
      );
    });

    it('should preserve the original arguments when calling a state handler', async function() {
      let m = new Machine(
        {
          start: {},
          end: {}
        },
        'start'
      );

      let spy = chai.spy();
      let h = m.eventHandler({
        '*': spy
      });
      await h('aaa', 1);
      spy.should.have.been.called.with('aaa', 1);
    });

    it('should fail when handling an event for a state not covered', function() {
      let m = new Machine(
        {
          start: {},
          end: {}
        },
        'start'
      );

      let spy = chai.spy();
      let h = m.eventHandler({
        end: spy
      });
      return h().then(
        function() {
          throw new Error('failed');
        },
        function(err) {
          err.name.should.equal('UnhandledEventError');
        }
      ); // current state is start and it's not covered by the handler
    });

    it('should return the return value of the original event handler', async function() {
      let m = new Machine(
        {
          start: {
            ev: function() {
              return 4;
            },
            '*': function() {
              return 3;
            }
          }
        },
        'start'
      );

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
      let m = new Machine(
        {
          start: {
            ev: function(i) {
              return i * 2;
            }
          }
        },
        'start'
      );

      let h = m.callbackEventHandler('ev');

      h(5, function(err, res) {
        should.not.exist(err);
        res.should.equal(10);
        done();
      });
    });

    it('should call the callback with the error of the promise returned by the event handler', function(done) {
      let m = new Machine(
        {
          start: {
            ev: function(i) {
              return i * 2;
            }
          }
        },
        'start'
      );

      let h = m.callbackEventHandler('aaa');

      h(5, function(err, _res) {
        err.name.should.equal('UnhandledEventError');
        done();
      });
    });

    it('should not fail if no callback is passed', function() {
      let m = new Machine(
        {
          start: {
            ev: function(i) {
              return i * 2;
            }
          }
        },
        'start'
      );

      should.not.Throw(function() {
        let h = m.callbackEventHandler('ev');
        h(5);
      });
    });
  });
});
