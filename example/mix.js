var regl = require('regl')()
var resl = require('resl')
var grid = require('grid-mesh')
var sin = Math.sin, cos = Math.cos

var glsl = require('glslify')
var proj = require('glsl-proj4')
var dmerge = require('deep-extend')

function geom (obj) {
  var p = proj('+proj=geocent +datum=WGS84 +units=m +no_defs')
  return dmerge(obj, {
    uniforms: p.members('proj'),
    vert: glsl`
      precision mediump float;
      #pragma glslify: proj_t = require('glsl-proj4/geocent/t')
      #pragma glslify: forward = require('glsl-proj4/geocent/forward')
      #pragma glslify: lookAt = require('glsl-look-at')
      uniform mat4 projection;
      uniform vec3 eye;
      uniform proj_t proj;
      attribute vec2 position;
      void main () {
        vec3 sky = forward(proj,eye);
        vec3 ground = forward(proj,vec3(eye.xy,0));
        mat3 view = lookAt(sky, ground, 0.0);
        vec3 p = view * forward(proj,vec3(vec2(position.y,-position.x),0));
        gl_Position = projection * vec4(p,1);
      }
    `
  })
}

var mix = require('../')()
var camera = regl({
  uniforms: {
    projection: mix.tie('projection'),
    eye: mix.tie('eye')
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
        (eye[0] - Math.max(-1, Math.min(1, dx))),
        (eye[1] + Math.max(-1, Math.min(1, dy))) % Math.PI,
        eye[2]
      ]
    })
  }
})

window.addEventListener('mousewheel', function (ev) {
  var eye = mix.get('eye')
  mix.set('eye', {
    time: 0.1,
    value: [
      eye[0],
      eye[1],
      Math.min(10,Math.max(0.0001,eye[2] * Math.pow(1.1, ev.deltaY/50)))
    ]
  })
})

window.addEventListener('keydown', function (ev) {
  if (ev.key == 'g') {
    mix.set('projectfn', {
      time: 0.15,
      value: globe
    })
  } else if (ev.key === 'f') {
    mix.set('projectfn', {
      time: 0.15,
      value: flat
    })
  }
})

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
    /*
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
    */
  }
  regl.frame(function () {
    regl.clear({ color: [0.1,0.1,0.1,1], depth: true })
    camera(function () {
      draw.ocean()
      draw.land0()
      //draw.land1()
      //draw.land2()
    })
  })
}

function ocean (regl) {
  var dlon = Math.PI*2/90, dlat = Math.PI/90
  var mesh = grid(90*3,90,[-Math.PI*3,-Math.PI/2],[dlon,0],[0,dlat]) // lonlat
  return regl(geom({
    frag: `
      precision mediump float;
      void main () {
        gl_FragColor = vec4(0.3,0.3,0.3,1);
      }
    `,
    attributes: {
      position: mesh.positions
    },
    elements: mesh.cells,
    depth: { enable: false, mask: false }
  }))
}

function land (regl, mesh) {
  var coords = []
  return regl(geom({
    frag: `
      precision mediump float;
      void main () {
        gl_FragColor = vec4(0.5,0.5,0.5,1);
      }
    `,
    attributes: {
      position: mesh.positions
    },
    elements: mesh.cells,
    cull: { enable: true }
  }))
}
