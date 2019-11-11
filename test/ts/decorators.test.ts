import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as spies from 'chai-spies';
import { defer, entry, exit, fsm, handle, Machine, noop } from '../../dist';

const should = chai.should();
chai.use(spies);
chai.use(chaiAsPromised);

describe('decorators', function() {
  it('should create a state machine with decorators', async function() {
    const _start = chai.spy();
    const _e1End = chai.spy();

    @fsm('start')
    class Test extends Machine {
      @entry('start')
      start() {
        _start();
      }

      @noop('start', 'e2')
      @handle('start', 'e1')
      e1Start() {
        this.enter('next');
      }

      @defer('next', 'e1')
      @noop('next', 'e2')
      @entry('next')
      next() {
        this.enter('end');
      }

      @handle('end', 'e1')
      e1End() {
        _e1End();
      }
    }

    const t = new Test();
    await t.process('e1');
    _start.should.have.been.called.once;
    should.exist(t.state);
    if (t.state) {
      t.state.should.equal('end');
      _start.should.have.been.called.once;
    }
  });
  it('derived machines should merge tables', async function() {
    const _start = chai.spy();
    const _e1End = chai.spy();
    const _e2Start = chai.spy();
    const _nextExit = chai.spy();

    @fsm('start')
    class Test extends Machine {
      @entry('start')
      start() {
        _start();
      }

      @noop('start', 'e2')
      @handle('start', 'e1')
      e1Start() {
        this.enter('next');
      }

      @defer('next', 'e1')
      @noop('next', 'e2')
      @entry('next')
      next() {
        this.enter('end');
      }

      @handle('end', 'e1')
      e1End() {
        _e1End();
      }
    }

    @fsm()
    class Test2 extends Test {
      @handle('start', 'e2')
      e2Start() {
        _e2Start();
      }
      @exit('next')
      nextExit() {
        _nextExit();
      }
    }

    const t = new Test2();
    await t.process('e2');
    await t.process('e1');
    _nextExit.should.have.been.called.once;
    _e2Start.should.have.been.called.once;
    _start.should.have.been.called.once;
    should.exist(t.state);
    if (t.state) {
      t.state.should.equal('end');
      _start.should.have.been.called.once;
    }
  });
});
