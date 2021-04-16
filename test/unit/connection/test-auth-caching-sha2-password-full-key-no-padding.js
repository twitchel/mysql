var assert = require('assert');
var crypto = require('crypto');
var common = require('../../common');
var Auth   = require(common.lib + '/protocol/Auth');
var Buffer = require('safe-buffer').Buffer;

crypto.publicEncrypt = crypto.publicEncrypt || function () { // Shim for Node < 0.11
  return Buffer.from('passwd', 'utf8');
};

var random = crypto.pseudoRandomBytes || crypto.randomBytes; // Depends on node.js version

var secureAuth = {
  key: common.getServerPublicKey()
};
var connection = common.createConnection({
  port       : common.fakeServerPort,
  password   : 'passwd',
  secureAuth : secureAuth
});
var server = common.createFakeServer();
var connected;

server.listen(common.fakeServerPort, function(err) {
  assert.ifError(err);

  connection.connect(function (err, result) {
    assert.ifError(err);

    connected = result;

    connection.destroy();
    server.destroy();
  });
});

server.on('connection', function(incomingConnection) {
  random(20, function (err, scramble) {
    assert.ifError(err);

    incomingConnection.on('clientAuthentication', function (packet) {
      this._resetAuthProcess(packet.scrambleBuff, Auth.sha2Token('passwd', scramble));
    });

    incomingConnection.on('authSwitchResponse', function (packet) {
      var expected = Auth.encrypt('passwd', scramble, secureAuth);
      this._sendEncryptedAuthResponse(packet.data, expected);
    });

    incomingConnection.handshake({
      authMethodName : 'caching_sha2_password',
      secureAuth     : secureAuth,
      scrambleBuff1  : scramble.slice(0, 8),
      scrambleBuff2  : scramble.slice(8, 20)
    });
  });
});

process.on('exit', function() {
  assert.equal(connected.fieldCount, 0);
});
