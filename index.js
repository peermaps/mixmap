var html = require('bel')
var rcom = require('regl-component')
var EventEmitter = require('events').EventEmitter
var Nano = require('nanocomponent')
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
  .controls button {
    min-width: 1.5em;
    padding: 0.1em;
    font-size: 1.1em;
  }
`

module.exports = MixMap

function MixMap (regl, opts) {
  if (!(this instanceof MixMap)) return new MixMap(regl, opts)
  Nano.call(this)
  if (!opts) opts = {}
  this._rcom = rcom(regl)
  this._maps = []
}
MixMap.prototype = Object.create(Nano.prototype)

MixMap.prototype._update = function () { return false }

MixMap.prototype._render = function (props) {
  return this._rcom.render(props)
}
MixMap.prototype.setMouse = function (ev) {
  for (var i = 0; i < this._maps.length; i++) {
    this._maps[i]._setMouse(ev)
  }
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
  this._bbox = [-180,-90,180,90]
  this._mouse = null
  this._size = null
}

Map.prototype.add = function (opts) {
  if (!opts) opts = {}
  if (opts.triangle) {
    this._draw.push(this._regl(Object.assign({
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
        void main () {
          gl_Position = vec4(
            (position.x - bbox.x) / (bbox.z - bbox.x) * 2.0 - 1.0,
            (position.y - bbox.y) / (bbox.w - bbox.y) * 2.0 - 1.0,
            0, 1);
        }
      `,
      uniforms: Object.assign(opts.triangle.uniforms || {}, {
        bbox: this._regl.prop('bbox')
      })
    }, opts.triangle)))
  }
  if (opts.linestrip) {
    this._draw.push(this._regl({
      frag: opts.linestrip.frag || `
        precision highp float;
        void main () {
          gl_FragColor = vec4(0,0,0,1);
        }
      `,
      vert: opts.linestrip.vert || `
        precision highp float;
        attribute vec2 position, normal;
        uniform vec4 bbox;
        void main () {
          gl_Position = vec4(
            (position.x - bbox.x) / (bbox.z - bbox.x) * 2.0 - 1.0,
            (position.y - bbox.y) / (bbox.w - bbox.y) * 2.0 - 1.0,
            0, 1);
        }
      `,
      uniforms: Object.assign(opts.linestrip.uniforms || {}, {
        bbox: this._regl.prop('bbox')
      }),
      attributes: {
        position: opts.linestrip.positions,
        normal: opts.linestrip.normals
      },
      elements: opts.linestrip.elements
    }))
  }
  if (opts.point) {
    // ...
  }
}

Map.prototype.draw = function () {
  this._regl.clear({ color: [1,1,1,1], depth: true })
  var props = { bbox: this._bbox }
  for (var i = 0; i < this._draw.length; i++) {
    this._draw[i](props)
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

Map.prototype.render = function (props) {
  var self = this
  var cstyle = `
    width: ${props.width}px;
    height: ${props.height}px;
  `
  if (!this._size) this._size = [0,0]
  this._size[0] = props.width
  this._size[1] = props.height
  return html`<div class=${style} style=${cstyle}>
    <div class="controls">
      <button onclick=${zoomIn}>+</button>
      <button onclick=${zoomOut}>-</button>
    </div>
    <div onmouseover=${move} onmouseout=${move}
    onmousemove=${move} onmousedown=${move} onmouseup=${move}>
      ${this._rcom.render(props)}
    </div>
  </div>`
  function move (ev) {
    self._setMouse(ev)
  }
  function zoomIn (ev) {
    ev.stopPropagation()
    self.setZoom(self.getZoom()+1)
  }
  function zoomOut (ev) {
    ev.stopPropagation()
    self.setZoom(self.getZoom()-1)
  }
}

Map.prototype.getZoom = function () {
  return bboxToZoom(this._bbox)
}

Map.prototype.setZoom = function (n) {
  zoomToBbox(this._bbox, Math.max(Math.min(n,21),1))
  this.draw()
}
