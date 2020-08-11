import hljs from 'highlight.js/lib/core';
import json from 'highlight.js/lib/languages/json';
import 'highlight.js/styles/github.css';

import translations from './app.translations';
import dictionary from '../dictionaries/en-US';

hljs.registerLanguage('json', json);
hljs.initHighlightingOnLoad();

const content = { translations, dictionary };

document.body.innerHTML += Object.keys(content).map((key) => `
  <h2><pre>${key}:</pre></h2>
  <pre><code class="json">${JSON.stringify(content[key], null, 2)}</code></pre>
`).join('');
