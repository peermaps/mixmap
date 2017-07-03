var ln360 = Math.log2(360)

module.exports = function (bbox,zoom) {
  var dx = bbox[2] - bbox[0]
  var dy = bbox[3] - bbox[1]
  var d = Math.pow(2, ln360 - zoom)
  var x = (bbox[2] + bbox[0]) * 0.5
  var y = (bbox[3] + bbox[1]) * 0.5
  var sx = dx < dy ? dx / dy : 1
  var sy = dy < dx ? dy / dx : 1
  bbox[0] = x - d * sx
  bbox[1] = y - d * sy
  bbox[2] = x + d * sx
  bbox[3] = y + d * sy
  return bbox
}
