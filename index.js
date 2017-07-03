var html = require('bel')
var rcom = require('regl-component')
var EventEmitter = require('events').EventEmitter
var Nano = require('nanocomponent')
var css = require('sheetify')
var bboxToZoom = require('./lib/bbox-to-zoom.js')
var zoomToBbox = require('./lib/zoom-to-bbox.js')

var style = css`
  :host {
    background-color: black;
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
}
MixMap.prototype = Object.create(Nano.prototype)

MixMap.prototype._update = function () { return false }

MixMap.prototype._render = function (props) {
  return this._rcom.render(props)
}

MixMap.prototype.create = function (opts) {
  return new Map(this._rcom.create(), opts)
}

function Map (rcom) {
  if (!(this instanceof Map)) return new Map(rcom)
  this._rcom = rcom
  this._regl = rcom.regl
  this._draw = []
  this._bbox = [-180,-90,180,90]
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
        void main () {
          gl_Position = vec4(position.x/180.0,position.y/90.0,0,1);
        }
      `
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
        void main () {
          gl_Position = vec4(
            position.x/180.0 + normal.x * 0.01,
            position.y/90.0 + normal.y * 0.01,
            0,1);
        }
      `,
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

Map.prototype.render = function (props) {
  var self = this
  var cstyle = `
    width: ${props.width}px;
    height: ${props.height}px;
  `
  return html`<div class=${style} style=${cstyle}>
    <div class="controls">
      <button onclick=${zoomIn}>+</button>
      <button onclick=${zoomOut}>-</button>
    </div>
    ${this._rcom.render(props)}
  </div>`
  function zoomIn () {
    self.setZoom(self.getZoom()+1)
  }
  function zoomOut () {
    self.setZoom(self.getZoom()-1)
  }
}

Map.prototype.getZoom = function () {
  return bboxToZoom(this._bbox)
}

Map.prototype.setZoom = function (n) {
  zoomToBbox(this._bbox, Math.max(Math.min(n,21),1))
  console.log(this._bbox, this.getZoom())
  this.draw()
}
