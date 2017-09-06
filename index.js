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
    return super.interact(action, infos)
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
