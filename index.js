var rcom = require('regl-component')
var Nano = require('cache-component')

module.exports = MixMap

function MixMap (regl, opts) {
  var self = this
  if (!(self instanceof MixMap)) return new MixMap(regl, opts)
  Nano.call(self)
  if (!opts) opts = {}
  self._rcom = rcom(regl, opts)
  self._maps = []
  window.addEventListener('resize', redraw)
  window.addEventListener('scroll', redraw)
  function redraw () {
    draw()
    window.requestAnimationFrame(draw)
  }
  function draw () {
    for (var i = 0; i < self._maps.length; i++) {
      self._maps[i].draw()
    }
  }
}
MixMap.prototype = Object.create(Nano.prototype)

MixMap.prototype._update = function () { return false }

MixMap.prototype._render = function (props) {
  return this._rcom.render(props)
}
MixMap.prototype.create = function (opts) {
  var m = new Map(this._rcom.create(), opts)
  this._maps.push(m)
  return m
}
