import './theme-review.css';
export { createPreviewStorage, previewState } from './theme-preview.mjs';

const palette = values => ({
  '--cp-bg': values.background,
  '--cp-bg-elevated': values.background,
  '--cp-surface': values.surface,
  '--cp-surface-soft': values.soft,
  '--cp-border': values.border,
  '--cp-border-strong': values.muted,
  '--cp-text': values.text,
  '--cp-text-muted': values.muted,
  '--cp-text-soft': values.muted,
  '--cp-accent': values.accent,
  '--cp-accent-hover': values.hover,
  '--cp-accent-soft': values.tint,
  '--cp-accent-fg': values.accentText,
  '--cp-link': values.secondary,
  '--cp-success': values.secondary,
  '--cp-warning': values.sun,
  '--cp-danger': '#ffb5ad',
  '--cp-overlay': '#090b10d9',
  '--cp-panel-strong': values.header,
  '--cp-highlight': values.tint,
  '--cp-focus': values.focus,
  '--cp-header': values.header,
  '--cp-header-text': values.text,
  '--cp-header-active': values.tint,
  '--cp-header-active-text': values.accent,
  '--cp-header-brand': values.accent,
  '--cp-header-dot': values.secondary,
  '--cp-calorie-surface': values.calorieSurface,
  '--cp-protein-surface': values.proteinSurface,
  '--cp-input-border': values.inputBorder,
  '--cp-meal-0-bg': values.morning,
  '--cp-meal-0-fg': values.sun,
  '--cp-meal-1-bg': values.tint,
  '--cp-meal-1-fg': values.accent,
  '--cp-meal-2-bg': values.proteinSurface,
  '--cp-meal-2-fg': values.secondary,
  '--cp-meal-3-bg': values.evening,
  '--cp-meal-3-fg': values.eveningText,
});

