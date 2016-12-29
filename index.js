var mat4 = require('gl-mat4')
var smooth = require('smooth-state')
var defined = require('defined')
var inherits = require('inherits')
var EventEmitter = require('events').EventEmitter
var sin = Math.sin, cos = Math.cos
var R = 6378137

var up = [0,1,0]
var tmp0 = [0,0,0], tmp1 = [0,0,0], tmp2 = [0,0,0], tmp3 = [0,0,0]

inherits(Mix, EventEmitter)
module.exports = Mix

function Mix (opts) {
  if (!(this instanceof Mix)) return new Mix(opts)
  EventEmitter.call(this)
  if (!opts) opts = {}
  this.state = smooth({
    eye: [0,0,1]
  })
  this._projection = []
}

Mix.prototype.tie = function (key) {
  var self = this
  return function (c) {
    return self.get(key, c)
  }
}

Mix.prototype.get = function (key, c) {
  if (c === undefined) c = this.state._time || 0
  if (key === 'projection') {
    var aspect = c.aspect || (c.viewportWidth && c.viewportHeight
      && c.viewportWidth / c.viewportHeight) || 1
    return mat4.perspective(this._projection, Math.PI/8, aspect, 0.00005*R, 100*R)
  } else return this.state.get(key,c)
}

Mix.prototype.set = function (key, c) {
  this.state.set(key, c)
}
