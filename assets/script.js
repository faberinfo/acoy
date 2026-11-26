(function () {
  // Topo muda de cor ao rolar
  var topo = document.getElementById('topo');
  function aoRolar() { topo.classList.toggle('rolou', window.scrollY > 24); }
  aoRolar();
  window.addEventListener('scroll', aoRolar, { passive: true });

  // Menu no celular
  var botao = document.querySelector('.topo__menu');
  var menu = document.getElementById('menu-movel');
  function fecharMenu() { menu.hidden = true; botao.setAttribute('aria-expanded', 'false'); }
  botao.addEventListener('click', function () {
    var abrir = menu.hidden;
    menu.hidden = !abrir;
    botao.setAttribute('aria-expanded', String(abrir));
    if (abrir) topo.classList.add('rolou'); else aoRolar();
  });
  menu.addEventListener('click', function (e) { if (e.target.tagName === 'A') { fecharMenu(); aoRolar(); } });

  // Ano no rodapé
  document.getElementById('ano').textContent = new Date().getFullYear();

  // Entrada suave dos blocos
  var alvos = document.querySelectorAll('.secao h2, .comp, .rec, .passos li, .condicoes, .form, .num');
  if ('IntersectionObserver' in window) {
    var obs = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('visivel'); obs.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    alvos.forEach(function (el) { el.classList.add('revela'); obs.observe(el); });
  }

  // Formulário: envia para a Azure Function em /api/contato
  var form = document.getElementById('form-contato');
  var aviso = document.getElementById('form-aviso');
  var botaoEnviar = form.querySelector('button[type="submit"]');
  var abertoEm = Date.now();
  function avisar(texto, tipo) { aviso.textContent = texto; aviso.className = 'form__aviso ' + (tipo || ''); }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var ok = true;
    form.querySelectorAll('[required]').forEach(function (campo) {
      var valido = campo.value.trim() !== '' && (campo.type !== 'email' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(campo.value.trim()));
      campo.setAttribute('aria-invalid', String(!valido));
      if (!valido) ok = false;
    });
    if (!ok) { avisar('Preencha nome, empresa e um e-mail válido.', 'erro'); return; }

    var d = new FormData(form);
    var dados = {
      nome: d.get('nome'), empresa: d.get('empresa'), email: d.get('email'),
      telefone: d.get('telefone'), mensagem: d.get('mensagem'),
      site: d.get('site'), tempo: Date.now() - abertoEm
    };
    botaoEnviar.disabled = true;
    avisar('Enviando...');
    fetch(form.action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    }).then(function (r) {
      if (!r.ok) {
        return r.text().then(function (t) {
          if (window.console) console.warn('Formulário /api/contato:', r.status, t.slice(0, 300));
          throw new Error('status ' + r.status);
        });
      }
      form.reset();
      avisar('Mensagem enviada. Em breve alguém da Acoy fala com você.', 'ok');
    }).catch(function () {
      avisar('Não conseguimos enviar agora. Escreva para contato@acoy.com.br que respondemos por lá.', 'erro');
    }).finally(function () { botaoEnviar.disabled = false; });
  });
})();
