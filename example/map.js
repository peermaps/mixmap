var mixmap = require('../')(require('regl'))
var map = mixmap.create()
var glsl = require('glslify')

var countries = require('./mesh.json')
var borders = require('./borders.json')
/*
map.add({
  triangle: {
    frag: `
      precision highp float;
      void main () {
        gl_FragColor = vec4(0,1,0,1);
      }
    `,
    attributes: {
      position: countries.triangle.positions
    },
    elements: countries.triangle.cells
  }
})
*/
map.add({
  triangle: {
    frag: glsl`
      precision highp float;
      #pragma glslify: hsl2rgb = require('glsl-hsl2rgb')
      #pragma glslify: colormap = require('glsl-colormap/bathymetry')
      varying float vcolor;
      void main () {
        //gl_FragColor = vec4(hsl2rgb(vcolor/5.0,0.4,0.5),1);
        gl_FragColor = colormap(vcolor/5.0);
      }
    `,
    vert: `
      precision highp float;
      attribute vec2 position;
      attribute float color;
      varying float vcolor;
      uniform vec4 bbox;
      void main () {
        vcolor = color;
        gl_Position = vec4(
          (position.x - bbox.x) / (bbox.z - bbox.x) * 2.0 - 1.0,
          (position.y - bbox.y) / (bbox.w - bbox.y) * 2.0 - 1.0,
          0, 1);
      }
    `,
    attributes: {
      position: countries.triangle.positions,
      color: countries.triangle.colors
    },
    elements: countries.triangle.cells
  }
})
map.draw()

var app = require('choo')()
var html = require('choo/html')

app.use(function (state, emitter) {
  setSize()
  window.addEventListener('resize', function () {
    setSize()
    emitter.emit('render')
  })
  window.addEventListener('mousemove', function (ev) {
    mixmap.setMouse(ev)
  })
  function setSize () {
    state.width = Math.min(window.innerWidth-50,600)
    state.height = Math.min(window.innerHeight-50,400)
  }
})

app.route('*', function (state, emit) {
  return html`<body>
    <h1>mixmap</h1>
    ${mixmap.render()}
    ${map.render(state)}
  </body>`
})
app.mount('body')
