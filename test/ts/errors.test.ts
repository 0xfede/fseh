import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as spies from 'chai-spies';
import { InvalidEventError, InvalidStateError, UnhandledEventError, UnknownStateError } from '../../dist/errors';

chai.use(spies);
chai.use(chaiAsPromised);

describe('Errors', function() {
  describe('InvalidEventError', function() {
    it('should not fail when Error.captureStackTrace is not available', function() {
      const save = Error.captureStackTrace;
      try {
        delete Error.captureStackTrace;
        new InvalidEventError('test');
        new InvalidEventError('test', 'test', true);
      } finally {
        Error.captureStackTrace = save;
      }
    });
  });
  describe('UnhandledEventError', function() {
    it('should not fail when Error.captureStackTrace is not available', function() {
      const save = Error.captureStackTrace;
      try {
        delete Error.captureStackTrace;
        new UnhandledEventError('test');
      } finally {
        Error.captureStackTrace = save;
      }
    });
  });
  describe('InvalidStateError', function() {
    it('should not fail when Error.captureStackTrace is not available', function() {
      const save = Error.captureStackTrace;
      try {
        delete Error.captureStackTrace;
        new InvalidStateError('test');
      } finally {
        Error.captureStackTrace = save;
      }
    });
  });
  describe('UnknownStateError', function() {
    it('should not fail when Error.captureStackTrace is not available', function() {
      const save = Error.captureStackTrace;
      try {
        delete Error.captureStackTrace;
        new UnknownStateError('test');
      } finally {
        Error.captureStackTrace = save;
      }
    });
  });
});
