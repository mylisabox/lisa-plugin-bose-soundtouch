'use strict'

const Plugin = require('lisa-plugin')

module.exports = class SoundTouchPlugin extends Plugin {

  /**
   * Called when
   * @param action to execute
   * @param infos context of the action
   * @return Promise
   */
  interact(action, infos) {
    const room = infos.fields.room || infos.context.room
    const device = infos.fields.device
    if (device && device.pluginName !== this.fullName) {
      return Promise.resolve()
    }
    let key
    let value
    switch (action) {
      case 'DEVICE_TURN_ON':
        key = 'power'
        value = 'on'
        break
      case 'DEVICE_TURN_OFF':
        key = 'power'
        value = 'off'
        break
      default:
        return Promise.resolve()
    }

    const criteria = {}
    if (room) {
      criteria.roomId = room.id

      return this.lisa.findDevices(criteria).then(devices => {
        return this.drivers['soundtouch'].setDevicesValue(devices, key, value)
      })
    }
    else if (device) {
      return this.drivers[device.driver].setDeviceValue(device, key, value)
    }
    else {
      return this.drivers['soundtouch'].setDeviceValue(null, key, value)
    }
  }

  constructor(app) {
    super(app, {
      config: require('./config'),
      drivers: require('./drivers'),
      pkg: require('./package'),
      //bots: require('./bots')
    })
  }
}
