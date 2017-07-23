var html = require('bel')
var EventEmitter = require('events').EventEmitter
var onload = require('on-load')
var bboxToZoom = require('./bbox-to-zoom.js')
var zoomToBbox = require('./zoom-to-bbox.js')
var boxIntersect = require('box-intersect')
var Draw = require('./draw.js')

var idlecb = window.requestIdleCallback
  || function (f) { setTimeout(f,0) }

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
  this._layers = []
  this._layerTiles = []
  this.viewbox = opts.viewbox || [-180,-90,180,90]
  this.backgroundColor = opts.backgroundColor || [1,1,1,1]
  this._mouse = null
  this._size = null
  this.on('viewbox', this._onviewbox)
}
Map.prototype = Object.create(EventEmitter.prototype)

Map.prototype._onviewbox = function () {
  var self = this
  if (self._idle) return
  self._idle = setTimeout(function () {
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
    var changed = false
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
          changed = true
        })
        Object.keys(tiles).forEach(function (key) {
          if (tiles[key] && !active[key]) {
            layer.remove(key, tiles[key])
            changed = true
            tiles[key] = null
          }
        })
      })
    })(self._layers[i],self._layerTiles[i])
    if (changed) self.draw()
  }, 100)
}

Map.prototype.prop = function (name) {
  return this.regl.prop(name)
}

Map.prototype.createDraw = function (opts) {
  var self = this
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
      varying vec2 vpos;
      uniform vec4 viewbox;
      uniform vec2 offset;
      uniform float zindex, aspect;
      void main () {
        vec2 p = position + offset;
        vpos = position;
        gl_Position = vec4(
          (p.x - viewbox.x) / (viewbox.z - viewbox.x) * 2.0 - 1.0,
          ((p.y - viewbox.y) / (viewbox.w - viewbox.y) * 2.0 - 1.0) * aspect,
          1.0/(2.0+zindex), 1);
      }
    `,
  }, opts, {
    uniforms: Object.assign({
      viewbox: self.prop('viewbox'),
      zoom: self.prop('zoom'),
      aspect: function (context) {
        return context.viewportWidth / context.viewportHeight
      },
      zindex: 0,
      offset: self.prop('offset')
    }, opts.uniforms)
  })
  var draw = new Draw(drawOpts, {
    regl: self.regl,
    onremove: function () {
      var ix = self._draw.indexOf(draw)
      if (ix >= 0) self._draw.splice(ix,1)
    }
  })
  self._draw.push(draw)
  self.draw()
  return draw
}

Map.prototype.addLayer = function (opts) {
  var self = this
  self._layers.push(opts)
  self._layerTiles.push({})
  if (!self._layerIdle) {
    self._layerIdle = idlecb(function () {
      self._layerIdle = null
      self._onviewbox()
    })
  }
}

Map.prototype.draw = function () {
  this.regl.poll()
  this.regl.clear({ color: this.backgroundColor, depth: true })
  var x0 = Math.floor((this.viewbox[0]+180)/360)*360
  var x1 = Math.floor((this.viewbox[2]+180)/360)*360
  var props = []
  var zoom = this.getZoom()
  for (var x = x0; x <= x1; x+= 360) {
    props.push({ viewbox: this.viewbox, zoom: zoom, offset: [x,0] })
  }
  for (var i = 0; i < this._draw.length; i++) {
    this._draw[i].draw(props)
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
    var aspect = self._size[0] / self._size[1]
    self.move(
      (self._mouse[0]-x)/self._size[0],
      (self._mouse[1]-y)/self._size[1]/aspect
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
  var self = this
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
  if (!props) props = {}
  var self = this
  var cstyle = `
    width: ${props.width}px;
    height: ${props.height}px;
  `
  if (!this._size) this._size = [0,0]
  this._size[0] = props.width
  this._size[1] = props.height
  this.draw()
  if (props.mouse === false) {
    this.element = html`<div class=${style} style=${cstyle}>
      <div>${this._rcom.render(props)}</div>
    </div>`
  } else {
    this.element = html`<div class=${style} style=${cstyle}>
      <div onmouseover=${move} onmouseout=${move}
      onmousemove=${move} onmousedown=${move} onmouseup=${move}>
        ${this._rcom.render(props)}
      </div>
    </div>`
  }
  onload(this.element,
    function () { self._load() },
    function () { self._unload() })
  return this.element
  function move (ev) { self._setMouse(ev) }
}

Map.prototype._load = function () {
  if (this._unloaded) {
    this._unloaded = false
    for (var i = 0; i < this._draw.length; i++) {
      this._draw[i].reload()
    }
  }
  this.draw()
}

Map.prototype._unload = function () {
  this._unloaded = true
}

Map.prototype.getZoom = function () {
  return bboxToZoom(this.viewbox)
}

Map.prototype.setZoom = function (n) {
  zoomToBbox(this.viewbox, Math.max(Math.min(n,21),1))
  this.draw()
  this.emit('viewbox', this.viewbox)
}
