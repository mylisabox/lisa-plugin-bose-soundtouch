'use strict'

const Driver = require('lisa-plugin').Driver
const soundTouchDiscovery = require('lisa-bose-soundtouch/discovery')
const soundTouchTemplate = require('../widgets/soundtouch.json')
const TIMEOUT = 1000

module.exports = class SoundTouchDriver extends Driver {
  constructor(lisa, plugin) {
    super(lisa, plugin)
    this.type = 'soundtouch'
    this.template = soundTouchTemplate
  }

  init() {
    this.devices = {}
    soundTouchDiscovery.search(deviceAPI => {
      this.devices[deviceAPI.device['mac_address']] = deviceAPI
      deviceAPI.socketStart()
      const log = this.log
      deviceAPI.getInfo(json => {
        deviceAPI.device.infos = json.info
        deviceAPI.device.realtime = {}
      })

      deviceAPI.setPoweredListener((poweredOn, json) => {
        if (deviceAPI.device.realtime.power !== poweredOn) {
          this._updatePower(deviceAPI, poweredOn)
        }
        deviceAPI.device.realtime.power = poweredOn
        deviceAPI.device.realtime.nowPlaying = json
        log.debug(poweredOn ? 'Powered On' : 'Powered Off')
      })

      deviceAPI.setIsPlayingListener((isPlaying, json) => {
        if (deviceAPI.device.realtime.isPlaying !== isPlaying) {
          this._updatePlaying(deviceAPI, json)
        }
        deviceAPI.device.realtime.isPlaying = isPlaying
        deviceAPI.device.realtime.nowPlaying = json
        log.debug(isPlaying ? 'Playing' : 'Not playing')
      })

      deviceAPI.setVolumeUpdatedListener((volume, json) => {
        log.debug("VOLUME UPDATED", volume, json)
        if (deviceAPI.device.realtime.volume !== volume) {
          this._updateVolume(deviceAPI, volume)
        }
        deviceAPI.device.realtime.volume = volume
      })

      deviceAPI.setNowPlayingUpdatedListener(json => {
        log.debug("NOW PLAYING UPDATED", json.nowPlaying.ContentItem)

      })

      deviceAPI.setNowSelectionUpdatedListener(json => {
        //log.debug("NOW SELECTION UPDATED", json)
        this._updateSelection(deviceAPI, json.preset.ContentItem)
      })

    })
    return Promise.resolve()
  }

  _updateVolume(deviceApi, volumeLevel) {
    return this._findLisaDevice(deviceApi.device['mac_address']).then(device => {
      if (device && device.data.volume != volumeLevel) {
        device.data.volume = volumeLevel
        return this._updateData(device)
      }
    })
  }

  _updatePower(deviceApi, powerOn) {
    return this._findLisaDevice(deviceApi.device['mac_address']).then(device => {
      if (device && ((device.data.power === 'on') != powerOn)) {
        device.data.power = powerOn ? 'on' : 'off'
        return this._updateData(device)
      }
    })
  }

  _updatePlaying(deviceApi, nowPlaying) {
    return this._findLisaDevice(deviceApi.device['mac_address']).then(device => {
      if (device) {
        device.data.isPlaying = nowPlaying.source === 'STANDBY' ?
          false : nowPlaying
        return this._updateData(device)
      }
    })
  }

  _updateSelection(deviceApi, sourceData) {
    return this._findLisaDevice(deviceApi.device['mac_address']).then(device => {
      if (device) {
        device.data.isPlaying = sourceData.source === 'STANDBY' ?
          false : sourceData
        device.data.source = sourceData.source
        return this._updateData(device)
      }
    })
  }

  _updateData(device) {
    device.template = this.template
    return this.lisa.createOrUpdateDevices(device)
  }

  _getPresetData(index, data) {
    const presetData = data.presets.preset[index]
    return presetData ? presetData.ContentItem : { itemName: index }
  }

  _getDeviceData(device) {
    const deviceApi = this.devices[device.privateData.macAddress]
    return new Promise((resolve, reject) => {
      deviceApi.getPresets(data => {
        device.data.preset1 = this._getPresetData(0, data)
        device.data.preset2 = this._getPresetData(1, data)
        device.data.preset3 = this._getPresetData(2, data)
        device.data.preset4 = this._getPresetData(3, data)
        device.data.preset5 = this._getPresetData(4, data)
        device.data.preset6 = this._getPresetData(5, data)
        resolve(device)
      })
      setTimeout(reject, TIMEOUT)
    }).then(device => new Promise((resolve, reject) => {
      deviceApi.getSources(data => {
        device.data.sources = data.sources.sourceItem
        resolve(device)
      })
      setTimeout(reject, TIMEOUT)
    })).then(device => new Promise((resolve, reject) => {
      deviceApi.getVolume(data => {
        device.data.volume = data.volume.actualvolume
        resolve(device)
      })
      setTimeout(reject, TIMEOUT)
    })).then(device => new Promise((resolve, reject) => {
      deviceApi.isPoweredOn(powerOn => {
        device.data.power = powerOn ? 'on' : 'off'
        resolve(device)
      })
      setTimeout(reject, TIMEOUT)
    })).then(device => new Promise((resolve, reject) => {
      deviceApi.getNowPlaying(data => {
        device.data.isPlaying = data.nowPlaying.ContentItem.source === 'STANDBY' ?
          false : data.nowPlaying.ContentItem
        device.data.state = device.data.isPlaying ? 'play' : 'pause'
        resolve(device)
      })
      setTimeout(reject, TIMEOUT)
    })).then(device => {
      device.template = this.template
      return this.lisa.createOrUpdateDevices(device).then(() => device)
    })
  }

  _togglePower(deviceApi, newValue) {
    return new Promise((resolve, reject) => {
      if (newValue === 'on') {
        deviceApi.powerOn(() => {
          resolve()
        })
      }
      else {
        deviceApi.powerOff(() => {
          resolve()
        })
      }
      setTimeout(() => reject(), TIMEOUT)
    })
  }

  _setPreset(deviceApi, newValue) {
    return new Promise((resolve, reject) => deviceApi.getPresets(data => {
        let presetData = data.presets.preset[newValue - 1]
        if (presetData) {
          presetData = presetData.ContentItem
          deviceApi.select(presetData.source, presetData.type, presetData.sourceAccount, presetData.location, data => {
            resolve()
          })
        }
        else {
          resolve()
        }
        setTimeout(() => reject(), TIMEOUT)
      })
    )
  }

  _setSource(deviceApi, newValue) {
    return new Promise((resolve, reject) => deviceApi.getSources(data => {
        const parts = newValue.split('|')
        const sourceData = data.sources.sourceItem.filter(data => {
          const source = parts[0]
          const sourceAccount = parts[1]
          return data.source === source &&
            (!sourceAccount || sourceAccount && data.sourceAccount === sourceAccount) &&
            data.status === 'READY'
        })[0]
        if (sourceData) {
          deviceApi.select(sourceData.source, sourceData.sourceAccount, sourceData.location, data => {
            this.log.debug(deviceApi.name + ' --> select: ', data)
            resolve()
          })
        }
        setTimeout(() => reject(), TIMEOUT)
      })
    )
  }

  _findLisaDevice(macAddress) {
    return this.lisa.findDevices().then(lisaDevices => {
      let device
      for (let lisaDevice of lisaDevices) {
        if (macAddress === lisaDevice.privateData.macAddress) {
          device = lisaDevice
        }
      }
      return device
    })

  }

  _findRealDevice(lisaDevice) {
    const ids = Object.keys(this.devices)
    for (let id of ids) {
      if (id === lisaDevice.privateData.macAddress) {
        return this.devices[id]
      }
    }
  }

  saveDevice(deviceData) {
    return this.getDevicesData([deviceData]).then(data => {
      return this.lisa.createOrUpdateDevices(data[0])
    })
  }

  getDevicesForPairing(existingDevices) {
    const pairingDevices = []
    const ids = Object.keys(this.devices)
    for (const id of ids) {
      const deviceApi = this.devices[id]
      const existingDevice = existingDevices.filter(existingDevice =>
        existingDevice.privateData.macAddress === deviceApi.device['mac_address'])[0]

      if (existingDevice) {
        continue
      }

      if (deviceApi.device.infos && deviceApi.device.infos.type.toLowerCase().indexOf(this.type) !== -1) {
        pairingDevices.push({
          name: deviceApi.name,
          image: '',
          id: id,
          driver: this.type,
          type: this.lisa.DEVICE_TYPE.MEDIA,
          template: this.template,
          data: {},
          privateData: {
            ip: deviceApi.device.ip,
            macAddress: deviceApi.device['mac_address']
          }
        })
      }
    }
    return pairingDevices
  }

  pairing(data) {
    let results = {
      devices: [],
      step: 'done'
    }
    if (data['devices_list']) {
      results = this.lisa.createOrUpdateDevices(data['devices_list'].map(device => {
        delete device.id
        return device
      })).then(() => Promise.resolve({
        step: 'done'
      }))
    }
    else {
      results = this.lisa.findDevices().then(devices => {
        return Promise.resolve({
          devices: this.getDevicesForPairing(devices),
          step: 'devices_list'
        })
      })
    }

    return results instanceof Promise ? results : Promise.resolve(results)
  }

  getDevicesData(dataDevices) {
    const getData = []
    for (const device of dataDevices) {
      const request = this._getDeviceData(device)
      getData.push(request)
    }
    return Promise.all(getData)
  }

  _setVolume(deviceApi, volumeLevel) {
    return new Promise((resolve, reject) => {
      deviceApi.setVolume(volumeLevel, data => {
        resolve()
      })
      setTimeout(() => reject(), TIMEOUT)
    })
  }

  _stopPlayer(deviceApi) {
    return new Promise((resolve, reject) => {
      deviceApi.stop(data => {
        resolve()
      })
      setTimeout(() => reject(), TIMEOUT)
    })
  }

  _playPausePlayer(deviceApi) {
    return new Promise((resolve, reject) => {
      deviceApi.playPause(data => {
        resolve()
      })
      setTimeout(() => reject(), TIMEOUT)
    })
  }

  _nextPlayer(deviceApi) {
    return new Promise((resolve, reject) => {
      deviceApi.next(data => {
        resolve()
      })
      setTimeout(() => reject(), TIMEOUT)
    })
  }

  _previousPlayer(deviceApi) {
    return new Promise((resolve, reject) => {
      deviceApi.previous(data => {
        resolve()
      })
      setTimeout(() => reject(), TIMEOUT)
    })
  }

  setDeviceValue(device, key, newValue) {
    const deviceApi = this._findRealDevice(device)
    if (deviceApi) {
      if (key === 'power') {
        return this._togglePower(deviceApi, newValue)
      }
      else if (key === 'preset') {
        return this._setPreset(deviceApi, newValue)
      }
      else if (key === 'volume') {
        return this._setVolume(deviceApi, newValue)
      }
      else if (key === 'playpause') {
        return this._playPausePlayer(deviceApi, newValue)
      }
      else if (key === 'stop') {
        return this._stopPlayer(deviceApi)
      }
      else if (key === 'next') {
        return this._nextPlayer(deviceApi, newValue)
      }
      else if (key === 'previous') {
        return this._previousPlayer(deviceApi, newValue)
      }
    }
    return Promise.reject()
  }

  setDevicesValue(devices, key, newValue) {

  }

  unload() {
    soundTouchDiscovery.stopSearching()
    return Promise.resolve()
  }
}
