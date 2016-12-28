var mat4 = require('gl-mat4')
var smooth = require('smooth-state')
var defined = require('defined')
var inherits = require('inherits')
var EventEmitter = require('events').EventEmitter
var sin = Math.sin, cos = Math.cos

var up = [0,1,0]
var tmp0 = [0,0,0], tmp1 = [0,0,0], tmp2 = [0,0,0], tmp3 = [0,0,0]

inherits(Mix, EventEmitter)
module.exports = Mix

function Mix (opts) {
  if (!(this instanceof Mix)) return new Mix(opts)
  EventEmitter.call(this)
  if (!opts) opts = {}
  this.state = smooth({
    eye: [0,0,4],
    projmix: 0
  })
  this._prevProjectFn = opts.projectfn || globe
  this._projectFn = opts.projectfn || globe
  this._view = []
  this._projection = []
}

Mix.prototype.project = function (out, p, c) {
  var pm = this.state.get('projmix', c)
  this._prevProjectFn(tmp0, p)
  this._projectFn(tmp1, p)
  return mix(out, tmp0, tmp1, pm)
}

Mix.prototype.positions = function (n, positions) {
  var self = this
  var len = positions.length
  var mapped = new Array(len)
  var fn = null
  if (n === 0) fn = self._prevProjectFn
  else if (n === 1) fn = self._projectFn
  else throw new Error('n must be 0 or 1, received: ' + n)

  for (var i = 0; i < len; i++) mapped[i] = [0,0,0]
  update()
  this.on('update-projectfn', update)
  //return function () { return mapped }
  return mapped

  function update () {
    for (var i = 0; i < len; i++) {
      fn(mapped[i], positions[i])
    }
  }
}

Mix.prototype.tie = function (key) {
  var self = this
  return function (c) {
    return self.get(key, c)
  }
}

Mix.prototype.get = function (key, c) {
  if (c === undefined) c = this.state._time || 0
  if (key === 'view') {
    var eye = this.state.get('eye', c)
    this.project(tmp2, eye, c) // sky point
    tmp3[0] = eye[0]
    tmp3[1] = eye[1]
    tmp3[1][2] = 0 // ground point
    this.project(tmp3, tmp3, c)
    return mat4.lookAt(this._view, tmp3, tmp2, up)
  } else if (key === 'projection') {
    var aspect = c.aspect || (c.viewportWidth && c.viewportHeight
      && c.viewportWidth / c.viewportHeight) || 1
    return mat4.perspective(this._projection, Math.PI/8, aspect, 0.00005, 100)
  } else return this.state.get(key,c)
}

Mix.prototype.set = function (key, c) {
  if (key === 'projectfn') {
    this.state.set('projmix', {
      time: defined(c.time, c),
      value: (this.state.limit('projmix')+1)%2,
      easing: c.easing
    })
    this._prevProjectFn = this._projectFn
    this._projectFn = c.value
    this.emit('update-projectfn')
  } else this.state.set(key, c)
}

function globe (out, p) {
  var lon = p[0], lat = p[1], h = (p[2] || 0) + 1
  out[0] = -cos(lon) * cos(lat) * h
  out[1] = sin(lat) * h
  out[2] = sin(lon) * cos(lat) * h
  return out
}

function mix (out, a, b, t) {
  t = Math.max(0,Math.min(1,t))
  out[0] = a[0] * (1-t) + b[0] * t
  out[1] = a[1] * (1-t) + b[1] * t
  out[2] = a[2] * (1-t) + b[2] * t
  return out
}
