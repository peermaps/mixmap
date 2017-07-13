var html = require('bel')
var EventEmitter = require('events').EventEmitter
var onload = require('on-load')
var bboxToZoom = require('./boox-to-zoom.js')
var zoomToBbox = require('./zoom-to-bbox.js')
var boxIntersect = require('box-intersect')
var css = require('sheetify')
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

module.exports = Map

function Map (rcom, opts) {
  if (!(this instanceof Map)) return new Map(rcom, opts)
  if (!opts) opts = {}
  this._rcom = rcom
  this.regl = rcom.regl
  this._draw = []
  this._drawOpts = []
  this._drawNames = []
  this._layers = []
  this._layerNames = []
  this._layerTiles = []
  this.viewbox = opts.viewbox || [-180,-90,180,90]
  this._mouse = null
  this._size = null
  this.on('viewbox', this._onviewbox)
}
Map.prototype = Object.create(EventEmitter.prototype)

Map.prototype._onviewbox = function () {
  var self = this
  if (self._idle) return
  self._idle = window.requestIdleCallback(function () {
    self._idle = null
    var boxes = []
    var x0 = Math.floor((self.viewbox[0]+180)/360)*360
    var x1 = Math.floor((self.viewbox[2]+180)/360)*360
    for (var x = x0; x <= x1; x += 360) {
      boxes.push([
        self.viewbox[0]-x, self.viewbox[1],
        self.viewbox[2]-x, self.viewbox[3] ])
    }
    var zoom = self.getZoom()
    for (var i = 0; i < self._layers.length; i++) (function (layer,tiles) {
      layer.viewbox(self.viewbox, zoom, function (err, lboxes) {
        if (err) return self.emit('error', err)
        if (!lboxes) lboxes = []
        var keys = Object.keys(lboxes)
        var values = keys.map(function (key) { return lboxes[key] })
        var active = {}
        boxIntersect(boxes, values, function (j, k) {
          var key = keys[k], bbox = values[k]
          active[key] = true
          if (tiles[key]) return
          tiles[key] = bbox
          layer.add(key, bbox)
        })
        Object.keys(tiles).forEach(function (key) {
          if (tiles[key] && !active[key]) {
            layer.remove(key, tiles[key])
            tiles[key] = null
          }
        })
      })
    })(self._layers[i],self._layerTiles[i])
  })
}

Map.prototype.add = function (key, opts) {
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
      uniform vec4 viewbox;
      uniform vec2 offset;
      void main () {
        vec2 p = position + offset;
        gl_Position = vec4(
          (p.x - viewbox.x) / (viewbox.z - viewbox.x) * 2.0 - 1.0,
          (p.y - viewbox.y) / (viewbox.w - viewbox.y) * 2.0 - 1.0,
          0, 1);
      }
    `,
    uniforms: Object.assign(opts.uniforms || {}, {
      viewbox: this.regl.prop('viewbox'),
      offset: this.regl.prop('offset')
    })
  }, opts)
  this._draw.push(this.regl(drawOpts))
  this._drawOpts.push(drawOpts)
  this._drawNames.push(key)
  this.draw()
}

Map.prototype.remove = function (key) {
  var ix = this._drawNames.indexOf(key)
  if (ix >= 0) {
    this._draw.splice(ix,1)
    this._drawOpts.splice(ix,1)
    this._drawNames.splice(ix,1)
  }
}

Map.prototype.addLayer = function (name, opts) {
  var self = this
  self._layers.push(opts)
  self._layerNames.push(name)
  self._layerTiles.push({})
  if (!self._layerIdle) {
    self._layerIdle = window.requestIdleCallback(function () {
      self._layerIdle = null
      self._onviewbox()
    })
  }
}

Map.prototype.removeLayer = function (name, opts) {
  var ix = this._layerNames.indexOf(name)
  if (ix >= 0) {
    this._layers.splice(ix,1)
    this._layerNames.splice(ix,1)
    this._layerTiles.splice(ix,1)
  }
}

Map.prototype.draw = function () {
  this.regl.poll()
  this.regl.clear({ color: [1,1,1,1], depth: true })
  var props
  var x0 = Math.floor((this.viewbox[0]+180)/360)*360
  var x1 = Math.floor((this.viewbox[2]+180)/360)*360
  if (x0 === x1) {
    props = { viewbox: this.viewbox, offset: [x0,0] }
  } else {
    props = []
    for (var x = x0; x <= x1; x+= 360) {
      props.push({ viewbox: this.viewbox, offset: [x,0] })
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
  var w = self.viewbox[2] - self.viewbox[0]
  var h = self.viewbox[3] - self.viewbox[1]
  self.viewbox[0] += dx*w
  self.viewbox[1] -= dy*h
  self.viewbox[2] += dx*w
  self.viewbox[3] -= dy*h
  self.draw()
  self.emit('viewbox', self.viewbox)
}

Map.prototype.setViewbox = function (viewbox) {
  self.viewbox = viewbox
  self.emit('viewbox', self.viewbox)
}

Map.prototype._fixbbox = function () {
  if (this.viewbox[1] < -90) {
    this.viewbox[3] += -90 - this.viewbox[1]
    this.viewbox[1] = -90
  }
  if (this.viewbox[3] > 90) {
    this.viewbox[1] += 90 - this.viewbox[3]
    this.viewbox[3] = 90
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
      this._draw[i] = this.regl(this._drawOpts[i])
    }
  }
  this.draw()
}

Map.prototype._unload = function () {
  this._draw = null
}

Map.prototype.getZoom = function () {
  return bboxToZoom(this.viewbox)
}

Map.prototype.setZoom = function (n) {
  zoomToBbox(this.viewbox, Math.max(Math.min(n,21),1))
  this.draw()
  this.emit('viewbox', this.viewbox)
}
