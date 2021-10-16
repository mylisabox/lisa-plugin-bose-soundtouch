import {createRequire} from 'module';
import SoundTouchDriver from './soundtouch.js';

const require = createRequire(import.meta.url);
const lifestyleTemplate = require('../widgets/lifestyle.json')

export default class LifeStyleDriver extends SoundTouchDriver {
  constructor(lisa, plugin) {
    super(lisa, plugin)
    this.type = 'lifestyle'
    this.template = lifestyleTemplate
  }
}
