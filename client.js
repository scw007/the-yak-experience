const ws = require('ws');

const client = new ws('ws://localhost:1234');

client.on('open', () => {
  // Causes the server to print "Hello"
  client.send('The quick brown fox jumped over the lazy dog');
});