export const themes = [
  {
    id: 'cerise', name: 'Cerise Nocturne', recommended: true,
    swatches: ['#ff8fa3', '#271d25', '#79d9c3', '#efd28b'],
    personality: 'Chaleureuse, complice, enveloppante.',
    fit: 'Un fond cerise très sombre, du rouge fruité lumineux et une menthe fraîche : une identité personnelle et joyeuse, sans effet néon. Mon meilleur équilibre entre douceur et caractère.',
    tradeoff: 'Le rouge éclairci tire vers la framboise. Plus intime que sportive ; moins rouge pur que Rouge Studio.',
    roles: 'Fond cerise noire ; texte blanc rosé ; boutons framboise à texte sombre ; protéines menthe ; repas miel, cerise, menthe et mauve grisé. Focus menthe.',
    tokens: palette({ background: '#191318', surface: '#271d25', soft: '#40313b', border: '#58424f', text: '#f8edf2', muted: '#c9b2c1', accent: '#ff8fa3', hover: '#ffafbc', accentText: '#310c17', tint: '#492633', secondary: '#79d9c3', sun: '#efd28b', focus: '#9af1dc', header: '#24161e', calorieSurface: '#34212d', proteinSurface: '#1c3531', inputBorder: '#9c7e90', morning: '#423723', evening: '#343047', eveningText: '#d5c5ec' }),
  },
  {
    id: 'petrole', name: 'Rouge Pétrole', recommended: true,
    swatches: ['#ff9982', '#10272b', '#82e0cb', '#f3d081'],
    personality: 'Énergique, fraîche, sûre d’elle.',
    fit: 'Le corail rouge réchauffe un pétrole profond. Les touches miel et menthe donnent une énergie sportive, vivante, sans ressembler à un tableau de bord technique.',
    tradeoff: 'Le fond coloré est plus présent au quotidien et le corail penche vers l’orangé. Plus affirmée que Cerise Nocturne.',
    roles: 'Fond pétrole ; texte blanc frais ; boutons corail à texte sombre ; protéines menthe ; repas miel, corail, vert d’eau et bleu. Focus miel.',
    tokens: palette({ background: '#10272b', surface: '#19343a', soft: '#304a4e', border: '#486267', text: '#edf8f5', muted: '#b0cbc8', accent: '#ff9982', hover: '#ffb29f', accentText: '#34150e', tint: '#4a3030', secondary: '#82e0cb', sun: '#f3d081', focus: '#ffe1a0', header: '#112c30', calorieSurface: '#343236', proteinSurface: '#1b4140', inputBorder: '#81a5a3', morning: '#464026', evening: '#263f57', eveningText: '#b5d7fa' }),
  },
  {
    id: 'studio', name: 'Rouge Studio', recommended: false,
    swatches: ['#ff7c85', '#17181a', '#d0d8e7', '#ebcc74'],
    personality: 'Graphique, précise, déterminée.',
    fit: 'Du charbon neutre, un rouge franc et de l’argent : une confiance immédiate. Un esprit studio sportif, sans injonction à la performance.',
    tradeoff: 'La plus nette, mais aussi la plus sérieuse. Moins chaleureuse et spontanée que Cerise Nocturne ou Rouge Pétrole.',
    roles: 'Fond charbon ; texte blanc neutre ; boutons rouges à texte sombre ; protéines argent bleuté ; repas or, rouge, acier et gris. Focus blanc froid.',
    tokens: palette({ background: '#17181a', surface: '#25272b', soft: '#393d44', border: '#50555f', text: '#f2f3f5', muted: '#b9bec8', accent: '#ff7c85', hover: '#ff9fa5', accentText: '#330b13', tint: '#462b33', secondary: '#c0d1ef', sun: '#ebcc74', focus: '#e5eaff', header: '#111214', calorieSurface: '#30252b', proteinSurface: '#2a3240', inputBorder: '#8f959f', morning: '#433a26', evening: '#363940', eveningText: '#d2d6df' }),
  },
  {
    id: 'matcha', name: 'Matcha Minuit', recommended: false,
    swatches: ['#cee58d', '#17271f', '#efb5d0', '#e3c789'],
    personality: 'Naturelle, tendre, optimiste.',
    fit: 'Le vert forêt et le citron doux suggèrent une énergie tranquille. La touche rose ajoute du plaisir et évite une palette entièrement verte.',
    tradeoff: 'Le rouge n’est plus la signature principale. Très apaisante, mais moins fidèle à ton attachement au rouge et au nom Cerise.',
    roles: 'Fond forêt ; texte ivoire clair ; boutons citron à texte sombre ; protéines rose poudré ; repas miel, citron, rose et vert sauge. Focus rose clair.',
    tokens: palette({ background: '#17271f', surface: '#23372c', soft: '#3b4d3b', border: '#53684f', text: '#f1f5e7', muted: '#bdcbae', accent: '#cee58d', hover: '#dfefb1', accentText: '#21300f', tint: '#3b4727', secondary: '#efb5d0', sun: '#e3c789', focus: '#ffd3e7', header: '#132319', calorieSurface: '#303e28', proteinSurface: '#40313d', inputBorder: '#93a68c', morning: '#443c2a', evening: '#2d4945', eveningText: '#a5e1d3' }),
  },
  {
    id: 'cobalt', name: 'Cobalt Après-Minuit', recommended: false,
    swatches: ['#a6c0ff', '#17233c', '#f2c479', '#efacb7'],
    personality: 'Créative, lumineuse, urbaine.',
    fit: 'Un bleu de nuit assumé, éclairé par du cobalt et de l’abricot. Un contraste plus éditorial, qui conserve de la chaleur grâce aux détails dorés.',
    tradeoff: 'La plus éloignée de la signature rouge. Une élégance nocturne, mais un risque d’évoquer une application de productivité plutôt qu’un compagnon personnel.',
    roles: 'Fond bleu nuit ; texte blanc bleuté ; boutons cobalt clair à texte sombre ; protéines abricot ; repas or, bleu, abricot et rose. Focus or clair.',
    tokens: palette({ background: '#17233c', surface: '#22324e', soft: '#344563', border: '#4e6384', text: '#f1f4ff', muted: '#bdcbe5', accent: '#a6c0ff', hover: '#c5d5ff', accentText: '#172950', tint: '#304474', secondary: '#f2c479', sun: '#f2d38d', focus: '#ffe0a2', header: '#1b3057', calorieSurface: '#293c62', proteinSurface: '#3c3536', inputBorder: '#92a8cc', morning: '#494030', evening: '#443449', eveningText: '#efacb7' }),
  },
];

const original = { id: 'original', name: 'Actuelle · claire', swatches: ['#b11f4b', '#0078d4', '#ffffff', '#f7f4ef'], personality: 'Calme, propre, un peu trop sage.', fit: 'Une base lisible et rassurante. Mais le bordeaux discret, les surfaces blanches et le bleu familier des statistiques donnent une impression plus générique que joyeuse ou personnelle.', tradeoff: 'Peu de fatigue visuelle en plein jour ; peu de caractère. Le rouge intervient surtout en petites touches, sans vraiment donner le ton.', roles: 'Blanc et ivoire, texte gris, accent bordeaux, protéines bleues, repas pastel. La référence reste inchangée.', tokens: {} };

