# SDS CRM Online

Versão web gratuita, sem dependências e pronta para publicar no GitHub Pages.

## Executar localmente

Na pasta do projeto:

```powershell
python -m http.server 8080
```

Abra `http://localhost:8080`.

## Publicar gratuitamente

1. Crie um repositório público no GitHub chamado `sds-crm-online`.
2. Envie `index.html`, `styles.css`, `app.js` e `README.md`.
3. Em **Settings > Pages**, escolha a branch `main` e a pasta `/root`.
4. O GitHub fornecerá um endereço público.

Os dados importados ficam salvos no navegador com `localStorage`. O botão **Conectar Google Sheets** lê a aba atualmente selecionada da planilha por link público e atualiza os clientes do CRM. Para funcionar, configure no Google Sheets: **Compartilhar → Qualquer pessoa com o link → Leitor**. Cada navegador precisa conectar o mesmo link; a sincronização de alterações é feita ao clicar novamente no botão.
