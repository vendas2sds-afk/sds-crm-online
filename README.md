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

O CRM inicia sem login. Os dados importados ficam salvos no navegador com `localStorage`. A planilha padrão do SDS CRM é carregada automaticamente ao abrir o sistema; o botão **Conectar Google Sheets** permite trocar o link. Para funcionar, configure no Google Sheets: **Compartilhar → Qualquer pessoa com o link → Leitor**.

O CRM não possui agenda interna nem integração com o Google Agenda. O botão **Conectar Google Sheets** carrega a planilha compartilhada usada como base de clientes.
