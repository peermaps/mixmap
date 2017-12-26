module.exports = Object.assign || function (out) {
  var len = arguments.length
  for (var i = 1; i < len; i++) {
    var arg = arguments[i]
    if (arg === undefined || arg === null) continue
    var keys = Object.keys(arg)
    var klen = keys.length
    for (var j = 0; j < klen; j++) {
      var k = keys[j]
      out[k] = arg[k]
    }
  }
  return out
}
