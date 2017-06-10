var html = require('bel')
var rcom = require('regl-component')
var EventEmitter = require('events').EventEmitter
var Nano = require('nanocomponent')
var css = require('sheetify')
var style = css`
  :host {
    background-color: black;
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

MixMap.prototype.create = function () {
  return new Map(this._rcom.create())
}

function Map (rcom) {
  if (!(this instanceof Map)) return new Map(rcom)
  this._rcom = rcom
  this._regl = rcom.regl
  this._draw = {}
  var mesh = require('icosphere')(3)
  this._draw.shapes = this._regl({
    frag: `
      precision highp float;
      void main () {
        gl_FragColor = vec4(1,0,0,1);
      }
    `,
    vert: `
      precision highp float;
      attribute vec3 position;
      void main () {
        gl_Position = vec4(position.xy*0.5,0,1);
      }
    `,
    attributes: {
      position: mesh.positions
    },
    elements: mesh.cells
  })
}

Map.prototype.draw = function () {
  this._regl.clear({ color: [0,1,0,1], depth: true })
  this._draw.shapes()
}

Map.prototype.render = function (props) {
  var cstyle = `
    width: ${props.width}px;
    height: ${props.height}px;
  `
  return html`<div class=${style} style=${cstyle}>
    ${this._rcom.render(props)}
  </div>`
}
