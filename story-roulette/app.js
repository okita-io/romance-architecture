// Romance Story Roulette - App Logic

(function () {
  'use strict';

  // --- DOM refs ---
  const worldSelect = document.getElementById('world-setting');
  const plotSelect = document.getElementById('plot-function');
  const protagTropeSelect = document.getElementById('protag-trope');
  const protagComboSelect = document.getElementById('protag-combo');
  const loveTropeSelect = document.getElementById('love-trope');
  const loveComboSelect = document.getElementById('love-combo');

  const worldDesc = document.getElementById('world-desc');
  const plotDesc = document.getElementById('plot-desc');
  const protagDesc = document.getElementById('protag-desc');
  const loveDesc = document.getElementById('love-desc');

  const randomizeBtn = document.getElementById('randomize-btn');
  const generateBtn = document.getElementById('generate-btn');
  const copyBtn = document.getElementById('copy-btn');
  const outputSection = document.getElementById('output-section');
  const promptOutput = document.getElementById('prompt-output');

  // --- Helpers ---
  function prettifyKey(key) {
    return key
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
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
    for (const [key, name] of Object.entries(PERSONALITY_COMBOS)) {
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

  protagTropeSelect.addEventListener('change', () => {
    protagDesc.textContent = CHARACTER_TROPES[protagTropeSelect.value] || '';
  });

  protagComboSelect.addEventListener('change', () => {
    // Show the combo name in desc area if a trope is also selected
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
    // Add shake animation
    document.querySelector('.grid').classList.add('shaking');
    setTimeout(() => document.querySelector('.grid').classList.remove('shaking'), 400);

    setSelectValue(worldSelect, randomChoice(WORLD_SETTINGS));
    setSelectValue(plotSelect, randomChoice(PLOT_FUNCTIONS));
    setSelectValue(protagTropeSelect, randomChoice(CHARACTER_TROPES));
    setSelectValue(protagComboSelect, randomChoice(PERSONALITY_COMBOS));
    setSelectValue(loveTropeSelect, randomChoice(CHARACTER_TROPES));
    setSelectValue(loveComboSelect, randomChoice(PERSONALITY_COMBOS));
  });

  // --- Generate Prompt ---
  generateBtn.addEventListener('click', () => {
    const world = worldSelect.value;
    const plot = plotSelect.value;
    const pTrope = protagTropeSelect.value;
    const pCombo = protagComboSelect.value;
    const lTrope = loveTropeSelect.value;
    const lCombo = loveComboSelect.value;

    if (!world || !plot || !pTrope || !pCombo || !lTrope || !lCombo) {
      alert('Please select all options (or hit Randomize) before generating!');
      return;
    }

    const worldName = prettifyKey(world);
    const plotName = prettifyKey(plot);
    const pTropeName = prettifyKey(pTrope);
    const pComboName = PERSONALITY_COMBOS[pCombo];
    const lTropeName = prettifyKey(lTrope);
    const lComboName = PERSONALITY_COMBOS[lCombo];

    const prompt = `You are a creative fiction writer specializing in romance novels. Generate a fun, engaging 3-paragraph story summary for a romance novel with the following configuration:

WORLD SETTING: ${worldName}
${WORLD_SETTINGS[world]}

PLOT FUNCTION: ${plotName}
${PLOT_FUNCTIONS[plot]}

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

    promptOutput.textContent = prompt;
    outputSection.hidden = false;
    outputSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // --- Copy ---
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(promptOutput.textContent).then(() => {
      const originalText = copyBtn.textContent;
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = originalText; }, 2000);
    });
  });
})();
