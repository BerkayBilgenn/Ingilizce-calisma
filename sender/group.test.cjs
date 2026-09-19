const assert = require("node:assert/strict");
const { findGroupByName, listGroups } = require("./whatsapp.cjs");

assert.equal(findGroupByName([{ id: "1@g.us", name: "Kalan İngilizce Kelimeler" }], "Kalan İngilizce Kelimeler").id, "1@g.us");
assert.equal(findGroupByName([{ id: "1@g.us", name: "Kalan İngilizce Kelimeler" }], "başka grup"), null);

const fallbackClient = {
  getChats: async () => { throw new Error("r: r"); },
  pupPage: {
    evaluate: async (fn) => {
      global.window = {
        require: () => ({
          Chat: {
            getModelsArray: () => [
              { id: { _serialized: "123@g.us" }, formattedTitle: "Kalan İngilizce Kelimeler" },
              { id: { _serialized: "90555@c.us" }, formattedTitle: "Bireysel sohbet" },
            ],
          },
        }),
      };
      try { return await fn(); } finally { delete global.window; }
    },
  },
};
listGroups(fallbackClient).then((groups) => {
  assert.deepEqual(groups, [{ id: "123@g.us", name: "Kalan İngilizce Kelimeler", isGroup: true }]);
  console.log("group fallback tests passed");
}).catch((error) => { console.error(error); process.exitCode = 1; });
console.log("group selection tests passed");
