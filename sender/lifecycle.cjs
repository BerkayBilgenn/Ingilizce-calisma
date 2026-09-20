function watchBrowser(client, onLost) {
  const browser = client.pupBrowser;
  const page = client.pupPage;
  let notified = false;
  function lost(reason) {
    if (notified) return;
    notified = true;
    onLost(reason);
  }
  if (!browser?.isConnected?.()) {
    lost("WhatsApp tarayıcısı kapandı.");
    return;
  }
  if (!page || page.isClosed()) {
    lost("WhatsApp sayfası kapandı.");
    return;
  }
  browser.once("disconnected", () => lost("WhatsApp tarayıcısı kapandı."));
  page.once("close", () => lost("WhatsApp sayfası kapandı."));
}
module.exports = { watchBrowser };
