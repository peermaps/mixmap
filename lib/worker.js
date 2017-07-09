var RPC = require('frame-rpc')

module.exports = function (self) {
  var rpc = new RPC(self, self, '*', {
    'json.parse': function (s, cb) {
      try { var data = JSON.parse(s) }
      catch (err) { return cb(err) }
      cb(null, data)
    }
  })
}
