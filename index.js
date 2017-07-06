var html = require('bel')
var rcom = require('regl-component')
var EventEmitter = require('events').EventEmitter
var Nano = require('cache-component')
var onload = require('on-load')
var css = require('sheetify')
var bboxToZoom = require('./lib/bbox-to-zoom.js')
var zoomToBbox = require('./lib/zoom-to-bbox.js')

var style = css`
  :host {
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    -khtml-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
  }
`

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

function Map (rcom) {
  if (!(this instanceof Map)) return new Map(rcom)
  this._rcom = rcom
  this._regl = rcom.regl
  this._draw = []
  this._drawOpts = []
  this._bbox = [-180,-90,180,90]
  this._mouse = null
  this._size = null
}

Map.prototype.add = function (opts) {
  if (!opts) throw new Error('must provide layer information to add()')
  var drawOpts = Object.assign({
    frag: `
      precision highp float;
      void main () {
        gl_FragColor = vec4(1,0,0,1);
      }
    `,
    vert: `
      precision highp float;
      attribute vec2 position;
      uniform vec4 bbox;
      uniform vec2 offset;
      void main () {
        vec2 p = position + offset;
        gl_Position = vec4(
          (p.x - bbox.x) / (bbox.z - bbox.x) * 2.0 - 1.0,
          (p.y - bbox.y) / (bbox.w - bbox.y) * 2.0 - 1.0,
          0, 1);
      }
    `,
    uniforms: Object.assign(opts.uniforms || {}, {
      bbox: this._regl.prop('bbox'),
      offset: this._regl.prop('offset')
    })
  }, opts)
  this._draw.push(this._regl(drawOpts))
  this._drawOpts.push(drawOpts)
  this.draw()
}

Map.prototype.draw = function () {
  this._regl.clear({ color: [1,1,1,1], depth: true })
  var props
  var x0 = Math.floor((this._bbox[0]+180)/360)*360
  var x1 = Math.floor((this._bbox[2]+180)/360)*360
  if (x0 === x1) {
    props = { bbox: this._bbox, offset: [x0,0] }
  } else {
    props = []
    for (var x = x0; x <= x1; x+= 360) {
      props.push({ bbox: this._bbox, offset: [x,0] })
    }
  }
  if (this._draw) {
    for (var i = 0; i < this._draw.length; i++) {
      this._draw[i](props)
    }
  }
}

Map.prototype._setMouse = function (ev) {
  var self = this
  var x = ev.offsetX
  var y = ev.offsetY
  var b = ev.buttons & 1
  if (!self._mouse) {
    self._mouse = [0,0]
  } else if (b && self._size) {
    self.move(
      (self._mouse[0]-x)/self._size[0],
      (self._mouse[1]-y)/self._size[1]
    )
  }
  self._mouse[0] = x
  self._mouse[1] = y
}

Map.prototype.move = function (dx,dy) {
  var self = this
  var w = self._bbox[2] - self._bbox[0]
  var h = self._bbox[3] - self._bbox[1]
  self._bbox[0] += dx*w
  self._bbox[1] -= dy*h
  self._bbox[2] += dx*w
  self._bbox[3] -= dy*h
  self.draw()
}

Map.prototype._fixbbox = function () {
  if (this._bbox[1] < -90) {
    this._bbox[3] += -90 - this._bbox[1]
    this._bbox[1] = -90
  }
  if (this._bbox[3] > 90) {
    this._bbox[1] += 90 - this._bbox[3]
    this._bbox[3] = 90
  }
}

Map.prototype.render = function (props) {
  var self = this
  var cstyle = `
    width: ${props.width}px;
    height: ${props.height}px;
  `
  if (!this._size) this._size = [0,0]
  this._size[0] = props.width
  this._size[1] = props.height
  this.draw()
  this.element = html`<div class=${style} style=${cstyle}>
    <div onmouseover=${move} onmouseout=${move}
    onmousemove=${move} onmousedown=${move} onmouseup=${move}>
      ${this._rcom.render(props)}
    </div>
  </div>`
  onload(this.element,
    function () { self._load() },
    function () { self._unload() })
  return this.element
  function move (ev) { self._setMouse(ev) }
}

Map.prototype._load = function () {
  if (!this._draw) {
    this._draw = []
    for (var i = 0; i < this._drawOpts.length; i++) {
      this._draw[i] = this._regl(this._drawOpts[i])
    }
  }
  this.draw()
}

Map.prototype._unload = function () {
  this._draw = null
}

Map.prototype.getZoom = function () {
  return bboxToZoom(this._bbox)
}

Map.prototype.setZoom = function (n) {
  zoomToBbox(this._bbox, Math.max(Math.min(n,21),1))
  this.draw()
}
