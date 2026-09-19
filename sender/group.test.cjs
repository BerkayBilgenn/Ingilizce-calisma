const assert = require("node:assert/strict");
const { findGroupByName } = require("./whatsapp.cjs");

assert.equal(findGroupByName([{ id: "1@g.us", name: "Kalan İngilizce Kelimeler" }], "Kalan İngilizce Kelimeler").id, "1@g.us");
assert.equal(findGroupByName([{ id: "1@g.us", name: "Kalan İngilizce Kelimeler" }], "başka grup"), null);
console.log("group selection tests passed");
