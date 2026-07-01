const winston = require('winston')

describe('Logger', () => {
  let logger

  beforeEach(() => {
    // Re-import to reset state
    jest.resetModules()
    logger = require('../../../src/utils/logger')
  })

  it('debe tener método info', () => {
    expect(logger.info).toBeDefined()
    expect(typeof logger.info).toBe('function')
  })

  it('debe tener método error', () => {
    expect(logger.error).toBeDefined()
  })

  it('debe formatear logs como JSON', () => {
    const Transport = require('winston-transport')

    class MockTransport extends Transport {
      constructor() {
        super()
        this.logSpy = jest.fn()
      }

      log(info, callback) {
        this.logSpy(info)
        callback()
      }
    }

    const mockTransport = new MockTransport()
    logger.add(mockTransport)

    logger.info('test message', { requestId: '123' })

    expect(mockTransport.logSpy).toHaveBeenCalled()
    const call = mockTransport.logSpy.mock.calls[0][0]
    expect(call.level).toBe('info')
    expect(call.message).toBe('test message')
    expect(call.requestId).toBe('123')
  })
})
