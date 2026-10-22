const box = document.getElementById('toggle');

chrome.storage.sync.get({ enabled: true }, (r) => {
  box.checked = r.enabled;
});

box.addEventListener('change', () => {
  chrome.storage.sync.set({ enabled: box.checked });
});
