var regl = require('regl')()
var resl = require('resl')
var grid = require('grid-mesh')
var sin = Math.sin, cos = Math.cos

var mix = require('../')()
var camera = regl({
  uniforms: {
    projection: mix.tie('projection'),
    view: mix.tie('view')
  }
})

window.addEventListener('mousemove', function (ev) {
  if (ev.buttons & 1) {
    var eye = mix.get('eye')
    var dx = ev.movementX / 800 * eye[2]
    var dy = ev.movementY / 800 * eye[2]
    mix.set('eye', {
      time: 0.1,
      value: [
        (eye[0] - Math.max(-1, Math.min(1, dx))) % (Math.PI*2),
        (eye[1] + Math.max(-1, Math.min(1, dy))) % Math.PI,
        eye[2]
      ]
    })
  }
})

window.addEventListener('mousewheel', function (ev) {
  var eye = mix.get('eye')
  mix.set('eye', {
    time: 100,
    value: [
      eye[0],
      eye[1],
      Math.min(10,Math.max(0.0001,eye[2] * Math.pow(1.1, ev.deltaY/50)))
    ]
  })
})

window.addEventListener('keydown', function (ev) {
  if (ev.key == 'g') {
    mix.set('project', {
      time: 0.15,
      value: globe
    })
  } else if (ev.key === 'f') {
    mix.set('project', {
      time: 0.15,
      value: flat
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
    land0: land(regl, assets.land),
    land1: land(regl, {
      positions: assets.land.positions.map(function (p) {
        return [p[0]+Math.PI*2,p[1],p[2]]
      }),
      cells: assets.land.cells
    }),
    land2: land(regl, {
      positions: assets.land.positions.map(function (p) {
        return [p[0]-Math.PI*2,p[1],p[2]]
      }),
      cells: assets.land.cells
    })
  }
  regl.frame(function () {
    regl.clear({ color: [0.1,0.1,0.1,1], depth: true })
    camera(function () {
      draw.ocean()
      draw.land0()
      draw.land1()
      draw.land2()
    })
  })
}

function ocean (regl) {
  var dlon = Math.PI*2/90, dlat = Math.PI/90
  var mesh = grid(90*3,90,[-Math.PI*3,-Math.PI/2],[dlon,0],[0,dlat]) // lonlat
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
      uniform float projmix;
      attribute vec3 position0, position1;
      void main () {
        vec3 p = mix(position0, position1, projmix);
        gl_Position = projection * view * vec4(p,1);
      }
    `,
    attributes: {
      position0: mix.positions(0, mesh.positions),
      position1: mix.positions(1, mesh.positions)
    },
    uniforms: { projmix: mix.tie('projmix') },
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
      uniform float projmix;
      attribute vec3 position0, position1;
      void main () {
        vec3 p = mix(position0, position1, projmix);
        gl_Position = projection * view * vec4(p,1);
      }
    `,
    attributes: {
      position0: mix.positions(0, mesh.positions),
      position1: mix.positions(1, mesh.positions)
    },
    uniforms: { projmix: mix.tie('projmix') },
    elements: mesh.cells,
    cull: { enable: true }
  })
}
