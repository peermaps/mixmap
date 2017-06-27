var mixmap = require('../')(require('regl'))
var map = mixmap.create()
var mesh = require('./mesh.json')
map.add({
  triangle: {
    attributes: {
      position: mesh.triangle.positions
    },
    elements: mesh.triangle.cells
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
