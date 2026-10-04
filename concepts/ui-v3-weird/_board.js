// Shared mock state for the four weird/retro concepts. Not part of the game.
// One mid-run moment: summer, a hungry wolf, the hand about to feed it.
(function () {
  const IMG = {
    sprout: '../ui-v2/art/sprout.png', grass: '../ui-v2/art/grass.png', rabbit: '../ui-v2/art/rabbit.png', fox: '../ui-v2/art/fox.png',
    deer: '../../img/deer-calm.png', zebra: '../../img/zebra-calm.png', buffalo: '../../img/buffalo-calm.png',
    wolf: '../../img/wolf-calm.png', wolfHungry: '../../img/wolf-hungry.png', bear: '../../img/bear-calm.png',
    lion: '../../img/lion-calm.png', tiger: '../../img/tiger-calm.png', elephant: '../../img/elephant-calm.png'
  };
  const LADDER = ['sprout', 'grass', 'rabbit', 'fox', 'deer', 'zebra', 'buffalo', 'wolf', 'bear', 'lion', 'tiger', 'elephant'];
  const B = [
    'wolf!', 'buffalo', 'zebra', 'deer', null,
    null, 'rabbit', 'fox', 'grass', 'sprout',
    'stone', 'grass', null, null, 'rabbit',
    null, null, 'sprout', null, null,
    null, null, null, 'grass', null
  ];
  const PREVIEW = { 5: 'rabbit' };   // placing the grass here would chain
  window.MOCK = { IMG: IMG, LADDER: LADDER, top: 'wolf' };

  window.drawBoard = function (el) {
    B.forEach(function (k, i) {
      const c = document.createElement('div');
      c.className = 'cell';
      if (k === 'stone') { c.classList.add('is-stone'); c.innerHTML = '<span class="stone"></span>'; }
      else if (k) {
        const hungry = k.slice(-1) === '!';
        const kind = hungry ? k.slice(0, -1) : k;
        c.classList.add('has', 'k-' + kind);
        if (hungry) c.classList.add('is-hungry');
        const img = document.createElement('img');
        img.src = hungry ? IMG.wolfHungry : IMG[kind];
        img.alt = kind;
        c.appendChild(img);
      } else if (PREVIEW[i]) {
        c.classList.add('is-preview');
        const img = document.createElement('img');
        img.src = IMG[PREVIEW[i]];
        img.alt = '';
        c.appendChild(img);
      }
      el.appendChild(c);
    });
  };

  window.drawLadder = function (el, withNames) {
    const top = LADDER.indexOf(window.MOCK.top);
    LADDER.forEach(function (k, n) {
      const s = document.createElement('span');
      s.className = 'rung' + (n <= top ? ' is-done' : '') + (n === top + 1 ? ' is-next' : '');
      s.innerHTML = '<img src="' + IMG[k] + '" alt="' + k + '">' + (withNames ? '<b>' + k + '</b>' : '');
      el.appendChild(s);
    });
  };
})();
