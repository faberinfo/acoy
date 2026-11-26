// Recebe o formulário do site e envia um e-mail para contato@acoy.com.br
// pelo Microsoft Graph (M365), usando um app registrado no Entra ID.
//
// Variáveis de ambiente (configurar no Static Web App > Configuração):
//   GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET
//   MAIL_FROM  caixa que envia (ex.: contato@acoy.com.br)
//   MAIL_TO    quem recebe (padrão: o mesmo MAIL_FROM)
//   ALLOWED_ORIGINS  opcional, ex.: https://acoy.com.br,https://www.acoy.com.br

const { app } = require('@azure/functions');

const LIMITES = { nome: 120, empresa: 160, email: 160, telefone: 40, mensagem: 3000 };
const TEMPO_MINIMO_MS = 3000; // robôs costumam enviar o formulário em menos de 3 s

// Limite simples por IP, em memória (cada instância tem o seu; serve contra rajadas)
const acessos = new Map();
function excedeuLimite(ip) {
  const agora = Date.now();
  const janela = 10 * 60 * 1000;
  const lista = (acessos.get(ip) || []).filter((t) => agora - t < janela);
  lista.push(agora);
  acessos.set(ip, lista);
  return lista.length > 5;
}

let tokenCache = { valor: null, expira: 0 };
async function obterToken() {
  if (tokenCache.valor && Date.now() < tokenCache.expira - 60000) return tokenCache.valor;
  const url = `https://login.microsoftonline.com/${process.env.GRAPH_TENANT_ID}/oauth2/v2.0/token`;
  const corpo = new URLSearchParams({
    client_id: process.env.GRAPH_CLIENT_ID,
    client_secret: process.env.GRAPH_CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });
  const r = await fetch(url, { method: 'POST', body: corpo });
  if (!r.ok) throw new Error(`token ${r.status}`);
  const j = await r.json();
  tokenCache = { valor: j.access_token, expira: Date.now() + j.expires_in * 1000 };
  return j.access_token;
}

function limpar(valor, max) {
  return String(valor || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);
}

app.http('contato', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'contato',
  handler: async (req, ctx) => {
    const resp = (status, ok) => ({ status, jsonBody: { ok } });

    const origem = req.headers.get('origin');
    const permitidas = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (permitidas.length && origem && !permitidas.includes(origem)) return resp(403, false);

    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'desconhecido';
    if (excedeuLimite(ip)) return resp(429, false);

    let d;
    try { d = await req.json(); } catch { return resp(400, false); }

    // Isca e tempo mínimo: finge sucesso para não dar pista ao robô
    if (d.site || Number(d.tempo) < TEMPO_MINIMO_MS) return resp(200, true);

    const dados = {};
    for (const [campo, max] of Object.entries(LIMITES)) dados[campo] = limpar(d[campo], max);
    const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email);
    if (!dados.nome || !dados.empresa || !emailValido) return resp(400, false);

    const de = process.env.MAIL_FROM;
    const para = process.env.MAIL_TO || de;
    const texto = [
      'Nova mensagem pelo site acoy.com.br',
      '',
      `Nome: ${dados.nome}`,
      `Empresa: ${dados.empresa}`,
      `E-mail: ${dados.email}`,
      `Telefone: ${dados.telefone || '-'}`,
      '',
      'Mensagem:',
      dados.mensagem || '(sem mensagem)',
    ].join('\n');

    try {
      const token = await obterToken();
      const r = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(de)}/sendMail`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            subject: `Site: contato de ${dados.empresa}`.slice(0, 200),
            body: { contentType: 'Text', content: texto },
            toRecipients: [{ emailAddress: { address: para } }],
            replyTo: [{ emailAddress: { address: dados.email, name: dados.nome } }],
          },
          saveToSentItems: false,
        }),
      });
      if (r.status !== 202) throw new Error(`sendMail ${r.status}`);
      return resp(200, true);
    } catch (err) {
      ctx.error('Falha ao enviar contato:', err.message);
      return resp(502, false);
    }
  },
});
