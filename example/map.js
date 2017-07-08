var mixmap = require('../')(require('regl'), {
  extensions: ['oes_element_index_uint']
})
var map = mixmap.create()
var glsl = require('glslify')
var xhr = require('xhr')

//var countries1 = require('./countries0.json')
xhr('2/2.json', function (err, res, body) {
  var data = JSON.parse(body)
  map.add({
    frag: glsl`
      precision highp float;
      #pragma glslify: hsl2rgb = require('glsl-hsl2rgb')
      varying float vcolor;
      void main () {
        gl_FragColor = vec4(hsl2rgb(vcolor/5.0+0.55,0.6,0.8),1);
      }
    `,
    vert: `
      precision highp float;
      attribute vec2 position;
      attribute float color;
      varying float vcolor;
      uniform vec4 viewbox;
      uniform vec2 offset;
      void main () {
        vcolor = color;
        vec2 p = position + offset;
        gl_Position = vec4(
          (p.x - viewbox.x) / (viewbox.z - viewbox.x) * 2.0 - 1.0,
          (p.y - viewbox.y) / (viewbox.w - viewbox.y) * 2.0 - 1.0,
          0, 1);
      }
    `,
    attributes: {
      position: data.triangle.positions,
      color: data.triangle.colors
    },
    elements: data.triangle.cells
  })
})

var app = require('choo')()
var html = require('choo/html')

app.use(function (state, emitter) {
  setSize()
  window.addEventListener('resize', function () {
    setSize()
    emitter.emit('render')
  })
  window.addEventListener('keydown', function (ev) {
    if (ev.code === 'Equal') {
      map.setZoom(map.getZoom()+1)
    } else if (ev.code === 'Minus') {
      map.setZoom(map.getZoom()-1)
    }
  })
  function setSize () {
    state.width = Math.min(window.innerWidth-50,600)
    state.height = Math.min(window.innerHeight-50,400)
  }
})

app.route('/cool', function (state, emit) {
  return html`<body>
    <a href="/">back</a>
  </body>`
})
app.route('*', function (state, emit) {
  return html`<body>
    ${mixmap.render()}
    <h1>mixmap</h1>
    <a href="/cool">cool</a>
    <div>
      <button onclick=${zoomIn}>zoom in</button>
      <button onclick=${zoomOut}>zoom out</button>
    </div>
    ${map.render(state)}
  </body>`
  function zoomIn () { map.setZoom(map.getZoom()+1) }
  function zoomOut () { map.setZoom(map.getZoom()-1) }
})
app.mount('body')
