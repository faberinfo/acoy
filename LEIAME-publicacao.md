# Site institucional Acoy: como publicar

## O que tem aqui
- `index.html` e `assets/`: o site (estático, sem build).
- `api/`: Azure Function `POST /api/contato`, que envia o formulário para contato@acoy.com.br pelo Microsoft Graph (M365).
- `staticwebapp.config.json`: rotas e cabeçalhos de segurança (CSP, HSTS etc.).

## Por que Azure Static Web Apps + Graph (e não PHP)
- O Static Web Apps hospeda o HTML e roda a função do formulário no mesmo recurso. O plano Free atende.
- PHP exigiria um App Service pago e envio por SMTP com usuário e senha. A Microsoft está desligando a autenticação básica de SMTP no Exchange Online, então esse caminho tende a quebrar.
- Pelo Graph, a função usa um app do Entra ID com segredo guardado na configuração da Azure. Nenhuma senha de caixa postal fica no código.

## Passo a passo

### 1. Caixa contato@acoy.com.br
Precisa existir no M365. Pode ser **caixa compartilhada** (não consome licença).

### 2. App no Entra ID
1. Entra ID > Registros de aplicativo > Novo registro: `site-acoy-contato` (single tenant, sem redirect).
2. Permissões de API > Microsoft Graph > **Permissões de aplicativo** > `Mail.Send` > Conceder consentimento de administrador.
3. Certificados e segredos > Novo segredo do cliente (validade 12 ou 24 meses; anote a data para renovar).
4. Anote: ID do diretório (tenant), ID do aplicativo (client) e o valor do segredo.

### 3. Restringir o app a uma única caixa (importante)
Sem isso, `Mail.Send` de aplicativo pode enviar como qualquer caixa da empresa. No PowerShell do Exchange Online:

```powershell
Connect-ExchangeOnline
New-DistributionGroup -Name "SiteContatoRemetentes" -Type Security -PrimarySmtpAddress site-contato-remetentes@acoy.com.br
Add-DistributionGroupMember -Identity "SiteContatoRemetentes" -Member contato@acoy.com.br
New-ApplicationAccessPolicy -AppId <CLIENT_ID> -PolicyScopeGroupId site-contato-remetentes@acoy.com.br -AccessRight RestrictAccess -Description "Site: só envia como contato@"
Test-ApplicationAccessPolicy -AppId <CLIENT_ID> -Identity contato@acoy.com.br   # deve dar Granted
Test-ApplicationAccessPolicy -AppId <CLIENT_ID> -Identity fabiano@acoy.com.br   # deve dar Denied
```

(Alternativa mais nova da Microsoft: "RBAC for Applications" no Exchange Online, com escopo de gerenciamento na caixa contato@.)

### 4. Criar o Static Web App
1. Portal Azure > Static Web Apps > Criar. Plano Free, região East US 2.
2. Origem: GitHub (repositório do site) ou "Outro" para publicar com a CLI.
3. Build: `App location` = `/`, `Api location` = `api`, `Output location` vazio.
   - Pela CLI: `npm i -g @azure/static-web-apps-cli` e `swa deploy . --api-location api --env production`.

### 5. Variáveis de ambiente
Static Web App > Configurações > Variáveis de ambiente:

| Nome | Valor |
|---|---|
| GRAPH_TENANT_ID | ID do diretório |
| GRAPH_CLIENT_ID | ID do aplicativo |
| GRAPH_CLIENT_SECRET | segredo do passo 2 |
| MAIL_FROM | contato@acoy.com.br |
| MAIL_TO | contato@acoy.com.br |
| ALLOWED_ORIGINS | https://acoy.com.br,https://www.acoy.com.br |

### 6. Domínio
Static Web App > Domínios personalizados > adicionar `www.acoy.com.br` (CNAME) e `acoy.com.br` (TXT de validação + ALIAS/CNAME flattening na Cloudflare). Testar primeiro no endereço `*.azurestaticapps.net`.

### 7. Teste
Enviar o formulário pela URL de teste e conferir se chegou em contato@ com "Responder" apontando para o e-mail do visitante.

## Proteção contra spam já incluída
Campo isca escondido, tempo mínimo de 3 s para enviar, limite de 5 envios por IP a cada 10 min, validação e tamanho máximo dos campos, e verificação de origem. Se aparecer spam mesmo assim, o próximo passo é o Cloudflare Turnstile (gratuito).
