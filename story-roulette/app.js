// Romance Story Roulette - App Logic

(function () {
  'use strict';

  // Factory archetype slug ← romance-archetypes foundation (must stay in sync
  // with romance_factory.generate.story_arc.combo_ladder.ARCHETYPE_FOUNDATION_SLUGS).
  const FOUNDATION_TO_ARCHETYPE = {
    'aristocrat-noble': 'aristocrat',
    'bold-dramatic': 'bold',
    'secretive-enigma': 'enigma',
    'unpredictable-freespirit': 'freespirit',
    'supergenius-intelectual': 'genius',
    'zealous-passionate': 'passionate',
    'shy-submissive': 'shy',
    'reserved-stoic': 'stoic',
    'tsundere-spitfire': 'tsundere',
    'obsessive-yandere': 'yandere',
  };

  // --- DOM refs ---
  const worldSelect = document.getElementById('world-setting');
  const plotSelect = document.getElementById('plot-function');
  const romanceTropeSelect = document.getElementById('romance-trope');
  const protagTropeSelect = document.getElementById('protag-trope');
  const protagComboSelect = document.getElementById('protag-combo');
  const loveTropeSelect = document.getElementById('love-trope');
  const loveComboSelect = document.getElementById('love-combo');

  const worldDesc = document.getElementById('world-desc');
  const plotDesc = document.getElementById('plot-desc');
  const romanceDesc = document.getElementById('romance-desc');
  const protagDesc = document.getElementById('protag-desc');
  const loveDesc = document.getElementById('love-desc');

  const randomizeBtn = document.getElementById('randomize-btn');
  const generateBtn = document.getElementById('generate-btn');
  const copyCliBtn = document.getElementById('copy-cli-btn');
  const copyPromptBtn = document.getElementById('copy-prompt-btn');
  const outputSection = document.getElementById('output-section');
  const cliOutput = document.getElementById('cli-output');
  const promptOutput = document.getElementById('prompt-output');
  const outputHint = document.getElementById('output-hint');

  // --- Helpers ---
  function prettifyKey(key) {
    return key
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  function slugifyName(name) {
    return String(name || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function isFactoryMappableCombo(comboKey) {
    const parts = String(comboKey).split('+');
    if (parts.length !== 2) return false;
    return parts.every(p => Boolean(FOUNDATION_TO_ARCHETYPE[p]));
  }

  function factoryMappableCombos() {
    const out = {};
    for (const [key, name] of Object.entries(PERSONALITY_COMBOS)) {
      if (isFactoryMappableCombo(key)) out[key] = name;
    }
    return out;
  }

  function comboCliToken(comboKey) {
    const name = PERSONALITY_COMBOS[comboKey];
    const slug = slugifyName(name);
    const mappable = factoryMappableCombos();
    const sameName = Object.keys(mappable).filter(
      k => slugifyName(mappable[k]) === slug
    );
    // Prefer the readable composite slug when unique among factory-mappable pairs.
    if (sameName.length === 1) return slug;
    return comboKey;
  }

  function shellQuote(token) {
    if (/^[A-Za-z0-9_./:@+=,-]+$/.test(token)) return token;
    return `'${String(token).replace(/'/g, `'\\''`)}'`;
  }

  function populateSelect(select, data, placeholder) {
    select.innerHTML = `<option value="">${placeholder}</option>`;
    for (const key of Object.keys(data)) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = prettifyKey(key);
      select.appendChild(opt);
    }
  }

  function populateComboSelect(select) {
    select.innerHTML = '<option value="">-- Pick a combo --</option>';
    for (const [key, name] of Object.entries(factoryMappableCombos())) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = name;
      select.appendChild(opt);
    }
  }

  function randomChoice(obj) {
    const keys = Object.keys(obj);
    return keys[Math.floor(Math.random() * keys.length)];
  }

  function setSelectValue(select, value) {
    select.value = value;
    select.dispatchEvent(new Event('change'));
  }

  // --- Initialize dropdowns ---
  populateSelect(worldSelect, WORLD_SETTINGS, '-- Pick a world --');
  populateSelect(plotSelect, PLOT_FUNCTIONS, '-- Pick a plot --');
  populateSelect(romanceTropeSelect, ROMANCE_TROPES, '-- Pick a romance trope --');
  populateSelect(protagTropeSelect, CHARACTER_TROPES, '-- Pick a trope --');
  populateSelect(loveTropeSelect, CHARACTER_TROPES, '-- Pick a trope --');
  populateComboSelect(protagComboSelect);
  populateComboSelect(loveComboSelect);

  // --- Description updates ---
  worldSelect.addEventListener('change', () => {
    worldDesc.textContent = WORLD_SETTINGS[worldSelect.value] || '';
  });

  plotSelect.addEventListener('change', () => {
    plotDesc.textContent = PLOT_FUNCTIONS[plotSelect.value] || '';
  });

  romanceTropeSelect.addEventListener('change', () => {
    romanceDesc.textContent = ROMANCE_TROPES[romanceTropeSelect.value] || '';
  });

  protagTropeSelect.addEventListener('change', () => {
    protagDesc.textContent = CHARACTER_TROPES[protagTropeSelect.value] || '';
  });

  protagComboSelect.addEventListener('change', () => {
    if (protagComboSelect.value) {
      const name = PERSONALITY_COMBOS[protagComboSelect.value];
      protagDesc.textContent = name ? `Personality: "${name}"` : '';
    }
  });

  loveTropeSelect.addEventListener('change', () => {
    loveDesc.textContent = CHARACTER_TROPES[loveTropeSelect.value] || '';
  });

  loveComboSelect.addEventListener('change', () => {
    if (loveComboSelect.value) {
      const name = PERSONALITY_COMBOS[loveComboSelect.value];
      loveDesc.textContent = name ? `Personality: "${name}"` : '';
    }
  });

  // --- Randomize ---
  randomizeBtn.addEventListener('click', () => {
    document.querySelectorAll('.grid').forEach(g => g.classList.add('shaking'));
    setTimeout(() => document.querySelectorAll('.grid').forEach(g => g.classList.remove('shaking')), 400);

    const combos = factoryMappableCombos();
    setSelectValue(worldSelect, randomChoice(WORLD_SETTINGS));
    setSelectValue(plotSelect, randomChoice(PLOT_FUNCTIONS));
    setSelectValue(romanceTropeSelect, randomChoice(ROMANCE_TROPES));
    setSelectValue(protagTropeSelect, randomChoice(CHARACTER_TROPES));
    setSelectValue(protagComboSelect, randomChoice(combos));
    setSelectValue(loveTropeSelect, randomChoice(CHARACTER_TROPES));
    setSelectValue(loveComboSelect, randomChoice(combos));
  });

  function buildStoryPrompt(world, plot, romance, pTrope, pCombo, lTrope, lCombo) {
    const worldName = prettifyKey(world);
    const plotName = prettifyKey(plot);
    const romanceName = prettifyKey(romance);
    const pTropeName = prettifyKey(pTrope);
    const pComboName = PERSONALITY_COMBOS[pCombo];
    const lTropeName = prettifyKey(lTrope);
    const lComboName = PERSONALITY_COMBOS[lCombo];

    return `You are a creative fiction writer specializing in romance novels. Generate a fun, engaging 3-paragraph story summary for a romance novel with the following configuration:

WORLD SETTING: ${worldName}
${WORLD_SETTINGS[world]}

PLOT FUNCTION: ${plotName}
${PLOT_FUNCTIONS[plot]}

ROMANCE TROPE: ${romanceName}
${ROMANCE_TROPES[romance]}

PROTAGONIST:
- Character Trope: ${pTropeName}
  ${CHARACTER_TROPES[pTrope]}
- Personality: "${pComboName}" (${pCombo})

LOVE INTEREST:
- Character Trope: ${lTropeName}
  ${CHARACTER_TROPES[lTrope]}
- Personality: "${lComboName}" (${lCombo})

INSTRUCTIONS:
Write a 3-paragraph story summary that:
1. Sets up the world and introduces both characters in their element
2. Describes the central conflict driven by the plot function and how these two very different people collide
3. Teases the romantic tension and hints at a satisfying (or hilariously complicated) resolution

Make it fun, vivid, and lean into the absurdity of this particular combination. Give both characters names that fit the world. Keep it under 300 words.`;
  }

  function copyText(button, text) {
    if (!text) return;

    const flash = () => {
      const originalText = button.textContent;
      button.textContent = 'Copied!';
      setTimeout(() => { button.textContent = originalText; }, 2000);
    };

    navigator.clipboard.writeText(text).then(flash).catch(() => {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      flash();
    });
  }

  // --- Generate CLI + story prompt ---
  generateBtn.addEventListener('click', () => {
    const world = worldSelect.value;
    const plot = plotSelect.value;
    const romance = romanceTropeSelect.value;
    const pTrope = protagTropeSelect.value;
    const pCombo = protagComboSelect.value;
    const lTrope = loveTropeSelect.value;
    const lCombo = loveComboSelect.value;

    if (!world || !plot || !romance || !pTrope || !pCombo || !lTrope || !lCombo) {
      alert('Please select all options (or hit Randomize) before generating!');
      return;
    }

    if (!isFactoryMappableCombo(pCombo) || !isFactoryMappableCombo(lCombo)) {
      alert('Selected personality combo is not factory-mappable. Pick another combo (or Randomize).');
      return;
    }

    const parts = [
      'python -m romance_factory.generate',
      `--world ${shellQuote(world)}`,
      `--plot ${shellQuote(plot)}`,
      `--trope ${shellQuote(romance)}`,
      `--protagonist ${shellQuote(pTrope)} ${shellQuote(comboCliToken(pCombo))}`,
      `--love-interest ${shellQuote(lTrope)} ${shellQuote(comboCliToken(lCombo))}`,
    ];

    cliOutput.textContent = parts.join(' ');
    promptOutput.textContent = buildStoryPrompt(
      world, plot, romance, pTrope, pCombo, lTrope, lCombo
    );
    if (outputHint) {
      outputHint.textContent =
        'Paste into a terminal, then append --llm-preset <name> and --story-path <dir>.';
    }
    outputSection.hidden = false;
    outputSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  copyCliBtn.addEventListener('click', () => {
    copyText(copyCliBtn, cliOutput.textContent);
  });

  copyPromptBtn.addEventListener('click', () => {
    copyText(copyPromptBtn, promptOutput.textContent);
  });
})();