export function mountThemeReview({ preview = false, onThemeChange, onExampleChange }) {
  const root = document.documentElement;
  const originalMode = preview ? 'light' : root.getAttribute('data-theme');
  const requestedPalette = new URLSearchParams(location.search).get('palette');
  const initialPalette = [...themes, original].some(theme => theme.id === requestedPalette) ? requestedPalette : preview ? 'cerise' : 'original';
  root.setAttribute('data-color-review', '');
  const panel = document.createElement('section');
  panel.id = 'theme-review';
  panel.setAttribute('aria-label', 'Comparateur de couleurs');
  panel.innerHTML = `<div class="review-inner">
    <div class="review-heading"><strong>Les nuits de Cerise</strong><span>${preview ? 'Bac à sable · journal personnel intact' : 'Ton journal · sur cet appareil'}</span><a id="review-mode-link" href="${preview ? '?' : '?themes'}">${preview ? 'Revenir à mon journal' : 'Essayer les exemples'}</a></div>
    <fieldset class="theme-options"><legend class="sr-only">Palette</legend>${[...themes, original].map(theme => `<label class="theme-option"><input type="radio" name="review-theme" value="${theme.id}" ${theme.id === initialPalette ? 'checked' : ''}><span class="theme-swatch" aria-hidden="true">${theme.swatches.map(color => `<span style="background:${color}"></span>`).join('')}</span><span class="theme-name">${theme.id === 'original' && originalMode === 'dark' ? 'Actuelle · sombre' : theme.name}</span></label>`).join('')}</fieldset>
    ${preview ? '<div class="review-actions"><fieldset class="example-options"><legend class="sr-only">État de démonstration</legend><label><input type="radio" name="review-example" value="populated" checked><span>Exemple rempli</span></label><label><input type="radio" name="review-example" value="empty"><span>Exemple vide</span></label></fieldset><button type="button" id="reset-example" title="Réinitialiser les données fictives">Réinitialiser l’exemple</button></div>' : ''}
    <details class="review-notes"><summary id="review-summary">Avis de direction artistique</summary><div id="review-description" aria-live="polite"></div><p class="review-recommendation"><strong>Mes deux choix :</strong> Cerise Nocturne pour la chaleur et la complicité ; Rouge Pétrole pour une personnalité plus sportive et affirmée. Seules les couleurs varient. Les exemples restent identiques, modifiables et non enregistrés.</p></details>
  </div>`;
  document.querySelector('#app').before(panel);
  const keys = Object.keys(themes[0].tokens);
  const apply = id => {
    const selected = [...themes, original].find(theme => theme.id === id);
    keys.forEach(key => root.style.removeProperty(key));
    root.setAttribute('data-theme', id === 'original' ? originalMode : 'dark');
    Object.entries(selected.tokens).forEach(([key, value]) => root.style.setProperty(key, value));
    root.dataset.palette = selected.id;
    const currentUrl = new URL(location.href);
    currentUrl.searchParams.set('palette', selected.id);
    history.replaceState(null, '', currentUrl);
    const modeUrl = new URL(currentUrl);
    if (preview) modeUrl.searchParams.delete('themes');
    else modeUrl.searchParams.set('themes', '');
    panel.querySelector('#review-mode-link').href = `${modeUrl.pathname}${modeUrl.search}${modeUrl.hash}`;
    panel.querySelector('#review-summary').textContent = `${selected.name} · ${selected.personality}${selected.recommended ? ' Mon choix.' : ''}`;
    panel.querySelector('#review-description').innerHTML = `<p><strong>Pourquoi :</strong> ${selected.fit}</p><p><strong>Compromis :</strong> ${selected.tradeoff}</p><p><strong>Palette complète :</strong> ${selected.roles}</p>`;
    onThemeChange();
  };
  panel.querySelectorAll('[name="review-theme"]').forEach(input => input.addEventListener('change', () => apply(input.value)));
  const setExample = () => onExampleChange(panel.querySelector('[name="review-example"]:checked').value === 'populated');
  panel.querySelectorAll('[name="review-example"]').forEach(input => input.addEventListener('change', setExample));
  panel.querySelector('#reset-example')?.addEventListener('click', setExample);
  apply(initialPalette);
}