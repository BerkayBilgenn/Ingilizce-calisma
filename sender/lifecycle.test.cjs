const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { watchBrowser } = require("./lifecycle.cjs");

const browser = new EventEmitter();
browser.isConnected = () => true;
const page = new EventEmitter();
page.isClosed = () => false;
const lost = [];
watchBrowser({ pupBrowser: browser, pupPage: page }, (reason) => lost.push(reason));
browser.emit("disconnected");
page.emit("close");
assert.deepEqual(lost, ["WhatsApp tarayıcısı kapandı."]);

const alreadyClosed = new EventEmitter();
alreadyClosed.isConnected = () => false;
watchBrowser({ pupBrowser: alreadyClosed, pupPage: page }, (reason) => lost.push(reason));
assert.deepEqual(lost, ["WhatsApp tarayıcısı kapandı.", "WhatsApp tarayıcısı kapandı."]);
console.log("sender lifecycle tests passed");
