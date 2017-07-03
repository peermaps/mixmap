var ln360 = Math.log2(360)
module.exports = function (bbox) {
  var dx = bbox[2] - bbox[0]
  var dy = bbox[3] - bbox[1]
  var d = Math.max(dx,dy)
  var zoom = ln360 - Math.log2(d) + 1
  return Math.max(Math.min(zoom,21),1)
}
