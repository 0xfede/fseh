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
      var m = new Machine({
        start: {
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
  });

});