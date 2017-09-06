'use strict'

const SoundTouchDriver = require('./soundtouch')
const lifestyleTemplate = require('../widgets/lifestyle.json')

module.exports = class LifeStyleDriver extends SoundTouchDriver {
  constructor(lisa, plugin) {
    super(lisa, plugin)
    this.type = 'lifestyle'
    this.template = lifestyleTemplate
  }
}
