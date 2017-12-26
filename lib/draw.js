var assign = require('./assign.js')
module.exports = Draw

function Draw (drawOpts, opts) {
  if (!(this instanceof Draw)) return new Draw(drawOpts, opts)
  this._regl = opts.regl
  this._draw = this._regl(drawOpts)
  this._options = drawOpts
  this.props = []
}

Draw.prototype.draw = function (props) {
  if (!props) {
    this._draw(this.props)
  } else if (Array.isArray(props) && props.length === 1) {
    for (var i = 0; i < this.props.length; i++) {
      assign(this.props[i], props[0])
    }
    this._draw(this.props)
  } else if (Array.isArray(props)) {
    var xprops = []
    for (var i = 0; i < this.props.length; i++) {
      for (var j = 0; j < props.length; j++) {
        xprops.push(assign({}, this.props[i], props[j]))
      }
    }
    this._draw(xprops)
  } else {
    for (var i = 0; i < this.props.length; i++) {
      assign(this.props[i], props)
    }
    this._draw(this.props)
  }
}

Draw.prototype.reload = function () {
  this._draw = this._regl(this._options)
}

Draw.prototype.remove = function () {
  this._options.onremove()
}
