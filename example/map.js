var mixmap = require('../')(require('regl'), {
  extensions: ['oes_element_index_uint']
})
var map = mixmap.create()
var glsl = require('glslify')
var xhr = require('xhr')
var boxIntersect = require('box-intersect')

xhr('2/meta.json', function (err, res, body) {
  var meta = JSON.parse(body)
  var keys = Object.keys(meta)
  var boxes = keys.map(function (key) { return meta[key] })
  var tiles = {}
  map.on('viewbox', function (bbox) {
    var box = []
    var x0 = Math.floor((bbox[0]+180)/360)*360
    var x1 = Math.floor((bbox[2]+180)/360)*360
    for (var x = x0; x <= x1; x += 360) {
      box.push([ bbox[0]-x, bbox[1], bbox[2]-x, bbox[3] ])
    }
    var active = {}
    boxIntersect(box, boxes, function (i,j) {
      var file = '2/' + keys[j] + '.json'
      active[file] = true
      if (tiles[file]) return
      tiles[file] = true
      xhr(file, function (err, res, body) {
        addTile(file, JSON.parse(body))
      })
    })
    Object.keys(tiles).forEach(function (key) {
      if (tiles[key] && !active[key]) {
        tiles[key] = false
        removeTile(key)
      }
    })
  })
})

function removeTile (key) {
  console.log('REMOVE',key)
  map.remove(key)
}
function addTile (key, data) {
  console.log('ADD',key)
  map.add(key, {
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
}

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
