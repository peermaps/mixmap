var assign = require('./assign.js')
module.exports = Draw

function Draw (drawOpts, opts) {
  if (!(this instanceof Draw)) return new Draw(drawOpts, opts)
  this._regl = opts.regl
  if (drawOpts.pickFrag) {
    drawOpts = assign({}, drawOpts)
    var pfrag = drawOpts.pickFrag
    var pvert = drawOpts.pickVert
    delete drawOpts.pickFrag
    delete drawOpts.pickVert
    this._pickOptions = assign({}, drawOpts, {
      frag: pfrag,
      vert: pvert || drawOpts.vert,
      context: assign(drawOpts.context || {}, {
        picking: true
      })
    })
  }
  this._drawOptions = assign({
    context: assign(drawOpts.context || {}, {
      picking: false
    })
  }, drawOpts)
  this.props = []
}

Draw.prototype._run = function (f, props) {
  if (!props) {
    f(this.props)
  } else if (Array.isArray(props) && props.length === 1) {
    for (var i = 0; i < this.props.length; i++) {
      assign(this.props[i], props[0])
    }
    f(this.props)
  } else if (Array.isArray(props)) {
    var xprops = []
    for (var i = 0; i < this.props.length; i++) {
      for (var j = 0; j < props.length; j++) {
        xprops.push(assign({}, this.props[i], props[j]))
      }
    }
    f(xprops)
  } else {
    for (var i = 0; i < this.props.length; i++) {
      assign(this.props[i], props)
    }
    f(this.props)
  }
}

Draw.prototype.draw = function (props) {
  if (!this._draw) {
    this._draw = this._regl(this._drawOptions)
  }
  this._run(this._draw, props)
}

Draw.prototype.pick = function (props) {
  if (this._pick) this._run(this._pick, props)
}

Draw.prototype._setfb = function (fb) {
  if (this._pickOptions) {
    this._pickOptions.framebuffer = fb
    this._pick = this._regl(this._pickOptions)
  }
}

Draw.prototype.reload = function () {
  this._draw = this._regl(this._drawOptions)
  if (this._pickOptions) {
    this._pick = this._regl(this._pickOptions)
  }
}

Draw.prototype.remove = function () {
  this._options.onremove()
}
