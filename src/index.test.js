var chai = require('chai')
  , spies = require('chai-spies')
  , should = chai.should()
  , Machine = require('../dist/index').Machine

chai.use(spies);

describe('fseh', function() {
  describe('constructor', function() {
    it('should create a Machine with no initial state', function() {
      var m = new Machine({ start: {} });
      should.not.exist(m.state);
    });

    it('should create a Machine that transits to the initial state', function() {
      var m = new Machine({ start: {} }, 'start');
      should.exist(m.state);
      m.state.should.be.a('string');
      m.state.should.equal('start');
    });

    it('should create a Machine that transits to the initial state and calls the entry function', function() {
      var spy = chai.spy(function() {
        should.exist(this.state);
        this.state.should.be.a('string');
        this.state.should.equal('start');
      });
      new Machine({
        start: {
          onEntry: spy
        }
      }, 'start');
      spy.should.have.been.called();
    });

    it('should create a Machine with a state list and transit to the initial state', function() {
      var m = new Machine([ 'start', 'work', 'end' ], 'start');
      should.exist(m.state);
      m.state.should.be.a('string');
      m.state.should.equal('start');
      should.exist(m.states);
      m.states.should.deep.equal({ 'start': {}, 'work': {}, 'end': {} });
    });

    it('should create a Machine with two-step construction', function() {
      var m = new Machine();
      should.not.exist(m.state);
      m.init([ 'start', 'work', 'end' ], 'start');
      should.exist(m.state);
      m.state.should.be.a('string');
      m.state.should.equal('start');
      should.exist(m.states);
      m.states.should.deep.equal({ 'start': {}, 'work': {}, 'end': {} });
    })
  });

  describe('enter', function() {
    it('should transit to a known state', function() {
      var m = new Machine({
        start: {}
      });
      should.not.exist(m.state);
      m.enter('start');
      should.exist(m.state);
      m.state.should.be.a('string');
      m.state.should.equal('start');
    });

    it('should not transit to an unknown state', function() {
      var m = new Machine({
        start: {}
      });
      should.not.exist(m.state);
      should.Throw(function() {
        m.enter('blabla');
      });
    });

    it('should do nothing when transiting to the current state', function() {
      var m = new Machine({
        start: {}
      }, 'start');
      m.enter('start');
      should.exist(m.state);
      m.state.should.be.a('string');
      m.state.should.equal('start');
    });

    it('should perform a valid transition', function() {
      var m = new Machine({
        start: {
          transitions: [ 'end' ]
        },
        end: {}
      }, 'start');
      should.exist(m.state);
      m.state.should.be.a('string');
      m.state.should.equal('start');

      m.enter('end');
      m.state.should.be.a('string');
      m.state.should.equal('end');
    });

    it('should not perform an invalid transition', function() {
      var spy = chai.spy();
      var m = new Machine({
        start: {
          onExit: spy,
          transitions: [ 'end' ]
        },
        end: {},
        end2: {}
      }, 'start');
      should.exist(m.state);
      m.state.should.be.a('string');
      m.state.should.equal('start');

      should.Throw(function() {
        m.enter('end2');
      });
      m.state.should.be.a('string');
      m.state.should.equal('start');
      spy.should.not.have.been.called();
    });

    it('should perform a valid transition calling exit and entry functions', function() {
      var start_entry = chai.spy();
      var start_exit = chai.spy();
      var end_entry = chai.spy();

      var m = new Machine({
        start: {
          onEntry: start_entry,
          onExit: start_exit,
          transitions: [ 'end' ]
        },
        end: {
          onEntry: end_entry
        }
      }, 'start');
      should.exist(m.state);
      start_entry.should.have.been.called();
      start_exit.should.not.have.been.called();
      end_entry.should.not.have.been.called();
      m.state.should.be.a('string');
      m.state.should.equal('start');

      m.enter('end');
      start_entry.should.have.been.called.once();
      start_exit.should.have.been.called();
      end_entry.should.have.been.called();
      m.state.should.be.a('string');
      m.state.should.equal('end');
    });
  });

  describe('process', function() {
    it('should process a known event in a state that handles it', function() {
      var spy = chai.spy();
      var m = new Machine({
        state1: {
          events: {
            'event1': spy
          },
          transitions: [ 'state2' ]
        },
        state2: {
        }
      }, 'state1');

      var h = m.eventHandler('event1');
      h.should.be.a('function');
      h();
      spy.should.have.been.called.once();
      m.enter('state2');
      h();
      spy.should.have.been.called.once();
    });

    it('should call the default handler if defined for an unknown event', function() {
      var spy = chai.spy();
      var m = new Machine({
        state1: {
          events: {
            'event1': spy
          },
          transitions: [ 'state2' ]
        },
        state2: {
          events: {
            '*': spy
          }
        }
      }, 'state1');

      var h = m.eventHandler('event1');
      h.should.be.a('function');
      h();
      spy.should.have.been.called.once();
      m.enter('state2');
      h();
      spy.should.have.been.called.twice();
    });

    it('should ignore an event if not handled and no default is defined', function() {
      var spy = chai.spy();
      var m = new Machine({
        state1: {
          events: {
            'event1': spy
          },
          transitions: [ 'state2' ]
        },
        state2: {
          events: {}
        }
      }, 'state1');

      var h = m.eventHandler('event1');
      h.should.be.a('function');
      h();
      spy.should.have.been.called.once();
      m.enter('state2');
      h();
      spy.should.have.been.called.once();
    });

    it('should ignore an null event', function() {
      var spy = chai.spy();
      var m = new Machine({
        state1: {
          events: {
            'event1': spy
          },
          transitions: [ 'state2' ]
        },
        state2: {
          events: {}
        }
      }, 'state1');

      m.process();
    });
  });

  describe('eventHandler', function() {
    it('should create a default event handler', function() {
      var m = new Machine({
        start: {
          transitions: [ 'end' ]
        },
        end: {
        }
      }, 'start');

      var spy = chai.spy();
      var h = m.eventHandler({
        '*': spy
      });
      h.should.be.a('function');
      h();
      spy.should.have.been.called();
    });

    it('should create an event handler whose state handlers are called according to the fsm state', function() {
      var m = new Machine({
        start: {
          transitions: [ 'work', 'end' ]
        },
        work: {
          transitions: [ 'end' ]
        },
        end: {
        }
      }, 'start');

      var start_spy = chai.spy();
      var work_spy = chai.spy();
      var end_spy = chai.spy();
      var h = m.eventHandler({
        start: start_spy,
        work: work_spy,
        end: end_spy
      });
      h.should.be.a('function');
      h();
      start_spy.should.have.been.called.once();
      work_spy.should.not.have.been.called();
      end_spy.should.not.have.been.called();
      m.enter('work');
      h();
      start_spy.should.have.been.called.once();
      work_spy.should.have.been.called.once();
      end_spy.should.not.have.been.called();
      m.enter('end');
      h();
      start_spy.should.have.been.called.once();
      work_spy.should.have.been.called.once();
      end_spy.should.have.been.called.once();
    });

    it('should preserve the original arguments when calling a state handler', function() {
      var m = new Machine({
        start: {
          transitions: [ 'end' ]
        },
        end: {
        }
      }, 'start');

      var spy = chai.spy();
      var h = m.eventHandler({
        '*': spy
      });
      h.should.be.a('function');
      h('aaa', 1);
      spy.should.have.been.called.with('aaa', 1);
    });

    it('should do nothing when handling an event for state not covered', function() {
      var m = new Machine({
        start: {
          transitions: [ 'end' ]
        },
        end: {
        }
      }, 'start');

      var spy = chai.spy();
      var h = m.eventHandler({
        end: spy
      });
      h(); // current state is start and it's not covered by the handler
    });

    it('should return the return value of the original event handler', function() {
      var m = new Machine({
        start: {
          events: {
            ev: function() {
              return 4;
            },
            '*': function() {
              return 3;
            }
          }
        }
      }, 'start');

      var h = m.eventHandler({
        start: function() {
          return 5;
        }
      });
      h().should.equal(5);
      m.eventHandler('ev')(1, 2, 3).should.equal(4);
      m.eventHandler('ev__')().should.equal(3);
    });
  });

});