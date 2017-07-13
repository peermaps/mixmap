var mixmap = require('../')
var regl = require('regl')
var glsl = require('glslify')

var mix = mixmap(regl, { extensions: ['oes_element_index_uint'] })
var map = mix.create()

var tiles = require('./data/50m/manifest.json')
var drawTile = map.createDraw({
  frag: glsl`
    precision highp float;
    #pragma glslify: hsl2rgb = require('glsl-hsl2rgb')
    uniform float id;
    void main () {
      float h = mod(id/8.0,1.0);
      float s = mod(id/4.0,1.0)*0.5+0.25;
      float l = mod(id/16.0,1.0)*0.5+0.25;
      gl_FragColor = vec4(hsl2rgb(h,s,l),1);
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
        0.5, 1);
    }
  `,
  uniforms: {
    id: map.prop('id')
  },
  attributes: {
    position: map.prop('points')
  },
  elements: [0,1,2,1,2,3]
})
map.addLayer({
  viewbox: function (bbox, zoom, cb) {
    cb(null, tiles)
  },
  add: function (key, bbox) {
    var file = '50m/' + bbox.join('x') + '.jpg'
    drawTile.props.push({
      id: Number(key),
      points: [
        bbox[0], bbox[1],
        bbox[0], bbox[3],
        bbox[2], bbox[1],
        bbox[2], bbox[3]
      ]
    })
  },
  remove: function (key, bbox) {
    var id = Number(key)
    drawTile.props = drawTile.props.filter(function (p) {
      return p.id !== id
    })
  }
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
    ${mix.render()}
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
