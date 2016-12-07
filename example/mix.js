var regl = require('regl')()
var resl = require('resl')
var icosphere = require('icosphere')
var mat4 = require('gl-mat4')
var vec3 = require('gl-vec3')
var grid = require('grid-mesh')
var sin = Math.sin, cos = Math.cos
var ease = require('eases/linear')
var state = require('smooth-state')({ tmix: 0 })

function mglobe (p) { return globe([], p) }
function mflat (p) { return flat([], p) }

var eye = [0,0,2]
var camera = (function () {
  var projection = [], view = []
  var space = { globe: [], flat: [] }
  var surface = { globe: [], flat: [] }
  var tmpv0 = [], tmpv1 = [], up = [0,1,0]
  return regl({
    uniforms: {
      projection: function (context) {
        //return mat4.ortho(projection, -2, 2, -2, 2, 0.1, 1000)
        var aspect = context.viewportWidth / context.viewportHeight
        return mat4.perspective(projection, Math.PI/2, aspect, 0.1, 1000)
      },
      view: function (context) {
        globe(space.globe, eye)
        flat(space.flat, eye)
        vec3.copy(tmpv0, eye)
        tmpv0[2] = 0
        globe(surface.globe, tmpv0)
        flat(surface.flat, tmpv0)

        var tmix = state.get('tmix', context.time)
        mix(tmpv0, space.flat, space.globe, tmix)
        mix(tmpv1, surface.flat, surface.globe, tmix)
        return mat4.lookAt(view, tmpv0, tmpv1, up)
      },
    }
  })
})()

function mix (out, a, b, t) {
  t = Math.max(0,Math.min(1,t))
  out[0] = a[0] * (1-t) + b[0] * t
  out[1] = a[1] * (1-t) + b[1] * t
  out[2] = a[2] * (1-t) + b[2] * t
  return out
}

window.addEventListener('mousemove', function (ev) {
  if (ev.buttons & 1) {
    eye[0] -= ev.movementX / 100
    eye[1] += ev.movementY / 100
  }
})

window.addEventListener('keydown', function (ev) {
  if (ev.key == 'g') {
    state.set('tmix', {
      time: 0.2,
      value: (state.limit('tmix')+1)%2,
      easing: ease
    })
  }
})

function globe (out, p) {
  var h = (p[2]||0) + 1
  out[0] = -cos(p[0]) * cos(p[1]) * h
  out[1] = sin(p[1]) * h
  out[2] = sin(p[0]) * cos(p[1]) * h
  return out
}
function flat (out, p) {
  out[0] = -p[2] || 0
  out[1] = p[1]
  out[2] = p[0]
  return out
}

resl({
  manifest: {
    land: {
      type: 'binary',
      src: 'land.pmesh',
      parser: require('pack-mesh/unpack')
    }
  },
  onDone: ready
})

function ready (assets) {
  var draw = {
    ocean: ocean(regl),
    land: land(regl, assets.land)
  }
  regl.frame(function () {
    regl.clear({ color: [0.1,0.1,0.1,1], depth: true })
    camera(function () {
      draw.ocean()
      draw.land()
    })
  })
}

function ocean (regl) {
  var dlon = Math.PI*2/90, dlat = Math.PI/90
  var mesh = grid(90,90,[-Math.PI,-Math.PI/2],[dlon,0],[0,dlat]) // lonlat
  return regl({
    frag: `
      precision mediump float;
      void main () {
        gl_FragColor = vec4(0.3,0.3,0.3,1);
      }
    `,
    vert: `
      precision mediump float;
      uniform mat4 projection, view;
      uniform float tmix;
      attribute vec3 position0, position1;
      void main () {
        vec3 p = mix(position0, position1, tmix);
        gl_Position = projection * view * vec4(p,1);
      }
    `,
    attributes: {
      position0: mesh.positions.map(mflat),
      position1: mesh.positions.map(mglobe)
    },
    uniforms: { tmix: state.tie('tmix') },
    elements: mesh.cells,
    depth: { enable: false, mask: false }
  })
}

function land (regl, mesh) {
  var coords = []
  return regl({
    frag: `
      precision mediump float;
      void main () {
        gl_FragColor = vec4(0.5,0.5,0.5,1);
      }
    `,
    vert: `
      precision mediump float;
      uniform mat4 projection, view, coords;
      uniform float tmix;
      attribute vec3 position0, position1;
      void main () {
        vec3 p = mix(position0, position1, tmix);
        gl_Position = projection * view * vec4(p,1);
      }
    `,
    attributes: {
      position0: mesh.positions.map(mflat),
      position1: mesh.positions.map(mglobe)
    },
    uniforms: { tmix: state.tie('tmix') },
    elements: mesh.cells,
    cull: { enable: true }
  })
}
