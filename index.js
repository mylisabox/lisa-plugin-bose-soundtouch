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
    const volume = infos.fields.number
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
      case "MUTE_VOLUME":
        break
      case "UNMUTE_VOLUME":
        break
      case "SET_VOLUME":
        key = 'volume'
        value = volume
        break
      case "INCREASE_VOLUME_AGAIN":
      case "INCREASE_VOLUME":
        key = 'increase_volume'
        value = volume
        break
      case "DECREASE_VOLUME_AGAIN":
      case "DECREASE_VOLUME":
        key = 'decrease_volume'
        value = volume
        break
      case "PAUSE_MEDIA_CENTER":
        key = 'playpause'
        value = 'pause'
        break
      case "PLAY_MEDIA_CENTER":
        key = 'playpause'
        value = 'play'
        break
      case "STOP_MEDIA_CENTER":
        key = 'stop'
        break
      case "NEXT_SONG":
      case "NEXT_SONG_AGAIN":
        key = 'next'
        break
      case "PREVIOUS_SONG":
      case "PREVIOUS_SONG_AGAIN":
        key = 'previous'
        break
      default:
        return Promise.resolve()
    }

    const criteria = {}
    if (room) {
      criteria.roomId = room.id
      return this.lisa.findDevices(criteria).then(devices => {
        const data = {
          lifestyle: [],
          soundtouch: []
        }
        for (let i = 0; i < devices.length; i++) {
          const deviceBose = devices[i];
          data[deviceBose.driver].push(deviceBose)
        }
        return Promise.all([
          this.drivers['soundtouch'].setDevicesValue(data.soundtouch, key, value),
          this.drivers['lifestyle'].setDevicesValue(data.lifestyle, key, value)
        ])
      })
    }
    else if (device) {
      return this.drivers[device.driver].setDeviceValue(device, key, value)
    }
    else {
      return Promise.resolve()
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
