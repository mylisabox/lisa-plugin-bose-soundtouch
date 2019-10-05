'use strict'

const Driver = require('lisa-plugin').Driver
const soundTouchDiscovery = require('lisa-bose-soundtouch/discovery')
const soundTouchTemplate = require('../widgets/soundtouch.json')

module.exports = class SoundTouchDriver extends Driver {
  constructor(lisa, plugin) {
    super(lisa, plugin)
    this.type = 'soundtouch'
    this.devices = {}
    this.template = soundTouchTemplate
  }

  init() {
    this.devices = {}

    const wantedType = this.type
    if (!this.isInitDone) {
      this.isInitDone = true
      soundTouchDiscovery.search(deviceAPI => {
        if (!deviceAPI.device.fullname.toLowerCase().startsWith(wantedType)) {
          return
        }

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
          log.debug('VOLUME UPDATED', volume, json)
          if (deviceAPI.device.realtime.volume !== volume) {
            this._updateVolume(deviceAPI, volume)
          }
          deviceAPI.device.realtime.volume = volume
        })

        /*
        deviceAPI.setNowPlayingUpdatedListener(json => {
          log.debug("NOW PLAYING UPDATED", json.nowPlaying.ContentItem)

        })*/

        deviceAPI.setNowSelectionUpdatedListener(json => {
          //log.debug("NOW SELECTION UPDATED", json)
          this._updateSelection(deviceAPI, json.preset.ContentItem)
        })

      })
    }
    return Promise.resolve()
  }

  _updateVolume(deviceApi, volumeLevel) {
    return this._findLisaDevice(deviceApi.device['mac_address']).then(device => {
      if (device && device.data.volume !== volumeLevel) {
        device.data.volume = volumeLevel
        return this._updateData(device)
      }
    })
  }

  _updatePower(deviceApi, powerOn) {
    return this._findLisaDevice(deviceApi.device['mac_address']).then(device => {
      if (device && ((device.data.power === 'on') !== powerOn)) {
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
    return presetData ? {itemName: presetData.ContentItem.itemName.text} : { itemName: index }
  }

  _getVolume(deviceApi) {
    return new Promise((resolve, reject) => {
      deviceApi.getVolume(data => {
        if (data.errors && data.errors.error) {
          reject(data.errors.error)
        }
        else {
          resolve(parseInt(data.volume.actualvolume.text))
        }
      })
    })
  }

  _getDeviceData(device) {
    const deviceApi = this.devices[device.privateData.macAddress]
    if(deviceApi == null) {//no connection to device, return cache values
      return Promise.resolve(device);
    }
    return new Promise((resolve, reject) => {
      deviceApi.getPresets(data => {
        if (data.errors && data.errors.error) {
          reject(data.errors.error)
        }
        else {
          device.data.preset1 = this._getPresetData(0, data)
          device.data.preset2 = this._getPresetData(1, data)
          device.data.preset3 = this._getPresetData(2, data)
          device.data.preset4 = this._getPresetData(3, data)
          device.data.preset5 = this._getPresetData(4, data)
          device.data.preset6 = this._getPresetData(5, data)
          resolve(device)
        }
      })
    }).then(device => new Promise((resolve, reject) => {
      deviceApi.getSources(data => {
        if (data.errors && data.errors.error) {
          reject(data.errors.error)
        }
        else {
          device.data.sources = data.sources.sourceItem
          resolve(device)
        }
      })
    })).then(device => this._getVolume(deviceApi).then(volume => {
      device.data.volume = volume
      return Promise.resolve(device)
      })
    ).then(device => new Promise((resolve, reject) => {
      deviceApi.isPoweredOn(powerOn => {
        device.data.power = powerOn ? 'on' : 'off'
        resolve(device)
      })
    })).then(device => new Promise((resolve, reject) => {
      deviceApi.getNowPlaying(data => {
        if (data.errors && data.errors.error) {
          reject(data.errors.error)
        }
        else {
          device.data.isPlaying = data.nowPlaying.playStatus && data.nowPlaying.playStatus.text === 'PLAY_STATE'
          device.data.state = device.data.isPlaying ? 'pause' : 'play'
          resolve(device)
        }
      })
    })).then(device => {
      device.template = this.template
      return this.lisa.createOrUpdateDevices(device).then(() => device)
    })
  }

  _togglePower(deviceApi, newValue) {
    return new Promise((resolve, reject) => {
      if (newValue === 'on') {
        deviceApi.powerOn(data => {
          if (data.errors && data.errors.error) {
            reject(data.errors.error)
          }
          else {
            resolve()
          }
        })
      }
      else {
        deviceApi.powerOff(data => {
          if (data.errors && data.errors.error) {
            reject(data.errors.error)
          }
          else {
            resolve()
          }
        })
      }
    })
  }

  _setPreset(deviceApi, newValue) {
    return new Promise((resolve, reject) => deviceApi.getPresets(data => {
        let presetData = data.presets.preset[newValue - 1]
        if (presetData) {
          presetData = presetData.ContentItem
          deviceApi.select(presetData.attributes.source, presetData.attributes.type, presetData.attributes.sourceAccount, presetData.attributes.location, data => {
            if (data.errors && data.errors.error) {
              reject(data.errors.error)
            }
            else {
              resolve()
            }
          })
        }
        else {
          reject(new Error('preset not find'))
        }
      })
    )
  }

  _setSource(deviceApi, newValue) {
    return new Promise((resolve, reject) => deviceApi.getSources(data => {
        const parts = newValue.split('|')
      let source = parts[0].toLowerCase()
      let sourceAccount = parts[1]
      if (source.startsWith('hdmi_')) {
        sourceAccount = source.toUpperCase()
        source = 'product'
      }
        const sourceData = data.sources.sourceItem.filter(data => {
          return data.source.toLowerCase() === source &&
            (!sourceAccount || sourceAccount && data.sourceAccount === sourceAccount)
        })[0]
        if (sourceData) {
          deviceApi.select(sourceData.source, sourceData.type || '', sourceData.sourceAccount || '', sourceData.location || '', data => {
            this.log.debug(deviceApi.name + ' --> select: ', data)
            if (data.errors && data.errors.error) {
              reject(data.errors.error)
            }
            else {
              resolve()
            }
          })
        }
        else {
          reject(new Error('source not find'))
        }
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

      if (deviceApi.device.infos && deviceApi.device.infos.type.text.toLowerCase().indexOf(this.type) !== -1) {
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
        if (data.errors && data.errors.error) {
          reject(data.errors.error)
        }
        else {
          resolve()
        }
      })
    })
  }

  _stopPlayer(deviceApi) {
    return new Promise((resolve, reject) => {
      deviceApi.stop(data => {
        if (data.errors && data.errors.error) {
          reject(data.errors.error)
        }
        else {
          resolve()
        }
      })
    })
  }

  _playPausePlayer(deviceApi) {
    return new Promise((resolve, reject) => {
      deviceApi.playPause(data => {
        if (data.errors && data.errors.error) {
          reject(data.errors.error)
        }
        else {
          resolve()
        }
      })
    })
  }

  _nextPlayer(deviceApi) {
    return new Promise((resolve, reject) => {
      deviceApi.next(data => {
        if (data.errors && data.errors.error) {
          reject(data.errors.error)
        }
        else {
          resolve()
        }
      })
    })
  }

  _previousPlayer(deviceApi) {
    return new Promise((resolve, reject) => {
      deviceApi.previous(data => {
        if (data.errors && data.errors.error) {
          reject(data.errors.error)
        }
        else {
          resolve()
        }
      })
    })
  }

  setDeviceValue(device, key, newValue) {
    const deviceApi = this._findRealDevice(device)
    if (deviceApi) {
      switch (key) {
        case 'power':
          return this._togglePower(deviceApi, newValue)
        case 'preset':
          return this._setPreset(deviceApi, newValue)
        case 'source':
          return this._setSource(deviceApi, newValue)
        case 'volume':
          return this._setVolume(deviceApi, newValue)
        case 'increase_volume':
          return this._getVolume(deviceApi).then(volume => this._setVolume(deviceApi, parseInt(volume) + newValue))
        case 'decrease_volume':
          return this._getVolume(deviceApi).then(volume => this._setVolume(deviceApi, parseInt(volume) - newValue))
        case 'playpause':
          return this._playPausePlayer(deviceApi, newValue)
        case 'stop':
          return this._stopPlayer(deviceApi)
        case 'next':
          return this._nextPlayer(deviceApi)
        case 'previous':
          return this._previousPlayer(deviceApi)
      }
    }
    return Promise.reject()
  }

  setDevicesValue(devices, key, newValue) {
    const actions = []
    for (let device of devices) {
      actions.push(this.setDeviceValue(device, key, newValue))
    }
    return Promise.all(actions)
  }

  unload() {
    soundTouchDiscovery.stopSearching()
    return Promise.resolve()
  }
}
