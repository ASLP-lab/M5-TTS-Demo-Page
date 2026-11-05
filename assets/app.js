(() => {
  'use strict';

  const languages = {
    en: { name: 'English', native: 'English' },
    de: { name: 'German', native: 'Deutsch' },
    fr: { name: 'French', native: 'Français' },
    ja: { name: 'Japanese', native: '日本語' },
    ko: { name: 'Korean', native: '한국어' },
    zh: { name: 'Chinese', native: '中文', textLang: 'zh-CN' },
    zh_sichuan: { name: 'Sichuanese', native: '四川话', textLang: 'zh-CN', isDialect: true },
    yue: { name: 'Cantonese', native: '粤语', textLang: 'yue', isDialect: true }
  };
  const modelNames = { reference: 'Reference prompt', m5: 'M5-TTS', moss: 'MOSS-TTS-Nano' };
  const samples = Array.isArray(window.M5_SAMPLES) ? window.M5_SAMPLES : [];
  const chineseSamples = Array.isArray(window.M5_CHINESE_SAMPLES) ? window.M5_CHINESE_SAMPLES : [];
  const chineseGroups = {
    normal: {
      name: 'Everyday speech',
      categories: {
        lang_zh: { name: 'Mandarin', description: 'Everyday Chinese sentences and natural spoken phrasing.' },
        codeswitch: { name: 'Code-switching', description: 'Chinese sentences with embedded words and phrases from other languages.' }
      }
    },
    emotion: {
      name: 'Emotion',
      categories: {
        emotion_joy: { name: 'Joy', description: 'Listen for the energy, warmth, and intonation of joyful speech.' },
        emotion_sad: { name: 'Sadness', description: 'Listen for changes in pace, tone, and delivery in sad speech.' },
        emotion_angry: { name: 'Anger', description: 'Compare the emphasis and intensity of emotionally charged delivery.' },
        emotion_surprise: { name: 'Surprise', description: 'Listen for expressive pitch changes and a sense of surprise.' }
      }
    },
    prosody: {
      name: 'Prosody',
      categories: {
        prosody_focus: { name: 'Focus & stress', description: 'Compare how emphasis brings different words and meanings into focus.' },
        prosody_question: { name: 'Questions', description: 'Listen for question intonation and the phrasing of interrogative sentences.' },
        prosody_rhythm: { name: 'Rhythm', description: 'Compare pacing, rhythm, and the flow of connected speech.' },
        pause_punctuation: { name: 'Punctuation', description: 'Listen to how punctuation shapes pauses and phrase boundaries.' },
        pause_minimal_pair: { name: 'Pause pairs', description: 'Three matched pairs keep the words unchanged and vary the punctuation. Listen to both versions of each pair.' },
        natural_conversation: { name: 'Conversation', description: 'Natural conversational turns with everyday phrasing and prosody.' }
      }
    }
  };
  const multilingualSamples = samples.filter(sample => languages[sample.language] && !languages[sample.language].isDialect);
  const dialectSamples = samples.filter(sample => languages[sample.language]?.isDialect);
  const sampleContainer = document.getElementById('audio-samples');
  const dialectContainer = document.getElementById('dialect-samples');
  const chineseContainer = document.getElementById('chinese-samples');
  const chineseCategoryList = document.getElementById('chinese-categories');
  const tabs = [...document.querySelectorAll('[data-language]')];
  const dialectTabs = [...document.querySelectorAll('[data-dialect]')];
  const chineseTabs = [...document.querySelectorAll('[data-chinese-group]')];
  const playbackGroups = [
    { container: sampleContainer, status: document.getElementById('playback-status') },
    { container: dialectContainer, status: document.getElementById('dialect-playback-status') },
    { container: chineseContainer, status: document.getElementById('chinese-playback-status') }
  ];
  const toast = document.getElementById('toast');
  let currentLanguage = 'en';
  let currentDialect = 'zh_sichuan';
  let currentChineseGroup = 'normal';
  const chineseSelections = { normal: 'lang_zh', emotion: 'emotion_joy', prosody: 'prosody_focus' };
  let toastTimeout;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function icon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('icon');
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', `#icon-${name}`);
    svg.append(use);
    return svg;
  }

  function sampleNumber(sample) {
    return sample.display_number || String(sample.selection_rank).padStart(2, '0');
  }

  function sampleLabel(sample) {
    return chineseGroups[sample.block]?.categories[sample.category]?.name || languages[sample.language].name;
  }

  function sampleId(sample) {
    return `sample-${sample.language}-${sampleNumber(sample)}`;
  }

  function announce(message) {
    window.clearTimeout(toastTimeout);
    toast.textContent = message;
    toast.classList.add('visible');
    toastTimeout = window.setTimeout(() => toast.classList.remove('visible'), 3000);
  }

  function updatePlaybackStatus() {
    playbackGroups.forEach(({ container, status }) => {
      const playing = [...container.querySelectorAll('audio')].find(audio => !audio.paused && !audio.ended);
      status.classList.toggle('is-playing', Boolean(playing));
      status.replaceChildren();
      if (playing) {
        status.textContent = `Playing ${playing.dataset.modelName} · ${playing.dataset.sampleLabel}`;
      } else {
        status.append(element('span', 'idle-dot'), document.createTextNode('Ready to listen'));
      }
    });
  }

  function audioCell(sample, model, displayIndex) {
    const cell = element('div', `audio-cell${model === 'm5' ? ' ours' : ''}`);
    const header = element('div', 'audio-cell-heading');
    const name = element('h4', '', modelNames[model]);
    name.id = `${sampleId(sample)}-${model}-label`;
    header.append(name);
    const badge = model === 'reference' ? 'Voice prompt' : model === 'm5' ? 'Ours' : 'Baseline';
    header.append(element('span', 'model-badge', badge));
    const duration = model === 'reference' ? sample.reference_duration : sample[model].duration;
    if (Number.isFinite(duration)) header.append(element('span', 'duration', `${duration.toFixed(1)} s`));
    const audio = element('audio');
    audio.controls = true;
    audio.preload = 'none';
    audio.src = sample.local_audio[model];
    audio.dataset.modelName = modelNames[model];
    audio.dataset.sampleLabel = `${sampleLabel(sample)} / Sample ${displayIndex}`;
    audio.setAttribute('aria-label', `${modelNames[model]}, ${sampleLabel(sample)}, sample ${displayIndex}`);
    audio.textContent = 'Your browser does not support audio playback.';
    audio.addEventListener('play', () => {
      document.querySelectorAll('.sample-card audio').forEach(other => {
        if (other !== audio && !other.paused) other.pause();
      });
      cell.classList.add('playing');
      updatePlaybackStatus();
    });
    for (const event of ['pause', 'ended']) {
      audio.addEventListener(event, () => {
        cell.classList.remove('playing');
        updatePlaybackStatus();
      });
    }
    audio.addEventListener('error', () => {
      if (cell.querySelector('.audio-error')) return;
      const error = element('p', 'audio-error', 'Audio could not be loaded. ');
      const link = element('a', '', 'Open WAV file');
      link.href = sample.local_audio[model];
      link.target = '_blank';
      link.rel = 'noopener';
      error.append(link);
      cell.append(error);
      updatePlaybackStatus();
    });
    cell.append(header, audio);
    return cell;
  }

  function sampleCard(sample, displayIndex) {
    const language = languages[sample.language];
    const rank = String(displayIndex);
    const card = element('article', 'sample-card');
    card.id = sampleId(sample);
    card.setAttribute('aria-labelledby', `${card.id}-title`);
    const header = element('div', 'sample-card-header');
    const heading = element('div', 'sample-heading');
    const title = element('h3', '', `Sample ${rank}`);
    title.id = `${card.id}-title`;
    heading.append(element('span', 'sample-number', rank), title);
    if (sample.language !== 'en') heading.append(element('span', 'native-label', language.native));
    const permalink = element('button', 'icon-button');
    permalink.type = 'button';
    permalink.title = 'Copy sample link';
    permalink.setAttribute('aria-label', `Copy link to ${language.name} sample ${rank}`);
    permalink.append(icon('link'));
    permalink.addEventListener('click', async () => {
      const url = new URL(window.location.href);
      url.hash = card.id;
      try {
        if (!navigator.clipboard) throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(url.href);
        announce('Sample link copied');
      } catch {
        window.location.hash = card.id;
        announce('Sample opened. Copy the link from your address bar.');
      }
    });
    header.append(heading, permalink);
    const target = element('div', 'target-text');
    const text = element('p', '', sample.target);
    text.lang = language.textLang || sample.language;
    target.append(element('span', 'target-label', 'Target text'), text);
    const audioColumns = element('div', 'audio-columns');
    const availableModels = ['reference', 'm5', 'moss'].filter(model => sample.local_audio[model]);
    audioColumns.style.setProperty('--audio-column-count', availableModels.length);
    for (const model of availableModels) audioColumns.append(audioCell(sample, model, displayIndex));
    const prompt = element('div', 'target-text prompt-text');
    const promptText = typeof sample.prompt_text === 'string' ? sample.prompt_text.trim() : '';
    const missingTranscript = sample.prompt_text_status === 'not_displayed' ? 'Reference transcript not displayed.' : 'Reference transcript not provided.';
    const transcript = element('p', promptText ? '' : 'transcript-missing', promptText || missingTranscript);
    transcript.lang = promptText ? language.textLang || sample.language : 'en';
    prompt.append(element('span', 'target-label', 'Prompt text'), transcript);
    card.append(header, prompt, target, audioColumns);
    if (sample.flags.includes('时长相差超过2倍')) {
      card.append(element('p', 'sample-warning', 'Listening note: the two generated clips differ in duration by more than 2×.'));
    }
    return card;
  }

  function showLanguage(language) {
    if (!tabs.some(tab => tab.dataset.language === language)) return;
    sampleContainer.querySelectorAll('audio').forEach(audio => audio.pause());
    currentLanguage = language;
    tabs.forEach(tab => {
      const selected = tab.dataset.language === language;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    const visibleSamples = multilingualSamples.filter(sample => language === 'all' || sample.language === language);
    sampleContainer.replaceChildren(...visibleSamples.map(sampleCard));
    if (!visibleSamples.length) {
      sampleContainer.append(element('p', 'notice', 'Audio examples are unavailable. Please check that assets/samples.js is included with this page.'));
    }
    document.getElementById('audio-panel').setAttribute('aria-labelledby', `tab-${language}`);
    document.getElementById('sample-count').textContent = `${language === 'all' ? 'All languages' : languages[language].name} · ${visibleSamples.length} listening examples`;
    updatePlaybackStatus();
  }

  function showDialect(dialect) {
    if (!dialectTabs.some(tab => tab.dataset.dialect === dialect)) return;
    dialectContainer.querySelectorAll('audio').forEach(audio => audio.pause());
    currentDialect = dialect;
    dialectTabs.forEach(tab => {
      const selected = tab.dataset.dialect === dialect;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    const visibleSamples = dialectSamples.filter(sample => dialect === 'all' || sample.language === dialect);
    dialectContainer.replaceChildren(...visibleSamples.map(sampleCard));
    if (!visibleSamples.length) {
      dialectContainer.append(element('p', 'notice', 'Dialect examples are unavailable. Please check that assets/samples.js is included with this page.'));
    }
    document.getElementById('dialect-panel').setAttribute('aria-labelledby', `dialect-tab-${dialect}`);
    document.getElementById('dialect-count').textContent = `${dialect === 'all' ? 'All dialects' : languages[dialect].name} · ${visibleSamples.length} listening examples`;
    updatePlaybackStatus();
  }

  function chinesePair(pairId, pairSamples, index, startIndex) {
    const group = element('section', 'minimal-pair-group');
    group.id = `chinese-${pairId}`;
    group.dataset.pair = pairId;
    group.setAttribute('aria-labelledby', `${group.id}-title`);
    const header = element('div', 'minimal-pair-header');
    const title = element('h3', '', `Pause pair ${index}`);
    title.id = `${group.id}-title`;
    header.append(icon('link'), title, element('span', '', 'Same words · Different punctuation'));
    const comparison = element('div', 'pair-text-comparison');
    pairSamples.forEach((sample, variant) => {
      const version = element('div', 'pair-text-version');
      const text = element('p', '', sample.target);
      text.lang = 'zh-CN';
      version.append(element('span', '', `${String.fromCharCode(65 + variant)} · Sample ${startIndex + variant}`), text);
      comparison.append(version);
    });
    group.append(header, comparison);
    pairSamples.forEach((sample, variant) => {
      const card = sampleCard(sample, startIndex + variant);
      card.querySelector('.sample-heading').append(element('span', 'pair-variant', `Version ${String.fromCharCode(65 + variant)}`));
      group.append(card);
    });
    return group;
  }

  function showChinese(block, category) {
    const group = chineseGroups[block];
    if (!group) return false;
    const selectedCategory = category || chineseSelections[block];
    if (!Object.hasOwn(group.categories, selectedCategory)) return false;
    chineseContainer.querySelectorAll('audio').forEach(audio => audio.pause());
    currentChineseGroup = block;
    chineseSelections[block] = selectedCategory;
    chineseTabs.forEach(tab => {
      const selected = tab.dataset.chineseGroup === block;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    const groupPanel = document.getElementById('chinese-group-panel');
    groupPanel.setAttribute('aria-labelledby', `chinese-group-${block}`);
    groupPanel.dataset.collection = block;
    if (chineseCategoryList.dataset.collection !== block) {
      const categoryTabs = Object.entries(group.categories).map(([key, info]) => {
        const button = element('button', 'chinese-category-tab');
        button.type = 'button';
        button.id = `chinese-category-${key}`;
        button.dataset.chineseCategory = key;
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-controls', 'chinese-panel');
        const count = chineseSamples.filter(sample => sample.block === block && sample.category === key).length;
        button.append(document.createTextNode(info.name), element('span', '', String(count).padStart(2, '0')));
        return button;
      });
      chineseCategoryList.replaceChildren(...categoryTabs);
      chineseCategoryList.dataset.collection = block;
      chineseCategoryList.setAttribute('aria-label', `Choose a category within ${group.name}`);
      bindTabs(categoryTabs, tab => {
        if (chineseSelections[block] === tab.dataset.chineseCategory) return;
        selectChinese(block, tab.dataset.chineseCategory);
      });
    }
    chineseCategoryList.querySelectorAll('[role="tab"]').forEach(tab => {
      const selected = tab.dataset.chineseCategory === selectedCategory;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    const info = group.categories[selectedCategory];
    document.getElementById('chinese-panel').setAttribute('aria-labelledby', `chinese-category-${selectedCategory}`);
    document.getElementById('chinese-breadcrumb').replaceChildren(
      document.createTextNode('Chinese'), element('span', '', '/'), document.createTextNode(group.name),
      element('span', '', '/'), element('strong', '', info.name)
    );
    document.getElementById('chinese-description').textContent = info.description;
    const visibleSamples = chineseSamples.filter(sample => sample.block === block && sample.category === selectedCategory)
      .sort((a, b) => a.selection_rank - b.selection_rank);
    if (selectedCategory === 'pause_minimal_pair') {
      const pairs = new Map();
      visibleSamples.forEach(sample => {
        if (!pairs.has(sample.minimal_pair)) pairs.set(sample.minimal_pair, []);
        pairs.get(sample.minimal_pair).push(sample);
      });
      chineseContainer.replaceChildren(...[...pairs].map(([key, pairSamples], index) => chinesePair(key, pairSamples, index, visibleSamples.indexOf(pairSamples[0]))));
      document.getElementById('chinese-count').textContent = `${info.name} · ${pairs.size} pairs · ${visibleSamples.length} listening examples`;
    } else {
      chineseContainer.replaceChildren(...visibleSamples.map(sampleCard));
      document.getElementById('chinese-count').textContent = `${info.name} · ${visibleSamples.length} listening examples`;
    }
    if (!visibleSamples.length) {
      chineseContainer.append(element('p', 'notice', 'Chinese examples are unavailable. Please check that assets/chinese-samples.js is included with this page.'));
    }
    updatePlaybackStatus();
    return true;
  }

  function selectChinese(block, category) {
    if (!showChinese(block, category)) return;
    const hash = `chinese-${block}-${chineseSelections[block]}`;
    try {
      history.pushState(null, '', `#${hash}`);
    } catch {
      window.location.hash = hash;
    }
  }

  function bindTabs(group, selectTab) {
    group.forEach((tab, index) => {
      tab.addEventListener('click', () => selectTab(tab));
      tab.addEventListener('keydown', event => {
        let target;
        if (event.key === 'ArrowRight') target = (index + 1) % group.length;
        if (event.key === 'ArrowLeft') target = (index - 1 + group.length) % group.length;
        if (event.key === 'Home') target = 0;
        if (event.key === 'End') target = group.length - 1;
        if (target === undefined) return;
        event.preventDefault();
        group[target].focus();
        group[target].click();
      });
    });
  }

  bindTabs(tabs, tab => {
    if (currentLanguage === tab.dataset.language) return;
    showLanguage(tab.dataset.language);
    try {
      history.pushState(null, '', `#examples-${currentLanguage}`);
    } catch {
      window.location.hash = `examples-${currentLanguage}`;
    }
  });
  bindTabs(dialectTabs, tab => {
    if (currentDialect === tab.dataset.dialect) return;
    showDialect(tab.dataset.dialect);
    try {
      history.pushState(null, '', `#dialects-${currentDialect}`);
    } catch {
      window.location.hash = `dialects-${currentDialect}`;
    }
  });

  bindTabs(chineseTabs, tab => {
    if (currentChineseGroup !== tab.dataset.chineseGroup) selectChinese(tab.dataset.chineseGroup);
  });

  function routeHash(shouldScroll) {
    const hash = window.location.hash.slice(1);
    const languageMatch = /^examples-(en|de|fr|ja|ko|all)$/.exec(hash);
    const dialectMatch = /^dialects-(zh_sichuan|yue|all)$/.exec(hash) || /^examples-(zh_sichuan|yue)$/.exec(hash);
    const chineseMatch = /^chinese-(normal|emotion|prosody)(?:-([a-z_]+))?$/.exec(hash);
    const sample = [...samples, ...chineseSamples].find(item => sampleId(item) === hash);
    if (chineseMatch) {
      if (showChinese(chineseMatch[1], chineseMatch[2]) && shouldScroll) {
        requestAnimationFrame(() => document.getElementById('chinese-examples').scrollIntoView());
      }
    } else if (dialectMatch) {
      if (currentDialect !== dialectMatch[1]) showDialect(dialectMatch[1]);
      if (shouldScroll) requestAnimationFrame(() => document.getElementById('dialect-examples').scrollIntoView());
    } else if (languageMatch) {
      if (currentLanguage !== languageMatch[1]) showLanguage(languageMatch[1]);
      if (shouldScroll) requestAnimationFrame(() => document.getElementById('examples').scrollIntoView());
    } else if (sample) {
      if (sample.block && chineseGroups[sample.block]) {
        if (currentChineseGroup !== sample.block || chineseSelections[sample.block] !== sample.category) showChinese(sample.block, sample.category);
      } else if (languages[sample.language]?.isDialect) {
        if (currentDialect !== sample.language && currentDialect !== 'all') showDialect(sample.language);
      } else if (currentLanguage !== sample.language && currentLanguage !== 'all') {
        showLanguage(sample.language);
      }
      if (shouldScroll) requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView());
    }
  }

  showChinese('normal');
  showDialect('zh_sichuan');
  showLanguage('en');
  routeHash(true);
  window.addEventListener('hashchange', () => routeHash(true));

  const dialog = document.getElementById('figure-dialog');
  const expandedFigure = document.getElementById('expanded-figure');
  document.querySelectorAll('[data-zoom]').forEach(button => {
    button.addEventListener('click', () => {
      expandedFigure.src = button.dataset.zoom;
      expandedFigure.alt = button.closest('figure').querySelector('img').alt;
      document.getElementById('dialog-caption').textContent = button.dataset.caption;
      document.getElementById('original-figure').href = button.dataset.zoom;
      dialog.showModal();
      document.body.classList.add('modal-open');
    });
  });
  document.getElementById('close-figure').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    const bounds = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
  });
  dialog.addEventListener('close', () => document.body.classList.remove('modal-open'));

  const backToTop = document.querySelector('.back-to-top');
  const navLinks = [...document.querySelectorAll('.top-nav a')];
  const anchors = ['abstract', 'tokenizer', 'architecture', 'chinese-examples', 'examples', 'dialect-examples']
    .map(id => document.getElementById(id))
    .filter(Boolean);
  let scrollPending = false;
  function updateNavigation() {
    backToTop.classList.toggle('visible', window.scrollY > 650);
    let activeId = '';
    anchors.forEach(section => {
      if (section.getBoundingClientRect().top <= 170) activeId = section.id;
    });
    if (activeId === 'architecture') activeId = 'tokenizer';
    navLinks.forEach(link => {
      const active = link.getAttribute('href') === `#${activeId}`;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    scrollPending = false;
  }
  window.addEventListener('scroll', () => {
    if (scrollPending) return;
    scrollPending = true;
    requestAnimationFrame(updateNavigation);
  }, { passive: true });
  updateNavigation();
})();
