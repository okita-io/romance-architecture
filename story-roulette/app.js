// Romance Story Roulette - App Logic

(function () {
  'use strict';

  // Factory archetype slug ← romance-archetypes foundation (must stay in sync
  // with romance_factory.generate.story_arc.combo_ladder.ARCHETYPE_FOUNDATION_SLUGS).
  const FOUNDATION_TO_ARCHETYPE = {
    'aristocrat-noble': 'aristocrat',
    'bold-dramatic': 'bold',
    'clumsy-dojikko': 'dojikko',
    'cool-kuudere': 'kuudere',
    'silent-dandere': 'dandere',
    'open-deredere': 'deredere',
    'princess-himedere': 'himedere',
    'princely-oujidere': 'oujidere',
    'divine-kamidere': 'kamidere',
    'teasing-sadodere': 'sadodere',
    'turncoat-mayadere': 'mayadere',
    'cynical-hinedere': 'hinedere',
    'secretive-enigma': 'enigma',
    'unpredictable-freespirit': 'freespirit',
    'supergenius-intellectual': 'genius',
    // Legacy typo key (pre-rename ladder/combo artifacts)
    'supergenius-intelectual': 'genius',
    'zealous-passionate': 'passionate',
    'shy-submissive': 'shy',
    'reserved-stoic': 'stoic',
    'tsundere-spitfire': 'tsundere',
    'obsessive-yandere': 'yandere',
  };

  // One-sentence foundation blurbs for the story-summary prompt (directed combo
  // = primary identity + secondary method). Keep in sync with romance-archetypes
  // character_archetype.foundations.json, abbreviated for the roulette prompt.
  const FOUNDATION_BLURBS = {
    'aristocrat-noble': 'Innate superiority as natural law: they expect to command, be accommodated, and treat honor, legacy, and reputation as non-negotiable.',
    'bold-dramatic': 'Life is a stage and they take the spotlight—gestures, declarations, and passions run at full theatrical volume with no interest in subtlety.',
    'clumsy-dojikko': 'Sincerity arrives ahead of coordination: huge-hearted, filterless, and physically hapless, they keep choosing connection even when grace abandons them.',
    'cool-kuudere': 'Flat affect and rationed speech until a single protocol-breaking flash of honesty; care shows as competence and logistics long before language.',
    'silent-dandere': 'Voice is a scarce resource spent only when safety is certain; for one trusted person the dam breaks into sudden fluency and selective intensity.',
    'open-deredere': 'Affection without a mask—warmth given early and unearned; the bravery is staying unguarded in a world that distrusts sweetness with no catch.',
    'princess-himedere': 'Emotional royalty: devotion must arrive as tribute on their terms; softness is a reward for proper worship, hiding a terror of being ordinary.',
    'princely-oujidere': 'Chivalry as visible performance that rehearses worthiness—polished vows and public choosing that, at best, deepen into kept promises.',
    'divine-kamidere': 'Love granted from altitude like a miracle; they need to remain the source of meaning, and softening means descending from pedestal to peer.',
    'teasing-sadodere': 'Courtship as pressure and play: provocation hunts for a real reaction, waking someone out of politeness—dangerous if control is mistaken for care.',
    'turncoat-mayadere': 'Begins as opposition until attachment rearranges allegiance; devotion is fierce because it cost them a prior self, and trust is the ordeal.',
    'cynical-hinedere': 'Contempt as armor and philosophy—sincerity is audited as a scam until proof humbles them into a reluctant, hard-won honesty.',
    'secretive-enigma': 'Present yet unknowable; every disclosure is measured misdirection, and power lives in what remains unsaid.',
    'unpredictable-freespirit': 'Rules are suggestions; path is whim and inner compass, with loyalty to freedom over plans, cages, or other people\'s schedules.',
    'supergenius-intellectual': 'Sees systems three moves ahead and makes the profound sound obvious; brilliance coexists with bafflement that others cannot see what they see.',
    'zealous-passionate': 'Conviction as wildfire—every pursuit is total surrender, neutrality is foreign, and intensity is treated as authenticity rather than excess.',
    'shy-submissive': 'Measured presence, apologies as armor, and devotion expressed as quiet endurance; desire lives in glances and what is not said.',
    'reserved-stoic': 'Equanimity as a built fortress: feeling is acknowledged privately, translated into measured action, and never allowed to seize the wheel.',
    'tsundere-spitfire': 'Care disguised as combat—kindness retracted the moment it shows, with "go away" often meaning "come closer."',
    'obsessive-yandere': 'Single-minded devotion that reshapes reality around one person; tenderness and possession are the same weather system.',
  };

  // --- DOM refs ---
  const pairingSelect = document.getElementById('pairing');
  const worldSelect = document.getElementById('world-setting');
  const plotSelect = document.getElementById('plot-function');
  const romanceTropeSelect = document.getElementById('romance-trope');
  const yaoiDyadSelect = document.getElementById('yaoi-dyad');
  const yaoiDyadCard = document.getElementById('yaoi-dyad-card');
  const protagTropeSelect = document.getElementById('protag-trope');
  const protagComboSelect = document.getElementById('protag-combo');
  const loveTropeSelect = document.getElementById('love-trope');
  const loveComboSelect = document.getElementById('love-combo');
  const antTropeSelect = document.getElementById('ant-trope');
  const antComboSelect = document.getElementById('ant-combo');

  const pairingDesc = document.getElementById('pairing-desc');
  const worldDesc = document.getElementById('world-desc');
  const plotDesc = document.getElementById('plot-desc');
  const romanceDesc = document.getElementById('romance-desc');
  const yaoiDyadDesc = document.getElementById('yaoi-dyad-desc');
  const protagDesc = document.getElementById('protag-desc');
  const loveDesc = document.getElementById('love-desc');
  const antDesc = document.getElementById('ant-desc');

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
  if (yaoiDyadSelect && typeof YAOI_ROLE_DYADS !== 'undefined') {
    populateSelect(yaoiDyadSelect, YAOI_ROLE_DYADS, '-- Optional dyad overlay --');
  }
  populateSelect(protagTropeSelect, CHARACTER_TROPES, '-- Pick a trope --');
  populateSelect(loveTropeSelect, CHARACTER_TROPES, '-- Pick a trope --');
  populateSelect(antTropeSelect, CHARACTER_TROPES, '-- Pick a trope --');
  populateComboSelect(protagComboSelect);
  populateComboSelect(loveComboSelect);
  populateComboSelect(antComboSelect);

  function syncYaoiDyadVisibility() {
    const isYaoi = pairingSelect.value === 'yaoi';
    if (yaoiDyadCard) {
      yaoiDyadCard.hidden = !isYaoi;
    }
    if (!isYaoi && yaoiDyadSelect) {
      yaoiDyadSelect.value = '';
    }
  }

  // --- Description updates ---
  pairingSelect.addEventListener('change', () => {
    pairingDesc.textContent = PAIRINGS[pairingSelect.value] || '';
    syncYaoiDyadVisibility();
  });
  // Initial pairing description
  pairingDesc.textContent = PAIRINGS[pairingSelect.value] || PAIRINGS.het;
  syncYaoiDyadVisibility();

  worldSelect.addEventListener('change', () => {
    worldDesc.textContent = WORLD_SETTINGS[worldSelect.value] || '';
  });

  plotSelect.addEventListener('change', () => {
    plotDesc.textContent = PLOT_FUNCTIONS[plotSelect.value] || '';
  });

  romanceTropeSelect.addEventListener('change', () => {
    romanceDesc.textContent = ROMANCE_TROPES[romanceTropeSelect.value] || '';
  });

  if (yaoiDyadSelect) {
    yaoiDyadSelect.addEventListener('change', () => {
      if (yaoiDyadDesc) {
        yaoiDyadDesc.textContent =
          (typeof YAOI_ROLE_DYADS !== 'undefined' && YAOI_ROLE_DYADS[yaoiDyadSelect.value]) ||
          'Overlays the romance trope (who pursues / receives). Not a trope key; plot stays separate.';
      }
    });
  }

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

  antTropeSelect.addEventListener('change', () => {
    antDesc.textContent = CHARACTER_TROPES[antTropeSelect.value] || '';
  });

  antComboSelect.addEventListener('change', () => {
    if (antComboSelect.value) {
      const name = PERSONALITY_COMBOS[antComboSelect.value];
      antDesc.textContent = name ? `Personality: "${name}" (how they oppose, not how they love)` : '';
    }
  });

  // --- Randomize ---
  randomizeBtn.addEventListener('click', () => {
    document.querySelectorAll('.grid').forEach(g => g.classList.add('shaking'));
    setTimeout(() => document.querySelectorAll('.grid').forEach(g => g.classList.remove('shaking')), 400);

    const combos = factoryMappableCombos();
    setSelectValue(pairingSelect, randomChoice(PAIRINGS));
    setSelectValue(worldSelect, randomChoice(WORLD_SETTINGS));
    setSelectValue(plotSelect, randomChoice(PLOT_FUNCTIONS));
    setSelectValue(romanceTropeSelect, randomChoice(ROMANCE_TROPES));
    setSelectValue(protagTropeSelect, randomChoice(CHARACTER_TROPES));
    setSelectValue(protagComboSelect, randomChoice(combos));
    setSelectValue(loveTropeSelect, randomChoice(CHARACTER_TROPES));
    setSelectValue(loveComboSelect, randomChoice(combos));
    setSelectValue(antTropeSelect, randomChoice(CHARACTER_TROPES));
    setSelectValue(antComboSelect, randomChoice(combos));
    if (pairingSelect.value === 'yaoi' && yaoiDyadSelect && typeof YAOI_ROLE_DYADS !== 'undefined') {
      setSelectValue(yaoiDyadSelect, randomChoice(YAOI_ROLE_DYADS));
    } else if (yaoiDyadSelect) {
      yaoiDyadSelect.value = '';
    }
  });

  function formatArchetypeBlock(comboKey, { opposition } = {}) {
    const comboName = PERSONALITY_COMBOS[comboKey];
    const [primary, secondary] = String(comboKey).split('+');
    const pSlug = FOUNDATION_TO_ARCHETYPE[primary];
    const sSlug = FOUNDATION_TO_ARCHETYPE[secondary];
    const pBlurb = FOUNDATION_BLURBS[primary] || prettifyKey(primary);
    const sBlurb = FOUNDATION_BLURBS[secondary] || prettifyKey(secondary);
    const usage = opposition
      ? 'These facets color HOW this character opposes (containment, isolation, sabotage, elimination)—not how they love. Do not write romantic yearning toward either lead, and do not redeem them into a third romantic option.'
      : 'These facets color HOW this character loves and defends intimacy. Primary is identity and worldview; secondary is method, texture, and tell.';
    return `- Personality combo: "${comboName}" (${comboKey})
  Directed blend: PRIMARY dominates identity/worldview; SECONDARY colors methods and behavioral texture.
  Primary: ${prettifyKey(primary)} → factory archetype \`${pSlug}\`
    ${pBlurb}
  Secondary: ${prettifyKey(secondary)} → factory archetype \`${sSlug}\`
    ${sBlurb}
  Write the emergent composite, not two stacked stereotypes. Factory maps this to ${pSlug},${sSlug}.
  ${usage}`;
  }

  function buildStoryPrompt(pairing, world, plot, romance, pTrope, pCombo, lTrope, lCombo, aTrope, aCombo, yaoiDyad) {
    const worldName = prettifyKey(world);
    const plotName = prettifyKey(plot);
    const romanceName = prettifyKey(romance);
    const pTropeName = prettifyKey(pTrope);
    const lTropeName = prettifyKey(lTrope);
    const aTropeName = prettifyKey(aTrope);
    const isYaoi = pairing === 'yaoi';
    const pairingBlock = isYaoi
      ? `PAIRING: Yaoi / BL (male/male)
Both the protagonist and the love interest are adult men. Use he/him for both. Do not write the protagonist as a woman or use she/her for either lead.
The antagonist is a first-class adversary, not a romantic lead; their gender may fit the world and is not locked to the pairing.`
      : `PAIRING: Heterosexual (female protagonist + male love interest)
The protagonist is a woman (she/her); the love interest is a man (he/him).
The antagonist is a first-class adversary, not a romantic lead; their gender may fit the world and is not locked to the pairing.`;
    const dyadBlock =
      isYaoi && yaoiDyad && typeof YAOI_ROLE_DYADS !== 'undefined' && YAOI_ROLE_DYADS[yaoiDyad]
        ? `\nROLE DYAD OVERLAY: ${yaoiDyad}\n${YAOI_ROLE_DYADS[yaoiDyad]}\nFilter the romance trope through this pursuit/receptivity dynamic (roles are not genders).\n`
        : '';
    const sameTropeClash =
      aTrope === pTrope || aTrope === lTrope
        ? `\nSame-trope clash: the antagonist shares a character trope with a lead (${aTropeName}). Reject the redeemable/humanized reading of that trope and press toward containing or dispatching the target.\n`
        : '';

    return `You are a creative fiction writer specializing in romance novels. Generate a fun, engaging story summary for a romance novel with the following configuration:

${pairingBlock}
${dyadBlock}
WORLD SETTING: ${worldName}
${WORLD_SETTINGS[world]}

PLOT FUNCTION: ${plotName}
${PLOT_FUNCTIONS[plot]}

ROMANCE TROPE: ${romanceName}
${ROMANCE_TROPES[romance]}

PROTAGONIST:
- Character Trope: ${pTropeName}
  ${CHARACTER_TROPES[pTrope]}
${formatArchetypeBlock(pCombo)}

LOVE INTEREST:
- Character Trope: ${lTropeName}
  ${CHARACTER_TROPES[lTrope]}
${formatArchetypeBlock(lCombo)}

ANTAGONIST (first-class adversary — not a love interest, not a rival-for-the-heart unless the plot function forces proximity):
- Character Trope: ${aTropeName}
  ${CHARACTER_TROPES[aTrope]}
${formatArchetypeBlock(aCombo, { opposition: true })}
${sameTropeClash}
INSTRUCTIONS:
Write a 5-to-6-paragraph story summary (about 600–900 words) that:
1. Sets up the world and introduces both romantic leads in their element, with each personality combo visible in how they occupy space
2. Introduces the antagonist as a distinct pressure — trope role plus personality-in-opposition, with a name and a concrete method
3. Describes the central conflict driven by the plot function and how these two very different people collide
4. Shows how the antagonist complicates, weaponizes, or intercepts that collision (containment / isolation / sabotage — not a third-wheel crush)
5. Teases romantic tension AND adversarial stakes toward a satisfying or hilariously complicated resolution
6. (Optional sixth paragraph) Leaves one unresolved hook that belongs to the antagonist spine, not a generic cliffhanger announcer

Make it fun, vivid, and lean into the absurdity of this particular combination. Give all three characters names that fit the world${isYaoi ? ' (both romantic leads are men)' : ''}. Use the extra length — do not compress three principals into a 300-word blurb. Target 600–900 words.`;
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
    const pairing = pairingSelect.value || 'het';
    const world = worldSelect.value;
    const plot = plotSelect.value;
    const romance = romanceTropeSelect.value;
    const yaoiDyad = (yaoiDyadSelect && pairing === 'yaoi') ? yaoiDyadSelect.value : '';
    const pTrope = protagTropeSelect.value;
    const pCombo = protagComboSelect.value;
    const lTrope = loveTropeSelect.value;
    const lCombo = loveComboSelect.value;
    const aTrope = antTropeSelect.value;
    const aCombo = antComboSelect.value;

    if (!world || !plot || !romance || !pTrope || !pCombo || !lTrope || !lCombo || !aTrope || !aCombo) {
      alert('Please select all options including the antagonist (or hit Randomize) before generating!');
      return;
    }

    if (!isFactoryMappableCombo(pCombo) || !isFactoryMappableCombo(lCombo) || !isFactoryMappableCombo(aCombo)) {
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
      `--antagonist ${shellQuote(aTrope)} ${shellQuote(comboCliToken(aCombo))}`,
    ];
    if (pairing === 'yaoi') {
      parts.push('--pairing yaoi');
      if (yaoiDyad) {
        parts.push(`--yaoi-dyad ${shellQuote(yaoiDyad)}`);
      }
    }

    cliOutput.textContent = parts.join(' ');
    promptOutput.textContent = buildStoryPrompt(
      pairing, world, plot, romance, pTrope, pCombo, lTrope, lCombo, aTrope, aCombo, yaoiDyad
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
