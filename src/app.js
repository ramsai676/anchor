import { run, reset, $ } from './ui.js';
import { SAMPLE } from './sample.js';

function readFile(file) {
  const reader = new FileReader();
  reader.onload = () => run(String(reader.result));
  reader.readAsText(file);
}

function wire() {
  const zone = $('#dropzone');
  const paste = $('#paste');

  $('#analyse').addEventListener('click', () => {
    const text = paste.value.trim();
    if (text.length > 40) run(text);
    else paste.focus();
  });

  $('#sample').addEventListener('click', () => {
    paste.value = SAMPLE;
    run(SAMPLE);
  });

  $('#reset').addEventListener('click', reset);

  $('#file').addEventListener('change', e => {
    if (e.target.files[0]) readFile(e.target.files[0]);
  });

  // Dragging fires dragleave for every child element crossed, so the counter
  // keeps the zone from flickering as the pointer moves across it.
  let depth = 0;
  for (const type of ['dragenter', 'dragover']) {
    zone.addEventListener(type, e => {
      e.preventDefault();
      if (type === 'dragenter') depth++;
      zone.dataset.over = 'true';
    });
  }
  zone.addEventListener('dragleave', () => {
    if (--depth <= 0) { depth = 0; zone.dataset.over = 'false'; }
  });
  zone.addEventListener('drop', e => {
    e.preventDefault();
    depth = 0;
    zone.dataset.over = 'false';
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  });

  // Ctrl/Cmd+Enter is the one shortcut here, and shortcuts never animate.
  paste.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') $('#analyse').click();
  });
}

function start() {
  wire();
  // #demo gives a shareable link that lands straight on a worked example,
  // which is the fastest way for someone to judge whether this is useful.
  if (location.hash === '#demo') run(SAMPLE);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}
