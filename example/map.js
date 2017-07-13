var mixmap = require('../')
var regl = require('regl')
var glsl = require('glslify')
var resl = require('resl')

var mix = mixmap(regl, { extensions: ['oes_element_index_uint'] })
var map = mix.create()

var tiles = require('./data/50m/manifest.json')
var drawTile = map.createDraw({
  frag: glsl`
    precision highp float;
    #pragma glslify: hsl2rgb = require('glsl-hsl2rgb')
    uniform float id;
    uniform sampler2D texture;
    varying vec2 vtcoord;
    void main () {
      float h = mod(id/8.0,1.0);
      float s = mod(id/4.0,1.0)*0.5+0.25;
      float l = mod(id/16.0,1.0)*0.5+0.25;
      vec3 c = hsl2rgb(h,s,l);
      vec4 tc = texture2D(texture,vtcoord);
      gl_FragColor = vec4(c*(1.0-tc.a)+tc.rgb*tc.a,1);
    }
  `,
  vert: `
    precision highp float;
    attribute vec2 position;
    uniform vec4 viewbox;
    uniform vec2 offset;
    attribute vec2 tcoord;
    varying vec2 vtcoord;
    void main () {
      vec2 p = position + offset;
      vtcoord = tcoord;
      gl_Position = vec4(
        (p.x - viewbox.x) / (viewbox.z - viewbox.x) * 2.0 - 1.0,
        (p.y - viewbox.y) / (viewbox.w - viewbox.y) * 2.0 - 1.0,
        0.5, 1);
    }
  `,
  uniforms: {
    id: map.prop('id'),
    texture: map.prop('texture')
  },
  attributes: {
    position: map.prop('points'),
    tcoord: [0,1,0,0,1,1,1,0] // sw,se,nw,ne
  },
  elements: [0,1,2,1,2,3]
})

map.addLayer({
  viewbox: function (bbox, zoom, cb) {
    cb(null, tiles)
  },
  add: function (key, bbox) {
    var file = '50m/' + bbox.join('x') + '.jpg'
    var prop = {
      id: Number(key),
      texture: map.regl.texture(),
      points: [
        bbox[0], bbox[1], // sw
        bbox[0], bbox[3], // se
        bbox[2], bbox[1], // nw
        bbox[2], bbox[3]  // ne
      ]
    }
    drawTile.props.push(prop)
    map.draw()
    resl({
      manifest: { tile: { type: 'image', src: file } },
      onDone: function (assets) {
        window.requestIdleCallback(function () {
          prop.texture = map.regl.texture(assets.tile)
          map.draw()
        })
      }
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
    <h1>mixmap ${state.now}</h1>
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
