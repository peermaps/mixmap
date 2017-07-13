var mixmap = require('../')
var regl = require('regl')
var glsl = require('glslify')
var resl = require('resl')

var mix = mixmap(regl, { extensions: ['oes_element_index_uint'] })
var map = mix.create()

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
      gl_FragColor = vec4(c*(1.0-tc.a)+tc.rgb*tc.a,0.5+tc.a*0.5);
    }
  `,
  vert: `
    precision highp float;
    attribute vec2 position;
    uniform vec4 viewbox;
    uniform vec2 offset;
    uniform float zindex;
    attribute vec2 tcoord;
    varying vec2 vtcoord;
    void main () {
      vec2 p = position + offset;
      vtcoord = tcoord;
      gl_Position = vec4(
        (p.x - viewbox.x) / (viewbox.z - viewbox.x) * 2.0 - 1.0,
        (p.y - viewbox.y) / (viewbox.w - viewbox.y) * 2.0 - 1.0,
        1.0/(1.0+zindex), 1);
    }
  `,
  uniforms: {
    id: map.prop('id'),
    zindex: map.prop('zindex'),
    texture: map.prop('texture')
  },
  attributes: {
    position: map.prop('points'),
    tcoord: [0,1,0,0,1,1,1,0] // sw,se,nw,ne
  },
  elements: [0,1,2,1,2,3],
  blend: {
    enable: true,
    func: { src: 'src alpha', dst: 'one minus src alpha' }
  }
})

var manifest = require('./manifest.json')
map.addLayer({
  viewbox: function (bbox, zoom, cb) {
    zoom = Math.round(zoom)
    if (zoom < 2) cb(null, manifest.level0)
    else if (zoom < 4) cb(null, manifest.level1)
    else cb(null, manifest.level2)
  },
  add: function (key, bbox) {
    var level = key.split('/')[0]
    var file = level + '/' + bbox.join('x') + '.jpg'
    var prop = {
      id: Number(key.split('/')[1]),
      key: key,
      zindex: 2 + Number(/(\d+)$/.exec(level)[1]),
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
        prop.texture = map.regl.texture(assets.tile)
        map.draw()
      }
    })
  },
  remove: function (key, bbox) {
    drawTile.props = drawTile.props.filter(function (p) {
      return p.key !== key
    })
  }
})

var drawCities = map.createDraw({
  frag: glsl`
    precision highp float;
    #pragma glslify: hsl2rgb = require('glsl-hsl2rgb')
    varying float population;
    void main () {
      if (length(gl_PointCoord.xy-0.5) > 0.5) discard;
      vec3 c = hsl2rgb(
        0.0, pow(population/1000.0,0.065)-1.0, 0.5
      );
      gl_FragColor = vec4(c,1);
    }
  `,
  vert: `
    precision highp float;
    attribute vec3 position;
    uniform vec4 viewbox;
    uniform vec2 offset;
    uniform float zoom;
    varying float population;
    void main () {
      vec2 p = position.xy + offset;
      population = max(1000.0,position.z);
      float z = 1.0-pow(population/1000.0,0.065);
      gl_PointSize = pow(population,0.4)*pow(zoom,1.2)*0.01;
      gl_Position = vec4(
        (p.x - viewbox.x) / (viewbox.z - viewbox.x) * 2.0 - 1.0,
        (p.y - viewbox.y) / (viewbox.w - viewbox.y) * 2.0 - 1.0,
        z, 1);
    }
  `,
  primitive: 'points',
  attributes: {
    position: map.prop('position')
  },
  count: map.prop('count')
})
resl({
  manifest: {
    cities: { type: 'text', src: 'cities1000.json', parser: JSON.parse }
  },
  onDone: function (assets) {
    drawCities.props.push({
      position: assets.cities,
      count: assets.cities.length
    })
  }
})

window.addEventListener('keydown', function (ev) {
  if (ev.code === 'Equal') {
    map.setZoom(Math.min(6,Math.round(map.getZoom()+1)))
  } else if (ev.code === 'Minus') {
    map.setZoom(map.getZoom()-1)
  }
})

var app = require('choo')()
var html = require('choo/html')

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
    ${map.render({ width: 600, height: 400 })}
  </body>`
  function zoomIn () { map.setZoom(map.getZoom()+1) }
  function zoomOut () { map.setZoom(map.getZoom()-1) }
})
app.mount('body')
