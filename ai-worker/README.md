# Servidor da inteligência do Radar Seguro RJ Pro

Este Cloudflare Worker protege a chave do Gemini e aceita chamadas somente da origem pública do Radar Seguro RJ Pro.

## Segurança

- A chave nunca deve ser escrita em `index.html`, `wrangler.toml`, `.dev.vars` versionado ou no GitHub.
- O segredo de produção deve ser cadastrado diretamente no Cloudflare com o nome `GEMINI_API_KEY`.
- O endpoint limita cada instalação a 20 perguntas por minuto.
- O aplicativo deve enviar apenas a pergunta e o histórico curto. GPS, endereço residencial e credenciais não devem ser enviados.
- O aplicativo público ainda não chama este servidor. A integração só deve ser ligada depois do teste do endereço publicado.

## Publicação

Dentro desta pasta:

```sh
npm install
npx wrangler login
npx wrangler secret put GEMINI_API_KEY
npm run deploy
```

Depois da publicação, testar:

```text
https://radar-seguro-rj-ai.<conta>.workers.dev/health
```

O resultado deve mostrar `configured: true`. A chave nunca aparece na resposta.
